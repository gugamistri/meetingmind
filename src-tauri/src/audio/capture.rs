//! Audio capture service implementation using CPAL

use std::sync::{Arc, RwLock, atomic::{AtomicBool, Ordering}};
use std::time::Instant;
use cpal::{Device, Stream, traits::{DeviceTrait, StreamTrait}};
use tokio::sync::{mpsc, broadcast};
use tracing::{debug, info, warn, error, instrument};
use uuid;

use super::types::{
    AudioBuffer, AudioConfig, AudioError, AudioResult, AudioCaptureStatus, 
    AudioLevelMonitor, AudioStats
};
use crate::transcription::TranscriptionService;

/// Unsafe wrapper to make Stream Send + Sync
/// WARNING: This is potentially unsafe and should only be used in single-threaded contexts
struct StreamWrapper(Option<Stream>);

unsafe impl Send for StreamWrapper {}
unsafe impl Sync for StreamWrapper {}
use super::devices::AudioDeviceManager;
use super::buffer::AudioRingBuffer;

/// Audio capture service for system audio capture
pub struct AudioCaptureService {
    device_manager: Arc<RwLock<AudioDeviceManager>>,
    current_stream: Arc<RwLock<StreamWrapper>>,
    ring_buffer: Option<AudioRingBuffer>,
    status: Arc<RwLock<AudioCaptureStatus>>,
    is_running: Arc<AtomicBool>,
    level_monitor: Arc<RwLock<AudioLevelMonitor>>,
    
    // Communication channels
    audio_sender: Option<mpsc::UnboundedSender<AudioBuffer>>,
    status_broadcaster: broadcast::Sender<AudioCaptureStatus>,
    level_broadcaster: broadcast::Sender<f32>,
    
    // Configuration
    config: AudioConfig,
    
    // Statistics and monitoring
    stats: Arc<RwLock<AudioStats>>,
    start_time: Arc<RwLock<Option<Instant>>>,
    
    // Session tracking
    current_session_id: Arc<RwLock<String>>,
    
    // Transcription integration
    transcription_service: Option<Arc<TranscriptionService>>,
    transcription_enabled: bool,
}

impl AudioCaptureService {
    /// Create a new audio capture service
    pub fn new() -> AudioResult<Self> {
        let device_manager = Arc::new(RwLock::new(AudioDeviceManager::new()?));
        let (status_broadcaster, _) = broadcast::channel(16);
        let (level_broadcaster, _) = broadcast::channel(64);
        
        info!("Created new audio capture service");
        
        Ok(Self {
            device_manager,
            current_stream: Arc::new(RwLock::new(StreamWrapper(None))),
            ring_buffer: None,
            status: Arc::new(RwLock::new(AudioCaptureStatus::Stopped)),
            is_running: Arc::new(AtomicBool::new(false)),
            level_monitor: Arc::new(RwLock::new(AudioLevelMonitor::new())),
            audio_sender: None,
            status_broadcaster,
            level_broadcaster,
            config: AudioConfig::default(),
            stats: Arc::new(RwLock::new(AudioStats::default())),
            start_time: Arc::new(RwLock::new(None)),
            current_session_id: Arc::new(RwLock::new(uuid::Uuid::new_v4().to_string())),
            transcription_service: None,
            transcription_enabled: false,
        })
    }
    
    /// Set transcription service and enable transcription
    pub fn set_transcription_service(&mut self, service: Arc<TranscriptionService>) {
        info!("Transcription service attached to audio capture");
        self.transcription_service = Some(service);
        self.transcription_enabled = true;
    }
    
    /// Enable or disable transcription
    pub fn set_transcription_enabled(&mut self, enabled: bool) {
        self.transcription_enabled = enabled;
        info!("Transcription {} for audio capture", if enabled { "enabled" } else { "disabled" });
    }
    
    /// Create audio capture service with custom configuration
    pub fn with_config(config: AudioConfig) -> AudioResult<Self> {
        let mut service = Self::new()?;
        service.config = config;
        info!("Created audio capture service with custom config: {:?}", service.config);
        Ok(service)
    }
    
    /// Start audio capture
    #[instrument(skip(self))]
    pub async fn start_capture(&mut self) -> AudioResult<()> {
        info!("Starting audio capture");
        
        // Check if already running
        if self.is_running.load(Ordering::Relaxed) {
            warn!("Audio capture already running");
            return Err(AudioError::AlreadyRunning);
        }
        
        // Generate new session ID for this recording
        let session_id = uuid::Uuid::new_v4().to_string();
        *self.current_session_id.write().unwrap() = session_id.clone();
        info!("Started new audio capture session: {}", session_id);
        
        // Start transcription session if enabled
        if self.transcription_enabled {
            if let Some(ref transcription_service) = self.transcription_service {
                match transcription_service.start_session(&session_id).await {
                    Ok(()) => {
                        info!("Transcription session started for session: {}", session_id);
                    }
                    Err(e) => {
                        error!("Failed to start transcription session: {}", e);
                        // Don't fail audio capture if transcription fails
                    }
                }
            }
        }
        
        // Update status
        self.update_status(AudioCaptureStatus::Starting).await?;
        
        // Get default input device
        let device = {
            let mut device_manager = self.device_manager.write()
                .map_err(|_| AudioError::Internal { 
                    message: "Failed to acquire device manager lock".to_string() 
                })?;
            device_manager.get_default_input_device()?
        };
        
        // Set up audio stream
        self.setup_audio_stream(&device).await?;
        
        // Start the stream
        if let Ok(stream_guard) = self.current_stream.read() {
            if let Some(ref stream) = stream_guard.0 {
                stream.play().map_err(AudioError::PlayStream)?;
                info!("Audio stream started successfully");
            }
        }
        
        // Update state
        self.is_running.store(true, Ordering::Relaxed);
        *self.start_time.write().unwrap() = Some(Instant::now());
        self.update_status(AudioCaptureStatus::Running).await?;
        
        info!("Audio capture started successfully with session ID: {}", session_id);
        Ok(())
    }
    
    /// Stop audio capture
    #[instrument(skip(self))]
    pub async fn stop_capture(&mut self) -> AudioResult<()> {
        info!("Stopping audio capture");
        
        if !self.is_running.load(Ordering::Relaxed) {
            debug!("Audio capture not running, nothing to stop");
            return Ok(());
        }
        
        // Stop transcription session if enabled
        if self.transcription_enabled {
            if let Some(ref transcription_service) = self.transcription_service {
                match transcription_service.stop_session().await {
                    Ok(()) => {
                        info!("Transcription session stopped successfully");
                    }
                    Err(e) => {
                        error!("Failed to stop transcription session: {}", e);
                        // Continue with audio capture stop even if transcription fails
                    }
                }
            }
        }
        
        // Update status
        self.update_status(AudioCaptureStatus::Stopping).await?;
        
        // Stop the stream
        if let Ok(mut stream_guard) = self.current_stream.write() {
            if let Some(stream) = stream_guard.0.take() {
                drop(stream); // This stops the stream
                info!("Audio stream stopped");
            }
        }
        
        // Clear buffer
        if let Some(ref buffer) = self.ring_buffer {
            buffer.clear()?;
        }
        
        // Update state
        self.is_running.store(false, Ordering::Relaxed);
        self.update_status(AudioCaptureStatus::Stopped).await?;
        
        info!("Audio capture stopped successfully");
        Ok(())
    }
    
    /// Set up audio stream with the given device
    async fn setup_audio_stream(&mut self, device: &Device) -> AudioResult<()> {
        info!("Setting up audio stream");
        
        // Find best configuration
        let stream_config = {
            let device_manager = self.device_manager.read()
                .map_err(|_| AudioError::Internal { 
                    message: "Failed to acquire device manager lock".to_string() 
                })?;
            device_manager.find_best_input_config(device, self.config.sample_rate)?
        };
        
        debug!("Using stream config: {:?}", stream_config);
        
        // Create ring buffer
        let buffer_capacity = self.config.buffer_size * 4; // 4x buffer size for safety
        let ring_buffer = AudioRingBuffer::new(
            buffer_capacity, 
            stream_config.sample_rate.0, 
            stream_config.channels
        );
        
        // Create audio processing channel
        let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<AudioBuffer>();
        self.audio_sender = Some(audio_tx);
        
        // Clone shared state for the audio callback
        let buffer_clone = ring_buffer.clone();
        let level_monitor_clone = Arc::clone(&self.level_monitor);
        let level_broadcaster_clone = self.level_broadcaster.clone();
        let stats_clone = Arc::clone(&self.stats);
        let target_sample_rate = self.config.sample_rate;
        let target_channels = self.config.channels;
        
        // Build input stream
        let stream = device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Handle audio data in callback
                if let Err(e) = Self::handle_audio_callback(
                    data,
                    &buffer_clone,
                    &level_monitor_clone,
                    &level_broadcaster_clone,
                    &stats_clone,
                    stream_config.sample_rate.0,
                    stream_config.channels,
                    target_sample_rate,
                    target_channels,
                ) {
                    error!("Audio callback error: {}", e);
                }
            },
            move |err| {
                error!("Audio stream error: {}", err);
            },
            None, // No timeout
        ).map_err(AudioError::Cpal)?;
        
        // Store the stream and buffer
        *self.current_stream.write().unwrap() = StreamWrapper(Some(stream));
        self.ring_buffer = Some(ring_buffer);
        
        // Spawn audio processing task
        self.spawn_audio_processor(audio_rx).await;
        
        info!("Audio stream setup completed");
        Ok(())
    }
    
    /// Handle audio data in the stream callback
    fn handle_audio_callback(
        data: &[f32],
        ring_buffer: &AudioRingBuffer,
        level_monitor: &Arc<RwLock<AudioLevelMonitor>>,
        level_broadcaster: &broadcast::Sender<f32>,
        stats: &Arc<RwLock<AudioStats>>,
        source_sample_rate: u32,
        source_channels: u16,
        target_sample_rate: u32,
        target_channels: u16,
    ) -> AudioResult<()> {
        // Create audio buffer from the input data
        let mut audio_buffer = AudioBuffer::new(
            data.to_vec(), 
            source_sample_rate, 
            source_channels
        );
        
        // Convert to target format if necessary
        if source_channels != target_channels && target_channels == 1 {
            audio_buffer = audio_buffer.to_mono();
        }
        
        // Resample if necessary (simple implementation for now)
        if source_sample_rate != target_sample_rate {
            audio_buffer = Self::resample_audio_buffer(audio_buffer, target_sample_rate)?;
        }
        
        // Update level monitor
        if let Ok(mut monitor) = level_monitor.write() {
            monitor.update(&audio_buffer);
            let rms_level = monitor.rms_level();
            
            // Broadcast level update (non-blocking)
            let _ = level_broadcaster.send(rms_level);
        }
        
        // Write to ring buffer
        if let Err(e) = ring_buffer.write(&audio_buffer.samples) {
            warn!("Failed to write to ring buffer: {}", e);
            
            // Update stats
            if let Ok(mut stats_guard) = stats.write() {
                stats_guard.buffer_overruns += 1;
            }
        }
        
        Ok(())
    }
    
    /// Simple audio resampling (basic implementation)
    fn resample_audio_buffer(
        buffer: AudioBuffer, 
        target_sample_rate: u32
    ) -> AudioResult<AudioBuffer> {
        let ratio = target_sample_rate as f64 / buffer.sample_rate as f64;
        
        if (ratio - 1.0).abs() < 0.001 {
            // No resampling needed
            return Ok(buffer);
        }
        
        let target_length = (buffer.samples.len() as f64 * ratio) as usize;
        let mut resampled = Vec::with_capacity(target_length);
        
        for i in 0..target_length {
            let source_index = (i as f64 / ratio) as usize;
            if source_index < buffer.samples.len() {
                resampled.push(buffer.samples[source_index]);
            } else {
                resampled.push(0.0);
            }
        }
        
        Ok(AudioBuffer::new(resampled, target_sample_rate, buffer.channels))
    }
    
    /// Spawn audio processing task
    async fn spawn_audio_processor(&self, mut audio_rx: mpsc::UnboundedReceiver<AudioBuffer>) {
        let _ring_buffer = self.ring_buffer.as_ref().unwrap().clone();
        let session_id = self.current_session_id.clone();
        let transcription_service = self.transcription_service.clone();
        let transcription_enabled = self.transcription_enabled;
        
        tokio::spawn(async move {
            info!("Audio processor task started with transcription: {}", transcription_enabled);
            let mut sample_count = 0;
            let mut total_duration = 0.0;
            let mut audio_chunk_buffer = Vec::new();
            const CHUNK_SIZE_SECONDS: f32 = 3.0; // Process transcription every 3 seconds
            
            while let Some(audio_buffer) = audio_rx.recv().await {
                sample_count += audio_buffer.samples.len();
                total_duration += audio_buffer.samples.len() as f64 / audio_buffer.sample_rate as f64;
                
                // Accumulate audio samples for transcription processing
                audio_chunk_buffer.extend_from_slice(&audio_buffer.samples);
                
                // Process transcription when we have enough audio (3 seconds worth)
                let chunk_size_samples = (CHUNK_SIZE_SECONDS * audio_buffer.sample_rate as f32) as usize;
                
                if audio_chunk_buffer.len() >= chunk_size_samples && transcription_enabled {
                    if let Some(ref service) = transcription_service {
                        // Extract chunk for transcription
                        let chunk_data: Vec<f32> = audio_chunk_buffer.drain(..chunk_size_samples).collect();
                        
                        // Process transcription asynchronously
                        let service_clone = service.clone();
                        let chunk_sample_rate = audio_buffer.sample_rate;
                        tokio::spawn(async move {
                            match service_clone.process_audio_chunk(&chunk_data, chunk_sample_rate).await {
                                Ok(transcription_chunks) => {
                                    for chunk in transcription_chunks {
                                        info!(
                                            "Transcription: \"{}\" (confidence: {:.2})", 
                                            chunk.text.trim(), 
                                            chunk.confidence
                                        );
                                    }
                                }
                                Err(e) => {
                                    error!("Transcription processing error: {}", e);
                                }
                            }
                        });
                    }
                }
                
                // Log audio processing progress every 5 seconds of audio
                if (sample_count % (5 * audio_buffer.sample_rate as usize)) < audio_buffer.samples.len() {
                    info!(
                        "Audio processing: {} samples captured, {:.1}s total duration, session: {}", 
                        sample_count, total_duration, session_id.read().unwrap()
                    );
                }
                
                // TODO: Add audio file writing
                // - Create WAV file for the session
                // - Write audio chunks to file
                // - Update database with recording metadata
            }
            
            // Process any remaining audio for transcription
            if !audio_chunk_buffer.is_empty() && transcription_enabled {
                if let Some(ref service) = transcription_service {
                    let final_chunk = audio_chunk_buffer.clone();
                    let service_clone = service.clone();
                    tokio::spawn(async move {
                        match service_clone.process_audio_chunk(&final_chunk, 16000).await {
                            Ok(transcription_chunks) => {
                                for chunk in transcription_chunks {
                                    info!(
                                        "Final transcription: \"{}\" (confidence: {:.2})", 
                                        chunk.text.trim(), 
                                        chunk.confidence
                                    );
                                }
                            }
                            Err(e) => {
                                error!("Final transcription processing error: {}", e);
                            }
                        }
                    });
                }
            }
            
            info!("Audio processor task ended - captured {} samples, {:.1}s total", sample_count, total_duration);
        });
    }
    
    /// Update capture status and broadcast to subscribers
    async fn update_status(&self, new_status: AudioCaptureStatus) -> AudioResult<()> {
        *self.status.write().unwrap() = new_status;
        let _ = self.status_broadcaster.send(new_status); // Non-blocking broadcast
        debug!("Audio capture status updated to: {:?}", new_status);
        Ok(())
    }
    
    /// Get current capture status
    pub fn status(&self) -> AudioCaptureStatus {
        *self.status.read().unwrap()
    }
    
    /// Check if capture is currently running
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
    
    /// Get current audio level (RMS)
    pub fn current_audio_level(&self) -> f32 {
        self.level_monitor.read()
            .map(|monitor| monitor.rms_level())
            .unwrap_or(0.0)
    }
    
    /// Get current peak level
    pub fn current_peak_level(&self) -> f32 {
        self.level_monitor.read()
            .map(|monitor| monitor.peak_level())
            .unwrap_or(0.0)
    }
    
    /// Get current audio level in decibels
    pub fn current_audio_level_db(&self) -> f32 {
        self.level_monitor.read()
            .map(|monitor| monitor.rms_level_db())
            .unwrap_or(-100.0)
    }
    
    /// Get audio capture statistics
    pub fn get_stats(&self) -> AudioStats {
        let mut stats = self.stats.read().unwrap().clone();
        
        // Add ring buffer stats if available
        if let Some(ref buffer) = self.ring_buffer {
            let buffer_stats = buffer.stats();
            stats.samples_processed = buffer_stats.samples_processed;
            stats.buffer_overruns = buffer_stats.buffer_overruns;
            stats.buffer_underruns = buffer_stats.buffer_underruns;
            stats.average_latency_ms = buffer.current_latency_ms();
        }
        
        // Add level monitoring stats
        if let Ok(monitor) = self.level_monitor.read() {
            stats.peak_level = monitor.peak_level();
            stats.rms_level = monitor.rms_level();
        }
        
        stats
    }
    
    /// Subscribe to status changes
    pub fn subscribe_status(&self) -> broadcast::Receiver<AudioCaptureStatus> {
        self.status_broadcaster.subscribe()
    }
    
    /// Subscribe to audio level updates
    pub fn subscribe_levels(&self) -> broadcast::Receiver<f32> {
        self.level_broadcaster.subscribe()
    }
    
    /// Get available audio devices
    pub async fn get_input_devices(&self) -> AudioResult<Vec<super::types::AudioDevice>> {
        let device_manager = self.device_manager.read()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire device manager lock".to_string() 
            })?;
        device_manager.get_input_devices()
    }
    
    /// Switch to a different audio device
    pub async fn switch_device(&mut self, device_name: &str) -> AudioResult<()> {
        info!("Switching to audio device: {}", device_name);
        
        let was_running = self.is_running();
        
        // Stop current capture if running
        if was_running {
            self.stop_capture().await?;
        }
        
        // Switch device
        let device = {
            let mut device_manager = self.device_manager.write()
                .map_err(|_| AudioError::Internal { 
                    message: "Failed to acquire device manager lock".to_string() 
                })?;
            device_manager.get_input_device_by_name(device_name)?
        };
        
        // Restart capture if it was running
        if was_running {
            self.setup_audio_stream(&device).await?;
            
            // Check if stream exists and start it without holding the guard across await
            let should_start = {
                if let Ok(stream_guard) = self.current_stream.read() {
                    stream_guard.0.is_some()
                } else {
                    false
                }
            };
            
            if should_start {
                // Start the stream without holding the lock
                if let Ok(stream_guard) = self.current_stream.read() {
                    if let Some(ref stream) = stream_guard.0 {
                        stream.play().map_err(AudioError::PlayStream)?;
                        self.is_running.store(true, Ordering::Relaxed);
                    }
                }
                // Update status after releasing the lock
                self.update_status(AudioCaptureStatus::Running).await?;
            }
        }
        
        info!("Successfully switched to audio device: {}", device_name);
        Ok(())
    }
    
    /// Read audio buffer from the ring buffer
    pub fn read_audio_buffer(&self, samples_to_read: usize) -> AudioResult<Option<AudioBuffer>> {
        if let Some(ref buffer) = self.ring_buffer {
            buffer.read_buffer(samples_to_read)
        } else {
            Ok(None)
        }
    }
    
    /// Get current buffer utilization
    pub fn buffer_utilization(&self) -> f32 {
        if let Some(ref buffer) = self.ring_buffer {
            buffer.utilization()
        } else {
            0.0
        }
    }
    
    /// Refresh device list
    pub async fn refresh_devices(&self) -> AudioResult<()> {
        let mut device_manager = self.device_manager.write()
            .map_err(|_| AudioError::Internal { 
                message: "Failed to acquire device manager lock".to_string() 
            })?;
        device_manager.refresh_devices()
    }
    
    /// Get configuration
    pub fn config(&self) -> &AudioConfig {
        &self.config
    }
    
    /// Update configuration (requires restart if running)
    pub fn set_config(&mut self, config: AudioConfig) {
        self.config = config;
        info!("Audio configuration updated: {:?}", self.config);
    }
}

impl Drop for AudioCaptureService {
    fn drop(&mut self) {
        if self.is_running() {
            warn!("AudioCaptureService dropped while still running, stopping capture");
            // We can't use async in Drop, so we'll just clean up synchronously
            self.is_running.store(false, Ordering::Relaxed);
            *self.current_stream.write().unwrap() = StreamWrapper(None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::timeout;

    #[tokio::test]
    async fn test_audio_capture_service_creation() {
        let result = AudioCaptureService::new();
        assert!(result.is_ok());
        
        let service = result.unwrap();
        assert_eq!(service.status(), AudioCaptureStatus::Stopped);
        assert!(!service.is_running());
    }
    
    #[tokio::test]
    async fn test_audio_capture_service_with_config() {
        let config = AudioConfig {
            sample_rate: 48000,
            channels: 2,
            buffer_size: 2048,
            format: super::types::AudioFormat::F32,
        };
        
        let result = AudioCaptureService::with_config(config.clone());
        assert!(result.is_ok());
        
        let service = result.unwrap();
        assert_eq!(service.config().sample_rate, 48000);
        assert_eq!(service.config().channels, 2);
    }
    
    #[tokio::test]
    async fn test_get_input_devices() {
        let service = AudioCaptureService::new().unwrap();
        let devices = service.get_input_devices().await;
        
        // Should succeed even if no devices are available
        assert!(devices.is_ok());
    }
    
    #[tokio::test]
    async fn test_status_subscription() {
        let service = AudioCaptureService::new().unwrap();
        let mut status_rx = service.subscribe_status();
        
        // Should be able to subscribe without issues
        assert!(status_rx.try_recv().is_err()); // No initial message
    }
    
    #[tokio::test]
    async fn test_level_subscription() {
        let service = AudioCaptureService::new().unwrap();
        let mut level_rx = service.subscribe_levels();
        
        // Should be able to subscribe without issues
        assert!(level_rx.try_recv().is_err()); // No initial message
    }
    
    #[tokio::test]
    async fn test_stats_initial_state() {
        let service = AudioCaptureService::new().unwrap();
        let stats = service.get_stats();
        
        assert_eq!(stats.samples_processed, 0);
        assert_eq!(stats.buffer_overruns, 0);
        assert_eq!(stats.buffer_underruns, 0);
    }
    
    #[tokio::test]
    async fn test_audio_levels_initial_state() {
        let service = AudioCaptureService::new().unwrap();
        
        assert_eq!(service.current_audio_level(), 0.0);
        assert_eq!(service.current_peak_level(), 0.0);
        assert_eq!(service.current_audio_level_db(), -100.0);
    }
    
    // Note: Testing actual audio capture requires audio devices,
    // which may not be available in CI environments.
    // Additional integration tests should be run on systems with audio hardware.
}