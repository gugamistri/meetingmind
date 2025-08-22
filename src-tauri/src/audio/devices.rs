//! Audio device management and enumeration

use cpal::{Device, Host, traits::{DeviceTrait, HostTrait}};
use tracing::{debug, info, warn, error};

use super::types::{AudioDevice, AudioDeviceType, AudioError, AudioResult};

/// Audio device manager for handling device enumeration and selection
pub struct AudioDeviceManager {
    host: Host,
    current_input_device: Option<Device>,
    current_output_device: Option<Device>,
}

impl AudioDeviceManager {
    /// Create a new audio device manager
    pub fn new() -> AudioResult<Self> {
        let host = cpal::default_host();
        debug!("Initialized audio device manager with host: {}", host.id().name());
        
        Ok(Self {
            host,
            current_input_device: None,
            current_output_device: None,
        })
    }
    
    /// Get all available input devices
    pub fn get_input_devices(&self) -> AudioResult<Vec<AudioDevice>> {
        let devices = self.host.input_devices()
            .map_err(AudioError::DeviceEnumeration)?;
        
        let mut audio_devices = Vec::new();
        let default_input = self.host.default_input_device();
        
        for device in devices {
            let device_name = device.name()
                .unwrap_or_else(|_| "Unknown Device".to_string());
            
            let is_default = default_input.as_ref()
                .map(|default| {
                    default.name().unwrap_or_default() == device_name
                })
                .unwrap_or(false);
            
            // Check if device is available by trying to get its configuration
            let is_available = device.default_input_config().is_ok();
            
            if is_available {
                debug!("Found input device: {} (default: {})", device_name, is_default);
            } else {
                warn!("Input device not available: {}", device_name);
            }
            
            audio_devices.push(AudioDevice {
                name: device_name,
                is_default,
                is_available,
                device_type: AudioDeviceType::Input,
            });
        }
        
        info!("Enumerated {} input devices", audio_devices.len());
        Ok(audio_devices)
    }
    
    /// Get all available output devices
    pub fn get_output_devices(&self) -> AudioResult<Vec<AudioDevice>> {
        let devices = self.host.output_devices()
            .map_err(AudioError::DeviceEnumeration)?;
        
        let mut audio_devices = Vec::new();
        let default_output = self.host.default_output_device();
        
        for device in devices {
            let device_name = device.name()
                .unwrap_or_else(|_| "Unknown Device".to_string());
            
            let is_default = default_output.as_ref()
                .map(|default| {
                    default.name().unwrap_or_default() == device_name
                })
                .unwrap_or(false);
            
            // Check if device is available by trying to get its configuration
            let is_available = device.default_output_config().is_ok();
            
            if is_available {
                debug!("Found output device: {} (default: {})", device_name, is_default);
            } else {
                warn!("Output device not available: {}", device_name);
            }
            
            audio_devices.push(AudioDevice {
                name: device_name,
                is_default,
                is_available,
                device_type: AudioDeviceType::Output,
            });
        }
        
        info!("Enumerated {} output devices", audio_devices.len());
        Ok(audio_devices)
    }
    
    /// Get the default input device
    pub fn get_default_input_device(&mut self) -> AudioResult<Device> {
        match self.host.default_input_device() {
            Some(device) => {
                let device_name = device.name()
                    .unwrap_or_else(|_| "Unknown Device".to_string());
                info!("Using default input device: {}", device_name);
                self.current_input_device = Some(device.clone());
                Ok(device)
            },
            None => {
                error!("No default input device available");
                Err(AudioError::DeviceNotFound { 
                    device: "default input".to_string() 
                })
            }
        }
    }
    
    /// Get the default output device
    pub fn get_default_output_device(&mut self) -> AudioResult<Device> {
        match self.host.default_output_device() {
            Some(device) => {
                let device_name = device.name()
                    .unwrap_or_else(|_| "Unknown Device".to_string());
                info!("Using default output device: {}", device_name);
                self.current_output_device = Some(device.clone());
                Ok(device)
            },
            None => {
                error!("No default output device available");
                Err(AudioError::DeviceNotFound { 
                    device: "default output".to_string() 
                })
            }
        }
    }
    
    /// Get input device by name
    pub fn get_input_device_by_name(&mut self, device_name: &str) -> AudioResult<Device> {
        let devices = self.host.input_devices()
            .map_err(AudioError::DeviceEnumeration)?;
        
        for device in devices {
            if let Ok(name) = device.name() {
                if name == device_name {
                    info!("Found input device by name: {}", device_name);
                    self.current_input_device = Some(device.clone());
                    return Ok(device);
                }
            }
        }
        
        error!("Input device not found: {}", device_name);
        Err(AudioError::DeviceNotFound { 
            device: device_name.to_string() 
        })
    }
    
    /// Get output device by name
    pub fn get_output_device_by_name(&mut self, device_name: &str) -> AudioResult<Device> {
        let devices = self.host.output_devices()
            .map_err(AudioError::DeviceEnumeration)?;
        
        for device in devices {
            if let Ok(name) = device.name() {
                if name == device_name {
                    info!("Found output device by name: {}", device_name);
                    self.current_output_device = Some(device.clone());
                    return Ok(device);
                }
            }
        }
        
        error!("Output device not found: {}", device_name);
        Err(AudioError::DeviceNotFound { 
            device: device_name.to_string() 
        })
    }
    
    /// Get the currently selected input device
    pub fn current_input_device(&self) -> Option<&Device> {
        self.current_input_device.as_ref()
    }
    
    /// Get the currently selected output device
    pub fn current_output_device(&self) -> Option<&Device> {
        self.current_output_device.as_ref()
    }
    
    /// Check if a device is still available (useful for device change detection)
    pub fn is_device_available(&self, device: &Device) -> bool {
        match device.default_input_config()
            .or_else(|_| device.default_output_config()) {
            Ok(_) => true,
            Err(e) => {
                debug!("Device availability check failed: {}", e);
                false
            }
        }
    }
    
    /// Get supported configurations for a device
    pub fn get_supported_input_configs(&self, device: &Device) -> AudioResult<Vec<cpal::SupportedStreamConfigRange>> {
        let configs: Vec<_> = device.supported_input_configs()
            .map_err(AudioError::SupportedConfigs)?
            .collect();
        Ok(configs)
    }
    
    /// Get supported configurations for an output device
    pub fn get_supported_output_configs(&self, device: &Device) -> AudioResult<Vec<cpal::SupportedStreamConfigRange>> {
        let configs: Vec<_> = device.supported_output_configs()
            .map_err(AudioError::SupportedConfigs)?
            .collect();
        Ok(configs)
    }
    
    /// Find the best matching input configuration for our requirements
    pub fn find_best_input_config(&self, device: &Device, sample_rate: u32) -> AudioResult<cpal::StreamConfig> {
        let default_config = device.default_input_config()
            .map_err(AudioError::Config)?;
        
        debug!("Default input config: {:?}", default_config);
        
        // Try to find a configuration that matches our sample rate
        let supported_configs = self.get_supported_input_configs(device)?;
        
        for config_range in supported_configs {
            if config_range.min_sample_rate().0 <= sample_rate 
                && config_range.max_sample_rate().0 >= sample_rate {
                
                let config = cpal::StreamConfig {
                    channels: config_range.channels().min(2), // Prefer mono or stereo
                    sample_rate: cpal::SampleRate(sample_rate),
                    buffer_size: cpal::BufferSize::Default,
                };
                
                info!("Found matching input config: {:?}", config);
                return Ok(config);
            }
        }
        
        // Fall back to default configuration
        warn!("No exact match found for sample rate {}, using default", sample_rate);
        Ok(default_config.into())
    }
    
    /// Find the best matching output configuration for our requirements
    pub fn find_best_output_config(&self, device: &Device, sample_rate: u32) -> AudioResult<cpal::StreamConfig> {
        let default_config = device.default_output_config()
            .map_err(AudioError::Config)?;
        
        debug!("Default output config: {:?}", default_config);
        
        // Try to find a configuration that matches our sample rate
        let supported_configs = self.get_supported_output_configs(device)?;
        
        for config_range in supported_configs {
            if config_range.min_sample_rate().0 <= sample_rate 
                && config_range.max_sample_rate().0 >= sample_rate {
                
                let config = cpal::StreamConfig {
                    channels: config_range.channels().min(2), // Prefer mono or stereo
                    sample_rate: cpal::SampleRate(sample_rate),
                    buffer_size: cpal::BufferSize::Default,
                };
                
                info!("Found matching output config: {:?}", config);
                return Ok(config);
            }
        }
        
        // Fall back to default configuration
        warn!("No exact match found for sample rate {}, using default", sample_rate);
        Ok(default_config.into())
    }
    
    /// Refresh device list (useful after device changes)
    pub fn refresh_devices(&mut self) -> AudioResult<()> {
        debug!("Refreshing device list");
        
        // Clear current device selections if they're no longer available
        if let Some(ref device) = self.current_input_device {
            if !self.is_device_available(device) {
                warn!("Current input device is no longer available, clearing selection");
                self.current_input_device = None;
            }
        }
        
        if let Some(ref device) = self.current_output_device {
            if !self.is_device_available(device) {
                warn!("Current output device is no longer available, clearing selection");
                self.current_output_device = None;
            }
        }
        
        info!("Device list refreshed");
        Ok(())
    }
}

impl Default for AudioDeviceManager {
    fn default() -> Self {
        Self::new().expect("Failed to create audio device manager")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_device_manager_creation() {
        let manager = AudioDeviceManager::new();
        assert!(manager.is_ok());
    }
    
    #[test]
    fn test_get_input_devices() {
        let manager = AudioDeviceManager::new().unwrap();
        let devices = manager.get_input_devices();
        
        // Should succeed even if no devices are available
        assert!(devices.is_ok());
    }
    
    #[test]
    fn test_get_output_devices() {
        let manager = AudioDeviceManager::new().unwrap();
        let devices = manager.get_output_devices();
        
        // Should succeed even if no devices are available
        assert!(devices.is_ok());
    }
    
    #[test]
    fn test_get_default_input_device() {
        let mut manager = AudioDeviceManager::new().unwrap();
        let result = manager.get_default_input_device();
        
        // Result depends on system configuration, but should not panic
        match result {
            Ok(_) => println!("Default input device found"),
            Err(AudioError::DeviceNotFound { .. }) => println!("No default input device"),
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }
    
    #[test]
    fn test_get_default_output_device() {
        let mut manager = AudioDeviceManager::new().unwrap();
        let result = manager.get_default_output_device();
        
        // Result depends on system configuration, but should not panic
        match result {
            Ok(_) => println!("Default output device found"),
            Err(AudioError::DeviceNotFound { .. }) => println!("No default output device"),
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }
    
    #[test]
    fn test_refresh_devices() {
        let mut manager = AudioDeviceManager::new().unwrap();
        let result = manager.refresh_devices();
        assert!(result.is_ok());
    }
}