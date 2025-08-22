# MeetingMind Codebase Structure

## Root Directory Structure
```
meeting-mind/
├── src/                    # React frontend source code
├── src-tauri/             # Rust backend source code
├── docs/                  # Project documentation
├── public/                # Static assets
├── tests/                 # Test files
├── models/                # AI model storage
└── scripts/               # Development scripts
```

## Frontend Structure (src/)
```
src/
├── components/            # React UI components
├── hooks/                 # Custom React hooks
├── stores/                # Zustand state management
├── services/              # API and service integrations
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── styles/                # CSS and styling files
├── assets/                # Static assets (images, etc.)
├── test/                  # Test utilities and setup
├── App.tsx               # Main React component
├── main.tsx              # React entry point
└── vite-env.d.ts         # Vite type definitions
```

## Backend Structure (src-tauri/src/)
```
src-tauri/src/
├── audio/                 # Audio capture and processing
├── transcription/         # Whisper integration and AI pipeline
├── storage/               # SQLite database operations and repositories
├── ai/                    # AI model integration
├── meeting/               # Meeting detection and management
├── integrations/          # External API integrations
├── commands/              # Tauri command handlers
├── events/                # Event system
├── config/                # Configuration management
├── security/              # Security and encryption
├── error.rs              # Error types and handling
├── config.rs             # Configuration definitions
├── lib.rs                # Library entry point
└── main.rs               # Application entry point
```

## Documentation Structure (docs/)
```
docs/
├── stories/               # User stories and feature specs
├── architecture/          # Technical architecture docs
├── prd/                   # Product requirements documents
└── qa/                    # Quality assurance documentation
    ├── gates/             # Quality gate configurations
    ├── assessments/       # QA assessment reports
    ├── execution/         # Test execution plans
    ├── summaries/         # Test summaries
    └── frameworks/        # Testing frameworks
```

## Key Configuration Files
- `package.json` - Frontend dependencies and scripts
- `Cargo.toml` (workspace) - Rust workspace configuration
- `src-tauri/Cargo.toml` - Backend dependencies
- `tsconfig.json` - TypeScript configuration with strict mode
- `.eslintrc.json` - ESLint rules for React/TypeScript
- `.prettierrc.json` - Code formatting rules
- `vite.config.ts` - Frontend build configuration
- `vitest.config.ts` - Test configuration with coverage
- `tailwind.config.js` - CSS framework configuration