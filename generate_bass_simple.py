import sys
import logging
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator
from src.config import config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def generate_bass_tab_simple(file_path):
    print(f"--- Processing Bass Tab (Simple Mode) for: {file_path} ---")
    
    # Disable Source Separation to avoid crashes
    # Accessing singleton dict directly to override
    config._config['audio']['source_separation'] = False
    
    # We will manually filter for bass
    
    print("1. Transcribing audio (Full Mix)...")
    try:
        notes, bpm = transcribe_audio(file_path)
    except Exception as e:
        print(f"Transcription failed: {e}")
        return

    print(f"   Transcribed {len(notes)} total notes. BPM: {bpm}")
    
    # 2. Filter for Bass Frequency
    # Standard Bass range: E1 (28) - G4 (67).
    # But in a mix, bass is usually the lowest element.
    # Let's be generous: <= 55 (G3 - 12th fret on G string approx? No. G2 is 43 (Open G). G3 is 55.)
    # G3 is reasonably high for bass groove.
    bass_cutoff = 55
    bass_notes = [n for n in notes if n['pitch'] <= bass_cutoff]
    
    if not bass_notes:
        print("No bass notes found below pitch 55. Increasing threshold to 60...")
        bass_notes = [n for n in notes if n['pitch'] <= 60]
        
    print(f"   Filtered {len(bass_notes)} bass notes (Pitch <= {bass_cutoff}).")
    
    # 3. Generate Tab for 4-String Bass
    print("2. Generating Bass Tab (Standard Tuning E1-G2)...")
    
    # Standard Bass Tuning: E1, A1, D2, G2
    bass_tuning = ['E1', 'A1', 'D2', 'G2']
    
    # We must configure generator to NOT auto-transpose, as that shifts pitch.
    config._config['tablature']['auto_transpose'] = False
    config._config['post_processing']['max_polyphony'] = 1 # Monophonic
    config._config['tablature']['slots_per_measure'] = 16
    
    generator = TabGenerator(
        tuning=bass_tuning,
        bpm=bpm
    )
    
    # Set Dummy Chord Template to prevent crash (Guitar chords use 6 strings, Bass has 4)
    # We need at least one template for chord detection to run without error.
    generator.chord_templates = {'N.C.': {0: 0}}
    
    # Generate ASCII Tab
    tab = generator.generate_ascii_tab(bass_notes)
    
    print("\n--- Generated Bass Tab ---\n")
    print(tab)
    
    # Save to file
    output_file = file_path.replace('.mp3', '_bass_tab.txt')
    with open(output_file, 'w') as f:
        f.write(f"Bass Tab for {file_path}\n")
        f.write(f"BPM: {bpm}\n\n")
        f.write(tab)
    print(f"\nSaved to {output_file}")

if __name__ == "__main__":
    target_file = "resource/1998.mp3"
    import os
    if not os.path.exists(target_file):
        # fuzzy search
        import glob
        files = glob.glob(f"resource/*1998*")
        if files:
            target_file = files[0]
            print(f"Found file: {target_file}")
        else:
            print("File not found.")
            sys.exit(1)
            
    generate_bass_tab_simple(target_file)
