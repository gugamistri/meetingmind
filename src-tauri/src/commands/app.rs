//! General application commands

use serde::{Deserialize, Serialize};
use crate::error::Result;

/// Application information
#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

/// Health status for a component
#[derive(Debug, Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: String,
    pub components: HealthComponents,
}

/// Health status for individual components
#[derive(Debug, Serialize)]
pub struct HealthComponents {
    pub database: String,
    pub audio: String,
    pub ai: String,
}

/// Get application information
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo> {
    Ok(AppInfo {
        name: "MeetingMind".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: "Privacy-first AI Meeting Assistant for desktop".to_string(),
    })
}

/// Perform a health check of all application components
#[tauri::command]
pub async fn health_check() -> Result<HealthStatus> {
    // Basic health check - in a real implementation, you'd check actual component status
    Ok(HealthStatus {
        status: "healthy".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        components: HealthComponents {
            database: "operational".to_string(),
            audio: "operational".to_string(),
            ai: "operational".to_string(),
        },
    })
}