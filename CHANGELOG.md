# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TanStack Query v5 status polling system with 1-second interval checks for pending/processing status.
- Zustand store `/client/store/project-store.ts` for unified project, playhead, metronome, and track mixing states.
- Web Audio API drift-corrected precise lookahead MetronomeEngine.
- WaveSurfer.js playhead drift monitoring and auto-sync checks.
- Comprehensive error handling and logging throughout the codebase
- Type hints for all functions and methods
- Configuration file support (config.yaml)
- Unit tests for core modules
- GitHub Actions CI/CD workflows
- Development tooling (black, isort, flake8, mypy)
- CONTRIBUTING.md with detailed contribution guidelines
- Example configuration file (config.yaml.example)
- Makefile for common development tasks
- pyproject.toml for modern Python packaging

### Changed
- Integrated client components with Zustand store subscription for real-time player states.
- Improved README with detailed usage examples and setup instructions
- Enhanced transcriber module with better validation and error handling
- Improved tab_generator with detailed docstrings
- Updated requirements.txt with version constraints

### Fixed
- Fixed TypeScript overloading/compilation errors in `scores/page.tsx`, `songs/page.tsx`, `tabs/page.tsx`, and `projects/page.tsx`.
- Corrected collection syntax errors (escaped triple quotes) in backend tests `tests/test_config.py`.
- Formatted `setup.py` and suppressed E402 warnings in `tests/conftest.py` to achieve zero-warning/zero-error python linting.
- Audio format validation now properly handles all supported formats
- BPM detection fallback to default value when detection fails

## [0.1.0] - 2024-01-08

### Added
- Initial release
- AI-powered audio transcription using Spotify's Basic Pitch
- Smart fingering algorithm for guitar tablature
- Chord detection with 40+ chord shapes
- Auto BPM detection using Librosa
- MCP server integration for Claude Desktop
- Multi-language support (English, Korean)
- ASCII tablature generation
- Command-line testing tool

### Features
- Support for multiple audio formats (MP3, WAV, FLAC, OGG, M4A, AAC)
- Chord-based note positioning
- Measure-based tablature formatting
- Internationalization support with gettext

[Unreleased]: https://github.com/yourusername/fingerstyle-tab-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/fingerstyle-tab-mcp/releases/tag/v0.1.0
