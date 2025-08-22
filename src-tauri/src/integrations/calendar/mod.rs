pub mod types;
pub mod oauth;
pub mod google;
pub mod repository;
pub mod sync;
pub mod detector;

pub use types::{
    CalendarError, CalendarProvider, CalendarAccount, CalendarEvent, 
    TimeRange, MeetingDetectionConfig, SyncStatus,
};

pub use oauth::OAuth2Service;
pub use google::{GoogleCalendarService, CalendarService};
pub use repository::CalendarRepository;
pub use sync::CalendarSyncService;
pub use detector::{MeetingDetector, DetectedMeeting};