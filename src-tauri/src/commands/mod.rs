// Command modules
pub mod app;
pub mod audio;
pub mod transcription;
pub mod ai;
pub mod calendar;

// Re-export all command functions
pub use app::*;
pub use audio::*;
pub use transcription::*;
pub use ai::*;
pub use calendar::*;

#[cfg(test)]
mod tests;