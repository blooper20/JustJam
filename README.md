# 🎸 JustJam: Band-Mate AI Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.2-black.svg)](https://nextjs.org/)

**JustJam** is an AI-powered band practice and music arrangement platform. It runs local neural network models to separate imported audio into individual stems, transcribes notes, detects chord progressions and structure, and provides an interactive multitrack player with a precision metronome for optimal practice.

---

## ✨ Features

- **🎧 AI Source Separation**: Splits any audio track into multiple stems (Vocals, Drums, Bass, Guitar, Piano, Other) using Demucs v4.
- **🎼 MusicXML Score Generation**: Transcribes stem melodies and chords using Spotify's Basic Pitch and renders interactive sheet music.
- **🎸 Intelligent Tablature Mapper**: Auto-generates guitar and bass ASCII tablatures utilizing an open-position prior, chord-matching constraints, and auto-transposition (Smart Capo) for easy playability.
- **🎛️ Interactive Multitrack Mixer**: Features solo, mute, volume adjustment, and playback speed control powered by WaveSurfer.js.
- **⏱️ Audio-Synced Metronome**: Custom Web Audio API metronome synced precisely to the playback clock with manual TAP BPM overrides.
- **🤝 Collaboration Workspace**: Real-time project sharing and access permission control (Viewer / Editor) for band members.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 16.1.2 (App Router) & React 19.2.3
- **Styling**: Tailwind CSS v4 & Radix UI / Shadcn
- **Audio Rendering**: WaveSurfer.js 7.12.1 (Multi-waveform synchronization)
- **Score Rendering**: OpenSheetMusicDisplay 1.9.3 (MusicXML renderer)
- **State Management & Data Fetching**: Zustand 5.0.10 & TanStack React Query v5
- **Internationalization**: next-intl 4.8.2 (Supports English & Korean)
- **Authentication**: NextAuth.js 4.24.13

### Backend
- **Framework**: FastAPI 0.128.0 (ASGI Web Framework)
- **Audio Engine & DSP**: 
  - Librosa 0.11.0 (Tempo/BPM tracking, beat grid alignment)
  - Spotify Basic Pitch 0.4.0 (Audio-to-MIDI neural network transcription)
  - Facebook Demucs 4.0.1 (Neural audio source separation)
  - music21 8.3.0 (Harmonic analysis and key detection)
  - PyTorch 2.8.0 & torchaudio 2.8.0 (Model execution engines)
- **Queue & Async Task Workers**: Celery 5.4+ (backed by Redis broker)
- **Database & Migration**: SQLite (local) / PostgreSQL (production) mapped via SQLAlchemy 2.0.25 and managed by Alembic 1.13.1

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg**: Required for audio segmenting and Demucs processing.
  - **macOS**: `brew install ffmpeg`
  - **Ubuntu**: `sudo apt-get install ffmpeg`
  - **Windows**: Install via Chocolatey `choco install ffmpeg` or manual PATH setting.

### Setup and Running

#### 1. Backend Server Setup
```bash
# Clone the repository
git clone https://github.com/blooper20/JustJam.git
cd JustJam

# Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn src.api.main:app --reload
```

#### 2. Frontend Client Setup
```bash
# Move to the client directory
cd client

# Install dependencies
npm install

# Run the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the platform.

---

## 🏗 Directory Structure (Milestones)

This layout outlines the key structural layers of the JustJam project (excluding build artifacts and dependencies):

```
JustJam/
├── client/                     # Frontend Next.js Application
│   ├── app/                    # Next.js App Router Pages
│   │   ├── [locale]/           # Localized app views (dashboard, projects, settings)
│   │   └── globals.css         # Tailwind v4 globals & custom styles
│   ├── components/             # Reusable UI Components
│   │   ├── multitrack-player.tsx # Sync-player & Web Audio Metronome Engine
│   │   ├── score-viewer.tsx    # OpenSheetMusicDisplay wrapper
│   │   ├── tab-viewer.tsx      # Tablature rendering component
│   │   └── ui/                 # Primitive Shadcn/Radix components
│   ├── hooks/                  # Custom React Hooks
│   │   └── use-project.ts      # Project fetching and polling hook
│   ├── lib/                    # Configuration and API Client helper
│   │   ├── api-client.ts       # Axios instance config
│   │   └── api.ts              # API interface methods
│   └── package.json            # Frontend dependency definitions
├── src/                        # Backend FastAPI Application
│   ├── api/                    # Web API Layer
│   │   ├── database.py         # SQLAlchemy Engine & session pool
│   │   ├── main.py             # FastAPI App definition & Middleware
│   │   ├── models.py           # SQLAlchemy DB Models (User, Project, Asset)
│   │   ├── routes/             # Route controllers (projects, users, auth)
│   │   └── services/           # Orchestration layer (project_service, analysis_service)
│   ├── audio_processor.py      # Demucs source separation wrapper
│   ├── score_generator.py      # MusicXML compilation engine
│   ├── tab_generator.py        # ASCII Tab transcription & fingering optimizer
│   ├── transcriber.py          # Basic Pitch wrapper and quantized cleaning
│   └── config.py               # YAML configuration loader
├── alembic/                    # Database migration directory
├── resource/                   # Sample audio resources
├── requirements.txt            # Python dependencies
├── pyproject.toml              # PyTest, Black, and tool definitions
└── README.md                   # This overview document
```

---

## 🔒 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
