"""
SoulComposer — Procedural music generation using pure math.

Generates instrumental beds, ambient textures, and melodic patterns without
any external API. Uses numpy for waveform synthesis.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Optional

import numpy as np

from core.emotion_mapper import EmotionMapper, MusicalEmotion


NOTE_FREQS = {
    "C": 261.63, "C#": 277.18, "Db": 277.18, "D": 293.66, "D#": 311.13,
    "Eb": 311.13, "E": 329.63, "F": 349.23, "F#": 369.99, "Gb": 369.99,
    "G": 392.00, "G#": 415.30, "Ab": 415.30, "A": 440.00, "A#": 466.16,
    "Bb": 466.16, "B": 493.88,
}

SCALES = {
    "major":          [0, 2, 4, 5, 7, 9, 11],
    "minor":          [0, 2, 3, 5, 7, 8, 10],
    "dorian":         [0, 2, 3, 5, 7, 9, 10],
    "mixolydian":     [0, 2, 4, 5, 7, 9, 10],
    "lydian":         [0, 2, 4, 6, 7, 9, 11],
    "phrygian":       [0, 1, 3, 5, 7, 8, 10],
    "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
    "pentatonic":     [0, 2, 4, 7, 9],
}


@dataclass
class ComposerSettings:
    duration: float = 30.0
    sample_rate: int = 44100
    emotion: str = "joy"


class SoulComposer:
    """Mathematical music synthesis — no neural nets, no APIs."""

    def __init__(self, sample_rate: int = 44100):
        self.sr = sample_rate

    def compose(self, settings: ComposerSettings) -> np.ndarray:
        emo = EmotionMapper.get(settings.emotion)
        sr = settings.sample_rate or self.sr
        dur = settings.duration
        n_samples = int(dur * sr)

        pad = self._ambient_pad(emo, dur, sr)
        chords = self._chord_progression(emo, dur, sr)
        melody = self._melody(emo, dur, sr)
        bass = self._bassline(emo, dur, sr)

        min_len = min(len(pad), len(chords), len(melody), len(bass), n_samples)
        mix = (
            0.25 * pad[:min_len]
            + 0.30 * chords[:min_len]
            + 0.25 * melody[:min_len]
            + 0.20 * bass[:min_len]
        )

        mix = self._apply_dynamics(mix, emo, sr)
        mix = self._normalize(mix)
        return mix.astype(np.float32)

    def _ambient_pad(self, emo: MusicalEmotion, dur: float, sr: int) -> np.ndarray:
        t = np.linspace(0, dur, int(dur * sr), endpoint=False)
        root = self._root_freq(emo.key)
        intervals = SCALES.get(emo.scale, SCALES["major"])

        pad = np.zeros_like(t)
        for i, interval in enumerate(intervals[:4]):
            freq = root * (2 ** (interval / 12.0))
            detune = 1.0 + random.uniform(-0.003, 0.003)
            wave = np.sin(2 * np.pi * freq * detune * t)
            lfo = 0.5 + 0.5 * np.sin(2 * np.pi * (0.1 + i * 0.05) * t)
            pad += wave * lfo * (0.3 / (i + 1))

        attack = np.linspace(0, 1, min(int(2.0 * sr), len(pad)))
        pad[:len(attack)] *= attack
        return pad

    def _chord_progression(self, emo: MusicalEmotion, dur: float, sr: int) -> np.ndarray:
        root = self._root_freq(emo.key)
        scale = SCALES.get(emo.scale, SCALES["major"])
        beat_dur = 60.0 / emo.tempo_bpm
        chord_dur = beat_dur * 4
        n_chords = max(1, int(dur / chord_dur))

        degrees = [0, 3, 4, 0] if emo.warmth > 0.5 else [0, 5, 3, 4]
        audio = np.array([], dtype=np.float64)

        for i in range(n_chords):
            deg = degrees[i % len(degrees)]
            chord_notes = [
                scale[deg % len(scale)],
                scale[(deg + 2) % len(scale)],
                scale[(deg + 4) % len(scale)],
            ]
            t = np.linspace(0, chord_dur, int(chord_dur * sr), endpoint=False)
            chord = np.zeros_like(t)
            for note in chord_notes:
                freq = root * (2 ** (note / 12.0))
                wave = 0.7 * np.sin(2 * np.pi * freq * t)
                wave += 0.3 * np.sin(2 * np.pi * freq * 2 * t)
                chord += wave / len(chord_notes)

            env = np.ones_like(t)
            fade = int(0.05 * sr)
            env[:fade] = np.linspace(0, 1, fade)
            env[-fade:] = np.linspace(1, 0, fade)
            chord *= env

            audio = np.concatenate([audio, chord])

        return audio[:int(dur * sr)]

    def _melody(self, emo: MusicalEmotion, dur: float, sr: int) -> np.ndarray:
        root = self._root_freq(emo.key) * 2  # octave up
        scale = SCALES.get(emo.scale, SCALES["major"])
        beat_dur = 60.0 / emo.tempo_bpm

        note_durations = [beat_dur, beat_dur * 0.5, beat_dur * 2, beat_dur * 1.5]
        audio = np.array([], dtype=np.float64)
        current_deg = 0

        while len(audio) / sr < dur:
            step = random.choice([-2, -1, 0, 1, 1, 2, 3])
            current_deg = max(0, min(len(scale) - 1, current_deg + step))
            note_semitones = scale[current_deg]
            freq = root * (2 ** (note_semitones / 12.0))

            note_dur = random.choice(note_durations)
            n = int(note_dur * sr)
            t = np.linspace(0, note_dur, n, endpoint=False)

            if emo.warmth > 0.6:
                wave = np.sin(2 * np.pi * freq * t)
            else:
                wave = 0.6 * np.sin(2 * np.pi * freq * t)
                wave += 0.3 * np.sin(2 * np.pi * freq * 3 * t)
                wave += 0.1 * np.sin(2 * np.pi * freq * 5 * t)

            env = np.exp(-3.0 * t / note_dur)
            attack = min(int(0.01 * sr), n)
            env[:attack] = np.linspace(0, 1, attack)
            wave *= env

            if random.random() < 0.15:
                silence = np.zeros(int(beat_dur * 0.5 * sr))
                audio = np.concatenate([audio, silence])
            else:
                audio = np.concatenate([audio, wave])

        return audio[:int(dur * sr)]

    def _bassline(self, emo: MusicalEmotion, dur: float, sr: int) -> np.ndarray:
        root = self._root_freq(emo.key) / 2  # octave down
        scale = SCALES.get(emo.scale, SCALES["major"])
        beat_dur = 60.0 / emo.tempo_bpm

        degrees = [0, 3, 4, 0] if emo.warmth > 0.5 else [0, 5, 3, 4]
        audio = np.array([], dtype=np.float64)

        while len(audio) / sr < dur:
            for deg in degrees:
                note = scale[deg % len(scale)]
                freq = root * (2 ** (note / 12.0))
                n = int(beat_dur * 2 * sr)
                t = np.linspace(0, beat_dur * 2, n, endpoint=False)

                wave = 0.8 * np.sin(2 * np.pi * freq * t)
                wave += 0.2 * np.sin(2 * np.pi * freq * 2 * t)

                env = np.exp(-1.5 * t / (beat_dur * 2))
                wave *= env
                audio = np.concatenate([audio, wave])

                if len(audio) / sr >= dur:
                    break

        return audio[:int(dur * sr)]

    def _apply_dynamics(self, audio: np.ndarray, emo: MusicalEmotion, sr: int) -> np.ndarray:
        fade_in = int(1.5 * sr)
        fade_out = int(3.0 * sr)
        if fade_in < len(audio):
            audio[:fade_in] *= np.linspace(0, 1, fade_in)
        if fade_out < len(audio):
            audio[-fade_out:] *= np.linspace(1, 0, fade_out)

        if emo.energy > 0.7:
            audio = np.tanh(audio * 1.3)

        return audio

    def _normalize(self, audio: np.ndarray, peak: float = 0.95) -> np.ndarray:
        mx = np.max(np.abs(audio))
        if mx > 0:
            audio = audio * (peak / mx)
        return audio

    @staticmethod
    def _root_freq(key: str) -> float:
        clean = key.replace("m", "").strip()
        return NOTE_FREQS.get(clean, 261.63)
