//! Audio capture and processing functionality

pub mod buffer;
pub mod capture;
pub mod devices;
pub mod processing;
pub mod types;

// Re-export main types and services for easy access
pub use capture::AudioCaptureService;
pub use devices::AudioDeviceManager;
pub use processing::{
    AudioProcessingPipeline, AudioQualityValidator, NoiseGateProcessor,
    AutomaticGainControl, AudioFormatConverter, AudioAnalyzer, AudioAnalysis
};
pub use buffer::{AudioRingBuffer, MultiChannelAudioBuffer};
pub use types::{
    AudioBuffer, AudioConfig, AudioDevice, AudioDeviceType, AudioError,
    AudioCaptureStatus, AudioProcessor, AudioStats, AudioLevelMonitor,
    AudioFormat, RingBuffer, AudioResult
};