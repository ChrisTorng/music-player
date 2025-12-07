#!/usr/bin/env python3
"""
Generate waveform and mel-spectrogram PNGs for audio files.

- Waveform: 4000x50, black background with white peaks, peak-normalized.
- Spectrogram: 4000x200, magma-like gradient, low frequencies at bottom.
- Outputs are written next to the source audio as <name>.waveform.png and
  <name>.spectrogram.png. Existing PNGs are skipped unless --force is set.

Dependencies: Python 3, librosa, numpy, pillow
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import librosa
import numpy as np
from PIL import Image, ImageDraw

WAVEFORM_SIZE = (4000, 50)
SPECTROGRAM_SIZE = (4000, 200)
DEFAULT_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".ogg"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate waveform and spectrogram PNGs.")
    parser.add_argument("-r", "--root", default=".", help="Root directory to scan (default: current directory).")
    parser.add_argument("-f", "--force", action="store_true", help="Regenerate even if PNGs already exist.")
    parser.add_argument(
        "--ext",
        nargs="+",
        default=sorted(DEFAULT_EXTS),
        help="Audio extensions to include (default: %(default)s).",
    )
    return parser.parse_args()


def replace_with_suffix(path: Path, suffix: str) -> Path:
    return path.with_name(path.stem + suffix)


def list_audio_files(root: Path, exts: set[str]) -> list[Path]:
    return sorted([p for p in root.rglob("*") if p.suffix.lower() in exts])


def choose_n_fft(n_samples: int) -> int:
    if n_samples <= 0:
        return 1024
    preferred = 4096
    n_fft = 1024
    while n_fft * 2 <= n_samples and n_fft < preferred:
        n_fft *= 2
    return min(n_fft, n_samples)


def gradient(norm: np.ndarray) -> np.ndarray:
    stops_t = np.array([0.0, 0.25, 0.5, 0.75, 1.0], dtype=np.float32)
    stops_c = np.array(
        [
            [0, 0, 3],
            [30, 16, 68],
            [83, 18, 123],
            [187, 55, 84],
            [251, 252, 73],
        ],
        dtype=np.float32,
    )
    t = np.clip(norm, 0.0, 1.0) ** 0.4
    pivot = 0.85
    strength = 0.6
    boost_mask = t > pivot
    t[boost_mask] = pivot + (t[boost_mask] - pivot) * (1.0 + strength)
    t = np.clip(t, 0.0, 1.0)
    r = np.interp(t, stops_t, stops_c[:, 0])
    g = np.interp(t, stops_t, stops_c[:, 1])
    b = np.interp(t, stops_t, stops_c[:, 2])
    return np.stack([r, g, b], axis=-1).astype(np.uint8)


def render_waveform(y: np.ndarray) -> Image.Image:
    width, height = WAVEFORM_SIZE
    img = Image.new("RGB", (width, height), (0, 0, 0))
    if y.size == 0:
        return img

    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = y / peak
    draw = ImageDraw.Draw(img)
    mid = height / 2
    total = len(y)
    for x in range(width):
        start = int(x * total / width)
        end = int((x + 1) * total / width)
        if end <= start:
            end = min(total, start + 1)
        segment = y[start:end]
        if segment.size == 0:
            continue
        min_v = float(np.min(segment))
        max_v = float(np.max(segment))
        y1 = mid - max_v * mid
        y2 = mid - min_v * mid
        draw.line([(x, y1), (x, y2)], fill=(255, 255, 255))
    return img


def render_spectrogram(y: np.ndarray, sr: int) -> Image.Image:
    width, height = SPECTROGRAM_SIZE
    if y.size < 1:
        return Image.new("RGB", (width, height), (0, 0, 0))

    n_fft = choose_n_fft(len(y))
    if len(y) < n_fft:
        y = np.pad(y, (0, n_fft - len(y)), mode="constant")
    hop_length = max(1, int(np.floor((len(y) - n_fft) / max(1, width - 1))))
    mel_bins = max(height * 2, 512)
    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        n_mels=mel_bins,
        power=2.0,
        center=False,
    )
    mel_db = 10 * np.log10(np.maximum(mel, 1e-12))
    global_max = float(np.max(mel_db))
    dynamic_range = 100.0
    min_db = max(global_max - dynamic_range, -120.0)
    denom = max(1e-6, global_max - min_db)

    frames = mel_db.shape[1]
    time_idx = np.linspace(0, frames - 1, width)
    mel_resampled = np.stack(
        [np.interp(time_idx, np.arange(frames), mel_db[i]) for i in range(mel_db.shape[0])]
    )

    rows = np.zeros((height, width), dtype=np.float32)
    max_bin = mel_resampled.shape[0] - 1
    for y_px in range(height):
        frac = 1.0 - (y_px / max(1, height - 1))
        idx = (frac * frac) * max_bin
        i0 = int(np.floor(idx))
        i1 = min(max_bin, i0 + 1)
        alpha = idx - i0
        base = (1 - alpha) * mel_resampled[i0] + alpha * mel_resampled[i1]
        il = max(0, i0 - 1)
        ir = min(max_bin, i1 + 1)
        left = (1 - alpha) * mel_resampled[il] + alpha * mel_resampled[i0]
        right = (1 - alpha) * mel_resampled[i1] + alpha * mel_resampled[ir]
        rows[y_px] = 0.5 * base + 0.25 * left + 0.25 * right

    norm = (rows - min_db) / denom
    rgb = gradient(norm)
    return Image.fromarray(rgb, mode="RGB")


def process_file(path: Path, force: bool) -> None:
    wave_out = replace_with_suffix(path, ".waveform.png")
    spec_out = replace_with_suffix(path, ".spectrogram.png")

    if not force and wave_out.exists() and spec_out.exists():
        print(f"[skip] PNGs exist for {path}")
        return

    print(f"[load] {path}")
    y, sr = librosa.load(path, sr=None, mono=True)

    if force or not wave_out.exists():
        print(f"[waveform] -> {wave_out}")
        wave_img = render_waveform(y)
        wave_out.parent.mkdir(parents=True, exist_ok=True)
        wave_img.save(wave_out)
    else:
        print(f"[skip] waveform exists: {wave_out}")

    if force or not spec_out.exists():
        print(f"[spectrogram] -> {spec_out}")
        spec_img = render_spectrogram(y, sr)
        spec_out.parent.mkdir(parents=True, exist_ok=True)
        spec_img.save(spec_out)
    else:
        print(f"[skip] spectrogram exists: {spec_out}")


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    exts = {e if e.startswith(".") else f".{e}" for e in args.ext}

    if not root.exists():
        print(f"[error] Root not found: {root}", file=sys.stderr)
        return 1

    files = list_audio_files(root, exts)
    if not files:
        print(f"[info] No audio files found under {root}")
        return 0

    for audio_path in files:
        try:
            process_file(audio_path, args.force)
        except Exception as exc:
            print(f"[error] Failed on {audio_path}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
