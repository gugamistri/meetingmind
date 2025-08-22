//! OpenAI API client implementation

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

use crate::ai::client::{AIServiceClient, HttpConfig, RateLimitStatus, utils};
use crate::ai::types::*;
use crate::error::{Error, Result};

/// OpenAI API client
#[derive(Clone)]
pub struct OpenAIClient {
    client: reqwest::Client,
    config: AIServiceConfig,
    http_config: HttpConfig,
    base_url: String,
}

impl OpenAIClient {
    /// Create a new OpenAI client
    pub fn new(config: AIServiceConfig) -> Result<Self> {
        let http_config = HttpConfig::default();
        let client = utils::create_http_client(&http_config)?;
        
        let base_url = config.base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
        
        Ok(Self {
            client,
            config,
            http_config,
            base_url,
        })
    }
    
    /// Create headers for OpenAI API requests
    fn create_headers(&self) -> Result<HeaderMap> {
        let mut headers = HeaderMap::new();
        
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        
        let auth_value = format!("Bearer {}", self.config.api_key.expose_secret());
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_value)
                .map_err(|e| Error::Configuration {
                    message: "Invalid API key format".to_string(),
                    source: Some(Box::new(e)),
                })?,
        );
        
        Ok(headers)
    }
    
    /// Make a chat completion request to OpenAI
    async fn chat_completion(&self, request: &ChatCompletionRequest) -> Result<ChatCompletionResponse> {
        let url = format!("{}/chat/completions", self.base_url);
        let headers = self.create_headers()?;
        
        let mut last_error = None;
        
        for attempt in 0..=self.http_config.max_retries {
            if attempt > 0 {
                utils::exponential_backoff(attempt, self.http_config.retry_delay_ms).await;
            }
            
            match self.client
                .post(&url)
                .headers(headers.clone())
                .json(request)
                .send()
                .await
            {
                Ok(response) => {
                    let status = response.status();
                    let rate_limit = utils::parse_rate_limit_headers(response.headers());
                    
                    if status.is_success() {
                        return response.json::<ChatCompletionResponse>().await
                            .map_err(|e| Error::AIService {
                                provider: "openai".to_string(),
                                message: format!("Failed to parse response: {}", e),
                                source: Some(e.into()),
                            });
                    } else if status == 429 {
                        // Rate limited, wait and retry
                        if let Some(retry_after) = rate_limit.retry_after_seconds {
                            tokio::time::sleep(std::time::Duration::from_secs(retry_after)).await;
                        }
                        continue;
                    } else {
                        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                        last_error = Some(Error::AIService {
                            provider: "openai".to_string(),
                            message: format!("API request failed with status {}: {}", status, error_text),
                            source: None,
                        });
                    }
                }
                Err(e) => {
                    last_error = Some(Error::AIService {
                        provider: "openai".to_string(),
                        message: format!("Request failed: {}", e),
                        source: Some(e.into()),
                    });
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| Error::AIService {
            provider: "openai".to_string(),
            message: "Max retries exceeded".to_string(),
            source: None,
        }))
    }
}

#[async_trait]
impl AIServiceClient for OpenAIClient {
    async fn summarize(&self, operation: &AIOperation) -> Result<SummaryResult> {
        let start_time = Instant::now();
        
        // Prepare the prompt based on template and input
        let system_prompt = operation.template.as_deref().unwrap_or(
            "You are an AI assistant that creates concise, well-structured meeting summaries. \
             Extract key points, decisions, action items, and important insights from the transcription."
        );
        
        let user_prompt = format!(
            "Please summarize the following meeting transcription:\n\n{}",
            operation.input_text
        );
        
        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            max_tokens: operation.max_output_tokens.or(Some(1000)),
            temperature: Some(0.3), // Lower temperature for more consistent summaries
            top_p: Some(1.0),
            frequency_penalty: Some(0.0),
            presence_penalty: Some(0.0),
        };
        
        let response = self.chat_completion(&request).await?;
        
        let processing_time = start_time.elapsed().as_millis() as u64;
        
        let content = response.choices
            .first()
            .map(|choice| choice.message.content.clone())
            .ok_or_else(|| Error::AIService {
                provider: "openai".to_string(),
                message: "No content in response".to_string(),
                source: None,
            })?;
        
        // Calculate cost based on usage
        let cost_usd = if let Some(ref usage) = response.usage {
            calculate_openai_cost(&self.config.model, usage.prompt_tokens, usage.completion_tokens)
        } else {
            0.0
        };
        
        Ok(SummaryResult {
            id: Uuid::new_v4(),
            meeting_id: Uuid::new_v4(), // This will be set by the caller
            template_id: None, // This will be set by the caller if applicable
            content,
            model_used: self.config.model.clone(),
            provider: AIProvider::OpenAI,
            cost_usd,
            processing_time_ms: processing_time,
            token_count: response.usage.map(|u| u.total_tokens),
            confidence_score: Some(0.85), // Default confidence for OpenAI
            created_at: chrono::Utc::now(),
        })
    }
    
    fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimate> {
        let input_tokens = utils::estimate_tokens(&operation.input_text);
        let template_tokens = operation.template
            .as_ref()
            .map(|t| utils::estimate_tokens(t))
            .unwrap_or(100); // Default system prompt tokens
        
        let total_input_tokens = input_tokens + template_tokens;
        let estimated_output_tokens = operation.max_output_tokens.unwrap_or(1000);
        
        let estimated_cost = calculate_openai_cost(
            &self.config.model,
            total_input_tokens,
            estimated_output_tokens,
        );
        
        Ok(CostEstimate {
            provider: AIProvider::OpenAI,
            model: self.config.model.clone(),
            operation_type: operation.operation_type.clone(),
            estimated_input_tokens: total_input_tokens,
            estimated_output_tokens,
            estimated_cost_usd: estimated_cost,
            confidence: 0.8, // Moderate confidence in estimation
        })
    }
    
    fn get_provider(&self) -> AIProvider {
        AIProvider::OpenAI
    }
    
    fn get_model(&self) -> &str {
        &self.config.model
    }
    
    async fn health_check(&self) -> Result<bool> {
        let url = format!("{}/models", self.base_url);
        let headers = self.create_headers()?;
        
        match self.client
            .get(&url)
            .headers(headers)
            .send()
            .await
        {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
    
    async fn get_rate_limit_status(&self) -> Result<RateLimitStatus> {
        // For OpenAI, we need to make a minimal request to get rate limit info
        let url = format!("{}/models", self.base_url);
        let headers = self.create_headers()?;
        
        match self.client
            .get(&url)
            .headers(headers)
            .send()
            .await
        {
            Ok(response) => {
                Ok(utils::parse_rate_limit_headers(response.headers()))
            }
            Err(e) => Err(Error::AIService {
                provider: "openai".to_string(),
                message: format!("Failed to get rate limit status: {}", e),
                source: Some(Box::new(e)),
            }),
        }
    }
}

/// Calculate cost for OpenAI API usage
fn calculate_openai_cost(model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
    // Pricing as of 2024 (per 1K tokens)
    let (input_cost_per_1k, output_cost_per_1k) = match model {
        "gpt-4" | "gpt-4-0613" => (0.03, 0.06),
        "gpt-4-turbo" | "gpt-4-turbo-preview" => (0.01, 0.03),
        "gpt-4o" => (0.005, 0.015),
        "gpt-3.5-turbo" => (0.0015, 0.002),
        _ => (0.01, 0.03), // Default to gpt-4-turbo pricing
    };
    
    let input_cost = (input_tokens as f64 / 1000.0) * input_cost_per_1k;
    let output_cost = (output_tokens as f64 / 1000.0) * output_cost_per_1k;
    
    input_cost + output_cost
}

// OpenAI API data structures

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    presence_penalty: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}