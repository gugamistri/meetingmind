//! Audio processing pipeline and quality validation

use std::collections::VecDeque;
use tracing::{debug, info, warn};

use super::types::{
    AudioBuffer, AudioError, AudioResult, AudioProcessor, AudioStats, 
    AudioLevelMonitor, AudioFormat
};

/// Audio processor for real-time audio processing and quality monitoring
pub struct AudioProcessingPipeline {
    processors: Vec<Box<dyn AudioProcessor>>,
    level_monitor: AudioLevelMonitor,
    quality_validator: AudioQualityValidator,
    stats: AudioStats,
    buffer_history: VecDeque<AudioBuffer>,
    max_history_size: usize,
}

impl AudioProcessingPipeline {
    /// Create a new audio processing pipeline
    pub fn new() -> Self {
        Self {
            processors: Vec::new(),
            level_monitor: AudioLevelMonitor::new(),
            quality_validator: AudioQualityValidator::new(),
            stats: AudioStats::default(),
            buffer_history: VecDeque::new(),
            max_history_size: 100, // Keep last 100 buffers for analysis
        }
    }
    
    /// Add a processor to the pipeline
    pub fn add_processor(&mut self, processor: Box<dyn AudioProcessor>) {
        info!("Adding audio processor to pipeline");
        self.processors.push(processor);
    }
    
    /// Process an audio buffer through the pipeline
    pub fn process(&mut self, buffer: AudioBuffer) -> AudioResult<AudioBuffer> {
        // Update level monitor
        self.level_monitor.update(&buffer);
        
        // Validate audio quality
        if let Err(e) = self.quality_validator.validate(&buffer) {
            warn!("Audio quality validation failed: {}", e);
            // Continue processing despite quality issues
        }
        
        // Process through all processors
        for processor in &mut self.processors {
            processor.process(&buffer)?;
        }
        
        // Store in history for analysis
        self.buffer_history.push_back(buffer.clone());
        if self.buffer_history.len() > self.max_history_size {
            self.buffer_history.pop_front();
        }
        
        // Update statistics
        self.update_stats(&buffer);
        
        debug!("Processed audio buffer: {} samples", buffer.samples.len());
        Ok(buffer)
    }
    
    /// Update processing statistics
    fn update_stats(&mut self, buffer: &AudioBuffer) {
        self.stats.samples_processed += buffer.samples.len() as u64;
        self.stats.peak_level = self.stats.peak_level.max(self.level_monitor.peak_level());
        self.stats.rms_level = self.level_monitor.rms_level();
        
        // Calculate average latency (simple approximation)
        let buffer_duration_ms = buffer.duration_ms();
        self.stats.average_latency_ms = (self.stats.average_latency_ms + buffer_duration_ms) / 2.0;
    }
    
    /// Get current audio level
    pub fn current_level(&self) -> f32 {
        self.level_monitor.rms_level()
    }
    
    /// Get current peak level
    pub fn peak_level(&self) -> f32 {
        self.level_monitor.peak_level()
    }
    
    /// Get processing statistics
    pub fn stats(&self) -> AudioStats {
        self.stats.clone()
    }
    
    /// Reset statistics
    pub fn reset_stats(&mut self) {
        self.stats = AudioStats::default();
        debug!("Reset audio processing statistics");
    }
    
    /// Get recent audio history for analysis
    pub fn get_recent_history(&self, count: usize) -> Vec<AudioBuffer> {
        let start_idx = if self.buffer_history.len() > count {
            self.buffer_history.len() - count
        } else {
            0
        };
        
        self.buffer_history.range(start_idx..).cloned().collect()
    }
    
    /// Analyze recent audio for patterns or issues
    pub fn analyze_recent_audio(&self) -> AudioAnalysis {
        let recent_buffers = self.get_recent_history(10);
        AudioAnalyzer::analyze(&recent_buffers)
    }
}

/// Audio quality validator
pub struct AudioQualityValidator {
    min_sample_rate: u32,
    max_sample_rate: u32,
    min_buffer_duration_ms: f64,
    max_buffer_duration_ms: f64,
    silence_threshold: f32,
    clipping_threshold: f32,
}

impl AudioQualityValidator {
    /// Create a new audio quality validator with default parameters
    pub fn new() -> Self {
        Self {
            min_sample_rate: 8000,   // Minimum for speech
            max_sample_rate: 192000, // Maximum reasonable
            min_buffer_duration_ms: 10.0,  // 10ms minimum
            max_buffer_duration_ms: 1000.0, // 1s maximum
            silence_threshold: 0.001, // Below this is considered silence
            clipping_threshold: 0.95, // Above this is considered clipping
        }
    }
    
    /// Validate an audio buffer for quality issues
    pub fn validate(&self, buffer: &AudioBuffer) -> AudioResult<()> {
        // Check sample rate
        if buffer.sample_rate < self.min_sample_rate {
            return Err(AudioError::UnsupportedFormat {
                details: format!("Sample rate {} too low (minimum: {})", 
                    buffer.sample_rate, self.min_sample_rate)
            });
        }
        
        if buffer.sample_rate > self.max_sample_rate {
            return Err(AudioError::UnsupportedFormat {
                details: format!("Sample rate {} too high (maximum: {})", 
                    buffer.sample_rate, self.max_sample_rate)
            });
        }
        
        // Check buffer duration
        let duration = buffer.duration_ms();
        if duration < self.min_buffer_duration_ms {
            warn!("Buffer duration too short: {:.2}ms", duration);
        }
        
        if duration > self.max_buffer_duration_ms {
            warn!("Buffer duration too long: {:.2}ms", duration);
        }
        
        // Check for silence (not necessarily an error, but worth noting)
        if buffer.rms_level() < self.silence_threshold {
            debug!("Detected silence in audio buffer");
        }
        
        // Check for clipping
        let max_sample = buffer.samples.iter()
            .map(|&s| s.abs())
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0);
        
        if max_sample >= self.clipping_threshold {
            warn!("Potential clipping detected: peak level {:.3}", max_sample);
        }
        
        // Check for NaN or infinite values
        for (i, &sample) in buffer.samples.iter().enumerate() {
            if !sample.is_finite() {
                return Err(AudioError::Internal {
                    message: format!("Invalid sample at index {}: {}", i, sample)
                });
            }
        }
        
        Ok(())
    }
    
    /// Set custom quality parameters
    pub fn set_sample_rate_range(&mut self, min: u32, max: u32) {
        self.min_sample_rate = min;
        self.max_sample_rate = max;
    }
    
    /// Set buffer duration range
    pub fn set_duration_range(&mut self, min_ms: f64, max_ms: f64) {
        self.min_buffer_duration_ms = min_ms;
        self.max_buffer_duration_ms = max_ms;
    }
}

/// Noise gate processor to reduce background noise
pub struct NoiseGateProcessor {
    threshold: f32,
    ratio: f32,
    attack_time: f32,
    release_time: f32,
    envelope: f32,
}

impl NoiseGateProcessor {
    pub fn new(threshold: f32) -> Self {
        Self {
            threshold,
            ratio: 0.1,        // 10:1 ratio
            attack_time: 0.01,  // 10ms attack
            release_time: 0.1,  // 100ms release
            envelope: 0.0,
        }
    }
}

impl AudioProcessor for NoiseGateProcessor {
    fn process(&mut self, buffer: &AudioBuffer) -> AudioResult<()> {
        let samples_per_ms = buffer.sample_rate as f32 / 1000.0;
        let attack_samples = (self.attack_time * samples_per_ms) as usize;
        let release_samples = (self.release_time * samples_per_ms) as usize;
        
        // Simple noise gate implementation
        for chunk in buffer.samples.chunks(attack_samples.max(1)) {
            let chunk_level = chunk.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
            
            if chunk_level > self.threshold {
                // Above threshold - open gate
                self.envelope = (self.envelope + 1.0).min(1.0);
            } else {
                // Below threshold - close gate gradually
                let decay = 1.0 / release_samples as f32;
                self.envelope = (self.envelope - decay).max(0.0);
            }
        }
        
        debug!("Noise gate processed {} samples, envelope: {:.3}", 
               buffer.samples.len(), self.envelope);
        Ok(())
    }
    
    fn stats(&self) -> AudioStats {
        // Could track gate open/close statistics
        AudioStats::default()
    }
}

/// Automatic gain control processor
pub struct AutomaticGainControl {
    target_level: f32,
    max_gain: f32,
    attack_time: f32,
    release_time: f32,
    current_gain: f32,
}

impl AutomaticGainControl {
    pub fn new(target_level: f32) -> Self {
        Self {
            target_level,
            max_gain: 8.0,      // Maximum 8x gain
            attack_time: 0.01,   // 10ms attack
            release_time: 0.5,   // 500ms release
            current_gain: 1.0,
        }
    }
}

impl AudioProcessor for AutomaticGainControl {
    fn process(&mut self, buffer: &AudioBuffer) -> AudioResult<()> {
        let current_level = buffer.rms_level();
        
        if current_level > 0.0 {
            let desired_gain = self.target_level / current_level;
            let limited_gain = desired_gain.min(self.max_gain).max(0.1);
            
            // Smooth gain changes
            let time_constant = if limited_gain > self.current_gain {
                self.attack_time
            } else {
                self.release_time
            };
            
            let alpha = (-1.0 / (time_constant * buffer.sample_rate as f32)).exp();
            self.current_gain = alpha * self.current_gain + (1.0 - alpha) * limited_gain;
        }
        
        debug!("AGC processed {} samples, gain: {:.3}", 
               buffer.samples.len(), self.current_gain);
        Ok(())
    }
    
    fn stats(&self) -> AudioStats {
        let stats = AudioStats::default();
        // Could add AGC-specific statistics
        stats
    }
}

/// Audio format converter
pub struct AudioFormatConverter {
    target_sample_rate: u32,
    target_channels: u16,
    target_format: AudioFormat,
}

impl AudioFormatConverter {
    pub fn new(sample_rate: u32, channels: u16, format: AudioFormat) -> Self {
        Self {
            target_sample_rate: sample_rate,
            target_channels: channels,
            target_format: format,
        }
    }
}

impl AudioProcessor for AudioFormatConverter {
    fn process(&mut self, buffer: &AudioBuffer) -> AudioResult<()> {
        // Format conversion would be implemented here
        // For now, just log the operation
        debug!("Format converter processed {} samples", buffer.samples.len());
        Ok(())
    }
    
    fn stats(&self) -> AudioStats {
        AudioStats::default()
    }
}

/// Audio analysis results
#[derive(Debug, Clone)]
pub struct AudioAnalysis {
    pub average_level: f32,
    pub peak_level: f32,
    pub dynamic_range: f32,
    pub silence_percentage: f32,
    pub clipping_percentage: f32,
    pub estimated_snr: f32, // Signal-to-noise ratio estimate
}

/// Audio analyzer for pattern detection and quality analysis
pub struct AudioAnalyzer;

impl AudioAnalyzer {
    /// Analyze a collection of audio buffers
    pub fn analyze(buffers: &[AudioBuffer]) -> AudioAnalysis {
        if buffers.is_empty() {
            return AudioAnalysis {
                average_level: 0.0,
                peak_level: 0.0,
                dynamic_range: 0.0,
                silence_percentage: 100.0,
                clipping_percentage: 0.0,
                estimated_snr: -100.0,
            };
        }
        
        let mut total_samples = 0;
        let mut level_sum = 0.0;
        let mut peak_level: f32 = 0.0;
        let mut silent_samples = 0;
        let mut clipped_samples = 0;
        
        let silence_threshold = 0.001;
        let clipping_threshold = 0.95;
        
        for buffer in buffers {
            total_samples += buffer.samples.len();
            level_sum += buffer.rms_level();
            peak_level = peak_level.max(buffer.samples.iter()
                .map(|&s| s.abs())
                .fold(0.0f32, f32::max));
            
            for &sample in &buffer.samples {
                let abs_sample = sample.abs();
                if abs_sample < silence_threshold {
                    silent_samples += 1;
                }
                if abs_sample >= clipping_threshold {
                    clipped_samples += 1;
                }
            }
        }
        
        let average_level = level_sum / buffers.len() as f32;
        let silence_percentage = (silent_samples as f32 / total_samples as f32) * 100.0;
        let clipping_percentage = (clipped_samples as f32 / total_samples as f32) * 100.0;
        
        // Simple dynamic range calculation
        let dynamic_range = if average_level > 0.0 {
            20.0 * (peak_level / average_level).log10()
        } else {
            0.0
        };
        
        // Estimate SNR (very basic)
        let estimated_snr = if average_level > silence_threshold {
            20.0 * (average_level / silence_threshold).log10()
        } else {
            -100.0
        };
        
        AudioAnalysis {
            average_level,
            peak_level,
            dynamic_range,
            silence_percentage,
            clipping_percentage,
            estimated_snr,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_processing_pipeline_creation() {
        let pipeline = AudioProcessingPipeline::new();
        assert_eq!(pipeline.current_level(), 0.0);
        assert_eq!(pipeline.peak_level(), 0.0);
    }
    
    #[test]
    fn test_audio_quality_validator() {
        let validator = AudioQualityValidator::new();
        
        // Valid buffer
        let valid_buffer = AudioBuffer::new(vec![0.1, 0.2, -0.1, -0.2], 16000, 1);
        assert!(validator.validate(&valid_buffer).is_ok());
        
        // Invalid sample rate (too low)
        let invalid_buffer = AudioBuffer::new(vec![0.1, 0.2], 7000, 1);
        assert!(validator.validate(&invalid_buffer).is_err());
    }
    
    #[test]
    fn test_noise_gate_processor() {
        let mut processor = NoiseGateProcessor::new(0.1);
        let buffer = AudioBuffer::new(vec![0.05, 0.15, 0.02, 0.25], 16000, 1);
        
        let result = processor.process(&buffer);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_automatic_gain_control() {
        let mut agc = AutomaticGainControl::new(0.5);
        let buffer = AudioBuffer::new(vec![0.1, 0.2, 0.1, 0.2], 16000, 1);
        
        let result = agc.process(&buffer);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_audio_analyzer() {
        let buffers = vec![
            AudioBuffer::new(vec![0.1, 0.2, -0.1, -0.2], 16000, 1),
            AudioBuffer::new(vec![0.3, -0.3, 0.4, -0.4], 16000, 1),
        ];
        
        let analysis = AudioAnalyzer::analyze(&buffers);
        
        assert!(analysis.average_level > 0.0);
        assert!(analysis.peak_level > 0.0);
        assert!(analysis.silence_percentage < 100.0);
        assert_eq!(analysis.clipping_percentage, 0.0);
    }
    
    #[test]
    fn test_audio_analyzer_empty() {
        let buffers = vec![];
        let analysis = AudioAnalyzer::analyze(&buffers);
        
        assert_eq!(analysis.average_level, 0.0);
        assert_eq!(analysis.peak_level, 0.0);
        assert_eq!(analysis.silence_percentage, 100.0);
    }
}