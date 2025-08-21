# /sprint Command - Unified Development Workflow

## Single Command Sprint Execution

This unified workflow uses a single `/sprint` command that automatically detects the current development step and executes the appropriate agent to move the sprint forward. No manual agent switching or parameter management required.

### Key Features:

- **🚀 Single Command**: Just run `/sprint` to progress through the entire workflow
- **🤖 Automatic Agent Execution**: System calls the right agent for each step automatically
- **🔍 Context-Aware Detection**: Adapts workflow based on story complexity and development context
- **🛡️ Seamless Quality Gates**: QA integration flows naturally through the development process
- **🧠 MCP Integration**: Leverages Serena, Context7, Sequential Thinking, and other MCP servers
- **📊 Continuous Progress**: Shows current status and automatically executes next step

### Available Agents (Auto-Selected):

- **Bob** (SM): Story creation with `*draft` command
- **Sarah** (PO): Story approval and requirements validation
- **Quinn** (QA): Risk assessment (`*risk`), test design (`*design`), tracing (`*trace`), NFR validation (`*nfr`), and review (`*review`)
- **James** (Dev): Story implementation with `*develop-story` command
- **Winston** (Architect): System design for complex architectural changes (when needed)
- **Mary** (Analyst): Business analysis for complex stories (when needed)

## 🚀 Single Command Usage

### The Only Command You Need

```bash
/sprint
```

**What It Does:**

1. **Detects current sprint step** by analyzing project state
2. **Automatically calls the appropriate agent** to execute the next action
3. **Shows progress and status** of current story development
4. **Continues execution** until story is complete and ready for deployment

### Automatic Step Detection & Execution

The system intelligently progresses through these steps:

| **Step**                | **Detection Logic**     | **Automatic Action**            | **Agent Called**               |
| ----------------------- | ----------------------- | ------------------------------- | ------------------------------ |
| **1. Story Creation**   | No story files found    | Create new story                | Bob with `*draft`              |
| **2. Story Approval**   | Story status = "Draft"  | Review and approve              | Sarah (PO)                     |
| **3. Pre-Dev QA**       | Complex story approved  | Risk assessment & test design   | Quinn with `*risk` + `*design` |
| **4. Development**      | Story approved, no code | Implement story                 | James with `*develop-story`    |
| **5. Mid-Dev QA**       | Development in progress | Validate coverage & NFRs        | Quinn with `*trace` + `*nfr`   |
| **6. Final Review**     | Development complete    | Comprehensive quality review    | Quinn with `*review`           |
| **7. Issue Resolution** | Review found issues     | Fix identified problems         | James (Dev)                    |
| **8. Completion**       | All gates passed        | Finalize and prepare deployment | Automatic                      |

## 🧠 Intelligent Agent Routing Logic

### Context-Aware Story Classification

The system automatically classifies stories to determine the appropriate workflow:

#### Automatic Classification Criteria

```bash
# Story Complexity Detection
SIMPLE_STORY = {
    "type": ["bug", "hotfix", "minor-feature"],
    "scope": "single-file-changes",
    "integration": "none",
    "workflow": "minimal-qa"
}

COMPLEX_STORY = {
    "type": ["feature", "enhancement", "api-change"],
    "scope": "multi-file-changes",
    "integration": "database|external-api|ui-components",
    "workflow": "standard-qa"
}

MIGRATION_STORY = {
    "type": ["legacy-migration", "architecture-change", "modernization"],
    "scope": "system-wide-impact",
    "integration": "legacy-system|data-migration|framework-change",
    "workflow": "extensive-qa"
}
```

### Step-by-Step Agent Execution

#### Step 1: Story Creation & Approval

**Detection**: No active story files in `docs/stories/`
**Automatic Actions**:

1. Call Bob (SM) with `*draft` → Creates new story
2. Call Sarah (PO) → Reviews and approves story
3. If complex: Call Mary (Analyst) → Additional business analysis

#### Step 2: Pre-Development Quality Setup

**Detection**: Approved story + classified as COMPLEX or MIGRATION
**Automatic Actions**:

1. Call Quinn (QA) with `*risk {story}` → Risk assessment
2. Call Quinn (QA) with `*design {story}` → Test strategy design
3. If architectural impact: Call Winston (Architect) → System design review

#### Step 3: Development Execution

**Detection**: Story approved + no implementation code present
**Automatic Actions**:

1. **Git Branch Management**: Check git status and create story-specific branch if needed
2. **Pre-Analysis**: Use Serena MCP to explore codebase patterns
3. **Documentation**: Use Context7 MCP for framework docs
4. Call James (Dev) with `*develop-story {story}` → Full implementation
5. **Integration**: Use RefactorMCP for legacy code changes (when applicable)

#### Step 4: Mid-Development Quality Checks

**Detection**: Development in progress + classified as COMPLEX/MIGRATION  
**Automatic Actions**:

1. Call Quinn (QA) with `*trace {story}` → Requirements coverage validation
2. Call Quinn (QA) with `*nfr {story}` → Non-functional requirements check

#### Step 5: Final Quality Review

**Detection**: Development marked complete + all tests passing
**Automatic Actions**:

1. Call Quinn (QA) with `*review {story}` → Comprehensive quality assessment
2. Generate quality gate decision (PASS/CONCERNS/FAIL/WAIVED)

#### Step 6: Issue Resolution (If Needed)

**Detection**: Quality gate status = FAIL or CONCERNS
**Automatic Actions**:

1. Call James (Dev) → Address specific issues identified by Quinn
2. Re-run quality checks after fixes

#### Step 7: Finalization

**Detection**: Quality gate status = PASS
**Automatic Actions**:

1. Update story status to "Complete"
2. Prepare deployment readiness report
3. Commit changes with comprehensive message
4. Push story branch to origin
5. Merge with main branch if all validations pass
6. Clean up feature branch

## 🌿 Git Branch Management Integration

### Automatic Branch Lifecycle Management

The sprint command includes comprehensive git branch management to ensure proper version control workflow:

#### Pre-Development Branch Setup

**Before starting any story development**, the system automatically:

1. **Check Current Git Status**: `git status` to validate repository state
2. **Branch Validation**: Check if story-specific branch exists (format: `feature/story-{number}-{slug}`)
3. **Branch Creation**: If no story branch exists, create one from main/master branch
4. **Branch Checkout**: Switch to story branch for all development work

```bash
# Automatic branch management flow
git status                                           # Validate repo state
git checkout main && git pull origin main           # Ensure main is current
git checkout -b "feature/story-1.8-policy-rules"   # Create story branch
git push -u origin "feature/story-1.8-policy-rules" # Set upstream tracking
```

#### Development Phase Branch Protection

**During development**, the system ensures:

1. **Single Story Focus**: All commits stay on the story-specific branch
2. **Regular Pushes**: Intermediate commits pushed to origin for backup
3. **Branch Validation**: Prevents accidental commits to main/master
4. **Conflict Detection**: Check for merge conflicts before final integration

#### Post-Development Branch Integration

**After story completion and quality gates pass**:

1. **Final Commit**: Create comprehensive commit with story details
2. **Push to Origin**: Ensure all changes are backed up remotely  
3. **Main Branch Merge**: 
   - Switch to main branch
   - Pull latest changes
   - Merge story branch with `--no-ff` for clear history
   - Push merged changes to origin
4. **Branch Cleanup**: Delete local and remote feature branch after successful merge

```bash
# Automatic finalization flow
git add . && git commit -m "feat: Complete Story X.Y - Description"
git push origin feature/story-X.Y-slug
git checkout main && git pull origin main
git merge --no-ff feature/story-X.Y-slug
git push origin main
git branch -d feature/story-X.Y-slug
git push origin --delete feature/story-X.Y-slug
```

#### Branch Naming Conventions

**Automated branch names follow standardized patterns**:

```bash
# Story branches
feature/story-{major}.{minor}-{slug}
# Examples:
feature/story-1.8-international-policy-rules
feature/story-2.1-user-authentication-modernization

# Hotfix branches (for urgent fixes)
hotfix/issue-{number}-{slug}
# Examples:
hotfix/issue-123-calculation-error
hotfix/issue-456-security-vulnerability

# Architecture/migration branches (for major changes)
epic/migration-{component}-{slug}
# Examples:
epic/migration-citnet-api-modernization
epic/migration-legacy-reports-system
```

#### Git Workflow Validation Rules

**Before proceeding with development**, the system validates:

✅ **Repository Clean State**: No uncommitted changes on main branch  
✅ **Remote Sync**: Local main branch is up-to-date with origin  
✅ **Branch Availability**: Story branch name is not already in use  
✅ **Access Rights**: User has push permissions to create branches  

**Before finalizing story**, the system validates:

✅ **All Tests Pass**: Comprehensive test suite must be green  
✅ **Quality Gates**: All Quinn (QA) validations must pass  
✅ **No Conflicts**: Story branch merges cleanly with current main  
✅ **Documentation Updated**: All relevant docs updated and committed  

## 🎯 Context-Aware Workflow Specializations

### Legacy Development Context

**Automatic Detection**: Keywords like "legacy", "migration", "characterization", "preservation"
**Specialized Agent Actions**:

```bash
# Enhanced legacy workflow (automatically applied)
1. **Mandatory Characterization Tests**: James (Dev) ensures business logic preservation
2. **Comprehensive Risk Assessment**: Quinn (QA) focuses on regression prevention
3. **RefactorMCP Integration**: Automatic use of `mcp__refactor-mcp__` for safe modernization
4. **Database Schema Validation**: Ensures existing schema compatibility
5. **Multi-Company Testing**: Test across all insurance company configurations
```

### Modern Development Context

**Automatic Detection**: Keywords like "clean architecture", "react", "api", "microservice"
**Specialized Agent Actions**:

```bash
# Enhanced modern workflow (automatically applied)
1. **Clean Architecture Validation**: Winston (Architect) ensures proper layer separation
2. **React Component Standards**: Automatic use of shadcn-ui MCP and Atlas Design System
3. **API Design Compliance**: James (Dev) follows RESTful conventions and OpenAPI specs
4. **Comprehensive Testing**: Unit, integration, and E2E test coverage via Quinn (QA)
5. **Performance Optimization**: Quinn (QA) validates response times and resource efficiency
```

### Migration Stories Context

**Automatic Detection**: Keywords like "modernization", "strangler fig", "api migration"  
**Specialized Agent Actions**:

```bash
# Enhanced migration workflow (automatically applied)
1. **Dual Implementation Validation**: Test both legacy and modern implementations
2. **Business Logic Preservation**: Characterization tests + modern test coverage
3. **Performance Benchmarking**: Ensure modern implementation meets/exceeds legacy
4. **Integration Testing**: Validate strangler fig routing works correctly
5. **Rollback Strategy Documentation**: Maintain ability to revert to legacy if needed
```

## 📊 Automatic Progress Tracking

### Real-Time Status Display

When you run `/sprint`, the system shows:

```bash
# Current Sprint Status
┌─────────────────────────────────────────────────┐
│ 🚀 Sprint Progress                              │
├─────────────────────────────────────────────────┤
│ Current Story: 1.X-story-name                   │
│ Classification: [COMPLEX_STORY]                 │
│ Context: [Modern Development]                   │
├─────────────────────────────────────────────────┤
│ ✅ Story Creation (Bob)                         │
│ ✅ Story Approval (Sarah)                       │
│ ✅ Risk Assessment (Quinn)                      │
│ ✅ Test Design (Quinn)                          │
│ 🔄 Development (James) - IN PROGRESS            │
│ ⏳ Mid-Dev QA (Quinn) - PENDING                 │
│ ⏳ Final Review (Quinn) - PENDING               │
│ ⏳ Completion - PENDING                         │
├─────────────────────────────────────────────────┤
│ 🎯 Next Action: Continue development            │
│ 🤖 Agent Ready: James (Dev)                     │
└─────────────────────────────────────────────────┘
```

### Quality Gate Progression

```bash
# Quality Gate Status Tracking
┌─────────────────────────────────────────────────┐
│ 🛡️ Quality Gates                                │
├─────────────────────────────────────────────────┤
│ Pre-Dev Risk Assessment: ✅ COMPLETE            │
│ Pre-Dev Test Design: ✅ COMPLETE                │
│ Mid-Dev Requirements Trace: ⏳ PENDING          │
│ Mid-Dev NFR Validation: ⏳ PENDING              │
│ Final Comprehensive Review: ⏳ PENDING          │
│ Overall Gate Status: 🔄 IN PROGRESS             │
└─────────────────────────────────────────────────┘
```

## 🚀 Complete Sprint Workflow Examples

### Example 1: Simple Bug Fix (Minimal QA)

```bash
# Single command execution flow
/sprint  → Detects: No story → Bob creates story
/sprint  → Detects: Draft story → Sarah approves
/sprint  → Detects: Approved simple story → James develops
/sprint  → Detects: Development complete → Quinn reviews
/sprint  → Detects: Review passed → Automatic completion

# Total: 5 command executions, fully automated agent routing
```

### Example 2: Complex Feature (Standard QA)

```bash
# Single command execution flow with enhanced QA + Git Branch Management
/sprint  → Detects: No story → Bob creates story
/sprint  → Detects: Draft story → Sarah approves
/sprint  → Detects: Complex story → Quinn risk assessment + test design
/sprint  → Detects: QA setup complete → Git branch creation + James develops with Serena/Context7
/sprint  → Detects: Mid-development → Quinn traces requirements + NFR validation
/sprint  → Detects: Development complete → Quinn comprehensive review
/sprint  → Detects: Review passed → Commit + merge to main + branch cleanup

# Total: 7 command executions, comprehensive quality integration + automated git workflow
# Git Flow: feature/story-X.Y-name → commits → merge to main → cleanup
```

### Example 3: Legacy Migration Story (Extensive QA)

```bash
# Single command execution flow with full validation + Git Branch Management
/sprint  → Detects: No story → Bob creates story + Mary business analysis
/sprint  → Detects: Draft story → Sarah approves + Winston architecture review
/sprint  → Detects: Migration story → Quinn risk + design + characterization strategy
/sprint  → Detects: QA setup complete → Git migration branch + James develops with RefactorMCP
/sprint  → Detects: Mid-development → Quinn traces + NFR + legacy compatibility
/sprint  → Detects: Development complete → Quinn migration validation review
/sprint  → Detects: Review passed → Full commit + safe merge + rollback prep + branch cleanup

# Total: 7 command executions, extensive migration safeguards + protected git workflow
# Git Flow: epic/migration-component-name → characterization commits → safe merge → rollback ready
```

## 🎯 Key Benefits of Unified Sprint Command

### Efficiency Gains

- **Single Command Simplicity**: No need to remember multiple commands or parameters
- **Automatic Agent Routing**: System selects the right agent for each step automatically
- **Context-Aware Processing**: Adapts workflow complexity based on story type
- **Continuous Progress**: Each command execution moves the sprint forward until complete

### Quality Improvements

- **Zero Missed Steps**: Systematic progression through all required phases
- **Consistent Standards**: All stories follow the same quality gate process
- **Risk-Based Testing**: Appropriate QA depth based on story classification
- **Documentation Trail**: Complete audit trail of all agent actions and decisions
- **Git Workflow Safety**: Automatic branch management prevents merge conflicts and ensures clean history

### User Experience

- **No Context Switching**: Single command interface eliminates mental overhead
- **Clear Progress Visibility**: Real-time status shows exactly where you are
- **Predictable Workflow**: Same process for all stories, adapted to complexity
- **Intelligent Automation**: System handles all the complexity behind the scenes

## 🔄 Continuous Workflow Until Completion

The unified `/sprint` command creates a seamless development experience:

1. **Run `/sprint`** → System detects current step and executes next action
2. **Review results** → See what was accomplished and current status
3. **Run `/sprint`** again → System progresses to next step automatically
4. **Repeat until complete** → Story reaches "Complete" status with all quality gates passed

**No manual agent management, no parameter complexity, no workflow confusion.**

Just `/sprint` until done! 🚀

---

## 🎯 Transform Your Development Experience

**Ready to streamline your development workflow?**

The unified `/sprint` command eliminates complexity while maintaining comprehensive quality standards. No more juggling multiple commands, parameters, or agent switches.

### Get Started:

```bash
/sprint
```

**That's it!** The system will:

- Detect your current development state
- Automatically call the right agent for the next step
- Show clear progress and status information
- Continue until your story is complete and deployment-ready

### Perfect For:

- **New Team Members**: Simplified workflow with built-in guidance
- **Experienced Developers**: Streamlined efficiency without sacrificing quality
- **Complex Projects**: Intelligent adaptation to story complexity and context
- **Quality-Focused Teams**: Comprehensive testing and validation at every step

**Experience the future of automated sprint execution! 🚀**
