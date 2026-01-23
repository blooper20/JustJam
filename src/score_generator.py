import logging
from typing import Any, Dict, List, Optional

import music21
from music21 import chord, clef, instrument, layout, metadata, meter, note, stream, tempo

logger = logging.getLogger(__name__)


class ScoreGenerator:
    def __init__(self, bpm: float = 120):
        self.bpm = bpm

    def generate_musicxml(self, notes: List[Dict[str, Any]], instrument_name: str = "Piano") -> str:
        """
        Generate MusicXML string from a list of notes.
        """
        if not notes:
            return ""

        # Create a Score
        s = stream.Score()
        s.metadata = metadata.Metadata()
        s.metadata.title = f"Analyzed {instrument_name.capitalize()}"
        s.metadata.composer = "Band-Mate AI"

        # Create a Part
        p = stream.Part()
        p.id = "part1"
        p.partName = instrument_name.capitalize()

        # Assign Instrument
        inst_map = {
            "vocals": instrument.Vocalist(),
            "bass": instrument.ElectricBass(),
            "guitar": instrument.ElectricGuitar(),
            "piano": instrument.Piano(),
            "drums": instrument.Percussion(),  # Drums handled differently usually, but simple mapping for now
            "other": instrument.Piano(),
        }
        inst = inst_map.get(instrument_name.lower(), instrument.Piano())
        p.insert(0, inst)

        # Assign Clef
        if instrument_name.lower() == "bass":
            p.insert(0, clef.BassClef())
        else:
            p.insert(0, clef.TrebleClef())

        # Assign Tempo
        p.insert(0, tempo.MetronomeMark(number=self.bpm))

        # Assign Time Signature (Default 4/4)
        p.insert(0, meter.TimeSignature("4/4"))

        # Process Notes
        # music21 requires offsets in "quarter lengths".
        # self.bpm is beats per minute (quarter notes per minute).
        # 1 beat = 60 / bpm seconds.
        # offset = time / (60/bpm)

        sec_per_beat = 60.0 / self.bpm

        # Quantize roughly to 16th notes (0.25 beat)
        def quantize(val):
            return round(val * 4) / 4.0

        for n in notes:
            pitch_val = n["pitch"]
            start_beat = n["start"] / sec_per_beat
            end_beat = n["end"] / sec_per_beat
            duration_beat = max(0.25, end_beat - start_beat)  # Min duration 16th note

            # Create Note or Chord
            # Currently we process individual notes.
            # If polyphony exists at same start time, we should handle it, but music21 stream can handle simultaneous notes (it creates chords automatically? No, we need to create Chords)
            # For simplicity let's just insert Notes using insert(). MusicXML allows voices.

            m21_note = note.Note(pitch_val)
            m21_note.quarterLength = quantize(duration_beat)

            # Insert at quantized offset
            p.insert(quantize(start_beat), m21_note)

        # Make measures
        p.makeMeasures(inPlace=True)
        # s.insert(0, p) # Wait, adding part to score
        s.append(p)

        # Export to MusicXML
        # music21 writes to file, we want string.
        # We can write to a temp file and read it or use GEXML
        try:
            from music21.musicxml import m21ToXml

            exporter = m21ToXml.GeneralObjectExporter(s)
            xml_bytes = exporter.parse()
            return xml_bytes.decode("utf-8")
        except Exception as e:
            logger.error(f"MusicXML generation error: {e}")
            # Fallback: write to temp and read
            import os
            import tempfile

            try:
                with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as tmp:
                    tmp_path = tmp.name

                s.write("musicxml", fp=tmp_path)

                with open(tmp_path, "r", encoding="utf-8") as f:
                    xml_content = f.read()

                os.remove(tmp_path)
                return xml_content
            except Exception as e2:
                logger.error(f"Fallback MusicXML failed: {e2}")
                raise e2


    def generate_midi(self, notes: List[Dict[str, Any]], instrument_name: str = "Piano") -> bytes:
        """
        Generate MIDI bytes from a list of notes.
        """
        if not notes:
            return b""

        s = stream.Score()
        p = stream.Part()
        
        # Assign Instrument
        inst_map = {
            "vocals": instrument.Vocalist(),
            "bass": instrument.ElectricBass(),
            "guitar": instrument.ElectricGuitar(),
            "piano": instrument.Piano(),
            "drums": instrument.Percussion(),
        }
        inst = inst_map.get(instrument_name.lower(), instrument.Piano())
        p.insert(0, inst)
        p.insert(0, tempo.MetronomeMark(number=self.bpm))

        sec_per_beat = 60.0 / self.bpm

        for n in notes:
            pitch_val = n["pitch"]
            start_beat = n["start"] / sec_per_beat
            end_beat = n["end"] / sec_per_beat
            duration_beat = max(0.25, end_beat - start_beat)

            m21_note = note.Note(pitch_val)
            m21_note.quarterLength = round(duration_beat * 4) / 4.0
            p.insert(round(start_beat * 4) / 4.0, m21_note)

        s.append(p)
        
        import tempfile
        import os
        
        try:
            with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
                tmp_path = tmp.name
            
            s.write("midi", fp=tmp_path)
            
            with open(tmp_path, "rb") as f:
                midi_bytes = f.read()
            
            os.remove(tmp_path)
            return midi_bytes
        except Exception as e:
            logger.error(f"MIDI generation error: {e}")
            raise e


def create_score(notes: List[Dict[str, Any]], bpm: float, instrument: str, format: str = "musicxml") -> Any:
    generator = ScoreGenerator(bpm=bpm)
    if format == "midi":
        return generator.generate_midi(notes, instrument)
    return generator.generate_musicxml(notes, instrument)
