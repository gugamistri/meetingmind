# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MeetingMind is a desktop AI Meeting Assistant built with Tauri + React, focused on privacy and local-first processing. The application captures system audio from meetings, performs hybrid transcription (local Whisper + optional cloud APIs), and generates AI-powered summaries while keeping data local by default.

## Architecture

**Technology Stack:**
- **Backend**: Rust with Tauri 2.0 framework
- **Frontend**: React 18 + TypeScript 5.0 + Vite 5.0
- **Database**: SQLite with sqlx for async operations
- **Audio Processing**: CPAL for cross-platform audio capture
- **AI/ML**: ONNX Runtime for local Whisper models
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: Zustand

**Core Components:**
1. **Audio Capture Service**: System audio capture using native APIs
2. **Transcription Pipeline**: Hybrid local/cloud processing
3. **Meeting Detector**: Calendar integration for automatic detection  
4. **Storage Engine**: Local SQLite with full-text search
5. **AI Processing Hub**: Coordinates local models and external APIs
6. **UI State Manager**: React-Rust bridge synchronization

## Development Commands

Since this is currently a specification document, actual build commands will be added once the codebase is implemented. Expected commands based on the spec:

```bash
# Development
npm run dev              # Start Tauri development server
npm run build           # Build production application
npm run tauri dev       # Run Tauri development mode
npm run tauri build     # Build Tauri application for distribution

# Testing (when implemented)
npm run test            # Run unit tests
npm run test:integration # Run integration tests
cargo test              # Run Rust backend tests

# Code Quality (when implemented)
npm run lint            # Lint TypeScript/React code
cargo clippy            # Lint Rust code
npm run typecheck       # TypeScript type checking
```

## Key Implementation Considerations

**Privacy-First Architecture:**
- All sensitive data processing happens locally by default
- External APIs are optional and user-controlled
- Local SQLite database with encryption for sensitive data
- No telemetry without explicit user consent

**Audio Processing Pipeline:**
- Use CPAL for cross-platform audio capture
- Buffer audio in 1-second chunks for low latency
- Support both microphone and system audio capture
- Automatic fallback between audio devices

**AI/ML Integration:**
- Local Whisper models (tiny/base) for offline transcription
- ONNX Runtime for optimized inference
- Fallback to OpenAI/Claude APIs when local confidence is low
- Cost tracking and transparent API usage

**Database Schema:**
- SQLite with WAL mode for performance
- FTS5 for full-text search capabilities
- Evolutionary schema design for future updates
- Automated backup and recovery system

**Security Requirements:**
- Device-based authentication (no user accounts in MVP)
- ChaCha20Poly1305 encryption for sensitive data
- SQLCipher for database encryption
- PII detection and redaction capabilities

## File Structure (Planned)

Based on the specification, the expected structure will be:

```
src-tauri/              # Rust backend
├── src/
│   ├── audio/          # Audio capture and processing
│   ├── transcription/  # Whisper integration and AI pipeline  
│   ├── storage/        # SQLite database operations
│   ├── calendar/       # Google Calendar integration
│   └── main.rs         # Tauri application entry point
└── models/             # Local AI models (Whisper ONNX)

src/                    # React frontend  
├── components/         # UI components
├── hooks/              # React hooks
├── stores/             # Zustand state management
├── types/              # TypeScript definitions
└── App.tsx             # Main React component
```

## Development Notes

- The application follows an offline-first, privacy-focused approach
- All core functionality must work without internet connectivity
- External API integrations are optional enhancements only
- UI should follow the specified design system with green/teal color palette
- Implement proper error handling and graceful degradation
- Maintain WCAG 2.1 AA accessibility compliance

## Current Status

This repository currently contains only the technical specification document. The actual implementation has not yet begun.