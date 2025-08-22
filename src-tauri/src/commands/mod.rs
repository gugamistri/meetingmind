// Command modules
pub mod app;
pub mod audio;
pub mod transcription;

// Re-export all command functions
pub use app::*;
pub use audio::*;
pub use transcription::*;

#[cfg(test)]
mod tests;