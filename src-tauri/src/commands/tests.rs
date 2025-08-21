#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_app_version() {
        // When
        let result = get_app_version().await;
        
        // Then
        assert!(result.is_ok());
        let version = result.unwrap();
        assert_eq!(version.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(version.build, "development");
    }

    #[tokio::test]
    async fn test_get_app_info() {
        // When
        let result = get_app_info().await;
        
        // Then
        assert!(result.is_ok());
        let app_info = result.unwrap();
        assert_eq!(app_info.name, "MeetingMind");
        assert_eq!(app_info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(app_info.description, "Privacy-first AI Meeting Assistant");
    }

    #[tokio::test]
    async fn test_health_check() {
        // When
        let result = health_check().await;
        
        // Then
        assert!(result.is_ok());
        let health = result.unwrap();
        assert_eq!(health.status, "healthy");
        assert_eq!(health.components.database, "not_initialized");
        assert_eq!(health.components.audio, "not_initialized");
        assert_eq!(health.components.ai, "not_initialized");
    }
}