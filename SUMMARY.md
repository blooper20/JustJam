# JustJam: Development Status

**JustJam** is an AI-powered smart band practice and music arrangement platform.

## 📊 Feature Status

### 1. Core Audio Engine ✅
- **Source Separation**: Facebook Demucs v4 (htdemucs_6s) (Vocals, Drums, Bass, Guitar, Piano, Other)
- **Transcription**: Spotify Basic Pitch (Note Detection to MIDI transcription)
- **BPM Detection**: Librosa
- **Stem Processing**: Parallel chunking for performance

### 2. Frontend (Web App) ✅
- **Framework**: Next.js 16.1.2 + React 19.2.3 + Zustand 5.0.10 + TanStack React Query v5
- **MultiTrack Player**: WaveSurfer.js 7.12.1
- **Collaboration Board**: General announcements, youtube embed voting, real-time polling synchronization
- **Schedule Board**: Independent calendar-based availability voting and rehearsal date finalization
- **Setlog & Practice Calendar**: 15s camera recording, fixed 5s iOS trimmer editing, 20-char text overlay, practice calendar list with comments, auto-vlog merge

### 3. API Server ✅
- **Framework**: FastAPI 0.128.0
- **Async Queue**: Celery 5.4+ (backed by Redis broker, single concurrency queue `worker_concurrency=1` for GPU OOM protection)
- **Endpoints**:
  - `/projects`: Upload & Manage
  - `/process`: Trigger Source Separation
  - `/stems`: Stream Audio Files
  - `/teams`: Band workspaces, member invitation, deletion, and role assignment
  - `/teams/{team_id}/posts`: Notice and Voting management
  - `/projects/{project_id}/practice-logs`: Practice setlog videos and comments management

## 🚀 Recent Updates
- Implemented role-based invitation and deletion permissions in the backend and band member sidebar.
- Fixed settings page and nav header profile image rendering by mapping relative storage paths to absolute host URLs.
- Integrated the projects management dashboard inline under the collab dashboard "SONG" tab.
- Formatted client-side components using Prettier and resolved Next.js middleware and e2e testing lints.

## 📅 Roadmap
- [x] User Accounts & Cloud Storage
- [x] MIDI Export (Basic Pitch)
- [x] Real-time Collaborative Practice & Setlog Vlog Merge
