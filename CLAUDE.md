# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a classical music media project focused on Liszt's Liebesträume No.3. It contains:
- Multiple audio/video takes recorded in different locations (home, church)
- MIDI files and modified versions
- Score sheet images organized by page and system
- Audio processing tools for generating waveforms and spectrograms

The planned TypeScript application (described in PLAN.md) will create a multi-track audio/video player with score synchronization.

## Development Commands

### Media Validation
```bash
# List all media files
find media -type f | sort

# Check video codec info
ffmpeg -i media/home/video/home.mp4 -hide_banner

# Verify file integrity
ffmpeg -v error -i <file> -f null -

# Remove Windows zone identifiers
find media -name '*:Zone.Identifier' -delete
```

### Audio Processing
```bash
# Generate waveform and spectrogram PNGs for all MP3s
./scripts/gen-mp3-png.sh

# Force regenerate existing PNGs
./scripts/gen-mp3-png.sh -f

# Process specific directory
./scripts/gen-mp3-png.sh -r media/home/audio
```

### File Transcoding Example
```bash
ffmpeg -i input.mov -c:v libx264 -crf 20 -c:a aac output.mp4
```

## File Organization

### Media Structure
- `media/score/`: Sheet music as `<page>-<system>.png` (e.g., `2-4.png`)
- `media/home/`, `media/church/`, `media/home-midi/`: Location-based takes
  - Each contains `audio/` and `video/` subdirectories
- `media/image/`: Reference images

### Naming Conventions
- Score images: `<page>-<system>.png` (1-indexed integers)
- Audio variants: Use parentheses like `home_(Piano).mp3`, `home_(Instrumental).mp3`
- Avoid spaces in filenames when possible
- Keep descriptive but consistent naming

### Generated Assets
The `gen-mp3-png.sh` script creates visualization assets:
- `<basename>.waveform.png`: 4000x200 white waveform on transparent background
- `<basename>.spectrogram.png`: 4000x200 magma colormap spectrogram

## Architecture (Planned TypeScript App)

### Core Modules
- `main.ts`: Entry point, UI generation, state management
- `config/types.ts`: TypeScript interfaces for JSON configuration
- `video/`: Native MP4 and YouTube iframe player controllers
- `audio/engine.ts`: Web Audio API routing for left/right channel assignment
- `visuals/`: Waveform and spectrogram PNG display with seek interaction
- `sync/controller.ts`: Audio-master clock synchronization
- `score/viewer.ts`: Sheet music display with slide-up animation

### Key Features
- Tab-based interface for different media sets
- Dual video players (top/bottom) with independent source selection  
- Multi-track audio with visual waveform/spectrogram navigation
- Score synchronization with timing-based sheet switching
- Left/right audio channel routing from any source

## File Requirements

- UTF-8 encoding for all text files
- No build system - this is a media asset repository
- Git LFS recommended for large binaries: `git lfs track "*.mp4" "*.mp3" "*.png"`
- Strip sensitive metadata from images before commit

## Testing

No formal unit tests. Validation involves:
- Ensuring media files play correctly
- Verifying expected durations and codecs (H.264/AAC for MP4, 44.1kHz for MP3)
- Checking file integrity with ffmpeg

## Important Notes

- Media files are gitignored but PNG visualizations are tracked
- The project supports both MP4 URLs and YouTube links in the planned app
- CORS configuration required for cross-domain media access
- Pure TypeScript implementation with no external frameworks planned