import logging
from typing import Any, Dict, List

from music21 import clef, instrument, metadata, meter, note, stream, tempo

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
            "drums": instrument.DrumKit(),  # Use DrumKit for correct score representation
            "other": instrument.Piano(),
        }
        inst = inst_map.get(instrument_name.lower(), instrument.Piano())
        p.insert(0, inst)

        # Assign Clef
        if instrument_name.lower() == "bass":
            p.insert(0, clef.BassClef())
        elif instrument_name.lower() == "drums":
            p.insert(0, clef.PercussionClef())
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

        # Quantize onset/duration based on triplet flag
        def quantize_val(val, is_triplet=False):
            if is_triplet:
                return round(val * 6) / 6.0
            return round(val * 4) / 4.0

        # Group notes by quantized onset beat to generate Chords when polyphony is present
        from music21 import chord

        groups = {}
        for n in notes:
            is_triplet = n.get("is_triplet", False)
            start_beat = n["start"] / sec_per_beat
            end_beat = n["end"] / sec_per_beat

            q_start = quantize_val(start_beat, is_triplet)
            q_end = quantize_val(end_beat, is_triplet)
            q_dur = max(0.25, q_end - q_start)

            if q_start not in groups:
                groups[q_start] = {"notes": [], "dur": q_dur, "is_triplet": is_triplet}

            groups[q_start]["notes"].append(n["pitch"])
            if q_dur > groups[q_start]["dur"]:
                groups[q_start]["dur"] = q_dur

        # Resolve note overlaps by truncating notes/chords so they don't exceed the next onset
        sorted_starts = sorted(groups.keys())
        for i in range(len(sorted_starts) - 1):
            curr_start = sorted_starts[i]
            next_start = sorted_starts[i + 1]
            if curr_start + groups[curr_start]["dur"] > next_start:
                groups[curr_start]["dur"] = max(0.25, next_start - curr_start)

        # Insert notes/chords into part
        for q_start, info in sorted(groups.items()):
            pitches = sorted(list(set(info["notes"])))
            dur = info["dur"]

            if len(pitches) == 1:
                m21_element = note.Note(pitches[0])
                if instrument_name.lower() == "drums" and pitches[0] == 42:
                    m21_element.notehead = "cross"
            else:
                m21_element = chord.Chord(pitches)
                if instrument_name.lower() == "drums":
                    for n_el in m21_element.notes:
                        if n_el.pitch.midi == 42:
                            n_el.notehead = "cross"

            m21_element.quarterLength = dur
            p.insert(q_start, m21_element)

        # Make measures
        p.makeMeasures(inPlace=True)
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
            "drums": instrument.DrumKit(),  # Use DrumKit for correct score representation
        }
        inst = inst_map.get(instrument_name.lower(), instrument.Piano())
        p.insert(0, inst)
        p.insert(0, tempo.MetronomeMark(number=self.bpm))

        sec_per_beat = 60.0 / self.bpm

        # Group notes by quantized onset beat to generate Chords when polyphony is present
        from music21 import chord

        def quantize_val(val, is_triplet=False):
            if is_triplet:
                return round(val * 6) / 6.0
            return round(val * 4) / 4.0

        groups = {}
        for n in notes:
            is_triplet = n.get("is_triplet", False)
            start_beat = n["start"] / sec_per_beat
            end_beat = n["end"] / sec_per_beat

            q_start = quantize_val(start_beat, is_triplet)
            q_end = quantize_val(end_beat, is_triplet)
            q_dur = max(0.25, q_end - q_start)

            if q_start not in groups:
                groups[q_start] = {"notes": [], "dur": q_dur, "is_triplet": is_triplet}

            groups[q_start]["notes"].append(n["pitch"])
            if q_dur > groups[q_start]["dur"]:
                groups[q_start]["dur"] = q_dur

        # Resolve note overlaps by truncating notes/chords so they don't exceed the next onset
        sorted_starts = sorted(groups.keys())
        for i in range(len(sorted_starts) - 1):
            curr_start = sorted_starts[i]
            next_start = sorted_starts[i + 1]
            if curr_start + groups[curr_start]["dur"] > next_start:
                groups[curr_start]["dur"] = max(0.25, next_start - curr_start)

        # Insert notes/chords into part
        for q_start, info in sorted(groups.items()):
            pitches = sorted(list(set(info["notes"])))
            dur = info["dur"]

            if len(pitches) == 1:
                m21_element = note.Note(pitches[0])
                if instrument_name.lower() == "drums" and pitches[0] == 42:
                    m21_element.notehead = "cross"
            else:
                m21_element = chord.Chord(pitches)
                if instrument_name.lower() == "drums":
                    for n_el in m21_element.notes:
                        if n_el.pitch.midi == 42:
                            n_el.notehead = "cross"

            m21_element.quarterLength = dur
            p.insert(q_start, m21_element)

        s.append(p)

        import os
        import tempfile

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


def create_score(
    notes: List[Dict[str, Any]], bpm: float, instrument: str, format: str = "musicxml"
) -> Any:
    generator = ScoreGenerator(bpm=bpm)
    if format == "midi":
        return generator.generate_midi(notes, instrument)
    return generator.generate_musicxml(notes, instrument)
