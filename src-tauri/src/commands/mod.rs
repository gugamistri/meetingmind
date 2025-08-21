// Command modules
pub mod audio;
pub mod transcription;

// Re-export all command functions
pub use audio::*;
pub use transcription::*;

#[cfg(test)]
mod tests;