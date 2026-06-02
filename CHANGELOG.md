# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> [!IMPORTANT]
> **Ratchet Rule #403**: 백엔드 환경 통합 테스트 시 `Cache entry deserialization failed` 경고가 발생하면 즉시 GitHub 파이프라인의 캐시 키(Cache-key)를 갱신한다. 프론트엔드의 폴링 로직 구현 시 백엔드 라우터 스키마와 불일치하면 파이썬 테스트가 붕괴될 수 있으므로 교차 검증을 의무화한다.
>
> **Ratchet Rule #404**: GitHub Actions YAML 파일 수정 시, 기존 액션 플러그인이 요구하는 필수 인자(예: path)를 절대 삭제하지 않도록 주의해야 하며, Node.js 20 deprecation 로그가 보일 경우 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`를 적용하여 노이즈를 제거한다.
>
> **Ratchet Rule #405**: 백엔드 API 스키마(`projects.py`)를 변경하여 프론트엔드와 동기화할 경우, 반드시 관련된 백엔드 통합 테스트(`test_workflow.py` 등)의 검증 로직도 함께 업데이트해야 한다. 또한 모든 변경 사항은 커밋 전 샌드박스 내에서 `flake8` 등 로컬 린트를 완벽히 통과해야 Exit Code 1로 인한 CI/CD 붕괴를 막을 수 있다.

### Added
- Catch-all dynamic route `client/app/[locale]/[...rest]/page.tsx` to cleanly route all unmapped localized paths to the beautiful custom 404 Not Found screen.
- Scored `/teams/{team_id}/search-users` endpoint on Python backend to search active non-member users for team invitation.
- Endpoint `DELETE /teams/{team_id}/members/{user_id}` on Python backend to allow removing team members or leaving the team.
- Language, notification preference, and screen Theme settings cards to the settings dashboard.
- `PracticeLogComment` database models, Pydantic schemas, and comment endpoints (`POST` & `DELETE`) to enable team commentary on practice logs.
- Interactive comments list display and comment publishing box under each uploaded practice vlog in the practice calendar.
- Scoped project manager tab (`SongBoard`) inside the collaboration dashboard, filtering song projects by `teamId`.
- Local URL query parsing (`?tab=song`) in the collab dashboard page for direct deep linking.
- Scoped configuration `APP_ENV` check in `src/api/limiter.py` to bypass slowapi rate limiting during local development and E2E testing to prevent 429 errors.

### Changed
- Restricted team member invitation, user search, position (instrument) updates, and member removal to team owners (managers) and editors (sub-managers) on backend and frontend sidebar.
- Enabled normal team members (`viewer` role) to only update their own instrument/position, disabling other members' comboboxes.
- Refactored Next.js middleware `client/proxy.ts` to only lock down explicit private routes (`/dashboard`, `/projects`, `/settings`), letting undefined URLs correctly pass through to show custom localized 404 screens.
- Refactored settings page (`/settings`) from a single panel into an aesthetic, highly interactive 2-column settings dashboard.
- Adjusted Next.js middleware matchers inside `proxy.ts` to allow `/images` static assets loading without throwing 307 login redirection.
- Converted comment input fields in `collaboration-board.tsx`, `schedule-board.tsx`, and `practice-calendar.tsx` to `<form>` based handlers with disabled inputs during pending mutation state to completely eliminate double comments submit bug.
- Enhanced invitation error handling to show API-defined error detail messages inside toast messages.
- Hid the practice vlog upload form UI for a calendar date if the current logged-in user has already uploaded a vlog for that date, displaying a stylized completion message instead.
- Removed the vlog description comment input box from the initial video upload form.
- Replaced the standalone `/projects` route with a client-side redirection to `/dashboard/collab?tab=song` to eliminate page reload transitions when clicking index tabs.
- Updated project detail page back-navigation to return to `/dashboard/collab?tab=song`.
- Wrapped backend relationships in `models.py` to keep Python codebase compliance under the 100-character line limit.
- Unified frontend styling formatting across TSX components via Prettier.
- Integrated client components with Zustand store subscription for real-time player states.
- Improved README with detailed usage examples and setup instructions
- Enhanced transcriber module with better validation and error handling
- Improved tab_generator with detailed docstrings
- Updated requirements.txt with version constraints

### Fixed
- Resolved user profile image loading and broken image issues by converting relative upload paths into absolute urls via `getProfileImageUrl` utility across the settings page, top navigation header, and cooperation boards.
- Fixed property access compilation error in `client/app/[locale]/settings/page.tsx` by referencing unwrapped user profile image `res.profile_image` instead of raw axios `res.data`.
- Fixed Playwright E2E tests (`project.spec.ts`, `player.spec.ts`) login flows by adopting a self-healing UI-based conditional login check and eliminating redundant `afterEach` cookie clearing, yielding a 4x testing speedup (1.1 min -> 15 sec).
- Adjusted URL regex matchers in `error.spec.ts` to properly tolerate locale-specific route suffixes.
- Cleaned up frontend lint warnings (unused state assignments and imports) in `dashboard/page.tsx`, `projects/[id]/page.tsx`, and `schedule-board.tsx`.
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
