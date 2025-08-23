// Command modules
pub mod app;
pub mod audio;
pub mod transcription;
pub mod ai;
pub mod calendar;
pub mod meetings;
pub mod search;

// Re-export all command functions
pub use app::*;
pub use audio::*;
pub use transcription::*;
pub use ai::*;
pub use calendar::*;
pub use meetings::*;
pub use search::*;

#[cfg(test)]
mod tests;