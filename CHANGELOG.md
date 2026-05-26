# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> [!IMPORTANT]
> **Ratchet Rule #403**: 백엔드 환경 통합 테스트 시 `Cache entry deserialization failed` 경고가 발생하면 즉시 GitHub 파이프라인의 캐시 키(Cache-key)를 갱신한다. 프론트엔드의 폴링 로직 구현 시 백엔드 라우터 스키마와 불일치하면 파이썬 테스트가 붕괴될 수 있으므로 교차 검증을 의무화한다.
>
> **Ratchet Rule #404**: GitHub Actions YAML 파일 수정 시, 기존 액션 플러그인이 요구하는 필수 인자(예: path)를 절대 삭제하지 않도록 주의해야 하며, Node.js 20 deprecation 로그가 보일 경우 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`를 적용하여 노이즈를 제거한다.

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
