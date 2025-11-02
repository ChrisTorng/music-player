# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a universal music player application supporting multiple classical music pieces. Each piece is organized in its own folder with a config.json file containing all media references and timing information.

Current pieces:
- `Liszt-Liebesträume-No.3/`: Contains multiple audio/video takes, MIDI versions, score images, and audio processing visualizations

The TypeScript application (described in PLAN.md) loads different pieces based on URL parameters, creating a multi-track audio/video player with score synchronization for each piece. Tab switching is performed via URL query string (`?tab=<id>`) and triggers a full page reload so each tab has an independent runtime state (no cross-tab state retention within a single page instance).

## Development Commands

### TypeScript Build & Development
```bash
# Install dependencies
npm install

# Build TypeScript (src/ → js/)
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Start local development server (default port 8000)
npm run serve

# Complete workflow (build + serve)
npm start

# Access the app
# http://localhost:8000/?piece=Liszt-Liebesträume-No.3
# http://localhost:8000/?piece=test&tab=test (minimal test piece)
```

**CRITICAL**: Never manually edit files in `js/` or `css/` directories - these are compiled outputs. Always edit source files in `src/` and run `npm run build`.

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

### Audio Processing (Optional - Legacy)
```bash
# Generate waveform and spectrogram PNGs for all MP3s (OPTIONAL)
# NOTE: Visualizations are now generated dynamically in-browser by default
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

### Generated Assets (Dynamic + Optional Static)
**Primary Method (Dynamic)**: Waveform and spectrogram visualizations are generated in-browser at runtime:
- Waveform: 4000×50 px (black background, white waveform)
- Spectrogram: 4000×200 px (magma colormap, low frequencies at bottom)
- No PNG files needed; generated from MP3 audio data using Web Audio API and Canvas

**Optional Static Method**: The `gen-mp3-png.sh` script can create offline PNG assets for external use:
- `<basename>.waveform.png`: 4000×50 px
- `<basename>.spectrogram.png`: 4000×200 px
- These are NOT used by the web application

## Architecture

### Application Loading
The app reads URL parameters to determine which piece to load:
- URL: `?piece=Liszt-Liebesträume-No.3` loads `Liszt-Liebesträume-No.3/config.json`
- URL: `&tab=<tab-id>` selects which tab to open for that piece; clicking a tab navigates to this URL and reloads the page
- All media paths in config.json are relative to the piece folder
- Future pieces can be added by creating new folders with config.json

### Core Modules (Implemented)
- `src/main.ts`: Entry point, MusicPlayerApp class, URL parameter handling, piece loading, UI generation, playback control
- `src/config/loader.ts`: Dynamic config.json loading and path resolution; supports JSONC (strips comments before parsing)
- `src/config/types.ts`: TypeScript interfaces for JSON configuration (Config, Tab, VideoSource, AudioTrack, etc.)
- `src/video/native.ts`: Native `<video>` element controller for MP4 playback
- `src/video/youtube.ts`: YouTube IFrame Player API wrapper for video sync
- `src/video/manager.ts`: Manages multiple video players and synchronization
- `src/audio/engine.ts`: Web Audio API routing for left/right channel assignment, gain control, playback ended detection
- `src/visual/renderer.ts`: Dynamic waveform and spectrogram generation from audio data using Canvas API

### Key Features
- Multi-piece support via URL parameters
- Tab-based interface for different recording takes within each piece (tabs are URL links using `?tab=`; navigation reloads the page and initializes only the selected tab)
- Dual video players (top/bottom) with independent source selection  
- Multi-track audio with visual waveform/spectrogram navigation
- Score synchronization with timing-based sheet switching
- Left/right audio channel routing from any source

## File Requirements

- UTF-8 encoding for all text files
- TypeScript strict mode enabled (`tsconfig.json` with `strict: true`, `noImplicitAny: true`)
- Compiled output: `src/` → `js/` (ES2020 modules, source maps included)
- Git LFS recommended for large binaries: `git lfs track "*.mp4" "*.mp3" "*.png"`
- Strip sensitive metadata from images before commit
- `.gitignore` excludes `node_modules/` and large media files

## Testing & Validation

No formal unit tests. Manual validation workflow:

### Quick Test Setup
```bash
# Build and serve
npm run build && npm run serve

# Open test piece (minimal config for quick testing)
http://localhost:8000/?piece=test&tab=test
```

The `test/` directory contains a minimal test piece with sync test media for quick validation.

### Media Validation
- Ensure media files play correctly in the browser
- Verify expected durations and codecs (H.264/AAC for MP4, 44.1kHz for MP3)
- Check file integrity: `ffmpeg -v error -i <file> -f null -`
- Test audio/video synchronization with test media
- Verify waveform/spectrogram rendering works correctly
- Check that channel routing (left/right) functions as expected

## Important Notes

- **Source of truth**: Edit `src/` (TypeScript) only. Never manually edit `js/` or `css/` - run `npm run build` to regenerate compiled output
- **Config format**: Supports JSONC (comments in `config.json` are stripped at runtime before parsing by `src/config/loader.ts`)
- **Media paths**: All paths in config.json are relative to the piece folder
- **URL routing**: `?piece=<folder-name>` determines which config to load; `&tab=<id>` selects the active tab
- **Tab navigation**: Clicking tabs triggers full page reload with new URL parameters (no cross-tab state retention)
- **CORS requirements**: Cross-domain MP4/MP3 requires `crossorigin="anonymous"` attribute and proper server headers
- **Video support**: Both native MP4 (`<video>`) and YouTube (IFrame API) are implemented
- **Audio routing**: Web Audio API handles left/right channel assignment from any audio source or video track
- **Visualizations**: Dynamically generated in-browser; PNG files (if present) are ignored by the web app
- **No framework dependencies**: Pure TypeScript with native Web APIs (Web Audio, Canvas, etc.)

### Common Pitfalls
- Forgetting to run `npm run build` after editing TypeScript files
- Manually editing `js/` files (changes will be overwritten on next build)
- Adding media files without updating the piece's `config.json`
- CORS issues when loading media from different origins without proper headers
- Attempting to route audio from YouTube videos (not supported - only screen sync works)
