<!-- 
title: 🎛️ Rample Sample Manager
owners: maintainer
last_reviewed: 2025-08-15
tags: documentation
-->

# 🎛️ Rample Sample Manager

[![Tests](https://github.com/peteb4ker/romper/actions/workflows/test.yml/badge.svg)](https://github.com/peteb4ker/romper/actions/workflows/test.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=peteb4ker_romper&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=peteb4ker_romper)
[![codecov](https://codecov.io/gh/peteb4ker/romper/branch/main/graph/badge.svg)](https://codecov.io/gh/peteb4ker/romper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/peteb4ker/romper.svg)](https://github.com/peteb4ker/romper/releases/latest)

**Romper** is a cross-platform desktop application designed to streamline sample kit management for the **Squarp Rample** — a 4-voice Eurorack sampler module. Whether you're a producer working with hundreds of samples or a live performer who needs quick access to perfectly organized kits, Romper provides an intuitive interface for managing, auditioning, and organizing your sample libraries.

## 🎯 What is Romper?

The **Squarp Rample** is a powerful 4-voice sampler in Eurorack format that reads samples from SD cards organized in a specific folder structure. While the Rample itself is excellent, managing large sample libraries, creating kits, and keeping everything organized can become tedious when working directly with files and folders.

**Romper solves this by providing:**
- A **visual interface** for browsing and organizing sample kits
- **Audio preview** with built-in playback and step sequencer
- **Safe sample management** that never modifies your original files
- **Kit editing tools** with drag-and-drop sample assignment
- **Batch operations** for organizing large sample libraries
- **Format validation** to ensure compatibility with your Rample hardware

Built with modern web technologies (**Electron**, **React**, **TypeScript**, **Drizzle ORM**), Romper brings the convenience of modern music software to hardware sample management.

## ✨ Key Features

### 🎵 **Intuitive Kit Management**
- Visual browser for all your Rample sample kits with rich metadata
- Organize kits by banks (A-Z) and slots (00-99) matching your hardware
- Quick search and filtering to find the perfect kit instantly
- Favorites system to bookmark your most-used kits

### 🔊 **Built-in Audio Preview**
- Play samples directly in the app without loading them on hardware
- **XOX-style step sequencer** for auditioning drum patterns
- Real-time BPM adjustment to match your project tempo
- Waveform visualization for quick sample identification

### ✏️ **Powerful Kit Editing**
- Drag-and-drop sample assignment to kit slots
- **Undo/redo support** for safe experimentation
- Bulk operations for organizing large sample collections
- Smart sample validation and format conversion

### 📁 **Reference-Only Architecture**
- **Never modifies your original samples** - works with references only
- Safe to use with existing sample libraries and workflows
- Supports both local sample libraries and direct SD card management
- Automatic backup and rollback capabilities

### 💾 **Hardware Integration**
- Direct SD card synchronization with format validation
- **Squarp Rample naming conventions** automatically applied
- Preview changes before writing to hardware
- Support for multiple SD cards and sample libraries

### 🎛️ **Professional Workflow**
- **Dark/Light theme** support for any studio environment
- Keyboard shortcuts for power users
- **Import official Squarp factory samples** automatically
- Export and share kit configurations with other users

## 👥 Who is Romper for?

### 🎹 **Music Producers**
- Organize hundreds of samples across multiple projects
- Quickly audition and arrange samples into performance-ready kits
- Maintain consistent sample libraries across multiple Rample units

### 🎤 **Live Performers** 
- Create setlist-specific sample kits for different songs or sets
- Quick access to backup kits and emergency sounds
- Reliable, tested sample organization for critical live performances

### 🏠 **Home Studio Musicians**
- Explore and organize the official Squarp factory sample packs
- Learn sample organization techniques for hardware workflow
- Bridge the gap between software DAW samples and hardware performance

### 🔧 **Sample Library Curators**
- Manage large collections of samples from various sources
- Create themed sample packs for sharing with the community
- Quality control and format validation for professional sample distribution

## 📥 Installation & Quick Start

### Download & Install

1. **Download** the latest release for your operating system:
   - **Windows**: `Romper-Setup-x.x.x.exe`
   - **macOS**: `Romper-x.x.x.dmg` 
   - **Linux**: `Romper-x.x.x.AppImage`

2. **Install** and launch Romper

3. **Connect your Rample SD card** or **choose a local folder** to get started

### First Time Setup

**🎛️ If you have an existing Rample SD card:**
- Insert your SD card and select it in Romper
- Your existing kits and samples will be automatically detected
- Start browsing, editing, and organizing immediately

**📁 Starting fresh:**
- Create a new folder for your sample library
- Download official Squarp factory samples (optional)
- Import your own samples and begin creating kits

**🏭 Using factory samples:**
- Romper can automatically download official Squarp sample packs
- Perfect starting point for new Rample users
- Provides professionally organized examples to learn from

## 🏗️ Project Structure

```
romper/
  app/renderer/    # React UI components and renderer logic
  electron/        # Electron main process and native integrations
  shared/          # Shared utilities between renderer and main
  docs/            # Documentation
  tests/           # End-to-end tests
  .github/chatmodes/ # GitHub Copilot Chatmodes for development workflows
```

## 📚 Documentation

### For Users

- **[Getting Started Guide](docs/user/getting-started.md)** - Installation and first-time setup
- **[User Documentation](docs/index.md)** - Complete user guide and feature overview
- **[Keyboard Shortcuts](docs/user/keyboard-shortcuts.md)** - Speed up your workflow
- **[Settings Guide](docs/user/settings.md)** - Configure Romper preferences

### For Developers

- **[Architecture Overview](docs/developer/architecture.md)** - Core design patterns and decisions
- **[Contributing Guide](docs/developer/contributing.md)** - How to contribute to the project
- **[Development Setup](docs/developer/development.md)** - Set up your development environment
- **[Development Workflow](docs/developer/development-workflow.md)** - Task execution and quality standards
- **[Coding Guide](docs/developer/coding-guide.md)** - Human-readable development best practices
- **[Database Schema](docs/developer/romper-db.md)** - Complete database documentation

### For AI Development Tools

- **[CLAUDE.md](CLAUDE.md)** - Claude Code project instructions
- **[Agent Instructions](.agent/)** - Machine-readable coding standards
- **[GitHub Copilot Instructions](.github/copilot-instructions.md)** - Copilot development standards

### Project Management

- **[Product Requirements](tasks/PRD.md)** - Complete project vision
- **[Current Tasks](tasks/tasks-PRD.md)** - Development progress tracking

## 💬 Development Workflows

The project uses structured workflows for different development tasks:

- [**Define.chatmode.md**](.github/chatmodes/Define.chatmode.md) - Create detailed Product Requirements Documents (PRDs)
- [**Plan.chatmode.md**](.github/chatmodes/Plan.chatmode.md) - Generate implementation task lists from PRDs
- [**Build.chatmode.md**](.github/chatmodes/Build.chatmode.md) - Execute tasks methodically with progress tracking

## ⚙️ Configuration

Romper can be configured using environment variables for advanced use cases:

- **`ROMPER_SDCARD_PATH`** - Default SD card directory path
- **`ROMPER_LOCAL_PATH`** - Default local sample library path  
- **`ROMPER_SQUARP_ARCHIVE_URL`** - Custom factory samples archive URL

## 🛠️ Development

### Prerequisites

- **Node.js** 18+ with npm
- **Git** for version control  
- **Squarp Rample** (optional, for testing with real hardware)

### Development Commands

```bash
# Start development (builds + hot reload)
npm run dev

# Testing
npm run test:fast   # Quick tests (~14s)
npm run test        # Full test suite with coverage (~40s) 
npm run test:e2e    # End-to-end tests

# Quality checks
npm run lint        # ESLint + auto-fix
npm run typecheck   # TypeScript validation

# Production build
npm run build       # Build all components
npm run make        # Create distributables
```

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development workflows, coding standards, and the mandatory worktree system.

## 📄 License

[MIT License](LICENSE) — feel free to fork and contribute!
