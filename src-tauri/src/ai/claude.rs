//! Anthropic Claude API client implementation

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

use crate::ai::client::{AIServiceClient, HttpConfig, RateLimitStatus, utils};
use crate::ai::types::*;
use crate::error::{Error, Result};

/// Claude API client
#[derive(Clone)]
pub struct ClaudeClient {
    client: reqwest::Client,
    config: AIServiceConfig,
    http_config: HttpConfig,
    base_url: String,
}

impl ClaudeClient {
    /// Create a new Claude client
    pub fn new(config: AIServiceConfig) -> Result<Self> {
        let http_config = HttpConfig::default();
        let client = utils::create_http_client(&http_config)?;
        
        let base_url = config.base_url
            .clone()
            .unwrap_or_else(|| "https://api.anthropic.com".to_string());
        
        Ok(Self {
            client,
            config,
            http_config,
            base_url,
        })
    }
    
    /// Create headers for Claude API requests
    fn create_headers(&self) -> Result<HeaderMap> {
        let mut headers = HeaderMap::new();
        
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        
        let auth_value = self.config.api_key.expose_secret();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(auth_value)
                .map_err(|e| Error::Configuration {
                    message: "Invalid API key format".to_string(),
                    source: Some(Box::new(e)),
                })?,
        );
        
        Ok(headers)
    }
    
    /// Make a message request to Claude
    async fn create_message(&self, request: &MessageRequest) -> Result<MessageResponse> {
        let url = format!("{}/v1/messages", self.base_url);
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
                        return response.json::<MessageResponse>().await
                            .map_err(|e| Error::AIService {
                                provider: "claude".to_string(),
                                message: format!("Failed to parse response: {}", e),
                                source: Some(Box::new(e)),
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
                            provider: "claude".to_string(),
                            message: format!("API request failed with status {}: {}", status, error_text),
                            source: None,
                        });
                    }
                }
                Err(e) => {
                    last_error = Some(Error::AIService {
                        provider: "claude".to_string(),
                        message: format!("Request failed: {}", e),
                        source: Some(Box::new(e)),
                    });
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| Error::AIService {
            provider: "claude".to_string(),
            message: "Max retries exceeded".to_string(),
            source: None,
        }))
    }
}

#[async_trait]
impl AIServiceClient for ClaudeClient {
    async fn summarize(&self, operation: &AIOperation) -> Result<SummaryResult> {
        let start_time = Instant::now();
        
        // Prepare the prompt based on template and input
        let system_prompt = operation.template.as_deref().unwrap_or(
            "You are an AI assistant that creates concise, well-structured meeting summaries. \
             Extract key points, decisions, action items, and important insights from the transcription. \
             Format your response in clear sections with bullet points where appropriate."
        );
        
        let user_message = format!(
            "Please summarize the following meeting transcription:\n\n{}",
            operation.input_text
        );
        
        let request = MessageRequest {
            model: self.config.model.clone(),
            max_tokens: operation.max_output_tokens.unwrap_or(1000),
            system: Some(system_prompt.to_string()),
            messages: vec![
                Message {
                    role: "user".to_string(),
                    content: user_message,
                },
            ],
            temperature: Some(0.3), // Lower temperature for more consistent summaries
            top_p: Some(1.0),
            top_k: Some(40),
        };
        
        let response = self.create_message(&request).await?;
        
        let processing_time = start_time.elapsed().as_millis() as u64;
        
        let content = response.content
            .first()
            .and_then(|content_block| {
                if content_block.content_type == "text" {
                    Some(content_block.text.clone())
                } else {
                    None
                }
            })
            .ok_or_else(|| Error::AIService {
                provider: "claude".to_string(),
                message: "No text content in response".to_string(),
                source: None,
            })?;
        
        // Calculate cost based on usage
        let cost_usd = calculate_claude_cost(
            &self.config.model,
            response.usage.input_tokens,
            response.usage.output_tokens,
        );
        
        Ok(SummaryResult {
            id: Uuid::new_v4(),
            meeting_id: Uuid::new_v4(), // This will be set by the caller
            template_id: None, // This will be set by the caller if applicable
            content,
            model_used: self.config.model.clone(),
            provider: AIProvider::Claude,
            cost_usd,
            processing_time_ms: processing_time,
            token_count: Some(response.usage.input_tokens + response.usage.output_tokens),
            confidence_score: Some(0.9), // Generally high confidence for Claude
            created_at: chrono::Utc::now(),
        })
    }
    
    fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimate> {
        let input_tokens = utils::estimate_tokens(&operation.input_text);
        let template_tokens = operation.template
            .as_ref()
            .map(|t| utils::estimate_tokens(t))
            .unwrap_or(150); // Default system prompt tokens for Claude
        
        let total_input_tokens = input_tokens + template_tokens;
        let estimated_output_tokens = operation.max_output_tokens.unwrap_or(1000);
        
        let estimated_cost = calculate_claude_cost(
            &self.config.model,
            total_input_tokens,
            estimated_output_tokens,
        );
        
        Ok(CostEstimate {
            provider: AIProvider::Claude,
            model: self.config.model.clone(),
            operation_type: operation.operation_type.clone(),
            estimated_input_tokens: total_input_tokens,
            estimated_output_tokens,
            estimated_cost_usd: estimated_cost,
            confidence: 0.85, // High confidence in estimation for Claude
        })
    }
    
    fn get_provider(&self) -> AIProvider {
        AIProvider::Claude
    }
    
    fn get_model(&self) -> &str {
        &self.config.model
    }
    
    async fn health_check(&self) -> Result<bool> {
        // Claude doesn't have a simple health check endpoint, so we'll make a minimal message request
        let test_request = MessageRequest {
            model: self.config.model.clone(),
            max_tokens: 1,
            system: Some("Respond with 'OK'.".to_string()),
            messages: vec![
                Message {
                    role: "user".to_string(),
                    content: "Health check".to_string(),
                },
            ],
            temperature: Some(0.0),
            top_p: Some(1.0),
            top_k: Some(1),
        };
        
        match self.create_message(&test_request).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    async fn get_rate_limit_status(&self) -> Result<RateLimitStatus> {
        // Claude rate limits are typically returned in response headers
        // We'll make a minimal request to check current status
        let test_request = MessageRequest {
            model: self.config.model.clone(),
            max_tokens: 1,
            system: Some("Rate limit check".to_string()),
            messages: vec![
                Message {
                    role: "user".to_string(),
                    content: "Check".to_string(),
                },
            ],
            temperature: Some(0.0),
            top_p: Some(1.0),
            top_k: Some(1),
        };
        
        let url = format!("{}/v1/messages", self.base_url);
        let headers = self.create_headers()?;
        
        match self.client
            .post(&url)
            .headers(headers)
            .json(&test_request)
            .send()
            .await
        {
            Ok(response) => {
                Ok(utils::parse_rate_limit_headers(response.headers()))
            }
            Err(e) => Err(Error::AIService {
                provider: "claude".to_string(),
                message: format!("Failed to get rate limit status: {}", e),
                source: Some(Box::new(e)),
            }),
        }
    }
}

/// Calculate cost for Claude API usage
fn calculate_claude_cost(model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
    // Pricing as of 2024 (per 1M tokens for Claude 3)
    let (input_cost_per_1m, output_cost_per_1m) = match model {
        "claude-3-opus-20240229" => (15.0, 75.0),
        "claude-3-sonnet-20240229" => (3.0, 15.0),
        "claude-3-haiku-20240307" => (0.25, 1.25),
        "claude-3-5-sonnet-20241022" => (3.0, 15.0),
        _ => (3.0, 15.0), // Default to Sonnet pricing
    };
    
    let input_cost = (input_tokens as f64 / 1_000_000.0) * input_cost_per_1m;
    let output_cost = (output_tokens as f64 / 1_000_000.0) * output_cost_per_1m;
    
    input_cost + output_cost
}

// Claude API data structures

#[derive(Debug, Serialize)]
struct MessageRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    content: Vec<ContentBlock>,
    usage: Usage,
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    input_tokens: u32,
    output_tokens: u32,
}