// Command modules
pub mod app;
pub mod audio;
pub mod transcription;
pub mod ai;

// Re-export all command functions
pub use app::*;
pub use audio::*;
pub use transcription::*;
pub use ai::*;

#[cfg(test)]
mod tests;