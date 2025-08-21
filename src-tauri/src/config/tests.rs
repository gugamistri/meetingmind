#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_creation() {
        // Given/When
        let config = AppConfig::default();
        
        // Then
        assert_eq!(config.app.name, "MeetingMind");
        assert_eq!(config.app.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(config.audio.sample_rate, 16000);
        assert_eq!(config.audio.channels, 1);
        assert_eq!(config.database.max_connections, 10);
        assert!(config.database.enable_wal);
        assert_eq!(config.ai.whisper_model_size, "base");
        assert!(config.security.enable_encryption);
        assert!(config.security.enable_pii_protection);
    }

    #[test]
    fn test_config_validation_success() {
        // Given
        let config = AppConfig::default();
        
        // When
        let result = config.validate();
        
        // Then
        assert!(result.is_ok());
    }

    #[test]
    fn test_config_validation_fails_with_zero_sample_rate() {
        // Given
        let mut config = AppConfig::default();
        config.audio.sample_rate = 0;
        
        // When
        let result = config.validate();
        
        // Then
        assert!(result.is_err());
        if let Err(AppError::Config { message }) = result {
            assert!(message.contains("Sample rate must be greater than 0"));
        } else {
            panic!("Expected Config error");
        }
    }

    #[test]
    fn test_config_validation_fails_with_zero_channels() {
        // Given
        let mut config = AppConfig::default();
        config.audio.channels = 0;
        
        // When
        let result = config.validate();
        
        // Then
        assert!(result.is_err());
        if let Err(AppError::Config { message }) = result {
            assert!(message.contains("Number of channels must be greater than 0"));
        } else {
            panic!("Expected Config error");
        }
    }

    #[test]
    fn test_config_validation_fails_with_zero_max_connections() {
        // Given
        let mut config = AppConfig::default();
        config.database.max_connections = 0;
        
        // When
        let result = config.validate();
        
        // Then
        assert!(result.is_err());
        if let Err(AppError::Config { message }) = result {
            assert!(message.contains("Maximum connections must be greater than 0"));
        } else {
            panic!("Expected Config error");
        }
    }
}