# MeetingMind Technology Stack

## Frontend (React)
- **Framework**: React 18.3.1 with TypeScript 5.5.0
- **Build Tool**: Vite 5.4.0 with ES modules
- **Testing**: Vitest 2.0.0 with React Testing Library 16.0.0
- **UI Components**: Radix UI primitives (@radix-ui/react-*)
- **Styling**: Tailwind CSS 3.4.0 with PostCSS
- **State Management**: Zustand 4.5.5
- **Path Aliases**: `@/*` points to `./src/*`

## Backend (Rust)
- **Framework**: Tauri 2.4 for desktop app framework
- **Runtime**: Tokio 1.40 for async operations
- **Database**: SQLx 0.7 with SQLite and runtime-tokio-rustls
- **Audio**: CPAL 0.15 for cross-platform audio capture
- **HTTP Client**: reqwest 0.12 with JSON and rustls-tls
- **Serialization**: serde 1.0 with derive features
- **Error Handling**: thiserror 1.0 and anyhow 1.0
- **Security**: chacha20poly1305, argon2, secrecy
- **Utilities**: uuid, chrono, tracing, fastrand, futures, regex

## Development Tools
- **Linting**: ESLint with TypeScript, React, and React Hooks plugins
- **Formatting**: Prettier with specific config (single quotes, 100 char width)
- **Type Checking**: TypeScript with strict mode enabled
- **Testing**: Vitest with coverage thresholds (80% for all metrics)
- **Package Manager**: npm with Node.js (detected via Homebrew)

## Platform Support
- **Primary**: macOS (Darwin) - current development environment
- **Target**: Cross-platform desktop (via Tauri)
- **Rust Toolchain**: Cargo 1.89.0

## Notable Dependencies
- **AI/ML**: ONNX Runtime (temporarily disabled for macOS ARM64)
- **Tauri Plugins**: shell plugin for system integration
- **Workspace**: Cargo workspace setup with shared dependencies