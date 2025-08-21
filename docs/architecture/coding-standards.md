# Coding Standards and Conventions

## Overview

This document establishes coding standards and conventions for the MeetingMind project, ensuring consistent, maintainable, and secure code across the Rust backend and TypeScript/React frontend.

## Core Principles

- **Privacy-First**: All code must respect user privacy and data security
- **Local-First**: Prioritize local processing over cloud dependencies
- **Performance-Conscious**: Optimize for resource efficiency and responsiveness
- **Accessibility-Compliant**: Follow WCAG 2.1 AA guidelines
- **Error-Resilient**: Implement comprehensive error handling and graceful degradation

## Rust Backend Standards

### Code Organization

```rust
// File structure within modules
pub mod audio {
    mod capture;
    mod processing;
    mod types;
    
    pub use capture::AudioCaptureService;
    pub use processing::AudioProcessor;
    pub use types::*;
}
```

### Naming Conventions

- **Modules**: Snake case (`audio_capture`, `meeting_detector`)
- **Structs/Enums**: PascalCase (`AudioCaptureService`, `TranscriptionStatus`)
- **Functions/Variables**: Snake case (`process_audio`, `meeting_id`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_BUFFER_SIZE`, `DEFAULT_SAMPLE_RATE`)

### Error Handling

```rust
// Use custom error types for domain-specific errors
#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("Audio device not found: {device}")]
    DeviceNotFound { device: String },
    #[error("Buffer overflow: {size} bytes")]
    BufferOverflow { size: usize },
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// Use Result types consistently
pub fn capture_audio() -> Result<AudioBuffer, AudioError> {
    // Implementation
}

// Handle errors at appropriate boundaries
match capture_audio() {
    Ok(buffer) => process_buffer(buffer),
    Err(AudioError::DeviceNotFound { device }) => {
        log::warn!("Audio device {} not available, falling back", device);
        use_fallback_device()
    }
    Err(e) => return Err(e.into()),
}
```

### Async Programming

```rust
// Use async/await for I/O operations
pub async fn save_transcription(
    pool: &SqlitePool, 
    transcription: &Transcription
) -> Result<(), DatabaseError> {
    sqlx::query!(
        "INSERT INTO transcriptions (meeting_id, content, timestamp) VALUES (?, ?, ?)",
        transcription.meeting_id,
        transcription.content,
        transcription.timestamp
    )
    .execute(pool)
    .await
    .map_err(DatabaseError::from)?;
    
    Ok(())
}

// Use tokio::spawn for concurrent tasks
let audio_task = tokio::spawn(async move {
    audio_service.start_capture().await
});
```

### Memory Management

```rust
// Use Arc<Mutex<T>> for shared mutable state
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock; // Prefer RwLock for async contexts

pub struct AudioService {
    buffer: Arc<RwLock<AudioBuffer>>,
    config: Arc<AudioConfig>,
}

// Implement Clone for cheap sharing
#[derive(Clone)]
pub struct MeetingSession {
    id: MeetingId,
    metadata: Arc<MeetingMetadata>,
}
```

### Security Practices

```rust
// Use secrecy crate for sensitive data
use secrecy::{Secret, ExposeSecret};

pub struct ApiKey(Secret<String>);

impl ApiKey {
    pub fn from_env() -> Result<Self, ConfigError> {
        let key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| ConfigError::MissingApiKey)?;
        Ok(Self(Secret::new(key)))
    }
    
    pub fn expose(&self) -> &str {
        self.0.expose_secret()
    }
}

// Zero sensitive data on drop
impl Drop for ApiKey {
    fn drop(&mut self) {
        // Handled by secrecy crate
    }
}
```

### Testing Standards

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_audio_capture_success() {
        let service = AudioCaptureService::new();
        let result = service.start_capture().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_audio_capture_device_not_found() {
        let service = AudioCaptureService::with_device("non-existent");
        let result = service.start_capture().await;
        assert!(matches!(result, Err(AudioError::DeviceNotFound { .. })));
    }
}
```

## TypeScript/React Frontend Standards

### Code Organization

```typescript
// Feature-based organization
src/
  components/
    common/           // Reusable UI components
    meeting/         // Meeting-specific components
    transcription/   // Transcription-related components
  hooks/             // Custom React hooks
  stores/           // Zustand stores
  types/            // TypeScript type definitions
  utils/            // Utility functions
```

### Naming Conventions

- **Components**: PascalCase (`MeetingList`, `TranscriptionView`)
- **Files**: kebab-case (`meeting-list.tsx`, `transcription-view.tsx`)
- **Hooks**: camelCase starting with "use" (`useMeetingData`, `useAudioState`)
- **Types/Interfaces**: PascalCase (`MeetingData`, `AudioConfig`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRIES`, `API_ENDPOINTS`)

### Component Structure

```typescript
interface MeetingListProps {
  meetings: Meeting[];
  onMeetingSelect: (meeting: Meeting) => void;
  isLoading?: boolean;
}

export const MeetingList: React.FC<MeetingListProps> = ({
  meetings,
  onMeetingSelect,
  isLoading = false
}) => {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const handleMeetingClick = useCallback((meeting: Meeting) => {
    setSelectedMeeting(meeting);
    onMeetingSelect(meeting);
  }, [onMeetingSelect]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="meeting-list">
      {meetings.map(meeting => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          onClick={handleMeetingClick}
          isSelected={selectedMeeting?.id === meeting.id}
        />
      ))}
    </div>
  );
};
```

### Type Definitions

```typescript
// Use strict type definitions
export interface Meeting {
  readonly id: string;
  readonly title: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly participants: ReadonlyArray<Participant>;
  readonly status: MeetingStatus;
}

export type MeetingStatus = 
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// Use branded types for IDs
export type MeetingId = string & { readonly __brand: 'MeetingId' };
export type UserId = string & { readonly __brand: 'UserId' };

export const createMeetingId = (id: string): MeetingId => id as MeetingId;
```

### Custom Hooks

```typescript
export const useMeetingData = (meetingId: MeetingId) => {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMeeting = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const meetingData = await invoke<Meeting>('get_meeting', { 
          meetingId 
        });
        
        if (!cancelled) {
          setMeeting(meetingData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMeeting();

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  return { meeting, isLoading, error };
};
```

### State Management with Zustand

```typescript
interface MeetingStore {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  isRecording: boolean;
  
  // Actions
  setMeetings: (meetings: Meeting[]) => void;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  isRecording: false,

  setMeetings: (meetings) => set({ meetings }),
  
  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  
  startRecording: () => {
    const { currentMeeting } = get();
    if (currentMeeting) {
      set({ isRecording: true });
      // Invoke Rust backend
      invoke('start_audio_capture', { meetingId: currentMeeting.id });
    }
  },
  
  stopRecording: () => {
    set({ isRecording: false });
    invoke('stop_audio_capture');
  }
}));
```

### Error Handling

```typescript
// Custom error types
export class MeetingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly meeting?: Meeting
  ) {
    super(message);
    this.name = 'MeetingError';
  }
}

// Error boundary component
export class MeetingErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  { hasError: boolean; error?: Error }
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Meeting error:', error, errorInfo);
    // Report to error tracking service if available
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}
```

## CSS/Styling Standards

### Tailwind CSS Conventions

```typescript
// Use consistent spacing scale
const spacing = {
  xs: 'p-1',    // 4px
  sm: 'p-2',    // 8px
  md: 'p-4',    // 16px
  lg: 'p-6',    // 24px
  xl: 'p-8',    // 32px
} as const;

// Define color palette
const colors = {
  primary: 'bg-emerald-600 hover:bg-emerald-700',
  secondary: 'bg-teal-600 hover:bg-teal-700',
  success: 'bg-green-600 hover:bg-green-700',
  warning: 'bg-yellow-600 hover:bg-yellow-700',
  danger: 'bg-red-600 hover:bg-red-700',
} as const;
```

### Component Styling

```typescript
// Use clsx for conditional classes
import clsx from 'clsx';

interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  disabled = false,
  children,
  ...props
}) => {
  return (
    <button
      className={clsx(
        // Base styles
        'font-medium rounded-lg transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        
        // Variant styles
        {
          'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500': 
            variant === 'primary',
          'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500': 
            variant === 'secondary',
        },
        
        // Size styles
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        
        // Disabled state
        {
          'opacity-50 cursor-not-allowed': disabled,
        }
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
```

## Documentation Standards

### Code Comments

```rust
/// Captures system audio from the specified device.
/// 
/// This function initializes the audio capture pipeline and begins
/// streaming audio data to the processing queue. It automatically
/// handles device fallback if the primary device is unavailable.
/// 
/// # Arguments
/// 
/// * `device_id` - Optional device identifier. If None, uses system default.
/// * `config` - Audio capture configuration including sample rate and buffer size.
/// 
/// # Returns
/// 
/// Returns a `Result` containing the capture handle on success, or an
/// `AudioError` if capture initialization fails.
/// 
/// # Errors
/// 
/// * `AudioError::DeviceNotFound` - Specified device is not available
/// * `AudioError::PermissionDenied` - System audio access is denied
/// * `AudioError::BufferOverflow` - Audio buffer configuration is invalid
/// 
/// # Examples
/// 
/// ```rust
/// let config = AudioConfig::default();
/// let handle = capture_system_audio(None, config).await?;
/// ```
pub async fn capture_system_audio(
    device_id: Option<&str>,
    config: AudioConfig,
) -> Result<CaptureHandle, AudioError> {
    // Implementation
}
```

```typescript
/**
 * Custom hook for managing meeting transcription state
 * 
 * Provides real-time transcription updates and handles the connection
 * to the Rust backend transcription service. Automatically manages
 * cleanup when the component unmounts.
 * 
 * @param meetingId - Unique identifier for the meeting
 * @returns Object containing transcription state and control functions
 * 
 * @example
 * ```typescript
 * const { transcription, isTranscribing, startTranscription } = 
 *   useTranscription(meetingId);
 * ```
 */
export const useTranscription = (meetingId: MeetingId) => {
  // Implementation
};
```

## Testing Standards

### Unit Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    
    #[tokio::test]
    async fn given_valid_audio_device_when_starting_capture_then_succeeds() {
        // Given
        let config = AudioConfig::default();
        let service = AudioCaptureService::new();
        
        // When
        let result = service.start_capture(config).await;
        
        // Then
        assert!(result.is_ok());
        let handle = result.unwrap();
        assert!(handle.is_active());
    }
}
```

```typescript
describe('MeetingList', () => {
  it('should render meetings correctly', () => {
    // Given
    const mockMeetings = [
      createMockMeeting({ id: '1', title: 'Test Meeting 1' }),
      createMockMeeting({ id: '2', title: 'Test Meeting 2' }),
    ];
    const onMeetingSelect = vi.fn();
    
    // When
    render(
      <MeetingList 
        meetings={mockMeetings} 
        onMeetingSelect={onMeetingSelect} 
      />
    );
    
    // Then
    expect(screen.getByText('Test Meeting 1')).toBeInTheDocument();
    expect(screen.getByText('Test Meeting 2')).toBeInTheDocument();
  });
});
```

## Performance Guidelines

### Rust Performance

- Use `Vec::with_capacity()` when size is known
- Prefer `&str` over `String` for function parameters
- Use `Cow<str>` for conditional ownership
- Profile with `cargo bench` and `criterion`
- Minimize allocations in hot paths

### React Performance

- Use `React.memo()` for expensive components
- Implement `useMemo()` and `useCallback()` strategically
- Avoid creating objects/functions in render
- Use lazy loading for heavy components
- Profile with React DevTools Profiler

## Security Guidelines

- Never log sensitive data (transcriptions, API keys)
- Use secure random number generation
- Implement proper input validation
- Follow OWASP guidelines for web security
- Regular dependency audits with `cargo audit` and `npm audit`
- Encrypt data at rest using industry-standard algorithms

## Code Review Checklist

- [ ] Code follows naming conventions
- [ ] Error handling is comprehensive
- [ ] Tests are included and passing
- [ ] Documentation is complete
- [ ] Performance impact is considered
- [ ] Security implications are reviewed
- [ ] Accessibility requirements are met
- [ ] Privacy guidelines are followed