# MeetingMind Project Overview

## Project Purpose
MeetingMind is a privacy-first AI Meeting Assistant built as a desktop application using Tauri + React. The application focuses on local-first processing to maintain privacy while providing:

- System audio capture from meetings
- Hybrid transcription (local Whisper + optional cloud APIs)
- AI-powered summarization 
- Local data storage by default

## Key Features
- **Privacy-First**: All sensitive data processing happens locally by default
- **Audio Capture**: System audio capture using CPAL for cross-platform support
- **Transcription Pipeline**: Hybrid local/cloud processing with local Whisper models
- **AI Summarization**: Local and optional cloud-based meeting summarization
- **Calendar Integration**: Automatic meeting detection via calendar APIs
- **Local Storage**: SQLite database with encryption for sensitive data

## Development Status
The project is actively being developed with multiple implemented stories including:
- 1.1: Project Foundation Setup ✅
- 1.2: Audio Capture System ✅
- 1.3: Transcription Pipeline Implementation ✅
- 1.4: AI-Powered Summarization ✅
- 1.5: Calendar Integration 🚧

## Current Architecture
- **Backend**: Rust with Tauri 2.0 framework
- **Frontend**: React 18 + TypeScript 5.0 + Vite 5.0
- **Database**: SQLite with sqlx for async operations
- **Audio**: CPAL for cross-platform audio capture
- **AI/ML**: ONNX Runtime for local Whisper models (temporarily disabled for macOS ARM64)
- **UI**: Radix UI components + Tailwind CSS
- **State Management**: Zustand