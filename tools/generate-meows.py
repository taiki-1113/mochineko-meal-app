"""Original, reproducible formant-synthesized cat-like sounds; no recordings/APIs.

Run from any directory with Python 3 (standard library only). Output is mono PCM
WAV at 22050 Hz. These are stylized synthesized meows, not real-cat recordings.
"""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)


def save(name, samples, peak=0.65):
    scale = peak / max(max(abs(x) for x in samples), 0.001)
    with wave.open(str(OUT / name), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(b"".join(struct.pack("<h", round(max(-1, min(1, x * scale)) * 32767)) for x in samples))


def meow(group, variant):
    settings = {
        "happy": (1.1, 260, 120, 0.12),
        "relaxed": (1.55, 220, 65, 0.22),
        "affectionate": (1.3, 245, 140, 0.17),
        "surprised": (0.7, 300, 175, 0.08),
    }
    length, base, excursion, roughness = settings[group]
    length *= [0.9, 1.0, 1.12][variant - 1]
    base *= [0.94, 1.0, 1.045][variant - 1]
    rng = random.Random(group + str(variant))
    phase = 0
    result = []
    breath = 0
    for i in range(int(length * RATE)):
        t = i / RATE
        u = t / length
        # A voiced /m-i-a-u/ glide with vibrato and a soft, slightly creaky tail.
        f0 = base + excursion * math.sin(math.pi * u) ** 1.7 - 70 * u
        f0 *= 1 + .017 * math.sin(2 * math.pi * (4.8 + variant * .3) * t)
        phase += 2 * math.pi * f0 / RATE
        a = min(1, u / .15)
        tail = max(0, (1 - u) / .28) ** .8
        envelope = min(a, tail, 1) * (.8 + .2 * math.sin(math.pi * u))
        f1 = 300 + 650 * math.sin(math.pi * min(1, u / .88)) ** 1.8
        f2 = 2000 - 1350 * u
        voice = 0
        for harmonic in range(1, 20):
            frequency = f0 * harmonic
            formant = .16 + 1.7 * math.exp(-((frequency - f1) / 220) ** 2) + .55 * math.exp(-((frequency - f2) / 300) ** 2)
            voice += math.sin(harmonic * phase + .12 * math.sin(phase * .5)) * formant / harmonic ** 1.15
        creak = 1 - roughness + roughness * math.sin(2 * math.pi * 26 * t) ** 2
        breath = .87 * breath + .13 * rng.uniform(-1, 1)
        result.append(envelope * (voice * creak + .045 * breath))
    save(f"{group}-{variant}.wav", [0] * 1800 + result + [0] * 4000)


for family in ("happy", "relaxed", "affectionate", "surprised"):
    for number in range(1, 4):
        meow(family, number)

# Two soft breath pulses separated by silence, with seamless silent loop edges.
rng = random.Random(20261027)
samples, low, phase = [], 0, 0
for i in range(RATE * 6):
    t = i / RATE
    envelope = 0
    for start, length, level in ((.5, 1.4, 1), (2.7, 1.7, .7)):
        u = (t - start) / length
        if 0 < u < 1:
            envelope += math.sin(math.pi * u) ** 2 * level
    noise = rng.uniform(-1, 1)
    low = .94 * low + .06 * noise
    phase += 2 * math.pi * (92 + 3 * math.sin(2 * math.pi * .3 * t)) / RATE
    samples.append(envelope * (low * .65 + math.sin(phase) * .035) * (.85 + .15 * math.sin(2 * math.pi * 24 * t)))
save("sleep.wav", samples, .3)
print(f"Generated 12 meows + sleep in {OUT}")
