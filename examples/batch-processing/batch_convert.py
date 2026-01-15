#!/usr/bin/env python3
"""
Batch Audio to Tab Converter

This script processes all audio files in a directory and generates
tablature for each one, saving the results to text files.

Usage:
    python batch_convert.py [directory]

Example:
    python batch_convert.py ../resource/
"""

import glob
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.transcriber import transcribe_audio
from src.tab_generator import create_tab


def batch_convert(directory: str = "resource/"):
    """
    Convert all audio files in a directory to tablature.

    Args:
        directory: Path to directory containing audio files
    """
    # Supported audio formats
    formats = ["*.mp3", "*.wav", "*.flac", "*.ogg", "*.m4a", "*.aac"]

    # Collect all audio files
    audio_files = []
    for fmt in formats:
        audio_files.extend(glob.glob(os.path.join(directory, fmt)))

    if not audio_files:
        print(f"❌ No audio files found in {directory}")
        return

    print(f"🎸 Found {len(audio_files)} audio file(s)\n")

    success_count = 0
    failed_files = []

    for i, audio_file in enumerate(audio_files, 1):
        filename = os.path.basename(audio_file)
        print(f"[{i}/{len(audio_files)}] Processing: {filename}")

        try:
            # Transcribe audio
            print(f"  → Analyzing audio...")
            notes, bpm = transcribe_audio(audio_file)
            print(f"  → Detected {len(notes)} notes, BPM: {bpm:.2f}")

            # Generate tab
            print(f"  → Generating tablature...")
            tab = create_tab(notes, bpm=bpm)

            # Save to file
            output_file = audio_file.rsplit('.', 1)[0] + '_tab.txt'
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"# Generated from: {filename}\n")
                f.write(f"# BPM: {bpm:.2f}\n")
                f.write(f"# Notes detected: {len(notes)}\n\n")
                f.write(tab)

            print(f"  ✓ Saved to: {output_file}\n")
            success_count += 1

        except Exception as e:
            print(f"  ✗ Failed: {str(e)}\n")
            failed_files.append((filename, str(e)))

    # Summary
    print("=" * 60)
    print(f"✅ Successfully processed: {success_count}/{len(audio_files)}")

    if failed_files:
        print(f"\n❌ Failed files:")
        for filename, error in failed_files:
            print(f"  - {filename}: {error}")
    else:
        print(f"🎉 All files processed successfully!")


if __name__ == "__main__":
    # Get directory from command line or use default
    directory = sys.argv[1] if len(sys.argv) > 1 else "resource/"

    print(f"🎸 Batch Audio to Tab Converter")
    print(f"📁 Directory: {directory}\n")

    batch_convert(directory)
