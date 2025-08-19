<!-- 
title: Task Index - Romper Sample Manager
updated: 2025-08-19
context_optimization: Focus on active tasks, archive completed work
-->

# Task Index - Romper Sample Manager

Quick navigation and overview of all project tasks. **Total Context Reduction: ~1,200 lines archived.**

---

## 🔥 Critical Tasks (v1.0.0 Blockers)

**File:** [`active/critical.md`](active/critical.md) | **Context:** Small (~50 lines)

| Task | Status | Priority | Description |
|------|--------|----------|-------------|
| **SYNC.1** | 🔴 Active | Critical | Bulletproof SD Card Sync |
| **QA.1** | 🔴 Active | Critical | Pre-release Testing & Validation |

### Quick Status
- **Build**: ✅ Successful (all platforms)
- **Tests**: ✅ Passing (2187 tests, 80.7% coverage)
- **Core Features**: ✅ Complete
- **Remaining**: SD sync reliability + final QA

---

## 🚀 Feature Tasks (Post v1.0.0)

**File:** [`active/features.md`](active/features.md) | **Context:** Medium (~100 lines)

| Task | Status | Priority | Target | Description |
|------|--------|----------|--------|-------------|
| **UX.1** | 🟡 Partial | High | v1.1.0 | Complete Favorites System |
| **UX.2** | 🔴 Pending | Medium | v1.2.0 | Testing and Integration |
| **ADMIN.1** | 🔴 Pending | Medium | v1.1.0 | Enhanced Error Recovery |
| **UX.3** | 🔵 Deferred | Low | v1.3.0+ | Advanced Kit Organization |

---

## 🔧 Technical Debt

**File:** [`active/technical-debt.md`](active/technical-debt.md) | **Context:** Medium (~80 lines)

### High Priority
| Task | Status | Effort | Description |
|------|--------|--------|-------------|
| **DEBT.1** | 🔴 Pending | Large | Decompose KitBrowser Component |
| **DEBT.5** | 🔴 Pending | Medium | Complete Test Infrastructure |

### Medium Priority
| Task | Status | Effort | Description |
|------|--------|--------|-------------|
| **DEBT.2** | 🔴 Pending | Medium | WAV Analysis to Main Process |
| **DEBT.6** | 🔴 Pending | Medium | Increase Error Path Coverage |

### Low Priority (As Needed)
- **DEBT.3**: Server-side input validation
- **DEBT.4**: Database profiling
- **DEBT.7**: Documentation improvements

---

## 📚 Reference Documents

### Product Specifications
- **[PRD.md](PRD.md)** - Complete product requirements (989 lines)
- **[specs/sd-card-naming.md](specs/sd-card-naming.md)** - SD card sync naming specification

### Historical Archive
- **[archive/completed-2025-01.md](archive/completed-2025-01.md)** - All completed tasks
- **[archive/technical-debt.md](archive/technical-debt.md)** - Completed tech debt items
- **[archive/README.md](archive/README.md)** - Archive organization guide

---

## 📊 Project Status Dashboard

### Release Status: v1.0.0
- **Ready**: ✅ Core features complete, tests passing
- **Blockers**: 2 critical tasks (SYNC.1, QA.1)
- **Timeline**: Ready for release after sync verification

### Development Health
- **Test Coverage**: 80.7% (175 files, 2187 tests)
- **Code Quality**: SonarCloud integration active
- **Architecture**: Drizzle ORM migration complete
- **Performance**: Sub-50ms UI response maintained

### Active Worktrees
```bash
git worktree list
# Main development happens in dedicated worktrees
# Example: <project-root>/worktrees/<feature-name>
# e.g. <project-root>/worktrees/task-cleanup (this reorganization)
#      <project-root>/worktrees/sd-card-naming (SYNC.1 implementation)
#      <project-root>/worktrees/release-automation (CI/CD improvements)
```

---

## 🎯 Quick Actions

### For Development
- **Start new feature**: `npm run worktree:create <feature-name>`
- **Run tests**: `npm run test:fast` (14s vs 40s with coverage)
- **Type check**: `npx tsc --noEmit`
- **Commit changes**: `npm run commit "message"` (includes quality checks + PR creation)

### For Task Management
- **Find active work**: Check [`active/`](active/) directory
- **Review completed work**: Check [`archive/`](archive/) directory
- **Implementation details**: Check [`specs/`](specs/) directory
- **Update progress**: Edit relevant task file in [`active/`](active/)

---

## 📋 Task Categories Explained

### Category Prefixes
- **SYNC**: SD card synchronization tasks
- **QA**: Quality assurance and testing
- **UX**: User experience improvements
- **ADMIN**: Administrative features
- **DEBT**: Technical debt items

### Status Indicators
- 🔴 **Active**: Currently being worked on
- 🟡 **Partial**: Partially complete, work remaining
- 🔴 **Pending**: Not yet started
- 🔵 **Deferred**: Low priority, future consideration
- ✅ **Complete**: Finished and archived

### Priority Levels
- **Critical**: v1.0.0 release blockers
- **High**: Next release priorities
- **Medium**: Important but not urgent
- **Low**: Future improvements

---

## 🔄 Migration Summary

### What Was Archived (1,200+ lines removed from active context)
- ✅ **41 completed tasks** from tasks-prd.md
- ✅ **6 completed tech debt items** from tasks-techdebt.md
- ✅ **Detailed implementation notes** for finished features
- ✅ **Historical task numbering** (replaced with semantic categories)

### What Remains Active (300 lines focused context)
- 🔥 **2 critical tasks** blocking v1.0.0 release
- 🚀 **4 feature tasks** for post-release development
- 🔧 **7 technical debt items** for ongoing improvement

### Benefits Achieved
- **87% context reduction**: 1,890 → 300 lines active
- **Clear priorities**: Critical tasks immediately visible
- **Better organization**: Semantic categories vs. random numbers
- **Preserved history**: All completed work archived but accessible
- **Agent-friendly**: Files under 200 lines prevent context overflow

---

*Task reorganization completed 2025-08-19 | [View change summary](archive/README.md)*