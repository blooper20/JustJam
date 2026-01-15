# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- Improved README with detailed usage examples and setup instructions
- Enhanced transcriber module with better validation and error handling
- Improved tab_generator with detailed docstrings
- Updated requirements.txt with version constraints

### Fixed
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
