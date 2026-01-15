# 🎸 JustJam: Band-Mate AI Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

**JustJam** is an AI-powered band practice platform that helps you practice, transcribe, and arrange music. It uses advanced source separation and audio analysis to break down songs into stems (Vocals, Drums, Bass, Other), generates tabs/scores, and provides a multi-track mixer for effective practice.

## ✨ Features

- **🎧 AI Source Separation**: Split any song into Vocals, Drums, Bass, and Other tracks using Demucs.
- **🎼 Score & Tab Generation**: 
  - **Sheet Music**: Generate MusicXML scores for all instruments (Melody, Drums, Keys, etc.).
  - **Tabs**: Auto-generate Bass and Guitar tablature.
- **🎛️ Multi-Track Mixer**: Solo, mute, and adjust volume for each stem to practice specific parts.
- **🎹 Interactive Practice**:
  - Waveform visualization.
  - PDF export for scores.
  - MusicXML export for further editing.
- **⚡ Local Processing**: Runs entirely on your machine. No data leaves your computer.

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for Frontend)
- **FFmpeg** installed and in PATH.

### Installation

1. **Clone & Setup Backend**
   ```bash
   git clone https://github.com/blooper20/justjam.git
   cd justjam
   
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Setup Frontend**
   ```bash
   cd client
   npm install
   ```

### Running the App

1. **Start Backend Server**
   ```bash
   # Terminal 1
   source venv/bin/activate
   uvicorn src.api.main:app --reload
   ```

2. **Start Frontend**
   ```bash
   # Terminal 2
   cd client
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## 🛠 Tech Stack

- **Backend**: FastAPI, Librosa, Basic Pitch, Demucs
- **Frontend**: Next.js, TypeScript, WaveSurfer.js, OpenSheetMusicDisplay, Shadcn/UI
- **Data**: SQLite (Local DB)

## 📜 License

MIT License. See [LICENSE](./LICENSE).
