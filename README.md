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

A cross-platform desktop app to manage sample kits for the **Squarp Rample** — a 4-voice Eurorack sampler. Built with **Electron**, **React**, **TypeScript**, and **Drizzle ORM**, this app makes it easy to organize, preview, and sync your sample kits.

## ✨ Features

- 🎵 **Kit Browser** - Browse and organize your Rample sample kits with metadata
- 🔊 **Sample Preview** - Listen to samples with built-in audio playback and XOX sequencer
- 📁 **Local Store Management** - Safe, non-destructive sample management with reference-only architecture
- ✏️ **Kit Editing** - Add, replace, and organize samples with undo/redo support
- 💾 **Safe Operations** - Validate and sync changes to SD card with format conversion
- 🌙 **Dark/Light Theme** - Modern UI that adapts to your preference

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

## 🚀 Getting Started

### Install dependencies

```sh
npm install
```

### Development

```sh
npm run dev      # Start development with hot reload
```

### Building

```sh
npm run build    # Build for production
```

### Testing

```sh
npm run lint     # Run ESLint
npm test         # Run unit and integration tests
npm run test:e2e # Run end-to-end tests
```

## ⚙️ Environment Variables

Romper supports the following environment variables for configuration:

- **`ROMPER_SDCARD_PATH`** - SD card directory path
- **`ROMPER_LOCAL_PATH`** - Local sample library path
- **`ROMPER_SQUARP_ARCHIVE_URL`** - Factory samples archive URL

Example usage:

```sh
# Point to your SD card
export ROMPER_SDCARD_PATH="/Volumes/RAMPLE/KITS"

# Or use a local directory
export ROMPER_LOCAL_PATH="/Users/yourusername/RampleSamples"

# Use a custom sample archive
export ROMPER_SQUARP_ARCHIVE_URL="https://custom-url.com/samples.zip"

npm run dev
```

## 🎯 Getting Started with Romper

Romper can work with your SD card in several ways:

### 📱 **From your existing Rample SD card**

If you already have a Rample with sample kits, just point Romper to your SD card directory and start managing your existing kits.

### 🏭 **From Squarp factory samples**

Automatically download the official factory sample packs from [squarp.net](https://squarp.net) and use Romper to organize them into your preferred kit structure.

### 📁 **From an empty folder**

Start fresh! Create a new folder and let Romper help you build your sample library from scratch. Perfect for organizing your own samples into Rample-compatible kits.

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
