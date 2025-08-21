# Source Code Organization and File Structure

## Overview

This document outlines the source code organization for MeetingMind, providing a clear structure that promotes maintainability, scalability, and separation of concerns. The structure follows domain-driven design principles while accommodating the hybrid Rust-TypeScript architecture.

## Root Directory Structure

```
meeting-mind/
├── .bmad-core/                 # BMAD core files (auto-generated, do not edit)
├── .github/                    # GitHub workflows and templates
├── docs/                       # Project documentation
├── src/                        # React frontend source code
├── src-tauri/                  # Rust backend source code
├── tests/                      # End-to-end and integration tests
├── scripts/                    # Build and development scripts
├── public/                     # Static assets for frontend
├── models/                     # Local AI models (Whisper ONNX)
├── .gitignore                  # Git ignore rules
├── .env.example                # Environment variables template
├── Cargo.toml                  # Rust workspace configuration
├── package.json                # Node.js dependencies and scripts
├── pnpm-lock.yaml             # Lockfile for pnpm
├── tauri.conf.json            # Tauri application configuration
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── vite.config.ts             # Vite build configuration
├── vitest.config.ts           # Vitest testing configuration
└── README.md                  # Project overview and setup
```

## Frontend Structure (`src/`)

The React frontend follows a feature-based organization with shared utilities and components.

```
src/
├── components/                 # Reusable UI components
│   ├── common/                # Generic, reusable components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── LoadingSpinner/
│   │   └── ErrorBoundary/
│   ├── layout/                # Layout-specific components
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   ├── MainLayout/
│   │   └── AppShell/
│   ├── meeting/               # Meeting-related components
│   │   ├── MeetingList/
│   │   ├── MeetingCard/
│   │   ├── MeetingDetails/
│   │   ├── MeetingControls/
│   │   └── MeetingSettings/
│   ├── transcription/         # Transcription UI components
│   │   ├── TranscriptionView/
│   │   ├── TranscriptionEditor/
│   │   ├── TranscriptionExport/
│   │   └── RealTimeTranscription/
│   ├── audio/                 # Audio-related UI components
│   │   ├── AudioVisualizer/
│   │   ├── AudioControls/
│   │   ├── DeviceSelector/
│   │   └── VolumeIndicator/
│   └── analytics/             # Analytics and insights components
│       ├── MeetingAnalytics/
│       ├── SummaryCard/
│       ├── InsightsPanel/
│       └── ActionItems/
├── hooks/                     # Custom React hooks
│   ├── common/                # Generic hooks
│   │   ├── useAsync.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useEventListener.ts
│   ├── meeting/               # Meeting-specific hooks
│   │   ├── useMeetingData.ts
│   │   ├── useMeetingActions.ts
│   │   └── useMeetingStatus.ts
│   ├── audio/                 # Audio-related hooks
│   │   ├── useAudioCapture.ts
│   │   ├── useAudioDevices.ts
│   │   └── useAudioLevel.ts
│   ├── transcription/         # Transcription hooks
│   │   ├── useTranscription.ts
│   │   ├── useTranscriptionStream.ts
│   │   └── useTranscriptionExport.ts
│   └── ai/                    # AI/ML related hooks
│       ├── useSummaryGeneration.ts
│       ├── useInsightsGeneration.ts
│       └── useActionItemExtraction.ts
├── stores/                    # Zustand state management
│   ├── meeting.store.ts       # Meeting state management
│   ├── audio.store.ts         # Audio capture state
│   ├── transcription.store.ts # Transcription state
│   ├── ui.store.ts           # UI state (modals, themes, etc.)
│   ├── settings.store.ts     # Application settings
│   └── analytics.store.ts    # Analytics and insights state
├── services/                  # Service layer for external interactions
│   ├── tauri.service.ts      # Tauri backend communication
│   ├── storage.service.ts    # Local storage utilities
│   ├── export.service.ts     # Data export functionality
│   └── calendar.service.ts   # Calendar integration
├── types/                     # TypeScript type definitions
│   ├── meeting.types.ts       # Meeting-related types
│   ├── audio.types.ts         # Audio processing types
│   ├── transcription.types.ts # Transcription types
│   ├── ai.types.ts           # AI/ML types
│   ├── api.types.ts          # API response types
│   └── common.types.ts       # Shared utility types
├── utils/                     # Utility functions and helpers
│   ├── date.utils.ts         # Date and time utilities
│   ├── audio.utils.ts        # Audio processing utilities
│   ├── text.utils.ts         # Text processing utilities
│   ├── validation.utils.ts   # Input validation
│   ├── format.utils.ts       # Data formatting
│   └── constants.ts          # Application constants
├── styles/                    # Global styles and themes
│   ├── globals.css           # Global CSS with Tailwind imports
│   ├── components.css        # Component-specific styles
│   └── themes.css            # Theme definitions
├── assets/                    # Static assets
│   ├── icons/                # SVG icons and graphics
│   ├── images/               # Images and illustrations
│   └── audio/                # Audio files (notification sounds)
├── App.tsx                    # Root React component
├── main.tsx                   # React application entry point
└── vite-env.d.ts             # Vite environment types
```

### Component Organization Pattern

Each component follows a consistent structure:

```
ComponentName/
├── ComponentName.tsx          # Main component implementation
├── ComponentName.test.tsx     # Unit tests
├── ComponentName.stories.tsx  # Storybook stories (if applicable)
├── hooks/                     # Component-specific hooks
│   └── useComponentName.ts
├── types.ts                   # Component-specific types
└── index.ts                   # Export barrel
```

## Backend Structure (`src-tauri/`)

The Rust backend is organized by domain with clear separation of concerns.

```
src-tauri/
├── src/                       # Rust source code
│   ├── main.rs               # Application entry point and Tauri setup
│   ├── lib.rs                # Library root with module declarations
│   ├── error.rs              # Global error types and handling
│   ├── config.rs             # Application configuration
│   ├── utils.rs              # Shared utility functions
│   ├── audio/                # Audio processing domain
│   │   ├── mod.rs            # Module exports
│   │   ├── capture.rs        # Audio capture implementation
│   │   ├── processing.rs     # Audio processing pipeline
│   │   ├── devices.rs        # Audio device management
│   │   ├── buffer.rs         # Audio buffer management
│   │   ├── types.rs          # Audio-related types
│   │   └── tests.rs          # Audio module tests
│   ├── transcription/        # Transcription domain
│   │   ├── mod.rs            # Module exports
│   │   ├── whisper.rs        # Local Whisper integration
│   │   ├── cloud.rs          # Cloud API integrations
│   │   ├── pipeline.rs       # Transcription pipeline
│   │   ├── models.rs         # ML model management
│   │   ├── types.rs          # Transcription types
│   │   └── tests.rs          # Transcription tests
│   ├── storage/              # Data persistence domain
│   │   ├── mod.rs            # Module exports
│   │   ├── database.rs       # Database connection and setup
│   │   ├── models.rs         # Database models
│   │   ├── repositories/     # Data access layer
│   │   │   ├── mod.rs
│   │   │   ├── meeting.rs    # Meeting repository
│   │   │   ├── transcription.rs # Transcription repository
│   │   │   └── settings.rs   # Settings repository
│   │   ├── migrations/       # Database migrations
│   │   │   ├── mod.rs
│   │   │   ├── 001_initial.sql
│   │   │   ├── 002_transcriptions.sql
│   │   │   └── 003_search_index.sql
│   │   └── tests.rs          # Storage tests
│   ├── meeting/              # Meeting management domain
│   │   ├── mod.rs            # Module exports
│   │   ├── detector.rs       # Meeting detection logic
│   │   ├── manager.rs        # Meeting lifecycle management
│   │   ├── calendar.rs       # Calendar integration
│   │   ├── session.rs        # Active meeting session
│   │   ├── types.rs          # Meeting types
│   │   └── tests.rs          # Meeting tests
│   ├── ai/                   # AI/ML processing domain
│   │   ├── mod.rs            # Module exports
│   │   ├── summarization.rs  # Meeting summarization
│   │   ├── insights.rs       # Meeting insights generation
│   │   ├── action_items.rs   # Action item extraction
│   │   ├── models/           # AI model management
│   │   │   ├── mod.rs
│   │   │   ├── whisper.rs    # Whisper model handling
│   │   │   ├── summarizer.rs # Summarization models
│   │   │   └── downloader.rs # Model download utilities
│   │   ├── types.rs          # AI-related types
│   │   └── tests.rs          # AI module tests
│   ├── security/             # Security and privacy domain
│   │   ├── mod.rs            # Module exports
│   │   ├── encryption.rs     # Data encryption utilities
│   │   ├── auth.rs           # Authentication (device-based)
│   │   ├── privacy.rs        # Privacy protection utilities
│   │   └── tests.rs          # Security tests
│   ├── integrations/         # External service integrations
│   │   ├── mod.rs            # Module exports
│   │   ├── calendar/         # Calendar service integrations
│   │   │   ├── mod.rs
│   │   │   ├── google.rs     # Google Calendar
│   │   │   ├── outlook.rs    # Outlook/Exchange
│   │   │   └── types.rs      # Calendar types
│   │   ├── cloud_apis/       # Cloud AI service integrations
│   │   │   ├── mod.rs
│   │   │   ├── openai.rs     # OpenAI API
│   │   │   ├── anthropic.rs  # Anthropic API
│   │   │   └── types.rs      # API types
│   │   └── tests.rs          # Integration tests
│   ├── commands/             # Tauri command handlers
│   │   ├── mod.rs            # Module exports
│   │   ├── meeting.rs        # Meeting-related commands
│   │   ├── audio.rs          # Audio commands
│   │   ├── transcription.rs  # Transcription commands
│   │   ├── settings.rs       # Settings commands
│   │   └── analytics.rs      # Analytics commands
│   └── events/               # Event system for frontend communication
│       ├── mod.rs            # Module exports
│       ├── audio.rs          # Audio-related events
│       ├── transcription.rs  # Transcription events
│       ├── meeting.rs        # Meeting events
│       └── types.rs          # Event types
├── Cargo.toml                # Rust dependencies and metadata
├── tauri.conf.json           # Tauri configuration
├── icons/                    # Application icons
│   ├── 32x32.png
│   ├── 128x128.png
│   ├── 128x128@2x.png
│   ├── icon.icns
│   └── icon.ico
└── build.rs                  # Build script for compilation
```

### Rust Module Organization Pattern

Each domain module follows this structure:

```rust
// mod.rs - Module exports and public API
pub mod capture;
pub mod processing;
pub mod types;

pub use capture::AudioCaptureService;
pub use processing::AudioProcessor;
pub use types::*;

// Re-export common functionality
pub use crate::error::AudioError;
```

## Testing Structure (`tests/`)

Comprehensive testing strategy with separated concerns:

```
tests/
├── integration/               # Integration tests
│   ├── audio_pipeline.rs     # Audio capture to transcription
│   ├── meeting_lifecycle.rs  # Complete meeting workflow
│   ├── data_persistence.rs   # Database operations
│   └── ui_integration.rs     # Frontend-backend integration
├── e2e/                      # End-to-end tests
│   ├── meeting_flow.rs       # Complete user workflows
│   ├── accessibility.rs      # Accessibility compliance
│   └── performance.rs        # Performance benchmarks
├── fixtures/                 # Test data and fixtures
│   ├── audio/               # Sample audio files
│   ├── transcriptions/      # Sample transcription data
│   └── meetings/            # Sample meeting data
└── utils/                   # Test utilities
    ├── mock_audio.rs        # Audio mocking utilities
    ├── test_database.rs     # Test database setup
    └── assertions.rs        # Custom test assertions
```

## Documentation Structure (`docs/`)

Comprehensive documentation organized by audience and purpose:

```
docs/
├── architecture/             # Technical architecture docs
│   ├── coding-standards.md   # Development standards
│   ├── tech-stack.md        # Technology choices
│   ├── source-tree.md       # This file
│   ├── api-design.md        # API design principles
│   ├── database-schema.md   # Database design
│   └── security-model.md    # Security architecture
├── user/                    # User-facing documentation
│   ├── installation.md     # Installation guide
│   ├── getting-started.md  # Quick start guide
│   ├── features.md         # Feature documentation
│   └── troubleshooting.md  # Common issues
├── developer/               # Developer documentation
│   ├── setup.md            # Development setup
│   ├── contributing.md     # Contribution guidelines
│   ├── api-reference.md    # API documentation
│   └── debugging.md        # Debugging guide
├── deployment/              # Deployment and operations
│   ├── building.md         # Build process
│   ├── packaging.md        # Application packaging
│   └── distribution.md     # Distribution strategy
└── adr/                    # Architecture Decision Records
    ├── 001-technology-stack.md
    ├── 002-audio-processing.md
    └── 003-data-storage.md
```

## Build and Configuration Files

### Root Level Configuration

- **`Cargo.toml`**: Rust workspace configuration, dependencies, and metadata
- **`package.json`**: Node.js dependencies, scripts, and project metadata
- **`tauri.conf.json`**: Tauri-specific configuration (permissions, bundle settings)
- **`tsconfig.json`**: TypeScript compiler configuration
- **`tailwind.config.js`**: Tailwind CSS customization
- **`vite.config.ts`**: Vite build tool configuration
- **`vitest.config.ts`**: Vitest testing framework configuration

### Environment and Development

- **`.env.example`**: Template for environment variables
- **`.gitignore`**: Git ignore patterns for both Rust and Node.js
- **`.github/workflows/`**: CI/CD pipeline definitions
- **`scripts/`**: Development and build automation scripts

## File Naming Conventions

### Frontend (TypeScript/React)
- **Components**: PascalCase (`MeetingList.tsx`)
- **Hooks**: camelCase with "use" prefix (`useMeetingData.ts`)
- **Utilities**: camelCase (`dateUtils.ts`)
- **Types**: camelCase with ".types" suffix (`meeting.types.ts`)
- **Stores**: camelCase with ".store" suffix (`meeting.store.ts`)

### Backend (Rust)
- **Modules**: snake_case (`audio_capture.rs`)
- **Tests**: snake_case with "_test" suffix (`audio_capture_test.rs`)
- **Types**: snake_case (`meeting_types.rs`)

### Documentation
- **kebab-case** for all documentation files (`coding-standards.md`)

## Import/Export Patterns

### Frontend Import Strategy
```typescript
// External dependencies first
import React from 'react';
import { create } from 'zustand';

// Internal imports by category
import { Button } from '@/components/common';
import { useMeetingData } from '@/hooks/meeting';
import { MeetingStore } from '@/stores/meeting.store';
import { Meeting } from '@/types/meeting.types';
import { formatDate } from '@/utils/date.utils';
```

### Rust Import Strategy
```rust
// Standard library
use std::collections::HashMap;
use std::sync::Arc;

// External crates
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

// Internal modules
use crate::audio::{AudioCapture, AudioError};
use crate::storage::MeetingRepository;
use crate::types::MeetingId;
```

## Separation of Concerns

### Domain Boundaries
1. **Audio Domain**: Everything related to audio capture and processing
2. **Transcription Domain**: Speech-to-text conversion and processing
3. **Meeting Domain**: Meeting lifecycle and metadata management
4. **Storage Domain**: Data persistence and retrieval
5. **AI Domain**: Machine learning and artificial intelligence features
6. **Security Domain**: Encryption, authentication, and privacy
7. **Integration Domain**: External service connections

### Layer Boundaries
1. **Presentation Layer**: React components and UI logic
2. **Application Layer**: Business logic and use cases (hooks, stores)
3. **Domain Layer**: Core business entities and rules
4. **Infrastructure Layer**: External dependencies and system interfaces

### Communication Patterns
- **Frontend ↔ Backend**: Tauri commands and events
- **Inter-Domain**: Well-defined interfaces and dependency injection
- **External Services**: Service layer abstraction with fallback strategies

This source tree organization ensures:
- Clear separation of concerns
- Easy navigation and code discovery
- Scalable architecture for future growth
- Consistent patterns across the codebase
- Testable and maintainable code structure