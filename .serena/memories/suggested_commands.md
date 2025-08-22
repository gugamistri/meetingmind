# MeetingMind Development Commands

## Core Development Commands

### Frontend Development
```bash
npm run dev              # Start Vite development server (port 1420)
npm run build           # Build frontend for production (TypeScript + Vite)
npm run preview         # Preview production build locally
```

### Tauri Development
```bash
npm run tauri:dev       # Start Tauri development mode (frontend + backend)
npm run tauri:build     # Build Tauri application for distribution
npm run tauri          # Access Tauri CLI directly
```

### Testing
```bash
npm run test           # Run Vitest unit tests
npm run test:ui        # Run Vitest with UI interface
npm run test:coverage  # Run tests with coverage report (80% threshold)
```

### Code Quality
```bash
npm run lint           # Lint TypeScript/React code with ESLint
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
npm run format:check   # Check if code is properly formatted
npm run type-check     # TypeScript type checking without emitting
```

### Backend Development (Rust)
```bash
cargo check            # Check Rust code for errors (in src-tauri/)
cargo build            # Build Rust backend
cargo test             # Run Rust unit tests
cargo clippy           # Lint Rust code
```

## Development Workflow Commands

### When Starting Development
```bash
npm install            # Install frontend dependencies
npm run type-check     # Verify TypeScript types
npm run lint           # Check code quality
npm run tauri:dev      # Start development environment
```

### Before Committing
```bash
npm run format         # Format all code
npm run lint:fix       # Fix linting issues
npm run type-check     # Ensure types are correct
npm run test           # Run all tests
npm run build          # Verify production build works
```

### Platform-Specific Commands (macOS)
```bash
# Rust toolchain (via Homebrew/rustup)
cargo --version       # Verify Cargo installation
rustc --version       # Verify Rust compiler

# Node.js (via Homebrew)
npm --version         # Verify npm installation
node --version        # Verify Node.js installation
```

## Database Commands (SQLite)
```bash
# Navigate to src-tauri first for database operations
cd src-tauri

# SQLx commands (if needed)
cargo sqlx database create    # Create SQLite database
cargo sqlx migrate run        # Run database migrations
cargo sqlx prepare           # Prepare queries for offline compilation
```

## Utility Commands (macOS Darwin)
```bash
# File operations
ls -la                # List files with details
find . -name "*.ts"   # Find TypeScript files
grep -r "pattern"     # Search for patterns in files

# Git operations
git status            # Check repository status
git add .             # Stage all changes
git commit -m "msg"   # Commit with message
git push              # Push to remote

# Process management
lsof -i :1420         # Check what's using port 1420
kill -9 <pid>         # Force kill process
```

## Project-Specific Notes
- **Port 1420**: Default Vite development server port
- **Path Aliases**: Use `@/` for imports from src directory
- **Test Coverage**: Minimum 80% required for branches, functions, lines, statements
- **Code Style**: Single quotes, 100 character line width, 2-space indentation
- **Database**: SQLite with WAL mode, located at `meeting-mind.db`