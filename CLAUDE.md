# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MeetingMind is a privacy-first AI Meeting Assistant built as a desktop application using Tauri + React. The application captures system audio from meetings, performs hybrid transcription (local Whisper + optional cloud APIs), and generates AI-powered summaries while keeping data local by default.

**Current Implementation Status:**
- ✅ Project Foundation Setup (Story 1.1)
- ✅ Audio Capture System (Story 1.2) 
- ✅ Transcription Pipeline Implementation (Story 1.3)
- ✅ AI-Powered Summarization (Story 1.4)
- ✅ Calendar Integration (Story 1.5)
- 🚧 Main Dashboard & Application Shell (Story 2.1)

## Architecture

**Technology Stack:**
- **Backend**: Rust with Tauri 2.4 framework
- **Frontend**: React 18.3 + TypeScript 5.5 + Vite 5.4
- **Database**: SQLite with SQLx 0.7 (WAL mode, async operations)
- **Audio Processing**: CPAL 0.15 for cross-platform audio capture
- **AI/ML**: Local Whisper models (ONNX temporarily disabled for macOS ARM64)
- **UI Components**: Radix UI primitives + Tailwind CSS 3.4
- **State Management**: Zustand 4.5.5
- **Testing**: Vitest 2.0 with 80% coverage requirements

**Key Directory Structure:**
```
src-tauri/src/
├── audio/              # Audio capture and processing
├── transcription/      # Whisper integration and AI pipeline
├── storage/            # SQLite database operations and repositories
├── ai/                 # AI model integration (OpenAI, Claude)
├── integrations/       # External API integrations (calendar, OAuth)
├── commands/           # Tauri command handlers
├── events/             # Event system
├── security/           # Encryption and security utilities
└── main.rs            # Application entry point

src/
├── components/         # React UI components
├── hooks/              # Custom React hooks
├── stores/             # Zustand state management
├── services/           # API and service integrations
└── types/              # TypeScript type definitions
```

## Development Commands

**Core Development:**
```bash
npm run tauri:dev       # Start Tauri development mode (recommended)
npm run dev             # Start frontend only (port 1420)
npm run build           # Build production application
npm run preview         # Preview production build
```

**Code Quality:**
```bash
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix ESLint issues
npm run format          # Format with Prettier
npm run type-check      # TypeScript type checking
```

**Testing:**
```bash
npm run test            # Run Vitest unit tests
npm run test:coverage   # Run tests with coverage (80% required)
npm run test:ui         # Run tests with UI interface
cargo test              # Run Rust backend tests
```

**Database Operations:**
```bash
# From src-tauri directory:
cd src-tauri
cargo sqlx database create             # Create SQLite database
cargo sqlx migrate run                 # Run migrations
cargo sqlx prepare                     # Prepare queries for offline compilation
```

## Key Implementation Patterns

**Privacy-First Architecture:**
- All sensitive data processing happens locally by default
- SQLite database with encryption for sensitive data
- External APIs (OpenAI, Claude) are optional and user-controlled
- Device-based authentication (no user accounts in MVP)
- PII detection and redaction capabilities

**Audio Processing Pipeline:**
- CPAL for cross-platform system audio capture
- Audio buffering in chunks for low latency
- Automatic device fallback and error handling
- Privacy controls for audio data retention

**Database Design:**
- SQLite with WAL mode for performance
- Repository pattern for database operations
- Async operations using SQLx with compile-time query checking
- Structured migrations for schema evolution

**Error Handling:**
- Rust: `thiserror` for custom errors, `anyhow` for error propagation
- TypeScript: Explicit error types and Result patterns
- Graceful degradation when external services unavailable

## Code Style Requirements

**TypeScript/React:**
- Single quotes, 100 char line width, 2-space indentation
- Strict TypeScript configuration with exact optional properties
- Functional components with arrow functions preferred
- Path aliases: `@/*` for src directory imports
- 80% test coverage required for all metrics

**Rust:**
- Standard Rust conventions (snake_case functions, PascalCase types)
- `#[cfg(test)]` for unit tests in same file
- Structured logging with `tracing` crate
- Security-focused patterns using `secrecy` for sensitive data

**Import Organization:**
```typescript
// External libraries first
import React from 'react';
import { create } from 'zustand';

// Internal modules with @ alias
import { ApiService } from '@/services/api';

// Relative imports last
import './Component.css';
```

## Platform-Specific Notes

**macOS Development:**
- ONNX Runtime temporarily disabled for ARM64 compatibility
- Rust toolchain via Homebrew/rustup
- SQLite database location: `./meeting-mind.db`
- Default development port: 1420

**Database Setup:**
- SQLite with WAL mode enabled
- Automatic migrations on startup
- Local storage: `meeting-mind.db` in project root
- Backup and recovery system implemented

**Security Implementation:**
- ChaCha20Poly1305 for data encryption
- Argon2 for password hashing
- OAuth2 integration for calendar services
- No telemetry without explicit user consent