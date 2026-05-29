# 🎸 JustJam: Band-Mate AI Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.2-black.svg)](https://nextjs.org/)

**JustJam** is an AI-powered smart band practice and music arrangement collaboration platform. Utilizing local deep learning models, it separates user-uploaded audio into individual tracks (Stems), transcribes melodies and chords, and automatically generates easy-to-play tablature (Tab) scores. It also integrates a WaveSurfer.js-based multitrack mixer and a Web Audio API-based precision metronome to provide the ultimate practice environment.

[English Document](./README.md) | [한국어 문서](./README_KR.md)

---

## ✨ 6 Core Features

### 1. 🎧 AI-Based Audio Source Separation
- Equips the **Facebook Demucs v4 (htdemucs_6s)** model to precisely separate a single imported audio file into multiple individual tracks (Vocals, Drums, Bass, Guitar, Piano, and Other instruments) in real time.
- The separated audio tracks are immediately available as stems for practicing individual part.



### 4. 🎛️ Interactive Multitrack Mixer
- Leverages the **WaveSurfer.js** engine to visualize separated multitrack waveforms in the browser and provides fully synchronized playback.
- Supports individual track volume controls, Solo and Mute functions, and pitch-preserved playback speed (BPM) adjustments.

### 5. ⏱️ Precision Audio-Synced Metronome
- Introduces a **Web Audio API**-based look-ahead scheduling technique to run an ultra-precise metronome engine that matches the audio playback clock and corrects for timing drift.
- Synchronizes with the rhythm grid of the playing track and allows flexible tempo adjustments via manual tap tempo (TAP BPM) controls.

### 6. 🤝 Real-Time Collaboration Workspace
- Provides a real-time project sharing and permission management system for band members.
- Differentiates Viewer and Editor permissions based on each member's role to sync collaborative arrangement and practice records.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 16.1.2 (App Router) & React 19.2.3
- **Styling**: Tailwind CSS v4 & Radix UI / Shadcn UI
- **Audio Rendering**: WaveSurfer.js 7.12.1
- **Score Rendering**: OpenSheetMusicDisplay 1.9.3 (MusicXML Renderer)
- **State Management & Fetching**: Zustand 5.0.10 & TanStack React Query v5
- **Internationalization (i18n)**: next-intl 4.8.2 (Korean & English support)
- **Authentication**: NextAuth.js 4.24.13

### Backend
- **Framework**: FastAPI 0.128.0 (ASGI Web Framework)
- **Audio Engine & DSP**:
  - Librosa 0.11.0 (Tempo/BPM tracking, beat grid alignment)
  - Spotify Basic Pitch 0.4.0 (Audio-to-MIDI neural network transcription)
  - Facebook Demucs 4.0.1 (Neural audio source separation engine)
  - music21 8.3.0 (Harmonic analysis and key detection)
  - PyTorch 2.8.0 & torchaudio 2.8.0 (Deep learning inference engines)
- **Queue & Workers**: Celery 5.4+ (backed by Redis broker for async queue processing)
- **Database & ORM**: SQLite (local dev) / PostgreSQL (production) & SQLAlchemy 2.0.25
- **DB Migration**: Alembic 1.13.1

---

## 🚀 Getting Started

### Prerequisites
Before installation and execution, ensure you have the following programs installed:
- **Python 3.10+**: [Python Official Website](https://www.python.org/downloads/)
- **Node.js 18+**: [Node.js Official Website](https://nodejs.org/)
- **FFmpeg**: Mandatory for audio parsing, parallel slicing, and Demucs separation.
  - **macOS**: `brew install ffmpeg`
  - **Ubuntu**: `sudo apt-get install ffmpeg`
  - **Windows**: Download from the [FFmpeg Download Page](https://ffmpeg.org/download.html) and add to your PATH environment variable.

---

### Execution Guide

#### 0. 🐳 Docker (Recommended) — One-Command Setup
The easiest way to run JustJam is via Docker Compose, which starts all services (backend, Celery worker, frontend, Redis, PostgreSQL) with a single command.

```bash
# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

> **Note**: The `justjam-data` Docker volume is shared between the `backend` and `worker` containers, ensuring separated audio stems are accessible to both services.

To stop all services:
```bash
docker-compose down
```

To stop and remove all data volumes (full reset):
```bash
docker-compose down -v
```

#### 1. Backend Server Setup & Run
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
alembic upgrade head

# Launch FastAPI development server (Port: 8000)
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Celery & Redis Async Worker Run (For audio separation)
A Redis server and a Celery worker are required to process audio separation tasks. Make sure a local Redis server is running.
```bash
# Run Celery async worker
celery -A src.api.services.project_service.celery_app worker --loglevel=info --concurrency=1
```

#### 3. Frontend Client Run
```bash
# Navigate to the client directory
cd client

# Install dependencies
npm install

# Start Next.js development server (Port: 3000)
npm run dev
```

---

## 🏗 Directory Structure

```
JustJam/
├── client/                     # Next.js frontend application
│   ├── app/                    # Next.js App Router (App directory structure)
│   │   ├── [locale]/           # Localized routing (dashboard, projects, settings)
│   │   └── globals.css         # Tailwind v4 globals & custom styles
│   ├── components/             # Reusable UI Components
│   │   ├── multitrack-player.tsx # WaveSurfer multimixer and Web Audio metronome
│   │   ├── score-viewer.tsx    # MusicXML score renderer
│   │   └── tab-viewer.tsx      # ASCII tablature score viewer
│   ├── hooks/                  # React custom hooks
│   │   └── use-project.ts      # Project polling API hook integrated with Zustand
│   └── package.json            # Frontend dependency specifications
├── src/                        # FastAPI backend application
│   ├── api/                    # Web API Layer
│   │   ├── database.py         # DB connection pool & engine setup
│   │   ├── main.py             # FastAPI App definition & CORS/middleware configuration
│   │   ├── models.py           # SQLAlchemy DB models
│   │   ├── routes/             # Route controllers (projects, auth, etc.)
│   │   └── services/           # Async audio processing & core business logic
│   ├── audio_processor.py      # Demucs source separation wrapper
│   ├── score_generator.py      # MusicXML compilation engine
│   ├── tab_generator.py        # ASCII Tab transcription & fingering optimizer
│   ├── transcriber.py          # Basic Pitch wrapper and quantized cleaning
│   └── config.py               # YAML configuration loader
└── README_KR.md                # Korean specification document
```

---

## 🤝 Contributing
If you wish to contribute or modify code, you must adhere to the project's strict linters and test suite. For details, please refer to [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md).
- **Python Formatting**: Must pass `black -l 100 src/ tests/` & `flake8 src/ tests/`.
- **TypeScript & React**: Must successfully pass `cd client && npm run lint` and `npm run build`.
