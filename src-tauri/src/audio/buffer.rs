//! Audio buffer management with ring buffer implementation

use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tracing::{debug, warn};

use super::types::{AudioBuffer, AudioError, AudioResult, AudioStats};

/// Thread-safe ring buffer for audio samples
pub struct AudioRingBuffer {
    inner: Arc<RwLock<RingBufferInner>>,
    stats: Arc<RwLock<AudioStats>>,
}

struct RingBufferInner {
    buffer: Vec<f32>,
    capacity: usize,
    write_pos: usize,
    read_pos: usize,
    size: usize,
    sample_rate: u32,
    channels: u16,
    last_write_time: Option<Instant>,
}

impl AudioRingBuffer {
    /// Create a new audio ring buffer
    pub fn new(capacity: usize, sample_rate: u32, channels: u16) -> Self {
        Self {
            inner: Arc::new(RwLock::new(RingBufferInner {
                buffer: vec![0.0; capacity],
                capacity,
                write_pos: 0,
                read_pos: 0,
                size: 0,
                sample_rate,
                channels,
                last_write_time: None,
            })),
            stats: Arc::new(RwLock::new(AudioStats::default())),
        }
    }
    
    /// Write audio samples to the buffer
    pub fn write(&self, samples: &[f32]) -> AudioResult<usize> {
        let mut inner = self.inner.write()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire write lock".to_string() 
            })?;
        
        let available_space = inner.capacity - inner.size;
        
        if samples.len() > available_space {
            // Update stats for buffer overrun
            if let Ok(mut stats) = self.stats.write() {
                stats.buffer_overruns += 1;
            }
            
            warn!("Audio buffer overrun: {} samples, {} available", samples.len(), available_space);
            return Err(AudioError::BufferOverflow { size: samples.len() });
        }
        
        let mut written = 0;
        for &sample in samples {
            let write_pos = inner.write_pos;
            inner.buffer[write_pos] = sample;
            inner.write_pos = (write_pos + 1) % inner.capacity;
            written += 1;
        }
        
        inner.size += written;
        inner.last_write_time = Some(Instant::now());
        
        // Update stats
        if let Ok(mut stats) = self.stats.write() {
            stats.samples_processed += written as u64;
            
            // Calculate peak and RMS levels from the written samples
            let peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
            stats.peak_level = stats.peak_level.max(peak);
            
            let rms_sum: f32 = samples.iter().map(|&s| s * s).sum();
            let rms = (rms_sum / samples.len() as f32).sqrt();
            stats.rms_level = (stats.rms_level + rms) / 2.0; // Simple moving average
        }
        
        debug!("Wrote {} audio samples to buffer", written);
        Ok(written)
    }
    
    /// Read audio samples from the buffer
    pub fn read(&self, output: &mut [f32]) -> AudioResult<usize> {
        let mut inner = self.inner.write()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire write lock".to_string() 
            })?;
        
        let available_samples = inner.size.min(output.len());
        
        if available_samples == 0 {
            // Update stats for buffer underrun
            if let Ok(mut stats) = self.stats.write() {
                stats.buffer_underruns += 1;
            }
            return Ok(0);
        }
        
        for i in 0..available_samples {
            output[i] = inner.buffer[inner.read_pos];
            inner.read_pos = (inner.read_pos + 1) % inner.capacity;
        }
        
        inner.size -= available_samples;
        
        debug!("Read {} audio samples from buffer", available_samples);
        Ok(available_samples)
    }
    
    /// Read audio samples as an AudioBuffer
    pub fn read_buffer(&self, samples_to_read: usize) -> AudioResult<Option<AudioBuffer>> {
        let inner = self.inner.read()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire read lock".to_string() 
            })?;
        
        if inner.size == 0 {
            return Ok(None);
        }
        
        let samples_to_read = samples_to_read.min(inner.size);
        let mut samples = vec![0.0; samples_to_read];
        
        drop(inner); // Release read lock before calling read
        
        let actual_read = self.read(&mut samples)?;
        if actual_read > 0 {
            samples.truncate(actual_read);
            let inner = self.inner.read()
                .map_err(|_| AudioError::Internal { 
                    message: "Failed to acquire read lock".to_string() 
                })?;
            
            Ok(Some(AudioBuffer::new(samples, inner.sample_rate, inner.channels)))
        } else {
            Ok(None)
        }
    }
    
    /// Get the number of available samples to read
    pub fn available(&self) -> usize {
        self.inner.read()
            .map(|inner| inner.size)
            .unwrap_or(0)
    }
    
    /// Get the available space for writing
    pub fn space_available(&self) -> usize {
        self.inner.read()
            .map(|inner| inner.capacity - inner.size)
            .unwrap_or(0)
    }
    
    /// Get buffer utilization as a percentage (0.0 to 1.0)
    pub fn utilization(&self) -> f32 {
        self.inner.read()
            .map(|inner| inner.size as f32 / inner.capacity as f32)
            .unwrap_or(0.0)
    }
    
    /// Clear the ring buffer
    pub fn clear(&self) -> AudioResult<()> {
        let mut inner = self.inner.write()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire write lock".to_string() 
            })?;
        
        inner.read_pos = 0;
        inner.write_pos = 0;
        inner.size = 0;
        inner.last_write_time = None;
        
        debug!("Cleared audio ring buffer");
        Ok(())
    }
    
    /// Get current audio statistics
    pub fn stats(&self) -> AudioStats {
        self.stats.read()
            .map(|stats| stats.clone())
            .unwrap_or_default()
    }
    
    /// Reset statistics
    pub fn reset_stats(&self) -> AudioResult<()> {
        let mut stats = self.stats.write()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire stats lock".to_string() 
            })?;
        
        *stats = AudioStats::default();
        debug!("Reset audio buffer statistics");
        Ok(())
    }
    
    /// Get the capacity of the buffer
    pub fn capacity(&self) -> usize {
        self.inner.read()
            .map(|inner| inner.capacity)
            .unwrap_or(0)
    }
    
    /// Check if the buffer has been written to recently
    pub fn has_recent_activity(&self, timeout: Duration) -> bool {
        self.inner.read()
            .map(|inner| inner.last_write_time)
            .unwrap_or(None)
            .map(|last_write| last_write.elapsed() < timeout)
            .unwrap_or(false)
    }
    
    /// Get current latency estimate in milliseconds
    pub fn current_latency_ms(&self) -> f64 {
        let inner = self.inner.read().unwrap();
        let samples_in_buffer = inner.size as f64;
        let samples_per_second = inner.sample_rate as f64 * inner.channels as f64;
        
        (samples_in_buffer / samples_per_second) * 1000.0
    }
}

impl Clone for AudioRingBuffer {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            stats: Arc::clone(&self.stats),
        }
    }
}

/// Multi-channel audio ring buffer for advanced use cases
pub struct MultiChannelAudioBuffer {
    buffers: Vec<AudioRingBuffer>,
    channel_count: usize,
    sample_rate: u32,
}

impl MultiChannelAudioBuffer {
    /// Create a new multi-channel audio buffer
    pub fn new(capacity: usize, sample_rate: u32, channels: usize) -> Self {
        let mut buffers = Vec::with_capacity(channels);
        
        for _ in 0..channels {
            buffers.push(AudioRingBuffer::new(capacity, sample_rate, 1));
        }
        
        Self {
            buffers,
            channel_count: channels,
            sample_rate,
        }
    }
    
    /// Write interleaved audio samples to the multi-channel buffer
    pub fn write_interleaved(&self, samples: &[f32]) -> AudioResult<usize> {
        if samples.len() % self.channel_count != 0 {
            return Err(AudioError::Internal { 
                message: "Sample count must be divisible by channel count".to_string() 
            });
        }
        
        let frames = samples.len() / self.channel_count;
        let mut channel_samples: Vec<Vec<f32>> = vec![Vec::with_capacity(frames); self.channel_count];
        
        // De-interleave samples
        for (i, &sample) in samples.iter().enumerate() {
            let channel = i % self.channel_count;
            channel_samples[channel].push(sample);
        }
        
        // Write to each channel buffer
        for (channel, samples) in channel_samples.iter().enumerate() {
            self.buffers[channel].write(samples)?;
        }
        
        Ok(samples.len())
    }
    
    /// Read interleaved audio samples from the multi-channel buffer
    pub fn read_interleaved(&self, output: &mut [f32]) -> AudioResult<usize> {
        if output.len() % self.channel_count != 0 {
            return Err(AudioError::Internal { 
                message: "Output buffer size must be divisible by channel count".to_string() 
            });
        }
        
        let frames = output.len() / self.channel_count;
        let mut channel_outputs: Vec<Vec<f32>> = vec![vec![0.0; frames]; self.channel_count];
        
        // Read from each channel
        let mut min_read = usize::MAX;
        for (channel, buffer) in self.buffers.iter().enumerate() {
            let read = buffer.read(&mut channel_outputs[channel])?;
            min_read = min_read.min(read);
        }
        
        // Interleave the samples
        let mut output_pos = 0;
        for frame in 0..min_read {
            for channel in 0..self.channel_count {
                if output_pos < output.len() {
                    output[output_pos] = channel_outputs[channel][frame];
                    output_pos += 1;
                }
            }
        }
        
        Ok(min_read * self.channel_count)
    }
    
    /// Get the number of available samples (per channel)
    pub fn available(&self) -> usize {
        self.buffers.iter()
            .map(|buffer| buffer.available())
            .min()
            .unwrap_or(0)
    }
    
    /// Clear all channel buffers
    pub fn clear(&self) -> AudioResult<()> {
        for buffer in &self.buffers {
            buffer.clear()?;
        }
        Ok(())
    }
    
    /// Get combined statistics from all channels
    pub fn combined_stats(&self) -> AudioStats {
        let mut combined = AudioStats::default();
        
        for buffer in &self.buffers {
            let stats = buffer.stats();
            combined.samples_processed += stats.samples_processed;
            combined.buffer_overruns += stats.buffer_overruns;
            combined.buffer_underruns += stats.buffer_underruns;
            combined.peak_level = combined.peak_level.max(stats.peak_level);
            combined.rms_level += stats.rms_level;
        }
        
        // Average RMS across channels
        combined.rms_level /= self.channel_count as f32;
        
        // Average latency
        combined.average_latency_ms = self.buffers.iter()
            .map(|buffer| buffer.current_latency_ms())
            .sum::<f64>() / self.channel_count as f64;
        
        combined
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_audio_ring_buffer_creation() {
        let buffer = AudioRingBuffer::new(1024, 16000, 1);
        assert_eq!(buffer.capacity(), 1024);
        assert_eq!(buffer.available(), 0);
        assert_eq!(buffer.space_available(), 1024);
    }
    
    #[test]
    fn test_audio_ring_buffer_write_read() {
        let buffer = AudioRingBuffer::new(100, 16000, 1);
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        
        // Write samples
        let written = buffer.write(&samples).unwrap();
        assert_eq!(written, 5);
        assert_eq!(buffer.available(), 5);
        
        // Read samples
        let mut output = vec![0.0; 3];
        let read = buffer.read(&mut output).unwrap();
        assert_eq!(read, 3);
        assert_eq!(output, vec![1.0, 2.0, 3.0]);
        assert_eq!(buffer.available(), 2);
    }
    
    #[test]
    fn test_audio_ring_buffer_overflow() {
        let buffer = AudioRingBuffer::new(5, 16000, 1);
        let samples = vec![1.0; 10]; // More than capacity
        
        let result = buffer.write(&samples);
        assert!(matches!(result, Err(AudioError::BufferOverflow { size: 10 })));
    }
    
    #[test]
    fn test_audio_ring_buffer_wraparound() {
        let buffer = AudioRingBuffer::new(5, 16000, 1);
        
        // Fill buffer
        let samples1 = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        buffer.write(&samples1).unwrap();
        
        // Read some samples
        let mut output = vec![0.0; 3];
        buffer.read(&mut output).unwrap();
        assert_eq!(output, vec![1.0, 2.0, 3.0]);
        
        // Write more samples (should wrap around)
        let samples2 = vec![6.0, 7.0, 8.0];
        buffer.write(&samples2).unwrap();
        
        // Read remaining samples
        let mut output2 = vec![0.0; 5];
        let read = buffer.read(&mut output2).unwrap();
        assert_eq!(read, 5);
        assert_eq!(output2, vec![4.0, 5.0, 6.0, 7.0, 8.0]);
    }
    
    #[test]
    fn test_audio_ring_buffer_stats() {
        let buffer = AudioRingBuffer::new(100, 16000, 1);
        let samples = vec![0.5, -0.5, 0.8, -0.3];
        
        buffer.write(&samples).unwrap();
        
        let stats = buffer.stats();
        assert_eq!(stats.samples_processed, 4);
        assert!(stats.peak_level > 0.7); // Should detect the 0.8 peak
        assert!(stats.rms_level > 0.0);
    }
    
    #[test]
    fn test_multi_channel_buffer() {
        let buffer = MultiChannelAudioBuffer::new(100, 16000, 2);
        
        // Interleaved stereo samples [L, R, L, R, ...]
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        
        let written = buffer.write_interleaved(&samples).unwrap();
        assert_eq!(written, 6);
        
        let mut output = vec![0.0; 4];
        let read = buffer.read_interleaved(&mut output).unwrap();
        assert_eq!(read, 4);
        assert_eq!(output, vec![1.0, 2.0, 3.0, 4.0]);
    }
    
    #[test]
    fn test_buffer_utilization() {
        let buffer = AudioRingBuffer::new(100, 16000, 1);
        
        assert_eq!(buffer.utilization(), 0.0);
        
        let samples = vec![1.0; 50];
        buffer.write(&samples).unwrap();
        
        assert_eq!(buffer.utilization(), 0.5);
    }
    
    #[test]
    fn test_recent_activity() {
        let buffer = AudioRingBuffer::new(100, 16000, 1);
        
        assert!(!buffer.has_recent_activity(Duration::from_millis(100)));
        
        let samples = vec![1.0, 2.0, 3.0];
        buffer.write(&samples).unwrap();
        
        assert!(buffer.has_recent_activity(Duration::from_millis(100)));
        
        // Wait and check again
        thread::sleep(Duration::from_millis(150));
        assert!(!buffer.has_recent_activity(Duration::from_millis(100)));
    }
}