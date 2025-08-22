//! Audio processing types and error definitions

use std::time::Duration;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Custom error types for audio processing operations
#[derive(Debug, Error)]
pub enum AudioError {
    #[error("Audio device not found: {device}")]
    DeviceNotFound { device: String },
    
    #[error("Permission denied for audio access")]
    PermissionDenied,
    
    #[error("Buffer overflow: {size} bytes")]
    BufferOverflow { size: usize },
    
    #[error("CPAL build stream error: {0}")]
    Cpal(#[from] cpal::BuildStreamError),
    
    #[error("Device configuration error: {0}")]
    Config(#[from] cpal::DefaultStreamConfigError),
    
    #[error("Supported stream configs error: {0}")]
    SupportedConfigs(#[from] cpal::SupportedStreamConfigsError),
    
    #[error("Stream error: {0}")]
    Stream(#[from] cpal::StreamError),
    
    #[error("Play stream error: {0}")]
    PlayStream(#[from] cpal::PlayStreamError),
    
    #[error("Device enumeration error: {0}")]
    DeviceEnumeration(#[from] cpal::DevicesError),
    
    #[error("Audio format not supported: {details}")]
    UnsupportedFormat { details: String },
    
    #[error("Audio service not initialized")]
    NotInitialized,
    
    #[error("Audio service already running")]
    AlreadyRunning,
    
    #[error("Internal error: {message}")]
    Internal { message: String },
}

/// Audio device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub name: String,
    pub is_default: bool,
    pub is_available: bool,
    pub device_type: AudioDeviceType,
}

/// Type of audio device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioDeviceType {
    Input,
    Output,
}

/// Audio configuration for capture
#[derive(Debug, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
    pub format: AudioFormat,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,  // 16kHz for transcription
            channels: 1,         // Mono
            buffer_size: 1024,   // ~64ms at 16kHz
            format: AudioFormat::F32,
        }
    }
}

/// Supported audio formats
#[derive(Debug, Clone, Copy)]
pub enum AudioFormat {
    F32,
    I16,
}

/// Audio buffer containing captured samples
#[derive(Debug, Clone)]
pub struct AudioBuffer {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub timestamp: std::time::Instant,
}

impl AudioBuffer {
    /// Create a new audio buffer
    pub fn new(samples: Vec<f32>, sample_rate: u32, channels: u16) -> Self {
        Self {
            samples,
            sample_rate,
            channels,
            timestamp: std::time::Instant::now(),
        }
    }
    
    /// Get the duration of the audio buffer in milliseconds
    pub fn duration_ms(&self) -> f64 {
        (self.samples.len() as f64) / (self.sample_rate as f64 * self.channels as f64) * 1000.0
    }
    
    /// Calculate RMS (Root Mean Square) level for audio visualization
    pub fn rms_level(&self) -> f32 {
        if self.samples.is_empty() {
            return 0.0;
        }
        
        let sum_squares: f32 = self.samples.iter().map(|&sample| sample * sample).sum();
        (sum_squares / self.samples.len() as f32).sqrt()
    }
    
    /// Convert to mono if stereo
    pub fn to_mono(&self) -> AudioBuffer {
        if self.channels == 1 {
            return self.clone();
        }
        
        let mono_samples: Vec<f32> = self.samples
            .chunks(self.channels as usize)
            .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
            .collect();
            
        AudioBuffer::new(mono_samples, self.sample_rate, 1)
    }
}

/// Audio capture statistics
#[derive(Debug, Clone, Serialize)]
pub struct AudioStats {
    pub samples_processed: u64,
    pub buffer_overruns: u64,
    pub buffer_underruns: u64,
    pub average_latency_ms: f64,
    pub peak_level: f32,
    pub rms_level: f32,
}

impl Default for AudioStats {
    fn default() -> Self {
        Self {
            samples_processed: 0,
            buffer_overruns: 0,
            buffer_underruns: 0,
            average_latency_ms: 0.0,
            peak_level: 0.0,
            rms_level: 0.0,
        }
    }
}

/// Audio capture status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum AudioCaptureStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error,
}

/// Audio processing callback trait
pub trait AudioProcessor: Send + Sync {
    /// Process incoming audio buffer
    fn process(&mut self, buffer: &AudioBuffer) -> Result<(), AudioError>;
    
    /// Get current audio statistics
    fn stats(&self) -> AudioStats;
}

/// Ring buffer for efficient audio data storage
pub struct RingBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    write_pos: usize,
    read_pos: usize,
    size: usize,
}

impl RingBuffer {
    /// Create a new ring buffer with specified capacity
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0.0; capacity],
            capacity,
            write_pos: 0,
            read_pos: 0,
            size: 0,
        }
    }
    
    /// Write samples to the ring buffer
    pub fn write(&mut self, samples: &[f32]) -> Result<usize, AudioError> {
        let available_space = self.capacity - self.size;
        if samples.len() > available_space {
            return Err(AudioError::BufferOverflow { size: samples.len() });
        }
        
        let mut written = 0;
        for &sample in samples {
            self.buffer[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.capacity;
            written += 1;
        }
        
        self.size += written;
        Ok(written)
    }
    
    /// Read samples from the ring buffer
    pub fn read(&mut self, output: &mut [f32]) -> usize {
        let available_samples = self.size.min(output.len());
        
        for i in 0..available_samples {
            output[i] = self.buffer[self.read_pos];
            self.read_pos = (self.read_pos + 1) % self.capacity;
        }
        
        self.size -= available_samples;
        available_samples
    }
    
    /// Get the number of available samples to read
    pub fn available(&self) -> usize {
        self.size
    }
    
    /// Get the available space for writing
    pub fn space_available(&self) -> usize {
        self.capacity - self.size
    }
    
    /// Clear the ring buffer
    pub fn clear(&mut self) {
        self.read_pos = 0;
        self.write_pos = 0;
        self.size = 0;
    }
}

/// Audio level monitor for real-time feedback
#[derive(Debug)]
pub struct AudioLevelMonitor {
    peak_level: f32,
    rms_level: f32,
    peak_decay_rate: f32,
}

impl AudioLevelMonitor {
    pub fn new() -> Self {
        Self {
            peak_level: 0.0,
            rms_level: 0.0,
            peak_decay_rate: 0.95, // Decay rate for peak level
        }
    }
    
    /// Update levels with new audio buffer
    pub fn update(&mut self, buffer: &AudioBuffer) {
        // Calculate current RMS level
        self.rms_level = buffer.rms_level();
        
        // Update peak level with decay
        let current_peak = buffer.samples.iter()
            .map(|&s| s.abs())
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0);
            
        if current_peak > self.peak_level {
            self.peak_level = current_peak;
        } else {
            self.peak_level *= self.peak_decay_rate;
        }
    }
    
    /// Get current peak level (0.0 to 1.0)
    pub fn peak_level(&self) -> f32 {
        self.peak_level
    }
    
    /// Get current RMS level (0.0 to 1.0)
    pub fn rms_level(&self) -> f32 {
        self.rms_level
    }
    
    /// Get peak level in decibels
    pub fn peak_level_db(&self) -> f32 {
        if self.peak_level > 0.0 {
            20.0 * self.peak_level.log10()
        } else {
            -100.0 // Silence
        }
    }
    
    /// Get RMS level in decibels
    pub fn rms_level_db(&self) -> f32 {
        if self.rms_level > 0.0 {
            20.0 * self.rms_level.log10()
        } else {
            -100.0 // Silence
        }
    }
}

impl Default for AudioLevelMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Result type alias for audio operations
pub type AudioResult<T> = Result<T, AudioError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_buffer_creation() {
        let samples = vec![0.5, -0.3, 0.8, -0.1];
        let buffer = AudioBuffer::new(samples.clone(), 16000, 1);
        
        assert_eq!(buffer.samples, samples);
        assert_eq!(buffer.sample_rate, 16000);
        assert_eq!(buffer.channels, 1);
        assert!(buffer.duration_ms() > 0.0);
    }
    
    #[test]
    fn test_audio_buffer_rms_level() {
        let samples = vec![0.5, -0.5, 0.3, -0.3];
        let buffer = AudioBuffer::new(samples, 16000, 1);
        let rms = buffer.rms_level();
        
        // Expected RMS: sqrt((0.25 + 0.25 + 0.09 + 0.09) / 4) = sqrt(0.17) ≈ 0.412
        assert!((rms - 0.412).abs() < 0.01);
    }
    
    #[test]
    fn test_ring_buffer_write_read() {
        let mut ring_buffer = RingBuffer::new(10);
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        
        // Write samples
        let written = ring_buffer.write(&samples).unwrap();
        assert_eq!(written, 5);
        assert_eq!(ring_buffer.available(), 5);
        
        // Read samples
        let mut output = vec![0.0; 3];
        let read = ring_buffer.read(&mut output);
        assert_eq!(read, 3);
        assert_eq!(output, vec![1.0, 2.0, 3.0]);
        assert_eq!(ring_buffer.available(), 2);
    }
    
    #[test]
    fn test_ring_buffer_overflow() {
        let mut ring_buffer = RingBuffer::new(5);
        let samples = vec![1.0; 10]; // More than capacity
        
        let result = ring_buffer.write(&samples);
        assert!(matches!(result, Err(AudioError::BufferOverflow { size: 10 })));
    }
    
    #[test]
    fn test_audio_level_monitor() {
        let mut monitor = AudioLevelMonitor::new();
        let samples = vec![0.5, -0.8, 0.3, -0.1];
        let buffer = AudioBuffer::new(samples, 16000, 1);
        
        monitor.update(&buffer);
        
        assert!(monitor.peak_level() > 0.7); // Peak should be around 0.8
        assert!(monitor.rms_level() > 0.0);
        assert!(monitor.peak_level_db() < 0.0); // Should be negative dB
    }
    
    #[test]
    fn test_audio_buffer_to_mono() {
        // Stereo samples [L, R, L, R, ...]
        let stereo_samples = vec![0.5, 0.3, 0.8, 0.2];
        let stereo_buffer = AudioBuffer::new(stereo_samples, 16000, 2);
        
        let mono_buffer = stereo_buffer.to_mono();
        
        assert_eq!(mono_buffer.channels, 1);
        assert_eq!(mono_buffer.samples.len(), 2);
        // First sample: (0.5 + 0.3) / 2 = 0.4
        // Second sample: (0.8 + 0.2) / 2 = 0.5
        assert!((mono_buffer.samples[0] - 0.4).abs() < 0.001);
        assert!((mono_buffer.samples[1] - 0.5).abs() < 0.001);
    }
}