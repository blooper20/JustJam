import logging
import os
from typing import Dict, List, Tuple

import librosa
import numpy as np

logger = logging.getLogger(__name__)

# Krumhansl-Schmuckler Key Templates
MAJOR_TEMPLATE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_TEMPLATE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def analyze_key(y: np.ndarray, sr: int) -> str:
    """
    Detect the key of the audio using chroma features and Krumhansl-Schmuckler profiles.
    """
    try:
        # Compute chroma features
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_sum = np.sum(chroma, axis=1)
        
        # Normalize
        if np.max(chroma_sum) > 0:
            chroma_sum = chroma_sum / np.max(chroma_sum)

        best_score = -1
        best_key = "Unknown"

        # Check all 12 major keys
        for i in range(12):
            rotated_template = np.roll(MAJOR_TEMPLATE, i)
            score = np.corrcoef(chroma_sum, rotated_template)[0, 1]
            if score > best_score:
                best_score = score
                best_key = f"{PITCH_NAMES[i]} Major"

        # Check all 12 minor keys
        for i in range(12):
            rotated_template = np.roll(MINOR_TEMPLATE, i)
            score = np.corrcoef(chroma_sum, rotated_template)[0, 1]
            if score > best_score:
                best_score = score
                best_key = f"{PITCH_NAMES[i]} Minor"

        return best_key
    except Exception as e:
        logger.error(f"Key analysis failed: {e}")
        return "Unknown"


def analyze_chords(y: np.ndarray, sr: int, bpm: float) -> List[Dict]:
    """
    Analyze chord progression.
    """
    try:
        # Harmonic-Percussive Source Separation
        y_harmonic, _ = librosa.effects.hpss(y)
        
        # Chroma features
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
        
        # Frequency of changes (e.g., every 2 beats)
        beat_dur = 60.0 / bpm
        hop_length = 512
        frames_per_beat = int((beat_dur * sr) / hop_length)
        
        # Aggregate chroma per segment (e.g. 2 beats)
        segment_frames = max(1, frames_per_beat * 2)
        num_frames = chroma.shape[1]
        
        chords = []
        for i in range(0, num_frames, segment_frames):
            end_f = min(i + segment_frames, num_frames)
            chunk = chroma[:, i:end_f]
            if chunk.shape[1] == 0:
                continue
                
            avg_chroma = np.mean(chunk, axis=1)
            
            # Simple chord matching (Major/Minor triads)
            best_c_score = -1
            best_c_name = "N/A"
            
            for root in range(12):
                # Major Triad Template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]
                major_idx = [root, (root + 4) % 12, (root + 7) % 12]
                score_maj = sum(avg_chroma[idx] for idx in major_idx)
                
                # Minor Triad Template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]
                minor_idx = [root, (root + 3) % 12, (root + 7) % 12]
                score_min = sum(avg_chroma[idx] for idx in minor_idx)
                
                if score_maj > best_c_score:
                    best_c_score = score_maj
                    best_c_name = f"{PITCH_NAMES[root]}"
                
                if score_min > best_c_score:
                    best_c_score = score_min
                    best_c_name = f"{PITCH_NAMES[root]}m"
            
            start_t = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)
            end_t = librosa.frames_to_time(end_f, sr=sr, hop_length=hop_length)
            
            # Deduplicate sequential identical chords
            if chords and chords[-1]["name"] == best_c_name:
                chords[-1]["end"] = end_t
            else:
                chords.append({
                    "start": start_t,
                    "end": end_t,
                    "name": best_c_name
                })
        
        return chords
    except Exception as e:
        logger.error(f"Chord analysis failed: {e}")
        return []


def perform_full_analysis(audio_path: str, bpm: float) -> Dict:
    """
    Perform full analysis: Key + Chords
    """
    try:
        # Load audio (mono, 22.05kHz)
        y, sr = librosa.load(audio_path, sr=22050, duration=120)  # Analyze first 2 mins
        
        key = analyze_key(y, sr)
        chords = analyze_chords(y, sr, bpm)
        
        return {
            "key": key,
            "chords": chords
        }
    except Exception as e:
        logger.error(f"Full analysis failed: {e}")
        return {"key": "Unknown", "chords": []}
