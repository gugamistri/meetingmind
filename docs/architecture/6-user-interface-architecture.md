# 6. User Interface Architecture

## 6.1 Design System Implementation

### Component Architecture
```typescript
// Base component structure
interface BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// Design tokens
const designTokens = {
  colors: {
    primary: {
      white: '#F8F9FA',
      darkGreen: '#0A5F55',
    },
    secondary: {
      greenLight: '#4CAF94',
      greenPale: '#E6F4F1',
    },
    functional: {
      success: '#43A047',
      error: '#E53935',
      warning: '#FFD54F',
      neutral: '#9E9E9E',
    },
  },
  typography: {
    fontFamily: ['SF Pro Text', 'Roboto', 'Inter', 'system-ui'],
    sizes: {
      h1: '28px',
      h2: '24px',
      h3: '20px',
      body: '15px',
      caption: '13px',
    },
  },
  spacing: {
    micro: '4px',
    small: '8px',
    default: '16px',
    medium: '24px',
    large: '32px',
    xl: '48px',
  },
} as const;
```

### Key UI Components

**Recording Controls:**
```typescript
const RecordingControls: React.FC = () => {
  const { isRecording, isPaused, startRecording, stopRecording, pauseRecording } = useRecording();
  
  return (
    <div className="recording-controls">
      <Button
        variant={isRecording ? 'secondary' : 'primary'}
        size="lg"
        onClick={isRecording ? stopRecording : startRecording}
        className="record-button"
      >
        {isRecording ? <StopIcon /> : <RecordIcon />}
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </Button>
      
      {isRecording && (
        <Button
          variant="ghost"
          onClick={pauseRecording}
          className="pause-button"
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </Button>
      )}
      
      <AudioLevelMeter />
      <RecordingTimer />
    </div>
  );
};
```

**Live Transcription Display:**
```typescript
const LiveTranscription: React.FC = () => {
  const { transcriptionBuffer } = useTranscription();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom for new content
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptionBuffer]);
  
  return (
    <div ref={containerRef} className="transcription-container">
      {transcriptionBuffer.map(segment => (
        <TranscriptionSegment
          key={segment.id}
          segment={segment}
          editable={true}
          onEdit={handleSegmentEdit}
          onSpeakerChange={handleSpeakerChange}
        />
      ))}
    </div>
  );
};
```

## 6.2 User Experience Flows

### First-Time Setup Flow
1. **Welcome Screen**: Introduction and privacy explanation
2. **Permissions Request**: Audio access and calendar integration
3. **Audio Test**: Verify microphone and system audio capture
4. **Calendar Connection**: Optional Google Calendar setup
5. **First Recording**: Guided first meeting capture

### Daily Usage Flow
1. **Dashboard View**: Upcoming meetings and recent recordings
2. **Meeting Detection**: Automatic notification 5 minutes before scheduled meetings
3. **Recording Session**: Live transcription with real-time feedback
4. **Post-Meeting**: Review, edit, and summarize transcription
5. **Export/Share**: Multiple format options and sharing links

### Meeting Management Flow
1. **Search Interface**: Full-text search with filters and facets
2. **Meeting List**: Chronological view with metadata and previews
3. **Detail View**: Full transcription editor with speaker identification
4. **Summary Generation**: AI-powered summaries with custom templates
5. **Export Options**: Markdown, PDF, DOCX, and sharing links

## 6.3 Accessibility and Internationalization

### Accessibility Implementation
- **WCAG 2.1 AA Compliance**: 4.5:1 contrast ratios, keyboard navigation
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Keyboard Shortcuts**: Complete app functionality via keyboard
- **Reduced Motion**: Respect `prefers-reduced-motion` setting

### Internationalization Support
- **Language Detection**: Automatic detection of meeting language
- **UI Localization**: Portuguese and English interface support
- **Date/Time Formatting**: Locale-specific formatting
- **Text Direction**: RTL language support preparation

---
