#!/usr/bin/env python3
"""
Generate test audio files with different rhythm patterns for the R-Pattern analyzer.
"""

import numpy as np
import wave
import os
from typing import List, Tuple

def generate_click_sound(sample_rate: int = 44100, duration: float = 0.05, frequency: float = 1000) -> np.ndarray:
    """Generate a short click/percussion sound."""
    samples = int(sample_rate * duration)
    t = np.linspace(0, duration, samples, False)
    
    # Create a quick attack and exponential decay
    envelope = np.exp(-t * 20)  # Fast decay
    
    # Mix of sine wave and noise for more realistic percussion
    sine_wave = np.sin(2 * np.pi * frequency * t)
    noise = np.random.normal(0, 0.1, samples)
    
    # Combine and apply envelope
    sound = (sine_wave * 0.7 + noise * 0.3) * envelope
    
    return sound

def create_rhythm_pattern(pattern_beats: List[float], bpm: int, duration: float = 8.0, 
                         sample_rate: int = 44100) -> np.ndarray:
    """Create an audio file with specified rhythm pattern."""
    
    # Calculate timing
    beats_per_second = bpm / 60.0
    seconds_per_beat = 1.0 / beats_per_second
    
    # Create silent audio buffer
    total_samples = int(sample_rate * duration)
    audio = np.zeros(total_samples)
    
    # Generate multiple repetitions of the pattern
    current_time = 0.0
    pattern_duration = max(pattern_beats) * seconds_per_beat + seconds_per_beat  # Add one beat buffer
    
    while current_time < duration - pattern_duration:
        for beat_time in pattern_beats:
            absolute_time = current_time + beat_time * seconds_per_beat
            if absolute_time >= duration:
                break
                
            # Generate click sound
            click = generate_click_sound(sample_rate)
            
            # Calculate sample position
            start_sample = int(absolute_time * sample_rate)
            end_sample = min(start_sample + len(click), total_samples)
            click_length = end_sample - start_sample
            
            if click_length > 0:
                audio[start_sample:end_sample] += click[:click_length] * 0.5
        
        current_time += pattern_duration
    
    return audio

def save_wav_file(audio: np.ndarray, filename: str, sample_rate: int = 44100):
    """Save audio array as WAV file."""
    # Normalize and convert to 16-bit
    audio_normalized = np.clip(audio, -1.0, 1.0)
    audio_16bit = (audio_normalized * 32767).astype(np.int16)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_16bit.tobytes())

def generate_test_patterns():
    """Generate various test patterns."""
    
    # Create test-audio directory
    os.makedirs('test-audio', exist_ok=True)
    
    patterns = [
        {
            'name': 'basic-rock-120bpm',
            'description': 'Basic rock pattern - quarter notes',
            'bpm': 120,
            'pattern': [0, 1, 2, 3],  # Quarter notes: 1, 2, 3, 4
        },
        {
            'name': 'eighth-notes-110bpm',
            'description': 'Eighth note pattern',
            'bpm': 110,
            'pattern': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],  # All eighth notes
        },
        {
            'name': 'funk-syncopated-100bpm',
            'description': 'Syncopated funk pattern',
            'bpm': 100,
            'pattern': [0, 0.25, 0.75, 1, 1.5, 2, 2.25, 2.75, 3, 3.5],  # Funk rhythm
        },
        {
            'name': 'triplet-feel-90bpm',
            'description': 'Triplet-based pattern',
            'bpm': 90,
            'pattern': [0, 0.667, 1.333, 2, 2.667, 3.333],  # Triplet feel
        },
        {
            'name': 'fast-metal-160bpm',
            'description': 'Fast 16th note metal pattern',
            'bpm': 160,
            'pattern': [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
        },
        {
            'name': 'off-beat-emphasis-130bpm',
            'description': 'Pattern emphasizing off-beats',
            'bpm': 130,
            'pattern': [0.5, 1.5, 2.5, 3.5],  # Only the "+" beats
        },
        {
            'name': 'complex-polyrhythm-140bpm',
            'description': 'Complex polyrhythmic pattern',
            'bpm': 140,
            'pattern': [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6],  # 5 against 4
        },
        {
            'name': 'reggae-skank-85bpm',
            'description': 'Reggae upstroke pattern',
            'bpm': 85,
            'pattern': [0.5, 1.5, 2.5, 3.5],  # Classic reggae skank on off-beats
        },
        {
            'name': 'latin-clave-120bpm',
            'description': 'Son clave pattern',
            'bpm': 120,
            'pattern': [0, 0.5, 1.5, 2, 3],  # 3-2 son clave
        },
        {
            'name': 'shuffle-blues-75bpm',
            'description': 'Shuffle rhythm with swing feel',
            'bpm': 75,
            'pattern': [0, 0.667, 1.333, 2, 2.667, 3.333],  # Shuffle triplets
        }
    ]
    
    print("Generating test audio patterns...")
    
    for pattern_info in patterns:
        print(f"Creating: {pattern_info['name']} - {pattern_info['description']}")
        
        audio = create_rhythm_pattern(
            pattern_beats=pattern_info['pattern'],
            bpm=pattern_info['bpm'],
            duration=8.0  # 8 seconds
        )
        
        filename = f"test-audio/{pattern_info['name']}.wav"
        save_wav_file(audio, filename)
        
        print(f"  → Saved: {filename}")
    
    print(f"\n✅ Generated {len(patterns)} test audio files in ./test-audio/")
    print("\nYou can now upload these files to test different rhythm patterns:")
    for pattern_info in patterns:
        print(f"  • {pattern_info['name']}.wav - {pattern_info['description']} ({pattern_info['bpm']} BPM)")

if __name__ == "__main__":
    generate_test_patterns()