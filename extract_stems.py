import sys
import os
import logging
from src.audio_processor import separate_audio
from src.config import config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def run_separation(file_path):
    print(f"--- Extracting Stems for: {file_path} ---")
    
    # Force enable source separation in config just in case
    config._config['audio']['source_separation'] = True
    
    try:
        # Use htdemucs_6s for 6-stem separation (vocals, bass, drums, guitar, piano, other)
        # Note: distinct from default 4-stem htdemucs
        stems = separate_audio(file_path, model_name='htdemucs_6s')
        
        print("\nSUCCESS! Stems created:")
        for role, path in stems.items():
            print(f"- {role.upper()}: {path}")
            
    except Exception as e:
        print(f"Error during separation: {e}")

if __name__ == "__main__":
    target_file = "resource/1998.mp3"
    
    if not os.path.exists(target_file):
        # fuzzy search
        import glob
        files = glob.glob(f"resource/*1998*")
        if files:
            target_file = files[0]
            print(f"Found match: {target_file}")
        else:
            print("File not found in resource/")
            sys.exit(1)
            
    run_separation(target_file)
