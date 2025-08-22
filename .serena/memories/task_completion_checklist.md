# MeetingMind Task Completion Checklist

## Code Quality Checks (Required Before Commit)

### Frontend Quality Gates
```bash
# 1. Format all code
npm run format

# 2. Fix linting issues  
npm run lint:fix

# 3. Type checking
npm run type-check

# 4. Run all tests with coverage
npm run test:coverage

# 5. Verify production build
npm run build
```

### Backend Quality Gates (Rust)
```bash
# Navigate to Rust workspace
cd src-tauri

# 1. Check for compilation errors
cargo check

# 2. Run Clippy linter
cargo clippy -- -D warnings

# 3. Run all tests
cargo test

# 4. Verify build
cargo build
```

## Testing Requirements

### Frontend Testing
- **Unit Tests**: All new components and utilities must have tests
- **Coverage**: Minimum 80% for branches, functions, lines, statements
- **Integration**: Test component interactions
- **Accessibility**: Basic a11y testing with React Testing Library

### Backend Testing  
- **Unit Tests**: All new functions and modules
- **Integration**: Database operations and API endpoints
- **Error Handling**: Test error paths and edge cases
- **Security**: Test encryption and authentication flows

## Documentation Updates

### Code Documentation
- **TypeScript**: JSDoc for complex functions and types
- **Rust**: Rustdoc comments for public APIs
- **README**: Update if new features or setup changes
- **Architecture**: Update docs if architectural changes

### Story Documentation
- **Implementation Notes**: Document technical decisions
- **Testing Strategy**: Record test approach and coverage
- **Known Issues**: Document any limitations or technical debt

## Database Migration Checks

### If Database Changes Made
```bash
cd src-tauri

# 1. Create migration if schema changed
cargo sqlx migrate add <description>

# 2. Run migrations
cargo sqlx migrate run

# 3. Prepare queries for offline compilation
cargo sqlx prepare

# 4. Test database operations
cargo test -- --test-threads=1
```

## Security Validation

### Privacy Requirements
- **Local Processing**: Verify sensitive data stays local
- **Encryption**: Ensure proper encryption of sensitive data
- **API Keys**: No hardcoded secrets in code
- **PII Protection**: Verify PII detection and redaction works

### Code Security
- **Dependencies**: Check for known vulnerabilities
- **Input Validation**: Proper sanitization of user inputs
- **Error Messages**: No sensitive information leaked in errors

## Performance Validation

### Frontend Performance
- **Bundle Size**: Check for reasonable chunk sizes
- **Load Time**: Verify acceptable startup time
- **Memory Usage**: Check for memory leaks in long-running sessions
- **Responsiveness**: UI remains responsive during operations

### Backend Performance
- **Database Queries**: Optimize slow queries
- **Memory Usage**: Check for memory leaks
- **Audio Processing**: Verify real-time performance
- **File I/O**: Efficient file operations

## Platform Compatibility

### Cross-Platform Considerations
- **File Paths**: Use platform-agnostic path handling
- **Audio APIs**: Verify CPAL works across platforms
- **Database**: SQLite compatibility
- **Dependencies**: Check platform-specific requirements

## Final Verification Steps

### Before Story Completion
1. **All Quality Gates Pass**: Green checkmarks on all automated checks
2. **Manual Testing**: Smoke test the implemented feature
3. **Documentation Updated**: All relevant docs reflect changes
4. **No Regressions**: Existing functionality still works
5. **Performance Acceptable**: No significant performance degradation

### Git Workflow
```bash
# 1. Stage all changes
git add .

# 2. Commit with descriptive message
git commit -m "feat: implement story X.Y - description"

# 3. Push to feature branch
git push origin feature/story-X.Y-description

# 4. Create PR if ready for review
```

## Quality Gate Criteria

### Minimum Requirements (Must Pass)
- ✅ All tests passing (80%+ coverage)
- ✅ No linting errors
- ✅ No TypeScript errors
- ✅ Production build succeeds
- ✅ No security vulnerabilities introduced
- ✅ Documentation updated

### Best Practice Requirements (Should Pass)
- ✅ Performance benchmarks met
- ✅ Accessibility standards maintained
- ✅ Code review feedback addressed
- ✅ Manual testing completed
- ✅ Cross-platform compatibility verified

## Emergency Hotfix Process

### For Critical Issues
1. **Create hotfix branch** from main
2. **Minimal fix** addressing only the critical issue
3. **Fast-track testing** (essential tests only)
4. **Emergency review** (single reviewer acceptable)
5. **Deploy immediately** after approval
6. **Follow-up** with full testing and documentation