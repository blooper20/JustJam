# Custom Tuning Examples

Learn how to use alternative guitar tunings with the Fingerstyle Tab MCP Server.

## 📖 Overview

By default, the tab generator uses standard tuning (EADGBE). However, you can specify custom tunings for different playing styles.

## 🎸 Supported Tunings

### Standard Tuning (Default)
```python
['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
```

### Drop D
```python
['D2', 'A2', 'D3', 'G3', 'B3', 'E4']
```

### DADGAD
```python
['D2', 'A2', 'D3', 'G3', 'A3', 'D4']
```

### Open G
```python
['D2', 'G2', 'D3', 'G3', 'B3', 'D4']
```

### Open D
```python
['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']
```

## 💻 Usage Examples

### Example 1: Drop D Tuning

```python
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator

# Transcribe audio
notes, detected_bpm = transcribe_audio("resource/song.mp3")

# Create tab generator with Drop D tuning
generator = TabGenerator(
    tuning=['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    bpm=detected_bpm
)

# Generate tab
tab = generator.generate_ascii_tab(notes)
print(tab)
```

### Example 2: DADGAD Tuning

```python
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator

notes, bpm = transcribe_audio("resource/celtic-song.mp3")

# DADGAD - popular for Celtic music
generator = TabGenerator(
    tuning=['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
    bpm=bpm,
    slots_per_measure=16  # Optional: adjust granularity
)

tab = generator.generate_ascii_tab(notes)
print(tab)
```

### Example 3: Custom Tuning with BPM Override

```python
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator

notes, _ = transcribe_audio("resource/song.mp3")

# Open G tuning with manual BPM
generator = TabGenerator(
    tuning=['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
    bpm=120,  # Force BPM to 120
    bass_threshold=50  # Optional: adjust bass detection
)

tab = generator.generate_ascii_tab(notes)
print(tab)
```

## 🎯 Advanced Configuration

### Full Parameter List

```python
generator = TabGenerator(
    tuning=['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],  # String tuning
    bpm=120.0,                                    # Beats per minute
    slots_per_measure=16,                         # Subdivision of measures
    bass_threshold=50,                            # MIDI note for bass detection
    num_strings=6                                 # Number of guitar strings
)
```

### Using with Claude Desktop

You can interactively adjust tuning through Claude:

```
You: "Can you analyze this file with Drop D tuning?"
Claude: [Adjusts parameters and generates tab]
```

## 📝 Notes on Tuning

### Pitch Notation

We use scientific pitch notation:
- `E2` = Low E string (~82.4 Hz)
- `A2` = A string (~110 Hz)
- `D3` = D string (~146.8 Hz)
- `G3` = G string (~196 Hz)
- `B3` = B string (~246.9 Hz)
- `E4` = High E string (~329.6 Hz)

### Choosing the Right Tuning

1. **Match the original recording** - If the song uses Drop D, use Drop D tuning
2. **Consider the key** - Open tunings work well for specific keys
3. **Check the bass notes** - Drop tunings provide lower bass notes

### Limitations

- The AI transcription doesn't detect tuning automatically
- You need to know (or guess) the tuning used in the recording
- Uncommon tunings may produce less accurate results

## 🔧 Troubleshooting

### Issue: Notes appear on wrong strings

**Solution:**
- Verify you're using the correct tuning
- Try standard tuning first to see if results improve
- The recording might use a different tuning than you specified

### Issue: Many open strings (0s) in the tab

**Solution:**
- This is expected for open tunings
- Verify the tuning matches the recording
- Some tunings naturally use more open strings

### Issue: Unplayable fingerings

**Solution:**
```python
# Adjust bass threshold
generator = TabGenerator(
    tuning=['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    bass_threshold=45  # Lower threshold for more bass notes on low strings
)
```

## 📚 Additional Resources

- [Guitar Tuning Database](https://www.stringjoy.com/guitar-tunings/)
- [Scientific Pitch Notation](https://en.wikipedia.org/wiki/Scientific_pitch_notation)
- [Main Documentation](../../README.md)

## 🤝 Contributing

Have examples for other tunings? Please contribute!

1. Add your example to this directory
2. Update this README
3. Submit a Pull Request

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
