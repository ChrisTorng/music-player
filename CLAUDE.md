# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a universal music player application supporting multiple classical music pieces. Each piece is organized in its own folder with a config.json file containing all media references and timing information.

Current pieces:
- `Liszt-Liebesträume-No.3/`: Contains multiple audio/video takes, MIDI versions, score images, and audio processing visualizations

The TypeScript application (described in PLAN.md) loads different pieces based on URL parameters, creating a multi-track audio/video player with score synchronization for each piece. Tab switching is performed via URL query string (`?tab=<id>`) and triggers a full page reload so each tab has an independent runtime state (no cross-tab state retention within a single page instance).

## Development Commands

### Media Validation
```bash
# List all media files for a specific piece
find <piece-folder> -type f | sort

# Example for Liszt piece
find Liszt-Liebesträume-No.3 -type f | sort

# Check video codec info
ffmpeg -i Liszt-Liebesträume-No.3/home/video/home.mp4 -hide_banner

# Verify file integrity
ffmpeg -v error -i <file> -f null -

# Remove Windows zone identifiers
find <piece-folder> -name '*:Zone.Identifier' -delete
```

### Audio Processing
```bash
# Generate waveform and spectrogram PNGs for all MP3s
./scripts/gen-mp3-png.sh

# Force regenerate existing PNGs
./scripts/gen-mp3-png.sh -f

# Process specific directory  
./scripts/gen-mp3-png.sh -r Liszt-Liebesträume-No.3/home/audio
```

### File Transcoding Example
```bash
ffmpeg -i input.mov -c:v libx264 -crf 20 -c:a aac output.mp4
```

## File Organization

### Piece Structure  
Each piece has its own folder containing:
- `config.json`: Configuration file with all media references and timing data
- `score/`: Sheet music as `<page>-<system>.png` (e.g., `2-4.png`)
- `home/`, `church/`, `home-midi/`: Location-based recording takes
  - Each contains `audio/` and `video/` subdirectories
- `image/`: Reference images

### Example: Liszt-Liebesträume-No.3/
```
Liszt-Liebesträume-No.3/
├── config.json
├── score/
│   ├── 1-1.png, 1-2.png, ...
├── home/
│   ├── audio/ (MP3 files + waveform/spectrogram PNGs)  
│   └── video/ (MP4 files)
├── church/
│   ├── audio/ (Demucs separated tracks)
│   └── video/ (MP4 files)
└── home-midi/
    ├── audio/ (MIDI-generated audio)
    └── video/ (MP4 files)
```

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

### Application Loading
The app reads URL parameters to determine which piece to load:
- URL: `?piece=Liszt-Liebesträume-No.3` loads `Liszt-Liebesträume-No.3/config.json`
- URL: `&tab=<tab-id>` selects which tab to open for that piece; clicking a tab navigates to this URL and reloads the page
- All media paths in config.json are relative to the piece folder
- Future pieces can be added by creating new folders with config.json

### Core Modules
- `main.ts`: Entry point, URL parameter handling, piece loading, UI generation
- `config/loader.ts`: Dynamic config.json loading and path resolution
- `config/types.ts`: TypeScript interfaces for JSON configuration
- `video/`: Native MP4 and YouTube iframe player controllers
- `audio/engine.ts`: Web Audio API routing for left/right channel assignment
- `visuals/`: Waveform and spectrogram PNG display with seek interaction
- `sync/controller.ts`: Audio-master clock synchronization
- `score/viewer.ts`: Sheet music display with slide-up animation

### Key Features
- Multi-piece support via URL parameters
- Tab-based interface for different recording takes within each piece (tabs are URL links using `?tab=`; navigation reloads the page and initializes only the selected tab)
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
- Each piece's config.json uses relative paths from its own folder
- The project supports both MP4 URLs and YouTube links in the planned app
- CORS configuration required for cross-domain media access
- Pure TypeScript implementation with no external frameworks planned
- URL parameter `piece` determines which folder/config.json to load
 - Source of truth: edit `src/` (TypeScript) only. Do not hand-edit `js/`; run `npm run build` to regenerate compiled output.
 - Config loader supports JSONC (comments): comments in `config.json` are stripped at runtime before parsing.
