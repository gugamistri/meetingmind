//! Template system for customizable meeting summaries

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use regex::Regex;

use crate::ai::types::{SummaryTemplate, MeetingType};
use crate::error::Result;
use crate::storage::repositories::summary::TemplateRepository;

/// Template manager for handling summary templates
pub struct TemplateManager {
    repository: TemplateRepository,
}

impl TemplateManager {
    /// Create a new template manager
    pub fn new(repository: TemplateRepository) -> Self {
        Self { repository }
    }
    
    /// Create a new template
    pub async fn create_template(
        &self,
        name: String,
        description: Option<String>,
        prompt_template: String,
        meeting_type: MeetingType,
        is_default: bool,
    ) -> Result<i64> {
        // Validate template
        self.validate_template(&prompt_template)?;
        
        let template = SummaryTemplate {
            id: 0, // Will be assigned by database
            name,
            description,
            prompt_template,
            meeting_type,
            is_default,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        self.repository.create_template(&template).await
    }
    
    /// Get a template by ID
    pub async fn get_template(&self, id: i64) -> Result<Option<SummaryTemplate>> {
        self.repository.get_template_by_id(id).await
    }
    
    /// Get all templates
    pub async fn get_all_templates(&self) -> Result<Vec<SummaryTemplate>> {
        self.repository.get_all_templates().await
    }
    
    /// Get templates by meeting type
    pub async fn get_templates_by_type(&self, meeting_type: MeetingType) -> Result<Vec<SummaryTemplate>> {
        self.repository.get_templates_by_type(meeting_type).await
    }
    
    /// Get default template for a meeting type
    pub async fn get_default_template(&self, meeting_type: MeetingType) -> Result<Option<SummaryTemplate>> {
        self.repository.get_default_template(meeting_type).await
    }
    
    /// Update a template
    pub async fn update_template(&self, template: SummaryTemplate) -> Result<()> {
        self.validate_template(&template.prompt_template)?;
        
        let mut updated_template = template;
        updated_template.updated_at = Utc::now();
        
        self.repository.update_template(&updated_template).await
    }
    
    /// Delete a template
    pub async fn delete_template(&self, id: i64) -> Result<()> {
        self.repository.delete_template(id).await
    }
    
    /// Process a template with context variables
    pub async fn process_template(
        &self,
        template: &SummaryTemplate,
        context: &TemplateContext,
    ) -> Result<String> {
        let mut processed = template.prompt_template.clone();
        
        // Replace context variables
        processed = self.replace_variables(&processed, context)?;
        
        // Clean up any remaining placeholders
        processed = self.clean_unused_placeholders(&processed);
        
        Ok(processed)
    }
    
    /// Preview a template with sample context
    pub async fn preview_template(
        &self,
        template: &SummaryTemplate,
        sample_context: Option<&TemplateContext>,
    ) -> Result<TemplatePreview> {
        let default_context = self.get_sample_context();
        let context = sample_context.unwrap_or(&default_context);
        
        let processed = self.process_template(template, context).await?;
        let variables = self.extract_variables(&template.prompt_template);
        
        Ok(TemplatePreview {
            original: template.prompt_template.clone(),
            processed,
            variables,
            context: context.clone(),
        })
    }
    
    /// Validate template syntax and structure
    fn validate_template(&self, template: &str) -> Result<()> {
        // Check for basic structure
        if template.trim().is_empty() {
            return Err(crate::error::Error::Configuration {
                message: "Template cannot be empty".to_string(),
                source: None,
            });
        }
        
        // Check for balanced variables
        let open_count = template.matches("{{").count();
        let close_count = template.matches("}}").count();
        
        if open_count != close_count {
            return Err(crate::error::Error::Configuration {
                message: "Unbalanced template variables ({{ and }})".to_string(),
                source: None,
            });
        }
        
        // Validate variable names
        let variables = self.extract_variables(template);
        for var in variables {
            if !self.is_valid_variable_name(&var) {
                return Err(crate::error::Error::Configuration {
                    message: format!("Invalid variable name: {}", var),
                    source: None,
                });
            }
        }
        
        Ok(())
    }
    
    /// Extract variable names from template
    fn extract_variables(&self, template: &str) -> Vec<String> {
        let re = Regex::new(r"\{\{([^}]+)\}\}").unwrap();
        re.captures_iter(template)
            .map(|cap| cap[1].trim().to_string())
            .collect()
    }
    
    /// Check if variable name is valid
    fn is_valid_variable_name(&self, name: &str) -> bool {
        let valid_vars = [
            "meeting_title", "meeting_duration", "meeting_date",
            "participants", "participant_count", "transcription_length",
            "meeting_type", "organizer", "summary_length_preference"
        ];
        valid_vars.contains(&name)
    }
    
    /// Replace variables in template with context values
    fn replace_variables(&self, template: &str, context: &TemplateContext) -> Result<String> {
        let mut result = template.to_string();
        
        // Replace each context variable
        if let Some(title) = &context.meeting_title {
            result = result.replace("{{meeting_title}}", title);
        }
        
        if let Some(duration) = &context.meeting_duration {
            result = result.replace("{{meeting_duration}}", duration);
        }
        
        if let Some(date) = &context.meeting_date {
            result = result.replace("{{meeting_date}}", date);
        }
        
        if let Some(participants) = &context.participants {
            result = result.replace("{{participants}}", participants);
        }
        
        if let Some(count) = &context.participant_count {
            result = result.replace("{{participant_count}}", &count.to_string());
        }
        
        if let Some(length) = &context.transcription_length {
            result = result.replace("{{transcription_length}}", &length.to_string());
        }
        
        if let Some(meeting_type) = &context.meeting_type {
            result = result.replace("{{meeting_type}}", meeting_type);
        }
        
        if let Some(organizer) = &context.organizer {
            result = result.replace("{{organizer}}", organizer);
        }
        
        if let Some(preference) = &context.summary_length_preference {
            result = result.replace("{{summary_length_preference}}", preference);
        }
        
        Ok(result)
    }
    
    /// Clean up unused placeholders
    fn clean_unused_placeholders(&self, template: &str) -> String {
        let re = Regex::new(r"\{\{[^}]+\}\}").unwrap();
        re.replace_all(template, "[not specified]").to_string()
    }
    
    /// Get sample context for template preview
    fn get_sample_context(&self) -> TemplateContext {
        TemplateContext {
            meeting_title: Some("Weekly Team Standup".to_string()),
            meeting_duration: Some("30 minutes".to_string()),
            meeting_date: Some("2024-01-15".to_string()),
            participants: Some("Alice, Bob, Charlie".to_string()),
            participant_count: Some(3),
            transcription_length: Some(2500),
            meeting_type: Some("standup".to_string()),
            organizer: Some("Alice".to_string()),
            summary_length_preference: Some("concise".to_string()),
        }
    }
    
    /// Export templates to JSON format
    pub async fn export_templates(&self) -> Result<String> {
        let templates = self.get_all_templates().await?;
        
        serde_json::to_string_pretty(&templates)
            .map_err(|e| crate::error::Error::Internal {
                message: format!("Failed to export templates: {}", e),
                source: Some(e.into()),
            })
    }
    
    /// Import templates from JSON format
    pub async fn import_templates(&self, json_data: &str) -> Result<ImportResult> {
        let templates: Vec<SummaryTemplate> = serde_json::from_str(json_data)
            .map_err(|e| crate::error::Error::Configuration {
                message: format!("Invalid template JSON: {}", e),
                source: Some(e.into()),
            })?;
        
        let mut imported = 0;
        let mut failed = 0;
        let mut errors = Vec::new();
        
        for template in templates {
            match self.validate_template(&template.prompt_template) {
                Ok(_) => {
                    match self.repository.create_template(&template).await {
                        Ok(_) => imported += 1,
                        Err(e) => {
                            failed += 1;
                            errors.push(format!("Failed to import '{}': {}", template.name, e));
                        }
                    }
                }
                Err(e) => {
                    failed += 1;
                    errors.push(format!("Invalid template '{}': {}", template.name, e));
                }
            }
        }
        
        Ok(ImportResult {
            imported,
            failed,
            errors,
        })
    }
    
    /// Test a template with given transcription text
    pub async fn test_template(
        &self,
        template: &SummaryTemplate,
        transcription: &str,
        context: &TemplateContext,
    ) -> Result<TemplateTestResult> {
        let processed_template = self.process_template(template, context).await?;
        
        // Estimate tokens and cost
        let estimated_input_tokens = self.estimate_tokens(&format!("{}\n\n{}", processed_template, transcription));
        let estimated_output_tokens = 500; // Conservative estimate for summary
        
        // Calculate estimated processing time (rough estimate)
        let estimated_time_ms = (estimated_input_tokens as f64 * 0.1 + estimated_output_tokens as f64 * 0.2) as u64;
        
        Ok(TemplateTestResult {
            processed_template,
            estimated_input_tokens,
            estimated_output_tokens,
            estimated_cost_openai: self.calculate_openai_cost(estimated_input_tokens, estimated_output_tokens),
            estimated_cost_claude: self.calculate_claude_cost(estimated_input_tokens, estimated_output_tokens),
            estimated_time_ms,
        })
    }
    
    /// Estimate token count for text
    fn estimate_tokens(&self, text: &str) -> u32 {
        // Rough approximation: 1 token ≈ 4 characters
        (text.len() as f32 / 4.0).ceil() as u32
    }
    
    /// Calculate estimated cost for OpenAI
    fn calculate_openai_cost(&self, input_tokens: u32, output_tokens: u32) -> f64 {
        // GPT-4 Turbo pricing
        let input_cost = (input_tokens as f64 / 1000.0) * 0.01;
        let output_cost = (output_tokens as f64 / 1000.0) * 0.03;
        input_cost + output_cost
    }
    
    /// Calculate estimated cost for Claude
    fn calculate_claude_cost(&self, input_tokens: u32, output_tokens: u32) -> f64 {
        // Claude 3 Sonnet pricing
        let input_cost = (input_tokens as f64 / 1_000_000.0) * 3.0;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * 15.0;
        input_cost + output_cost
    }
}

/// Context variables for template processing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TemplateContext {
    pub meeting_title: Option<String>,
    pub meeting_duration: Option<String>,
    pub meeting_date: Option<String>,
    pub participants: Option<String>,
    pub participant_count: Option<u32>,
    pub transcription_length: Option<u32>,
    pub meeting_type: Option<String>,
    pub organizer: Option<String>,
    pub summary_length_preference: Option<String>,
}

/// Template preview result
#[derive(Debug, Clone, serde::Serialize)]
pub struct TemplatePreview {
    pub original: String,
    pub processed: String,
    pub variables: Vec<String>,
    pub context: TemplateContext,
}

/// Template import result
#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportResult {
    pub imported: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

/// Template test result with cost estimates
#[derive(Debug, Clone, serde::Serialize)]
pub struct TemplateTestResult {
    pub processed_template: String,
    pub estimated_input_tokens: u32,
    pub estimated_output_tokens: u32,
    pub estimated_cost_openai: f64,
    pub estimated_cost_claude: f64,
    pub estimated_time_ms: u64,
}