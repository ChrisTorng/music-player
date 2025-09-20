import { ConfigLoader } from './config/loader.js';
import { Config, Tab } from './config/types.js';
import { VideoManager } from './video/manager.js';
import { AudioEngine } from './audio/engine.js';
import { renderWaveformPng, renderSpectrogramPng } from './visual/renderer.js';

class MusicPlayerApp {
  private config: Config | null = null;
  private currentTab: Tab | null = null;
  private configLoader: ConfigLoader;
  private videoManager: VideoManager;
  private isPlaying: boolean = false;
  private audioEngine: AudioEngine;
  private cursorRaf: number | null = null;
  private trackImageInfo: Map<string, { imgEl: HTMLImageElement | null; spectEl: HTMLImageElement | null; wrapperEl: HTMLDivElement | null }>;
  private pieceName: string = '';
  private pendingMediaLoads = 0;
  private playbackEnded: boolean = false;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.videoManager = new VideoManager();
    this.audioEngine = new AudioEngine();
    this.trackImageInfo = new Map();
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.showLoading(true);
      
      // Parse URL parameters
      const { piece, tab } = ConfigLoader.parseUrlParams();
      
      if (!piece) {
        throw new Error('No piece specified. Please add ?piece=<folder-name> to URL');
      }
      
      // Load config
      this.config = await this.configLoader.loadPieceConfig(piece);
      this.pieceName = piece;

      // Prepare audio engine
      await this.audioEngine.initialize();
      this.audioEngine.onPlaybackEndedCallback(() => this.handlePlaybackEnded());
      
      // Update UI
      this.updatePieceInfo(piece);
      this.generateTabs();
      this.setupGlobalControls();
      // Choose initial tab from URL (?tab=), fallback to defaultTab or first
      const availableTabIds = new Set(this.config.tabs.map(t => t.id));
      const initialTab = (tab && availableTabIds.has(tab)) ? tab : (this.config.defaultTab || this.config.tabs[0].id);
      this.switchToTab(initialTab);
      
      this.showLoading(false);
      
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  // ---- Dynamic visual generation helpers ----
  private async ensureTrackBuffer(trackId: string, url: string): Promise<AudioBuffer> {
    // Try existing buffer in engine first
    let buf = this.audioEngine.getTrackBuffer(trackId);
    if (buf) return buf;
    // If not loaded yet, load via engine to leverage same AudioContext
    await this.audioEngine.loadAudioTrack(trackId, url);
    buf = this.audioEngine.getTrackBuffer(trackId);
    if (!buf) throw new Error('Failed to decode audio buffer');
    return buf;
  }

  private showLoading(show: boolean): void {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = show ? 'flex' : 'none';
    }
  }

  private showError(message: string): void {
    this.showLoading(false);
    
    const errorEl = document.getElementById('error');
    const errorMessageEl = document.getElementById('error-message');
    const retryBtn = document.getElementById('error-retry');
    
    if (errorEl && errorMessageEl) {
      errorMessageEl.textContent = message;
      errorEl.style.display = 'flex';
    }
    
    if (retryBtn) {
      retryBtn.onclick = () => {
        errorEl!.style.display = 'none';
        this.init();
      };
    }
  }

  private updatePieceInfo(pieceName: string): void {
    const pieceInfoEl = document.getElementById('piece-info');
    if (pieceInfoEl) {
      pieceInfoEl.textContent = `Current Piece: ${pieceName}`;
    }
  }

  private generateTabs(): void {
    if (!this.config) return;
    
    const tabNavEl = document.getElementById('tab-nav');
    if (!tabNavEl) return;
    
    // Clear existing tabs
    tabNavEl.innerHTML = '';
    
    // Generate tab links (navigate via query string and reload)
    this.config.tabs.forEach(tab => {
      const a = document.createElement('a');
      a.className = 'tab';
      a.textContent = tab.title;
      a.dataset.tabId = tab.id;
      // Preserve existing params, set piece and tab
      const url = new URL(window.location.href);
      if (this.pieceName) {
        url.searchParams.set('piece', this.pieceName);
      }
      url.searchParams.set('tab', tab.id);
      a.href = url.toString();
      tabNavEl.appendChild(a);
    });
  }

  private setupGlobalControls(): void {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        this.togglePlayPause();
      });
    }

    // Set up video manager callbacks
    this.videoManager.onTimeUpdateCallback((_currentTime, _source) => {
      // Cursor follows audio master clock; video updates are secondary.
    });

    this.videoManager.onPlayCallback((source) => {
      console.log(`Play from ${source}`);
      this.updatePlayPauseButton();
    });

    this.videoManager.onPauseCallback((source) => {
      console.log(`Pause from ${source}`);
      this.updatePlayPauseButton();
    });

    // Keep visuals aligned on window resize
    window.addEventListener('resize', () => {
      const clock = this.audioEngine.getMasterClock();
      const t = this.isPlaying ? clock.currentTime : 0;
      this.updateAllVisualsPosition(t);
    });

    // Ensure initial control state reflects loading status
    this.updatePlayPauseButton();
  }

  private async togglePlayPause(): Promise<void> {
    try {
      if (!this.isPlaying && this.isMediaLoading()) {
        // Still loading media; ignore accidental clicks.
        return;
      }

      if (this.isPlaying) {
        // Pause both video and audio
        this.videoManager.pauseAll();
        this.audioEngine.pauseAll();
        this.isPlaying = false;
        this.playbackEnded = false;
      } else {
        // Require master audio duration; if unavailable, block playback
        const duration = this.audioEngine.getMasterAudioDuration();
        if (!duration || !isFinite(duration) || duration <= 0) {
          alert('No master audio duration available. Please select/load an audio track for routing before playing.');
          return;
        }

        const clockBeforeStart = this.audioEngine.getMasterClock();
        const reachedEnd = this.playbackEnded || (isFinite(clockBeforeStart.currentTime) && clockBeforeStart.currentTime >= duration - 0.01);
        if (reachedEnd) {
          this.seekTo(0);
        }

        this.playbackEnded = false;
        // Start audio first (master clock), then video
        await this.audioEngine.resume();
        await this.audioEngine.playAll();
        const clock = this.audioEngine.getMasterClock();
        await this.videoManager.playAll(clock.currentTime, () => this.audioEngine.getMasterClock().currentTime);
        this.isPlaying = true;
        this.startCursorLoop();
      }
      this.updatePlayPauseButton();
    } catch (error) {
      console.error('Playback error:', error);
      this.isPlaying = false;
      // Handle autoplay restrictions
      if (error instanceof Error && error.message.includes('play')) {
        alert('Please click play again to start playback. Browser autoplay restrictions may apply.');
      }
    }
  }

  private updatePlayPauseButton(): void {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
      const isPlaying = this.isPlaying || this.videoManager.isAnyPlaying();
      playPauseBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
      const shouldDisable = this.isMediaLoading() && !this.isPlaying;
      (playPauseBtn as HTMLButtonElement).disabled = shouldDisable;
    }

    this.setDropdownsDisabled(this.isPlaying || this.videoManager.isAnyPlaying());
  }

  private handlePlaybackEnded(): void {
    this.isPlaying = false;
    this.playbackEnded = true;
    this.videoManager.pauseAll();
    this.seekTo(0);
    this.updatePlayPauseButton();
  }

  private seekTo(timeSec: number): void {
    const clamped = Math.max(0, timeSec);
    this.audioEngine.seekAll(clamped);
    this.videoManager.seekAll(clamped);
    this.updateAllVisualsPosition(clamped);
  }

  private switchToTab(tabId: string): void {
    if (!this.config) return;
    
    const tab = this.config.tabs.find(t => t.id === tabId);
    if (!tab) {
      console.warn(`Tab with id "${tabId}" not found`);
      return;
    }
    
    this.currentTab = tab;
    
    // Update active tab button
    document.querySelectorAll('.tab').forEach(tabBtn => {
      tabBtn.classList.remove('active');
      if ((tabBtn as HTMLElement).dataset.tabId === tabId) {
        tabBtn.classList.add('active');
      }
    });
    
    // Update UI sections
    this.updateVideoSelectors();
    this.updateAudioGroups();
    this.applyDefaults();

    // Load audio for default group and apply routing
    this.loadSelectedGroupAudioTracks().then(() => {
      this.applyRoutingFromSelectors();
      // After audio loads, we should have duration; re-align visuals at t=0
      this.updateAllVisualsPosition(0);
    }).catch(err => console.error('Audio preload failed:', err));
  }

  private updateVideoSelectors(): void {
    if (!this.currentTab) return;
    
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    
    if (!topVideoSelect || !bottomVideoSelect) return;
    
    // Clear existing options (keep "None" option)
    topVideoSelect.innerHTML = '<option value="">None</option>';
    bottomVideoSelect.innerHTML = '<option value="">None</option>';
    
    // Add video options
    this.currentTab.videos.forEach(video => {
      const topOption = document.createElement('option');
      topOption.value = video.id;
      topOption.textContent = video.label;
      topVideoSelect.appendChild(topOption);
      
      const bottomOption = document.createElement('option');
      bottomOption.value = video.id;
      bottomOption.textContent = video.label;
      bottomVideoSelect.appendChild(bottomOption);
    });
    
    // Add change event listeners to prevent same video selection
    topVideoSelect.addEventListener('change', () => this.handleVideoSelectionChange());
    bottomVideoSelect.addEventListener('change', () => this.handleVideoSelectionChange());
  }

  private handleVideoSelectionChange(): void {
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    
    if (!topVideoSelect || !bottomVideoSelect) return;
    
    const topValue = topVideoSelect.value;
    const bottomValue = bottomVideoSelect.value;
    
    // If both selected and same, clear bottom selection
    if (topValue && bottomValue && topValue === bottomValue) {
      bottomVideoSelect.value = '';
    }
    
    this.updateVideoPlayers();
    this.updateChannelSelectors();
  }

  private async updateVideoPlayers(): Promise<void> {
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    
    if (!topVideoSelect || !bottomVideoSelect || !this.currentTab) return;
    
    try {
      const loadTasks: Promise<void>[] = [];

      // Handle top video
      if (topVideoSelect.value) {
        const topVideo = this.currentTab.videos.find(v => v.id === topVideoSelect.value);
        if (topVideo) {
          loadTasks.push(this.trackMediaLoad(() => this.videoManager.loadTopVideo(topVideo)));
        }
      } else {
        this.videoManager.unloadVideo('top');
      }
      
      // Handle bottom video
      if (bottomVideoSelect.value) {
        const bottomVideo = this.currentTab.videos.find(v => v.id === bottomVideoSelect.value);
        if (bottomVideo) {
          loadTasks.push(this.trackMediaLoad(() => this.videoManager.loadBottomVideo(bottomVideo)));
        }
      } else {
        this.videoManager.unloadVideo('bottom');
      }

      if (loadTasks.length) {
        await Promise.all(loadTasks);
      }
      
    } catch (error) {
      console.error('Error loading videos:', error);
      alert(`Failed to load video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // This method is no longer needed as VideoManager handles loading
  // private loadVideo(playerId: string, videoId: string): void { ... }

  private updateAudioGroups(): void {
    if (!this.currentTab) return;
    
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    if (!audioGroupSelect) return;
    
    // Clear existing options
    audioGroupSelect.innerHTML = '';
    
    // Add audio group options
    this.currentTab.audioGroups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.label;
      audioGroupSelect.appendChild(option);
    });
    
    // Add change event listener
    audioGroupSelect.addEventListener('change', () => {
      this.updateAudioTracks();
      this.updateChannelSelectors();
      this.loadSelectedGroupAudioTracks().then(() => {
        this.applyRoutingFromSelectors();
        this.updateAllVisualsPosition(0);
      }).catch(err => console.error(err));
    });
  }

  private updateAudioTracks(): void {
    if (!this.currentTab) return;
    
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    const audioTracksContainer = document.getElementById('audio-tracks');
    
    if (!audioGroupSelect || !audioTracksContainer) return;
    
    const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
    if (!selectedGroup) return;
    
    // Clear existing tracks
    audioTracksContainer.innerHTML = '';
    
    // Generate track elements
    selectedGroup.tracks.forEach(track => {
      const trackElement = this.createTrackElement(track);
      audioTracksContainer.appendChild(trackElement);
      // Ensure visuals render after element is in DOM
      this.updateTrackVisuals(track.id);
    });
  }

  private createTrackElement(track: any): HTMLElement {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'audio-track';
    trackDiv.dataset.trackId = track.id;
    
    trackDiv.innerHTML = `
      <div class="track-header">
        <span class="track-title">${track.label}</span>
        <div class="track-controls">
          <label>
            <input type="checkbox" class="waveform-toggle" checked>
            Waveform
          </label>
          <label>
            <input type="checkbox" class="spectrogram-toggle" checked>
            Spectrogram
          </label>
        </div>
      </div>
      <div class="track-visuals" id="visuals-${track.id}">
        <!-- Visualizations will be loaded here -->
      </div>
    `;
    
    // Add event listeners for visual toggles
    const waveformToggle = trackDiv.querySelector('.waveform-toggle') as HTMLInputElement;
    const spectrogramToggle = trackDiv.querySelector('.spectrogram-toggle') as HTMLInputElement;
    
    if (waveformToggle) {
      waveformToggle.addEventListener('change', () => this.updateTrackVisuals(track.id));
    }
    
    if (spectrogramToggle) {
      spectrogramToggle.addEventListener('change', () => this.updateTrackVisuals(track.id));
    }
    
    // Initial visuals are rendered after append in updateAudioTracks()
    
    return trackDiv;
  }

  private updateTrackVisuals(trackId: string): void {
    if (!this.currentTab) return;
    
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
    const track = selectedGroup?.tracks.find(t => t.id === trackId);
    
    if (!track) return;
    
    const visualsContainer = document.getElementById(`visuals-${trackId}`);
    const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
    
    if (!visualsContainer || !trackElement) return;
    
    const waveformToggle = trackElement.querySelector('.waveform-toggle') as HTMLInputElement;
    const spectrogramToggle = trackElement.querySelector('.spectrogram-toggle') as HTMLInputElement;
    
    // Clear existing visuals
    visualsContainer.innerHTML = '';
    const container = visualsContainer as HTMLElement;
    container.style.position = 'relative';
    // Fixed viewport: follow screen width; only show visible region
    container.style.width = '100%';
    container.style.minHeight = '0';
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'hidden';

    // Create a scrolling track wrapper that will be translated during playback.
    // Use absolute positioning so its large width does not affect layout sizing.
    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'visuals-track';
    trackWrapper.style.position = 'absolute';
    trackWrapper.style.left = '0';
    trackWrapper.style.top = '0';
    trackWrapper.style.transform = 'translateX(0px)';
    trackWrapper.style.willChange = 'transform';
    
    // Prepare decoded buffer once for dynamic rendering
    let bufferPromise: Promise<AudioBuffer> | null = null;
    const getBuf = () => {
      if (!bufferPromise) bufferPromise = this.ensureTrackBuffer(track.id, track.url);
      return bufferPromise;
    };

    // Add waveform if enabled
    if (waveformToggle?.checked) {
      const waveformImg = document.createElement('img');
      waveformImg.className = 'visual-image waveform-image';
      waveformImg.alt = `Waveform for ${track.label}`;
      // Fixed display size 4000×50
      waveformImg.style.display = 'block';
      waveformImg.style.width = '4000px';
      waveformImg.style.height = '50px';
      // Dynamic render from decoded buffer
      getBuf().then(buf => {
        const dataUrl = renderWaveformPng(buf, 4000, 50);
        waveformImg.src = dataUrl;
      }).catch(e => console.error('Waveform render failed', e));
      waveformImg.onload = () => {
        const prev = this.trackImageInfo.get(track.id);
        this.trackImageInfo.set(track.id, { imgEl: waveformImg, spectEl: prev?.spectEl || null, wrapperEl: trackWrapper });
        // Recompute position after image metrics are available
        const clock = this.audioEngine.getMasterClock();
        const t = this.isPlaying ? clock.currentTime : 0;
        this.positionWrapper(container, trackWrapper, t);
      };
      trackWrapper.appendChild(waveformImg);
    }
    
    // Add spectrogram if enabled
    if (spectrogramToggle?.checked) {
      const spectrogramImg = document.createElement('img');
      spectrogramImg.className = 'visual-image spectrogram-image';
      spectrogramImg.alt = `Spectrogram for ${track.label}`;
      spectrogramImg.style.marginTop = waveformToggle?.checked ? '5px' : '0';
      // Fixed display size 4000×200
      spectrogramImg.style.display = 'block';
      spectrogramImg.style.width = '4000px';
      spectrogramImg.style.height = '200px';
      // Dynamic render from decoded buffer
      getBuf().then(buf => {
        const dataUrl = renderSpectrogramPng(buf, 4000, 200);
        spectrogramImg.src = dataUrl;
      }).catch(e => console.error('Spectrogram render failed', e));
      spectrogramImg.onload = () => {
        const prev = this.trackImageInfo.get(track.id);
        this.trackImageInfo.set(track.id, { imgEl: prev?.imgEl || null, spectEl: spectrogramImg, wrapperEl: trackWrapper });
        // Recompute position after image metrics are available
        const clock = this.audioEngine.getMasterClock();
        const t = this.isPlaying ? clock.currentTime : 0;
        this.positionWrapper(container, trackWrapper, t);
      };
      trackWrapper.appendChild(spectrogramImg);
    }

    // Compute and set container height based on enabled visuals
    const hasWave = !!(waveformToggle?.checked);
    const hasSpect = !!(spectrogramToggle?.checked);
    const marginBetween = hasWave && hasSpect ? 5 : 0;
    const totalHeight = (hasWave ? 50 : 0) + (hasSpect ? 200 : 0) + marginBetween;
    if (totalHeight > 0) container.style.height = `${totalHeight}px`;
    else container.style.height = '0px';

    // Append wrapper to the container (after height is set)
    container.appendChild(trackWrapper);

    // Add a centered cursor overlay (playback progress line)
    const cursor = document.createElement('div');
    cursor.className = 'cursor-line';
    cursor.style.position = 'absolute';
    cursor.style.top = '0';
    cursor.style.bottom = '0';
    cursor.style.width = '2px';
    cursor.style.left = '50%';
    cursor.style.background = 'rgba(255,0,0,0.9)';
    cursor.style.pointerEvents = 'none';
    container.appendChild(cursor);

    // Set initial alignment: left edge under the centered cursor
    // If audio duration not yet available, center-align left edge directly.
    const dur = this.audioEngine.getMasterAudioDuration();
    if (dur && isFinite(dur) && dur > 0) {
      this.positionWrapper(container, trackWrapper, 0);
    } else {
      const center = container.clientWidth / 2;
      trackWrapper.style.transform = `translateX(${center}px)`;
    }
  }

  private updateChannelSelectors(): void {
    if (!this.currentTab) return;
    
    const leftChannelSelect = document.getElementById('left-channel') as HTMLSelectElement;
    const rightChannelSelect = document.getElementById('right-channel') as HTMLSelectElement;
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    
    if (!leftChannelSelect || !rightChannelSelect || !audioGroupSelect) return;
    
    // Clear existing options
    leftChannelSelect.innerHTML = '';
    rightChannelSelect.innerHTML = '';
    
    // Add audio track options
    const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
    if (selectedGroup) {
      selectedGroup.tracks.forEach(track => {
        const leftOption = document.createElement('option');
        leftOption.value = `audio:${track.id}`;
        leftOption.textContent = `🎵 ${track.label}`;
        leftChannelSelect.appendChild(leftOption);
        
        const rightOption = document.createElement('option');
        rightOption.value = `audio:${track.id}`;
        rightOption.textContent = `🎵 ${track.label}`;
        rightChannelSelect.appendChild(rightOption);
      });
    }
    
    // Add video track options (only for loaded MP4 videos)
    const activePlayers = this.videoManager.getActivePlayers();
    activePlayers.forEach(({ position, source }) => {
      if (source.type === 'mp4') {
        const leftOption = document.createElement('option');
        leftOption.value = `video:${position}`;
        leftOption.textContent = `📹 ${source.label} (${position === 'top' ? 'Top' : 'Bottom'})`;
        leftChannelSelect.appendChild(leftOption);
        
        const rightOption = document.createElement('option');
        rightOption.value = `video:${position}`;
        rightOption.textContent = `📹 ${source.label} (${position === 'top' ? 'Top' : 'Bottom'})`;
        rightChannelSelect.appendChild(rightOption);
      }
    });

    // Apply routing when user changes selection
    leftChannelSelect.addEventListener('change', () => this.applyRoutingFromSelectors());
    rightChannelSelect.addEventListener('change', () => this.applyRoutingFromSelectors());
  }

  private async loadSelectedGroupAudioTracks(): Promise<void> {
    if (!this.currentTab) return;
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    if (!audioGroupSelect) return;
    const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
    if (!selectedGroup) return;

    await this.trackMediaLoad(async () => {
      for (const t of selectedGroup.tracks) {
        try {
          await this.audioEngine.loadAudioTrack(t.id, t.url);
        } catch (e) {
          console.error(`Failed to load audio track ${t.id}`, e);
        }
      }
    });
  }

  private parseRoutingValue(value: string): { type: 'audio' | 'video'; id?: string; position?: 'top' | 'bottom' } | null {
    if (!value) return null;
    const [type, rest] = value.split(':');
    if (type === 'audio') return { type: 'audio', id: rest };
    if (type === 'video') return { type: 'video', position: rest as 'top' | 'bottom' };
    return null;
  }

  private applyRoutingFromSelectors(): void {
    const leftChannelSelect = document.getElementById('left-channel') as HTMLSelectElement;
    const rightChannelSelect = document.getElementById('right-channel') as HTMLSelectElement;
    if (!leftChannelSelect || !rightChannelSelect) return;

    const left = this.parseRoutingValue(leftChannelSelect.value);
    const right = this.parseRoutingValue(rightChannelSelect.value);

    this.audioEngine.setRouting({
      left: left ? (left.type === 'audio' ? { type: 'audio', id: left.id! } : { type: 'video', id: '', position: left.position }) : null,
      right: right ? (right.type === 'audio' ? { type: 'audio', id: right.id! } : { type: 'video', id: '', position: right.position }) : null,
    });
  }

  private startCursorLoop(): void {
    if (this.cursorRaf !== null) cancelAnimationFrame(this.cursorRaf);
    const tick = () => {
      const clock = this.audioEngine.getMasterClock();
      if (this.isPlaying) {
        this.videoManager.syncToMaster(clock.currentTime);
      }
      document.querySelectorAll('.track-visuals').forEach((containerEl) => {
        const container = containerEl as HTMLElement;
        const parent = container.closest('.audio-track') as HTMLElement | null;
        const trackId = parent?.dataset.trackId;
        if (!trackId) return;
        const info = this.trackImageInfo.get(trackId);
        if (!info) return;
        const wrapper = info.wrapperEl || (container.querySelector('.visuals-track') as HTMLDivElement | null);
        const refImg = info.imgEl || info.spectEl;
        if (!wrapper || !refImg) return;

        // Center cursor; move the wrapper according to current time
        const cursor = container.querySelector('.cursor-line') as HTMLDivElement | null;
        if (cursor) cursor.style.left = '50%';
        this.positionWrapper(container, wrapper, clock.currentTime);
      });
      this.cursorRaf = requestAnimationFrame(tick);
    };
    this.cursorRaf = requestAnimationFrame(tick);
  }

  // Compute and apply wrapper translation for a given time
  private positionWrapper(container: HTMLElement, wrapper: HTMLElement, timeSec: number): void {
    // Determine the track pixel width in CSS pixels (displayed width)
    const refImg = (wrapper.querySelector('img.visual-image') as HTMLImageElement) || null;
    const styleWidth = refImg ? parseInt(refImg.style.width || '0', 10) : 0;
    const trackWidth = refImg ? (refImg.clientWidth || styleWidth || refImg.width || refImg.naturalWidth || 0) : Math.max(wrapper.scrollWidth, wrapper.clientWidth, 0);
    if (!trackWidth) return;

    // Prefer master audio duration; if unavailable but time is 0, still center-align left edge
    const audioDuration = this.audioEngine.getMasterAudioDuration();
    if (!audioDuration || !isFinite(audioDuration) || audioDuration <= 0) {
      if (timeSec === 0) {
        const centerX0 = container.clientWidth / 2;
        wrapper.style.transform = `translateX(${centerX0}px)`;
      }
      return;
    }
    const clamped = Math.max(0, Math.min(timeSec, audioDuration));
    const x = (clamped / audioDuration) * trackWidth;

    const viewportWidth = container.clientWidth;
    const centerX = viewportWidth / 2;
    let tx = centerX - x;
    // Clamp translation: start -> left edge under center; end -> right edge under center
    const minTx = centerX - trackWidth; // at end
    const maxTx = centerX;              // at start
    tx = Math.max(minTx, Math.min(maxTx, tx));
    wrapper.style.transform = `translateX(${tx}px)`;
  }

  // Update all visible wrappers to reflect a given time
  private updateAllVisualsPosition(timeSec: number): void {
    document.querySelectorAll('.track-visuals').forEach((containerEl) => {
      const container = containerEl as HTMLElement;
      const wrapper = container.querySelector('.visuals-track') as HTMLDivElement | null;
      if (!wrapper) return;
      const parent = container.closest('.audio-track') as HTMLElement | null;
      const trackId = parent?.dataset.trackId;
      if (!trackId) return;
      this.positionWrapper(container, wrapper, timeSec);
    });
  }

  private applyDefaults(): void {
    if (!this.currentTab) return;
    
    const defaults = this.currentTab.defaults;
    
    // Apply video defaults
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    
    if (topVideoSelect && defaults.topVideoId) {
      topVideoSelect.value = defaults.topVideoId;
    }
    if (bottomVideoSelect && defaults.bottomVideoId) {
      bottomVideoSelect.value = defaults.bottomVideoId || '';
    }
    
    // Apply audio group default
    const audioGroupSelect = document.getElementById('audio-group') as HTMLSelectElement;
    if (audioGroupSelect && defaults.audioGroupId) {
      audioGroupSelect.value = defaults.audioGroupId;
    }
    
    // Update dependent UI elements
    void this.updateVideoPlayers();
    this.updateAudioTracks();
    this.updateChannelSelectors();
    
    // Apply routing defaults
    setTimeout(() => {
      const leftChannelSelect = document.getElementById('left-channel') as HTMLSelectElement;
      const rightChannelSelect = document.getElementById('right-channel') as HTMLSelectElement;
      
      if (leftChannelSelect && defaults.routing.left) {
        const leftValue = defaults.routing.left.type === 'audio' 
          ? `audio:${defaults.routing.left.id}`
          : `video:${defaults.routing.left.position}`;
        leftChannelSelect.value = leftValue;
      }
      
      if (rightChannelSelect && defaults.routing.right) {
        const rightValue = defaults.routing.right.type === 'audio'
          ? `audio:${defaults.routing.right.id}`
          : `video:${defaults.routing.right.position}`;
        rightChannelSelect.value = rightValue;
      }
      this.applyRoutingFromSelectors();
    }, 100);
  }

  private beginMediaLoad(): void {
    this.pendingMediaLoads += 1;
    this.updatePlayPauseButton();
  }

  private endMediaLoad(): void {
    if (this.pendingMediaLoads > 0) {
      this.pendingMediaLoads -= 1;
    }
    this.updatePlayPauseButton();
  }

  private isMediaLoading(): boolean {
    return this.pendingMediaLoads > 0;
  }

  private async trackMediaLoad<T>(load: () => Promise<T>): Promise<T> {
    this.beginMediaLoad();
    try {
      return await load();
    } finally {
      this.endMediaLoad();
    }
  }

  private setDropdownsDisabled(disabled: boolean): void {
    document.querySelectorAll('select').forEach((element) => {
      (element as HTMLSelectElement).disabled = disabled;
    });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MusicPlayerApp();
});
