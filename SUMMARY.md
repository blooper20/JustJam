# JustJam: Development Status

**JustJam** is an AI-powered smart band practice and music arrangement platform.

## 📊 Feature Status

### 1. Core Audio Engine ✅
- **Source Separation**: Facebook Demucs v4 (htdemucs_6s) (Vocals, Drums, Bass, Guitar, Piano, Other)
- **Transcription**: Spotify Basic Pitch (Note Detection)
- **BPM Detection**: Librosa
- **Stem Processing**: Parallel chunking for performance

### 2. Frontend (Web App) ✅
- **Framework**: Next.js 16.1.2 + React 19.2.3 + Zustand 5.0.10 + TanStack React Query v5
- **MultiTrack Player**: WaveSurfer.js 7.12.1
- **Sheet Music Viewer**: OpenSheetMusicDisplay 1.9.3 (MusicXML Renderer)
- **Tab Viewer**: ASCII (Guitar/Bass tablature with Smart Capo & playability optimization)

### 3. API Server ✅
- **Framework**: FastAPI 0.128.0
- **Async Queue**: Celery 5.4+ (backed by Redis broker, single concurrency queue `worker_concurrency=1` for GPU OOM protection)
- **Endpoints**:
  - `/projects`: Upload & Manage
  - `/process`: Trigger Source Separation
  - `/stems`: Stream Audio Files
  - `/tabs`: Generate Tabs
  - `/score`: Generate MusicXML

## 🚀 Recent Updates
- Prevented Server-Side Rendering (SSR) of browser-only APIs (AudioContext, WaveSurfer) in MultiTrackPlayer using isMounted guard (Rule #402 compliance).
- Optimized use-project query polling with dynamic refetch interval and 3-strike failure shortcutting.
- Set Celery worker concurrency constraint (worker_concurrency=1 in celery_app.py and updated DEPLOYMENT.md/README_KR.md).
- Added schema-asserting unit test (test_generate_project_tab using mock patches) in tests/test_project_routes.py.
- Cleaned up backend python imports and code formatting (black, flake8).

## 📅 Roadmap
- [ ] User Accounts & Cloud Storage (Phase 3)
- [ ] MIDI Export
- [ ] Real-time Collaborative Practice
