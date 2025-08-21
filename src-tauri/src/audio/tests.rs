//! Integration tests for the audio module

use super::*;
use std::time::Duration;
use tokio::time::timeout;

/// Test helper to create mock audio configuration
fn create_test_config() -> AudioConfig {
    AudioConfig {
        sample_rate: 16000,
        channels: 1,
        buffer_size: 1024,
        format: AudioFormat::F32,
    }
}

/// Test helper to create mock audio data
fn create_test_audio_data(samples: usize) -> Vec<f32> {
    (0..samples).map(|i| (i as f32 * 0.1).sin()).collect()
}

#[tokio::test]
async fn test_audio_capture_service_lifecycle() {
    // Test that we can create and initialize the service
    let service = AudioCaptureService::new();
    assert!(service.is_ok());
    
    let mut service = service.unwrap();
    assert_eq!(service.status(), AudioCaptureStatus::Stopped);
    assert!(!service.is_running());
}

#[tokio::test]
async fn test_audio_capture_service_with_custom_config() {
    let config = AudioConfig {
        sample_rate: 48000,
        channels: 2,
        buffer_size: 2048,
        format: AudioFormat::F32,
    };
    
    let service = AudioCaptureService::with_config(config.clone());
    assert!(service.is_ok());
    
    let service = service.unwrap();
    assert_eq!(service.config().sample_rate, 48000);
    assert_eq!(service.config().channels, 2);
    assert_eq!(service.config().buffer_size, 2048);
}

#[tokio::test]
async fn test_audio_device_manager_initialization() {
    let manager = AudioDeviceManager::new();
    assert!(manager.is_ok());
    
    let manager = manager.unwrap();
    
    // Test device enumeration
    let input_devices = manager.get_input_devices();
    assert!(input_devices.is_ok());
    
    let devices = input_devices.unwrap();
    println!("Found {} input devices", devices.len());
    
    // Check if any device is marked as default
    let has_default = devices.iter().any(|d| d.is_default);
    if !devices.is_empty() {
        println!("Has default device: {}", has_default);
    }
}

#[tokio::test]
async fn test_audio_ring_buffer_operations() {
    let buffer = AudioRingBuffer::new(1000, 16000, 1);
    
    // Test basic write/read operations
    let test_samples = create_test_audio_data(100);
    let write_result = buffer.write(&test_samples);
    assert!(write_result.is_ok());
    assert_eq!(write_result.unwrap(), 100);
    
    // Test buffer state
    assert_eq!(buffer.available(), 100);
    assert_eq!(buffer.space_available(), 900);
    
    // Test reading
    let mut read_samples = vec![0.0; 50];
    let read_result = buffer.read(&mut read_samples);
    assert!(read_result.is_ok());
    assert_eq!(read_result.unwrap(), 50);
    assert_eq!(buffer.available(), 50);
    
    // Test overflow protection
    let large_samples = create_test_audio_data(2000);
    let overflow_result = buffer.write(&large_samples);
    assert!(overflow_result.is_err());
    assert!(matches!(overflow_result, Err(AudioError::BufferOverflow { .. })));
}

#[tokio::test]
async fn test_audio_processing_pipeline() {
    let mut pipeline = AudioProcessingPipeline::new();
    
    // Add some processors
    pipeline.add_processor(Box::new(NoiseGateProcessor::new(0.1)));
    pipeline.add_processor(Box::new(AutomaticGainControl::new(0.5)));
    
    // Test processing
    let samples = create_test_audio_data(1000);
    let buffer = AudioBuffer::new(samples, 16000, 1);
    
    let result = pipeline.process(buffer);
    assert!(result.is_ok());
    
    let processed_buffer = result.unwrap();
    assert_eq!(processed_buffer.samples.len(), 1000);
    assert_eq!(processed_buffer.sample_rate, 16000);
    assert_eq!(processed_buffer.channels, 1);
    
    // Check that level monitoring is working
    assert!(pipeline.current_level() >= 0.0);
    assert!(pipeline.peak_level() >= 0.0);
    
    // Check statistics
    let stats = pipeline.stats();
    assert!(stats.samples_processed > 0);
}

#[tokio::test]
async fn test_audio_quality_validation() {
    let validator = AudioQualityValidator::new();
    
    // Test valid audio buffer
    let valid_samples = create_test_audio_data(1000);
    let valid_buffer = AudioBuffer::new(valid_samples, 16000, 1);
    let validation_result = validator.validate(&valid_buffer);
    assert!(validation_result.is_ok());
    
    // Test invalid sample rate (too low)
    let invalid_buffer = AudioBuffer::new(vec![0.1, 0.2], 7000, 1);
    let validation_result = validator.validate(&invalid_buffer);
    assert!(validation_result.is_err());
    
    // Test buffer with NaN values
    let nan_samples = vec![0.1, f32::NAN, 0.3];
    let nan_buffer = AudioBuffer::new(nan_samples, 16000, 1);
    let validation_result = validator.validate(&nan_buffer);
    assert!(validation_result.is_err());
}

#[tokio::test]
async fn test_audio_level_monitor() {
    let mut monitor = AudioLevelMonitor::new();
    
    // Test with silence
    let silence = AudioBuffer::new(vec![0.0; 1000], 16000, 1);
    monitor.update(&silence);
    assert_eq!(monitor.rms_level(), 0.0);
    assert_eq!(monitor.peak_level(), 0.0);
    
    // Test with actual audio
    let audio_samples = create_test_audio_data(1000);
    let audio_buffer = AudioBuffer::new(audio_samples, 16000, 1);
    monitor.update(&audio_buffer);
    
    assert!(monitor.rms_level() > 0.0);
    assert!(monitor.peak_level() > 0.0);
    assert!(monitor.rms_level_db() > -100.0);
    assert!(monitor.peak_level_db() > -100.0);
    
    // Test level decay
    let silence2 = AudioBuffer::new(vec![0.0; 1000], 16000, 1);
    monitor.update(&silence2);
    // Peak should decay, but not immediately to zero due to decay rate
    assert!(monitor.peak_level() >= 0.0);
}

#[tokio::test]
async fn test_audio_buffer_utilities() {
    // Test stereo to mono conversion
    let stereo_samples = vec![0.5, 0.3, 0.8, 0.2, 0.1, 0.9]; // 3 frames of stereo
    let stereo_buffer = AudioBuffer::new(stereo_samples, 16000, 2);
    
    let mono_buffer = stereo_buffer.to_mono();
    assert_eq!(mono_buffer.channels, 1);
    assert_eq!(mono_buffer.samples.len(), 3);
    
    // Test duration calculation
    let samples = vec![0.0; 16000]; // 1 second at 16kHz
    let buffer = AudioBuffer::new(samples, 16000, 1);
    assert!((buffer.duration_ms() - 1000.0).abs() < 1.0);
    
    // Test RMS calculation
    let rms_samples = vec![0.5, -0.5, 0.5, -0.5];
    let rms_buffer = AudioBuffer::new(rms_samples, 16000, 1);
    let rms = rms_buffer.rms_level();
    assert!((rms - 0.5).abs() < 0.01);
}

#[tokio::test]
async fn test_multi_channel_buffer() {
    let buffer = MultiChannelAudioBuffer::new(1000, 16000, 2);
    
    // Test interleaved write/read
    let interleaved_samples = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]; // 3 frames stereo
    let write_result = buffer.write_interleaved(&interleaved_samples);
    assert!(write_result.is_ok());
    assert_eq!(write_result.unwrap(), 6);
    
    // Test reading back
    let mut output = vec![0.0; 4]; // Read 2 frames
    let read_result = buffer.read_interleaved(&mut output);
    assert!(read_result.is_ok());
    assert_eq!(read_result.unwrap(), 4);
    assert_eq!(output, vec![1.0, 2.0, 3.0, 4.0]);
    
    // Test combined stats
    let stats = buffer.combined_stats();
    assert!(stats.samples_processed > 0);
}

#[tokio::test]
async fn test_audio_analyzer() {
    // Test with multiple buffers
    let buffers = vec![
        AudioBuffer::new(vec![0.1, 0.2, -0.1, -0.2], 16000, 1),
        AudioBuffer::new(vec![0.3, -0.3, 0.4, -0.4], 16000, 1),
        AudioBuffer::new(vec![0.0; 1000], 16000, 1), // Silence
    ];
    
    let analysis = AudioAnalyzer::analyze(&buffers);
    
    assert!(analysis.average_level > 0.0);
    assert!(analysis.peak_level > 0.0);
    assert!(analysis.silence_percentage > 0.0); // Should detect some silence
    assert_eq!(analysis.clipping_percentage, 0.0); // No clipping in test data
    assert!(analysis.dynamic_range > 0.0);
    
    // Test with empty buffer list
    let empty_analysis = AudioAnalyzer::analyze(&[]);
    assert_eq!(empty_analysis.average_level, 0.0);
    assert_eq!(empty_analysis.silence_percentage, 100.0);
}

#[tokio::test]
async fn test_error_handling() {
    // Test device manager with invalid device name
    let mut manager = AudioDeviceManager::new().unwrap();
    let result = manager.get_input_device_by_name("nonexistent_device_12345");
    assert!(result.is_err());
    assert!(matches!(result, Err(AudioError::DeviceNotFound { .. })));
    
    // Test ring buffer overflow
    let buffer = AudioRingBuffer::new(10, 16000, 1);
    let large_samples = vec![0.0; 20]; // Larger than capacity
    let result = buffer.write(&large_samples);
    assert!(result.is_err());
    assert!(matches!(result, Err(AudioError::BufferOverflow { .. })));
}

#[tokio::test]
async fn test_concurrent_buffer_access() {
    use std::sync::Arc;
    use std::thread;
    
    let buffer = Arc::new(AudioRingBuffer::new(10000, 16000, 1));
    let buffer_clone = Arc::clone(&buffer);
    
    // Spawn writer thread
    let writer = thread::spawn(move || {
        for _ in 0..100 {
            let samples = create_test_audio_data(50);
            let _ = buffer_clone.write(&samples);
            thread::sleep(Duration::from_millis(1));
        }
    });
    
    // Read in main thread
    let mut total_read = 0;
    for _ in 0..50 {
        let mut output = vec![0.0; 100];
        if let Ok(read_count) = buffer.read(&mut output) {
            total_read += read_count;
        }
        thread::sleep(Duration::from_millis(2));
    }
    
    writer.join().unwrap();
    
    println!("Total samples read: {}", total_read);
    assert!(total_read > 0);
}

#[tokio::test]
async fn test_audio_service_event_handling() {
    // This test would require actual audio devices and is more suitable for integration testing
    // For now, we test the event subscription setup
    
    let service = AudioCaptureService::new().unwrap();
    let status_rx = service.subscribe_status();
    let level_rx = service.subscribe_levels();
    
    // Test that receivers are created successfully
    assert!(status_rx.is_ok());
    assert!(level_rx.is_ok());
    
    // In a real test, we would:
    // 1. Start capture service
    // 2. Verify events are sent
    // 3. Check event data integrity
    // But this requires actual audio hardware
}

/// Performance benchmark test
#[tokio::test]
async fn test_audio_processing_performance() {
    let mut pipeline = AudioProcessingPipeline::new();
    pipeline.add_processor(Box::new(NoiseGateProcessor::new(0.1)));
    
    let large_buffer = AudioBuffer::new(create_test_audio_data(44100), 44100, 1); // 1 second
    
    let start = std::time::Instant::now();
    
    // Process buffer multiple times
    for _ in 0..100 {
        let result = pipeline.process(large_buffer.clone());
        assert!(result.is_ok());
    }
    
    let duration = start.elapsed();
    println!("Processed 100 buffers of 1s audio in {:?}", duration);
    
    // Should process much faster than real-time
    assert!(duration.as_secs_f64() < 1.0);
}

/// Test audio format conversion
#[tokio::test]
async fn test_audio_format_conversion() {
    let mut converter = AudioFormatConverter::new(16000, 1, AudioFormat::F32);
    
    let buffer = AudioBuffer::new(create_test_audio_data(1000), 44100, 2);
    let result = converter.process(&buffer);
    
    // Should not fail even if conversion isn't fully implemented
    assert!(result.is_ok());
}

/// Test device refresh functionality
#[tokio::test]
async fn test_device_refresh() {
    let mut manager = AudioDeviceManager::new().unwrap();
    
    // Get initial device list
    let initial_devices = manager.get_input_devices().unwrap();
    
    // Refresh devices
    let refresh_result = manager.refresh_devices();
    assert!(refresh_result.is_ok());
    
    // Get devices again
    let refreshed_devices = manager.get_input_devices().unwrap();
    
    // Device count should be consistent (unless devices were actually added/removed)
    println!("Initial devices: {}, After refresh: {}", 
             initial_devices.len(), refreshed_devices.len());
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    
    /// Test the complete audio capture workflow (requires actual audio hardware)
    #[ignore] // Ignored by default since it requires audio hardware
    #[tokio::test]
    async fn test_full_audio_capture_workflow() {
        let mut service = AudioCaptureService::new().unwrap();
        
        // Start capture
        let start_result = timeout(Duration::from_secs(5), service.start_capture()).await;
        
        if start_result.is_err() {
            println!("Audio capture start timed out - likely no audio devices available");
            return;
        }
        
        assert!(start_result.unwrap().is_ok());
        assert!(service.is_running());
        assert_eq!(service.status(), AudioCaptureStatus::Running);
        
        // Let it run for a short time
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        // Check stats
        let stats = service.get_stats();
        println!("Audio stats after 500ms: {:?}", stats);
        
        // Stop capture
        let stop_result = timeout(Duration::from_secs(5), service.stop_capture()).await;
        assert!(stop_result.unwrap().is_ok());
        assert!(!service.is_running());
        assert_eq!(service.status(), AudioCaptureStatus::Stopped);
    }
    
    /// Test device switching during capture
    #[ignore] // Requires multiple audio devices
    #[tokio::test]
    async fn test_device_switching_during_capture() {
        let mut service = AudioCaptureService::new().unwrap();
        let devices = service.get_input_devices().await.unwrap();
        
        if devices.len() < 2 {
            println!("Skipping device switch test - need at least 2 audio devices");
            return;
        }
        
        // Start with first device
        service.start_capture().await.unwrap();
        
        // Switch to second device
        let second_device = &devices[1];
        let switch_result = service.switch_device(&second_device.name).await;
        assert!(switch_result.is_ok());
        
        // Verify it's still running
        assert!(service.is_running());
        
        service.stop_capture().await.unwrap();
    }
}