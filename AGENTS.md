# Repository Guidelines

## Project Structure & Module Organization
- `media/score`: Sheet images named `<page>-<system>.png` (e.g., `2-4.png`).
- `media/image`: Reference images (e.g., `20250803 Liszt.png`).
- `media/home`, `media/church`, `media/home-midi`: Each contains `audio/` and `video/` for takes and renders.
- Do not commit Windows alternate streams like `*:Zone.Identifier` — delete them before pushing.

## Build, Test, and Development Commands
- No build system; this repo tracks media assets.
- Validate media quickly:
  - List and spot-check: `find media -type f | sort`
  - Probe codecs: `ffmpeg -i media/home/video/home.mp4 -hide_banner`
  - Check decode errors: `ffmpeg -v error -i <file> -f null -`
- Transcode (example): `ffmpeg -i input.mov -c:v libx264 -crf 20 -c:a aac output.mp4`

## Naming Conventions
- Scores: `media/score/<page>-<system>.png` (two integers, 1-indexed).
- Location buckets: `home/`, `church/`, `home-midi/` → keep files under `audio/` or `video/`.
- Variants: use parentheses to match existing style, e.g., `home_(Piano).mp3`, `home_(Instrumental).mp3`.
- Keep names descriptive but consistent; avoid introducing new patterns (no camelCase or random prefixes).

## Formatting & Linting
- None required. Prefer UTF-8 filenames. Avoid spaces in new assets when possible; if needed, mirror current style exactly.

## Testing Guidelines
- No unit tests. “Tests” are integrity checks:
  - Ensure files open and play; verify durations match expectations.
  - Confirm target codecs/bitrates (e.g., H.264/AAC for MP4, 44.1kHz for MP3).
  - Remove `*:Zone.Identifier` artifacts: `find media -name '*:Zone.Identifier' -delete`.

## Commit & Pull Request Guidelines
- Commits: concise, present-tense summary (e.g., `add: church video take` / `update: score pages 1–6`).
- PRs should include:
  - Purpose, context, and what changed.
  - File manifest with paths and counts (audio/video/score).
  - Any notable processing choices (e.g., CRF, sample rate) and screenshots or thumbnails where helpful.

## Security & Configuration Tips
- Consider Git LFS for large binaries: `git lfs track "*.mp4" "*.mp3" "*.png"`.
- Strip sensitive metadata from images if needed (e.g., EXIF) before commit.
