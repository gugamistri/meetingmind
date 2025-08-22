# MeetingMind Coding Standards and Conventions

## TypeScript/React Standards

### Code Style (Prettier Configuration)
- **Quotes**: Single quotes for strings, JSX single quotes
- **Line Width**: 100 characters maximum
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Required
- **Trailing Commas**: ES5 style
- **Bracket Spacing**: Enabled
- **Arrow Parens**: Avoid when possible
- **End of Line**: LF (Unix style)

### TypeScript Configuration (Strict Mode)
- **Strict Mode**: Enabled with additional strict checks
- **Exact Optional Properties**: Required
- **No Implicit Returns**: Enforced
- **No Unchecked Indexed Access**: Enforced
- **Unused Locals/Parameters**: Error (except `_` prefixed)
- **Path Mapping**: `@/*` for src directory imports

### ESLint Rules
- **React**: No prop-types (using TypeScript), React 17+ JSX transform
- **TypeScript**: No explicit any (warn), unused vars error with `_` exception
- **General**: No console (warn), prefer const, no var, object shorthand, arrow callbacks
- **React Hooks**: Enforced rules for proper hook usage
- **React Refresh**: Only export components rule

### Component Conventions
- **Functional Components**: Prefer arrow functions
- **TypeScript Types**: Explicit prop interfaces
- **File Names**: PascalCase for components, camelCase for utilities
- **Import Order**: External libraries, internal imports, relative imports
- **Exports**: Named exports preferred, default for main component

## Rust Backend Standards

### Code Organization
- **Error Handling**: Use `thiserror` for custom errors, `anyhow` for error propagation
- **Async**: Tokio runtime with async/await patterns
- **Serialization**: Serde with derive features
- **Security**: Use `secrecy` for sensitive data, proper encryption practices
- **Logging**: Tracing crate for structured logging

### Naming Conventions
- **Functions**: snake_case
- **Types/Structs**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Modules**: snake_case
- **Crates**: kebab-case

### Project Patterns
- **Repository Pattern**: For database operations in storage module
- **Command Pattern**: For Tauri command handlers
- **Event-Driven**: Using Tauri's event system
- **Configuration**: Centralized in config module

## Database Standards

### SQLite Conventions
- **WAL Mode**: For better concurrency
- **Migrations**: Using SQLx migrations
- **Queries**: Compile-time checked with SQLx
- **Schema**: Evolutionary design for future updates
- **Encryption**: SQLCipher for sensitive data

### Table Naming
- **Snake Case**: All table and column names
- **Descriptive**: Clear, descriptive names
- **Relationships**: Proper foreign key naming

## Testing Standards

### Frontend Testing (Vitest)
- **Coverage Thresholds**: 80% for branches, functions, lines, statements
- **Test Environment**: jsdom for React components
- **Test Files**: `*.test.ts` or `*.spec.ts` suffix
- **Setup**: Global test setup in `src/test/setup.ts`
- **Mocking**: React Testing Library patterns

### Backend Testing (Rust)
- **Unit Tests**: In same file with `#[cfg(test)]`
- **Integration Tests**: In `tests/` directory
- **Test Data**: Use test fixtures and factories
- **Database**: In-memory SQLite for testing

## Security Standards

### Privacy-First Architecture
- **Local Processing**: Default to local processing
- **Encryption**: ChaCha20Poly1305 for data at rest
- **API Keys**: Proper secret management with `secrecy` crate
- **PII Detection**: Automatic detection and redaction
- **No Telemetry**: Without explicit user consent

### Authentication
- **Device-Based**: No user accounts in MVP
- **Key Management**: Argon2 for password hashing
- **Session Management**: Local session tokens

## Documentation Standards

### Code Documentation
- **TypeScript**: JSDoc for complex functions
- **Rust**: Rustdoc comments for public APIs
- **README**: Keep updated with current status
- **Architecture**: Maintain architectural decision records

### Commit Standards
- **Format**: Conventional commits preferred
- **Scope**: Clear scope indication
- **Description**: Descriptive commit messages
- **Testing**: All tests must pass before commit

## File Organization Principles

### Import Organization
```typescript
// External libraries
import React from 'react';
import { create } from 'zustand';

// Internal modules
import { ApiService } from '@/services/api';
import { MeetingStore } from '@/stores/meeting';

// Relative imports
import './Component.css';
```

### Export Patterns
```typescript
// Preferred: Named exports
export const Component = () => { /* ... */ };
export type ComponentProps = { /* ... */ };

// Default export for main component only
export default Component;
```