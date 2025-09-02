#!/usr/bin/env bash
set -euo pipefail

# Generate missing PNGs for MP3s under any directory:
# - Waveform: peak-normalized to 0 dBFS, 4000x100, white on transparent
#   Output name: <basename>.waveform.png
# - Spectrogram: magma colormap, 4000x150, transparent background
#   Output name: <basename>.spectrogram.png
#
# Options:
#   -f    Force regenerate even if PNG exists
#   -r DIR  Root directory to search (default: current dir)

force=0
root="."
while getopts ":fr:" opt; do
  case "$opt" in
    f) force=1 ;;
    r) root="$OPTARG" ;;
    *) ;;
  esac
done

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[error] ffmpeg not found on PATH" >&2
  exit 1
fi

make_waveform() {
  local in_mp3="$1" out_png="$2"
  # Detect peak level
  local report maxv gain_db
  report=$(ffmpeg -nostats -i "$in_mp3" -af volumedetect -f null - 2>&1 || true)
  maxv=$(printf "%s" "$report" | awk -F': ' '/max_volume:/ {gsub(/ dB/,"",$2); print $2; exit}')
  if [[ -z "${maxv:-}" || "$maxv" == "-inf" ]]; then
    gain_db=0
  else
    gain_db=$(awk -v mv="$maxv" 'BEGIN { g = -mv; if (g < 0) g=0; printf("%.3f", g) }')
  fi
  echo "[waveform] max_volume=${maxv:-unknown} dB, gain=${gain_db} dB -> $out_png"
  ffmpeg -y -i "$in_mp3" \
    -filter_complex "aformat=channel_layouts=mono,volume=${gain_db}dB,showwavespic=s=4000x100:colors=white,format=rgba,colorkey=black:0.02:0.0" \
    -frames:v 1 "$out_png" < /dev/null
}

make_spectrogram() {
  local in_mp3="$1" out_png="$2"
  # Previous version used colorkey to make near-black transparent, which caused the upper
  # frequency band (often very low energy in piano material) to become fully transparent
  # leaving apparent "empty" space. We remove colorkey so the full 200px height is visually
  # occupied. Slight brightness lift helps low-energy bands show faint color instead of pure black.
  echo "[spectrogram] magma 4000x200 (no colorkey) -> $out_png"
  ffmpeg -y -i "$in_mp3" \
    -lavfi "aformat=channel_layouts=mono,showspectrumpic=s=4000x200:legend=disabled:scale=log:color=magma,eq=contrast=1.55:brightness=0.02:saturation=1.25,format=rgba" \
    "$out_png" < /dev/null
}

shopt -s nullglob
declare -a files
while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$root" -type f -path '*.mp3' -print0)

if ((${#files[@]}==0)); then
  echo "[info] No MP3 files found under $root matching *.mp3"
  exit 0
fi

for f in "${files[@]}"; do
  dir=$(dirname "$f")
  base=$(basename "$f" .mp3)
  wave_out="$dir/$base.waveform.png"
  spec_out="$dir/$base.spectrogram.png"

  if [[ $force -eq 1 || ! -f "$wave_out" ]]; then
    make_waveform "$f" "$wave_out"
  else
    echo "[skip] waveform exists: $wave_out"
  fi

  if [[ $force -eq 1 || ! -f "$spec_out" ]]; then
    make_spectrogram "$f" "$spec_out"
  else
    echo "[skip] spectrogram exists: $spec_out"
  fi
done

echo "[done] Generation complete."

