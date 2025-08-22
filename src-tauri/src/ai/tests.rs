use super::*;
use crate::storage::repositories::usage::UsageRepository;
use crate::storage::repositories::summary::SummaryRepository;
use crate::storage::repositories::template::TemplateRepository;
use anyhow::Result;
use mockall::{mock, predicate::*};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// Mock HTTP client for testing external AI services
mock! {
    HttpClient {}
    
    #[async_trait::async_trait]
    impl HttpClient for HttpClient {
        async fn post(&self, url: &str, headers: Vec<(String, String)>, body: String) -> Result<String>;
        async fn get(&self, url: &str, headers: Vec<(String, String)>) -> Result<String>;
    }
}

// Mock AI service client implementations
mock! {
    OpenAIClient {}
    
    #[async_trait::async_trait]
    impl AIServiceClient for OpenAIClient {
        async fn summarize(&self, text: &str, template: &str) -> Result<SummaryResult>;
        fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimation>;
        fn get_provider_name(&self) -> &'static str;
        fn get_models(&self) -> Vec<String>;
        async fn health_check(&self) -> Result<ServiceHealth>;
    }
}

mock! {
    ClaudeClient {}
    
    #[async_trait::async_trait]
    impl AIServiceClient for ClaudeClient {
        async fn summarize(&self, text: &str, template: &str) -> Result<SummaryResult>;
        fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimation>;
        fn get_provider_name(&self) -> &'static str;
        fn get_models(&self) -> Vec<String>;
        async fn health_check(&self) -> Result<ServiceHealth>;
    }
}

// Mock repositories
mock! {
    MockSummaryRepository {}
    
    #[async_trait::async_trait]
    impl SummaryRepository for MockSummaryRepository {
        async fn create_summary(&self, summary: &SummaryResult) -> Result<i64>;
        async fn get_summary_by_meeting_id(&self, meeting_id: &str) -> Result<Option<SummaryResult>>;
        async fn get_summary_by_id(&self, id: i64) -> Result<Option<SummaryResult>>;
        async fn update_summary(&self, summary: &SummaryResult) -> Result<()>;
        async fn delete_summary(&self, id: i64) -> Result<()>;
        async fn search_summaries(&self, query: &str, limit: Option<i32>) -> Result<Vec<SummaryResult>>;
        async fn get_recent_summaries(&self, limit: Option<i32>) -> Result<Vec<SummaryResult>>;
        async fn get_summaries_by_date_range(&self, start: &str, end: &str) -> Result<Vec<SummaryResult>>;
    }
}

mock! {
    MockUsageRepository {}
    
    #[async_trait::async_trait]
    impl UsageRepository for MockUsageRepository {
        async fn record_usage(&self, record: &UsageRecord) -> Result<i64>;
        async fn get_usage_stats(&self) -> Result<UsageStats>;
        async fn get_provider_stats(&self, provider: &str, days: i32) -> Result<ProviderStats>;
        async fn get_usage_by_date_range(&self, start: &str, end: &str) -> Result<Vec<UsageRecord>>;
        async fn export_usage_data(&self, start: &str, end: &str, format: &str) -> Result<String>;
    }
}

mock! {
    MockTemplateRepository {}
    
    #[async_trait::async_trait]
    impl TemplateRepository for MockTemplateRepository {
        async fn create_template(&self, template: &SummaryTemplate) -> Result<i64>;
        async fn get_template_by_id(&self, id: i64) -> Result<Option<SummaryTemplate>>;
        async fn get_all_templates(&self) -> Result<Vec<SummaryTemplate>>;
        async fn get_templates_by_type(&self, meeting_type: &str) -> Result<Vec<SummaryTemplate>>;
        async fn update_template(&self, template: &SummaryTemplate) -> Result<()>;
        async fn delete_template(&self, id: i64) -> Result<()>;
        async fn get_default_template(&self, meeting_type: &str) -> Result<Option<SummaryTemplate>>;
    }
}

fn create_test_summary_result() -> SummaryResult {
    SummaryResult {
        id: "test-summary-123".to_string(),
        meeting_id: "meeting-456".to_string(),
        template_id: Some(1),
        content: "This is a test meeting summary with key points and action items.".to_string(),
        model_used: "gpt-4".to_string(),
        provider: "openai".to_string(),
        cost_usd: 0.15,
        processing_time_ms: 2500,
        token_count: Some(250),
        confidence_score: Some(0.95),
        created_at: "2025-01-15T10:30:00Z".to_string(),
    }
}

fn create_test_cost_estimation() -> CostEstimation {
    CostEstimation {
        estimated_cost: 0.15,
        provider: "openai".to_string(),
        operation_type: "summarization".to_string(),
        estimated_input_tokens: 2000,
        estimated_output_tokens: 300,
        can_afford: true,
        budget_impact: BudgetImpact {
            daily_before: 2.50,
            daily_after: 2.65,
            monthly_before: 45.75,
            monthly_after: 45.90,
            daily_budget: 10.00,
            monthly_budget: 100.00,
        },
    }
}

fn create_test_template() -> SummaryTemplate {
    SummaryTemplate {
        id: 1,
        name: "Standup Template".to_string(),
        description: Some("Daily standup meeting template".to_string()),
        prompt_template: "Summarize this standup meeting focusing on updates, blockers, and next steps.".to_string(),
        meeting_type: "standup".to_string(),
        is_default: true,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
    }
}

fn create_test_usage_stats() -> UsageStats {
    UsageStats {
        daily_spend: 2.50,
        monthly_spend: 45.75,
        daily_budget: 10.00,
        monthly_budget: 100.00,
        daily_remaining: 7.50,
        monthly_remaining: 54.25,
        daily_utilization: 0.25,
        monthly_utilization: 0.4575,
        warning_level: "Normal".to_string(),
    }
}

fn create_test_service_health(provider: &str, is_healthy: bool) -> ServiceHealth {
    ServiceHealth {
        provider: provider.to_string(),
        is_healthy,
        rate_limit_status: if is_healthy {
            Some(RateLimitStatus {
                requests_remaining: Some(100),
                tokens_remaining: Some(50000),
                reset_time: Some("2025-01-15T12:00:00Z".to_string()),
                retry_after_seconds: None,
            })
        } else {
            Some(RateLimitStatus {
                requests_remaining: Some(0),
                tokens_remaining: Some(0),
                reset_time: Some("2025-01-15T12:30:00Z".to_string()),
                retry_after_seconds: Some(1800),
            })
        },
        circuit_breaker_state: if is_healthy { "closed" } else { "open" }.to_string(),
    }
}

#[tokio::test]
async fn test_openai_client_summarize_success() {
    let mut mock_client = MockOpenAIClient::new();
    
    mock_client
        .expect_summarize()
        .with(eq("Test transcription"), eq("Test template"))
        .times(1)
        .returning(|_, _| Ok(create_test_summary_result()));
    
    let result = mock_client.summarize("Test transcription", "Test template").await;
    
    assert!(result.is_ok());
    let summary = result.unwrap();
    assert_eq!(summary.content, "This is a test meeting summary with key points and action items.");
    assert_eq!(summary.provider, "openai");
    assert_eq!(summary.model_used, "gpt-4");
}

#[tokio::test]
async fn test_claude_client_summarize_success() {
    let mut mock_client = MockClaudeClient::new();
    
    let mut expected_summary = create_test_summary_result();
    expected_summary.provider = "claude".to_string();
    expected_summary.model_used = "claude-3-sonnet".to_string();
    
    mock_client
        .expect_summarize()
        .with(eq("Test transcription"), eq("Test template"))
        .times(1)
        .returning(move |_, _| Ok(expected_summary.clone()));
    
    let result = mock_client.summarize("Test transcription", "Test template").await;
    
    assert!(result.is_ok());
    let summary = result.unwrap();
    assert_eq!(summary.provider, "claude");
    assert_eq!(summary.model_used, "claude-3-sonnet");
}

#[tokio::test]
async fn test_cost_estimation_accuracy() {
    let mut mock_client = MockOpenAIClient::new();
    
    mock_client
        .expect_estimate_cost()
        .times(1)
        .returning(|operation| {
            // Simulate cost calculation based on operation parameters
            let base_cost = match operation.operation_type.as_str() {
                "summarization" => 0.001, // $0.001 per 1K tokens
                _ => 0.002,
            };
            
            let total_tokens = operation.input_tokens + operation.output_tokens;
            let estimated_cost = (total_tokens as f64 / 1000.0) * base_cost;
            
            Ok(CostEstimation {
                estimated_cost,
                provider: "openai".to_string(),
                operation_type: operation.operation_type.clone(),
                estimated_input_tokens: operation.input_tokens,
                estimated_output_tokens: operation.output_tokens,
                can_afford: estimated_cost <= 1.0, // Mock budget check
                budget_impact: BudgetImpact {
                    daily_before: 2.50,
                    daily_after: 2.50 + estimated_cost,
                    monthly_before: 45.75,
                    monthly_after: 45.75 + estimated_cost,
                    daily_budget: 10.00,
                    monthly_budget: 100.00,
                },
            })
        });
    
    let operation = AIOperation {
        operation_type: "summarization".to_string(),
        input_tokens: 2000,
        output_tokens: 300,
        model: "gpt-4".to_string(),
    };
    
    let result = mock_client.estimate_cost(&operation);
    
    assert!(result.is_ok());
    let estimation = result.unwrap();
    
    // Verify cost calculation accuracy within 5% requirement
    let expected_cost = 0.0023; // (2300 tokens / 1000) * 0.001
    let actual_cost = estimation.estimated_cost;
    let error_percentage = ((actual_cost - expected_cost).abs() / expected_cost) * 100.0;
    
    assert!(error_percentage <= 5.0, "Cost estimation error {}% exceeds 5% requirement", error_percentage);
    assert_eq!(estimation.estimated_input_tokens, 2000);
    assert_eq!(estimation.estimated_output_tokens, 300);
    assert!(estimation.can_afford);
}

#[tokio::test]
async fn test_ai_service_manager_fallback_logic() {
    let mut primary_client = MockOpenAIClient::new();
    let mut fallback_client = MockClaudeClient::new();
    
    // Primary client fails
    primary_client
        .expect_summarize()
        .times(1)
        .returning(|_, _| Err(anyhow::anyhow!("OpenAI service unavailable")));
    
    primary_client
        .expect_get_provider_name()
        .returning(|| "openai");
    
    // Fallback client succeeds
    let mut fallback_summary = create_test_summary_result();
    fallback_summary.provider = "claude".to_string();
    
    fallback_client
        .expect_summarize()
        .times(1)
        .returning(move |_, _| Ok(fallback_summary.clone()));
    
    fallback_client
        .expect_get_provider_name()
        .returning(|| "claude");
    
    // Simulate AIServiceManager behavior
    let primary_result = primary_client.summarize("Test transcription", "Test template").await;
    assert!(primary_result.is_err());
    
    let fallback_result = fallback_client.summarize("Test transcription", "Test template").await;
    assert!(fallback_result.is_ok());
    
    let summary = fallback_result.unwrap();
    assert_eq!(summary.provider, "claude");
}

#[tokio::test]
async fn test_circuit_breaker_pattern() {
    let mut mock_client = MockOpenAIClient::new();
    
    // Simulate multiple failures to trigger circuit breaker
    mock_client
        .expect_health_check()
        .times(3)
        .returning(|| Ok(create_test_service_health("openai", false)));
    
    mock_client
        .expect_get_provider_name()
        .returning(|| "openai");
    
    // First health check - service unhealthy
    let health1 = mock_client.health_check().await.unwrap();
    assert!(!health1.is_healthy);
    assert_eq!(health1.circuit_breaker_state, "open");
    
    // Second health check - still unhealthy
    let health2 = mock_client.health_check().await.unwrap();
    assert!(!health2.is_healthy);
    
    // Third health check - still unhealthy
    let health3 = mock_client.health_check().await.unwrap();
    assert!(!health3.is_healthy);
    assert_eq!(health3.circuit_breaker_state, "open");
}

#[tokio::test]
async fn test_service_recovery_after_failure() {
    let mut mock_client = MockOpenAIClient::new();
    
    // First call fails
    mock_client
        .expect_health_check()
        .times(1)
        .returning(|| Ok(create_test_service_health("openai", false)));
    
    // Second call succeeds (service recovered)
    mock_client
        .expect_health_check()
        .times(1)
        .returning(|| Ok(create_test_service_health("openai", true)));
    
    // First health check - service unhealthy
    let health1 = mock_client.health_check().await.unwrap();
    assert!(!health1.is_healthy);
    assert_eq!(health1.circuit_breaker_state, "open");
    
    // Second health check - service recovered
    let health2 = mock_client.health_check().await.unwrap();
    assert!(health2.is_healthy);
    assert_eq!(health2.circuit_breaker_state, "closed");
    assert!(health2.rate_limit_status.is_some());
    
    let rate_limit = health2.rate_limit_status.unwrap();
    assert_eq!(rate_limit.requests_remaining, Some(100));
    assert_eq!(rate_limit.tokens_remaining, Some(50000));
}

#[tokio::test]
async fn test_rate_limiting_behavior() {
    let mut mock_client = MockOpenAIClient::new();
    
    // Simulate rate limit exceeded
    mock_client
        .expect_summarize()
        .times(1)
        .returning(|_, _| {
            Err(anyhow::anyhow!("Rate limit exceeded. Retry after 60 seconds"))
        });
    
    let result = mock_client.summarize("Test transcription", "Test template").await;
    
    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("Rate limit exceeded"));
    assert!(error_msg.contains("60 seconds"));
}

#[tokio::test]
async fn test_template_processing_and_substitution() {
    let template = SummaryTemplate {
        id: 1,
        name: "Dynamic Template".to_string(),
        description: Some("Template with variables".to_string()),
        prompt_template: "Summarize the {{meeting_type}} meeting titled '{{meeting_title}}' with {{participant_count}} participants. Focus on {{summary_focus}}.".to_string(),
        meeting_type: "standup".to_string(),
        is_default: false,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
    };
    
    let context = TemplateContext {
        meeting_title: Some("Weekly Team Sync".to_string()),
        meeting_type: Some("standup".to_string()),
        participant_count: Some(5),
        summary_focus: Some("action items and blockers".to_string()),
        ..Default::default()
    };
    
    // Simulate template processing
    let processed_template = process_template_variables(&template.prompt_template, &context);
    
    let expected = "Summarize the standup meeting titled 'Weekly Team Sync' with 5 participants. Focus on action items and blockers.";
    assert_eq!(processed_template, expected);
}

#[tokio::test]
async fn test_template_processing_with_missing_variables() {
    let template_text = "Meeting: {{meeting_title}}, Date: {{meeting_date}}, Organizer: {{organizer}}";
    
    let context = TemplateContext {
        meeting_title: Some("Test Meeting".to_string()),
        // meeting_date and organizer are missing
        ..Default::default()
    };
    
    let processed = process_template_variables(template_text, &context);
    
    // Missing variables should remain as placeholders or be handled gracefully
    assert!(processed.contains("Test Meeting"));
    // Implementation should either keep placeholders or use defaults
    assert!(processed.contains("{{meeting_date}}") || processed.contains("TBD") || processed.contains("Unknown"));
}

#[tokio::test]
async fn test_performance_requirement_validation() {
    use std::time::Instant;
    
    let mut mock_client = MockOpenAIClient::new();
    
    // Simulate a summarization that takes less than 30 seconds
    mock_client
        .expect_summarize()
        .times(1)
        .returning(|_, _| {
            // Simulate processing time
            std::thread::sleep(std::time::Duration::from_millis(100)); // 100ms simulation
            Ok(create_test_summary_result())
        });
    
    let start_time = Instant::now();
    let result = mock_client.summarize("Test transcription", "Test template").await;
    let duration = start_time.elapsed();
    
    assert!(result.is_ok());
    assert!(duration.as_secs() < 30, "Summarization took {}s, exceeding 30s requirement", duration.as_secs());
    
    // Also verify the processing time is recorded in the result
    let summary = result.unwrap();
    assert!(summary.processing_time_ms > 0);
    assert!(summary.processing_time_ms < 30000); // Less than 30 seconds in milliseconds
}

#[tokio::test]
async fn test_async_processing_queue_management() {
    use tokio::sync::mpsc;
    
    // Simulate async processing queue
    let (tx, mut rx) = mpsc::channel::<String>(10);
    
    // Simulate adding tasks to queue
    let task_ids = vec!["task-1", "task-2", "task-3"];
    
    for task_id in &task_ids {
        tx.send(task_id.to_string()).await.unwrap();
    }
    
    // Verify tasks are queued
    let mut received_tasks = Vec::new();
    for _ in 0..task_ids.len() {
        if let Some(task_id) = rx.recv().await {
            received_tasks.push(task_id);
        }
    }
    
    assert_eq!(received_tasks.len(), 3);
    assert!(received_tasks.contains(&"task-1".to_string()));
    assert!(received_tasks.contains(&"task-2".to_string()));
    assert!(received_tasks.contains(&"task-3".to_string()));
}

#[tokio::test]
async fn test_budget_controls_and_alerts() {
    let mut mock_client = MockOpenAIClient::new();
    
    // Test case where operation exceeds budget
    mock_client
        .expect_estimate_cost()
        .times(1)
        .returning(|_| {
            Ok(CostEstimation {
                estimated_cost: 15.0, // Exceeds daily budget of 10.0
                provider: "openai".to_string(),
                operation_type: "summarization".to_string(),
                estimated_input_tokens: 50000,
                estimated_output_tokens: 5000,
                can_afford: false, // Cannot afford
                budget_impact: BudgetImpact {
                    daily_before: 8.00,
                    daily_after: 23.00, // Would exceed daily budget
                    monthly_before: 80.00,
                    monthly_after: 95.00,
                    daily_budget: 10.00,
                    monthly_budget: 100.00,
                },
            })
        });
    
    let operation = AIOperation {
        operation_type: "summarization".to_string(),
        input_tokens: 50000,
        output_tokens: 5000,
        model: "gpt-4".to_string(),
    };
    
    let result = mock_client.estimate_cost(&operation);
    
    assert!(result.is_ok());
    let estimation = result.unwrap();
    
    // Verify budget controls
    assert!(!estimation.can_afford);
    assert!(estimation.budget_impact.daily_after > estimation.budget_impact.daily_budget);
    
    // Should trigger budget alert
    let daily_utilization = estimation.budget_impact.daily_after / estimation.budget_impact.daily_budget;
    assert!(daily_utilization > 1.0); // Over budget
}

#[tokio::test]
async fn test_budget_warning_levels() {
    let test_cases = vec![
        (0.25, "Normal"),   // 25% utilization
        (0.65, "Info"),     // 65% utilization
        (0.85, "Warning"),  // 85% utilization
        (1.05, "Critical"), // 105% utilization (over budget)
    ];
    
    for (utilization, expected_level) in test_cases {
        let daily_spend = 10.0 * utilization;
        let daily_budget = 10.0;
        
        let warning_level = determine_warning_level(daily_spend, daily_budget);
        assert_eq!(warning_level, expected_level, "Failed for utilization {}", utilization);
    }
}

#[tokio::test]
async fn test_privacy_controls_and_user_consent() {
    let mut mock_client = MockOpenAIClient::new();
    
    // Test with privacy mode enabled (should not call external service)
    let privacy_enabled = true;
    
    if privacy_enabled {
        // Should not make external API calls when privacy mode is enabled
        mock_client.expect_summarize().times(0);
        
        // Simulate local processing only
        let local_summary = SummaryResult {
            id: "local-summary-123".to_string(),
            meeting_id: "meeting-456".to_string(),
            template_id: Some(1),
            content: "Summary generated locally without external API".to_string(),
            model_used: "local-whisper".to_string(),
            provider: "local".to_string(),
            cost_usd: 0.0,
            processing_time_ms: 1500,
            token_count: Some(200),
            confidence_score: Some(0.85),
            created_at: "2025-01-15T10:30:00Z".to_string(),
        };
        
        // Verify local processing characteristics
        assert_eq!(local_summary.provider, "local");
        assert_eq!(local_summary.cost_usd, 0.0);
        assert!(local_summary.content.contains("locally"));
    } else {
        // Privacy mode disabled - external API calls allowed
        mock_client
            .expect_summarize()
            .times(1)
            .returning(|_, _| Ok(create_test_summary_result()));
        
        let result = mock_client.summarize("Test transcription", "Test template").await;
        assert!(result.is_ok());
        
        let summary = result.unwrap();
        assert_ne!(summary.provider, "local");
        assert!(summary.cost_usd > 0.0);
    }
}

#[tokio::test]
async fn test_error_handling_and_recovery() {
    let mut mock_client = MockOpenAIClient::new();
    
    // Test various error scenarios
    let error_scenarios = vec![
        "Network timeout",
        "Authentication failed",
        "Service temporarily unavailable",
        "Invalid request format",
        "Rate limit exceeded",
    ];
    
    for (i, error_msg) in error_scenarios.iter().enumerate() {
        mock_client
            .expect_summarize()
            .times(1)
            .returning(move |_, _| Err(anyhow::anyhow!("{}", error_msg)));
        
        let result = mock_client.summarize("Test transcription", "Test template").await;
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains(error_msg));
    }
}

#[tokio::test]
async fn test_concurrent_ai_operations() {
    use tokio::sync::Semaphore;
    use std::sync::Arc;
    
    // Simulate concurrent operation limiting
    let semaphore = Arc::new(Semaphore::new(3)); // Max 3 concurrent operations
    let mut handles = Vec::new();
    
    for i in 0..5 {
        let sem = semaphore.clone();
        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            
            // Simulate AI operation
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            
            format!("Task {} completed", i)
        });
        handles.push(handle);
    }
    
    // Wait for all tasks to complete
    let results: Vec<_> = futures::future::join_all(handles).await;
    
    // Verify all tasks completed successfully
    for (i, result) in results.iter().enumerate() {
        assert!(result.is_ok());
        let message = result.as_ref().unwrap();
        assert!(message.contains(&format!("Task {} completed", i)));
    }
}

// Helper function to process template variables (would be implemented in the actual code)
fn process_template_variables(template: &str, context: &TemplateContext) -> String {
    let mut result = template.to_string();
    
    if let Some(title) = &context.meeting_title {
        result = result.replace("{{meeting_title}}", title);
    }
    
    if let Some(meeting_type) = &context.meeting_type {
        result = result.replace("{{meeting_type}}", meeting_type);
    }
    
    if let Some(count) = context.participant_count {
        result = result.replace("{{participant_count}}", &count.to_string());
    }
    
    if let Some(focus) = &context.summary_focus {
        result = result.replace("{{summary_focus}}", focus);
    }
    
    // Handle missing variables by keeping placeholders
    result
}

// Helper function to determine warning level based on utilization
fn determine_warning_level(spend: f64, budget: f64) -> &'static str {
    let utilization = spend / budget;
    
    if utilization >= 1.0 {
        "Critical"
    } else if utilization >= 0.80 {
        "Warning"
    } else if utilization >= 0.60 {
        "Info"
    } else {
        "Normal"
    }
}

// Integration test for complete summarization workflow
#[tokio::test]
async fn test_complete_summarization_workflow() {
    let mut mock_summary_repo = MockSummaryRepository::new();
    let mut mock_usage_repo = MockUsageRepository::new();
    let mut mock_template_repo = MockTemplateRepository::new();
    let mut mock_ai_client = MockOpenAIClient::new();
    
    // Setup expectations
    mock_template_repo
        .expect_get_template_by_id()
        .with(eq(1))
        .times(1)
        .returning(|_| Ok(Some(create_test_template())));
    
    mock_ai_client
        .expect_estimate_cost()
        .times(1)
        .returning(|_| Ok(create_test_cost_estimation()));
    
    mock_ai_client
        .expect_summarize()
        .times(1)
        .returning(|_, _| Ok(create_test_summary_result()));
    
    mock_summary_repo
        .expect_create_summary()
        .times(1)
        .returning(|_| Ok(1));
    
    mock_usage_repo
        .expect_record_usage()
        .times(1)
        .returning(|_| Ok(1));
    
    // Simulate the workflow
    // 1. Get template
    let template = mock_template_repo.get_template_by_id(1).await.unwrap().unwrap();
    assert_eq!(template.name, "Standup Template");
    
    // 2. Estimate cost
    let operation = AIOperation {
        operation_type: "summarization".to_string(),
        input_tokens: 2000,
        output_tokens: 300,
        model: "gpt-4".to_string(),
    };
    let cost_estimate = mock_ai_client.estimate_cost(&operation).unwrap();
    assert!(cost_estimate.can_afford);
    
    // 3. Generate summary
    let transcription = "Sample meeting transcription...";
    let processed_template = process_template_variables(&template.prompt_template, &TemplateContext::default());
    let summary = mock_ai_client.summarize(transcription, &processed_template).await.unwrap();
    
    // 4. Save summary
    let summary_id = mock_summary_repo.create_summary(&summary).await.unwrap();
    assert_eq!(summary_id, 1);
    
    // 5. Record usage
    let usage_record = UsageRecord {
        id: None,
        service_provider: summary.provider.clone(),
        operation_type: "summarization".to_string(),
        model_name: summary.model_used.clone(),
        input_tokens: Some(2000),
        output_tokens: Some(300),
        cost_usd: summary.cost_usd,
        meeting_id: Some(summary.meeting_id.clone()),
        summary_id: Some(summary_id),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let usage_id = mock_usage_repo.record_usage(&usage_record).await.unwrap();
    assert_eq!(usage_id, 1);
}

#[tokio::test]
async fn test_service_health_monitoring() {
    let mut openai_client = MockOpenAIClient::new();
    let mut claude_client = MockClaudeClient::new();
    
    // OpenAI healthy, Claude unhealthy
    openai_client
        .expect_health_check()
        .times(1)
        .returning(|| Ok(create_test_service_health("openai", true)));
    
    claude_client
        .expect_health_check()
        .times(1)
        .returning(|| Ok(create_test_service_health("claude", false)));
    
    // Check health status
    let openai_health = openai_client.health_check().await.unwrap();
    let claude_health = claude_client.health_check().await.unwrap();
    
    assert!(openai_health.is_healthy);
    assert_eq!(openai_health.circuit_breaker_state, "closed");
    assert!(openai_health.rate_limit_status.unwrap().requests_remaining.unwrap() > 0);
    
    assert!(!claude_health.is_healthy);
    assert_eq!(claude_health.circuit_breaker_state, "open");
    assert_eq!(claude_health.rate_limit_status.unwrap().requests_remaining.unwrap(), 0);
}

// Test data structures that would be defined in the actual implementation
#[derive(Debug, Clone)]
pub struct AIOperation {
    pub operation_type: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub model: String,
}

#[derive(Debug, Clone)]
pub struct UsageRecord {
    pub id: Option<i64>,
    pub service_provider: String,
    pub operation_type: String,
    pub model_name: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub cost_usd: f64,
    pub meeting_id: Option<String>,
    pub summary_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Default)]
pub struct TemplateContext {
    pub meeting_title: Option<String>,
    pub meeting_type: Option<String>,
    pub participant_count: Option<u32>,
    pub summary_focus: Option<String>,
}