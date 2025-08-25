import { ConfigLoader } from './config/loader.js';
import { Config, Tab } from './config/types.js';

class MusicPlayerApp {
  private config: Config | null = null;
  private currentTab: Tab | null = null;
  private configLoader: ConfigLoader;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.showLoading(true);
      
      // Parse URL parameters
      const { piece } = ConfigLoader.parseUrlParams();
      
      if (!piece) {
        throw new Error('No piece specified. Please add ?piece=<folder-name> to URL');
      }
      
      // Load config
      this.config = await this.configLoader.loadPieceConfig(piece);
      
      // Update UI
      this.updatePieceInfo(piece);
      this.generateTabs();
      this.switchToTab(this.config.defaultTab || this.config.tabs[0].id);
      
      this.showLoading(false);
      
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
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
    
    // Generate tab buttons
    this.config.tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.className = 'tab';
      tabButton.textContent = tab.title;
      tabButton.dataset.tabId = tab.id;
      
      tabButton.addEventListener('click', () => {
        this.switchToTab(tab.id);
      });
      
      tabNavEl.appendChild(tabButton);
    });
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

  private updateVideoPlayers(): void {
    const topVideoSelect = document.getElementById('top-video') as HTMLSelectElement;
    const bottomVideoSelect = document.getElementById('bottom-video') as HTMLSelectElement;
    const topContainer = document.getElementById('top-video-container');
    const bottomContainer = document.getElementById('bottom-video-container');
    
    if (!topVideoSelect || !bottomVideoSelect || !topContainer || !bottomContainer) return;
    
    // Show/hide video containers based on selection
    if (topVideoSelect.value) {
      topContainer.classList.remove('hidden');
      this.loadVideo('top-video-player', topVideoSelect.value);
    } else {
      topContainer.classList.add('hidden');
    }
    
    if (bottomVideoSelect.value) {
      bottomContainer.classList.remove('hidden');
      this.loadVideo('bottom-video-player', bottomVideoSelect.value);
    } else {
      bottomContainer.classList.add('hidden');
    }
  }

  private loadVideo(playerId: string, videoId: string): void {
    if (!this.currentTab) return;
    
    const video = this.currentTab.videos.find(v => v.id === videoId);
    const videoPlayer = document.getElementById(playerId) as HTMLVideoElement;
    
    if (!video || !videoPlayer) return;
    
    if (video.type === 'mp4') {
      videoPlayer.src = video.url;
      videoPlayer.style.display = 'block';
      // TODO: Hide any YouTube iframe if exists
    } else if (video.type === 'youtube') {
      // TODO: Implement YouTube iframe player
      console.warn('YouTube videos not yet implemented');
    }
  }

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
            <input type="checkbox" class="waveform-toggle" ${track.images.waveform ? 'checked' : ''}>
            Waveform
          </label>
          <label>
            <input type="checkbox" class="spectrogram-toggle" ${track.images.spectrogram ? 'checked' : ''}>
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
    
    // Load initial visuals
    this.updateTrackVisuals(track.id);
    
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
    
    // Add waveform if enabled and available
    if (waveformToggle?.checked && track.images.waveform) {
      const waveformImg = document.createElement('img');
      waveformImg.src = track.images.waveform;
      waveformImg.className = 'visual-image waveform-image';
      waveformImg.alt = `Waveform for ${track.label}`;
      visualsContainer.appendChild(waveformImg);
    }
    
    // Add spectrogram if enabled and available
    if (spectrogramToggle?.checked && track.images.spectrogram) {
      const spectrogramImg = document.createElement('img');
      spectrogramImg.src = track.images.spectrogram;
      spectrogramImg.className = 'visual-image spectrogram-image';
      spectrogramImg.alt = `Spectrogram for ${track.label}`;
      spectrogramImg.style.marginTop = waveformToggle?.checked ? '5px' : '0';
      visualsContainer.appendChild(spectrogramImg);
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
    
    // Add video track options (only for playing videos)
    if (topVideoSelect?.value) {
      const topVideo = this.currentTab.videos.find(v => v.id === topVideoSelect.value);
      if (topVideo && topVideo.type === 'mp4') {
        const leftOption = document.createElement('option');
        leftOption.value = `video:top`;
        leftOption.textContent = `📹 ${topVideo.label} (Top)`;
        leftChannelSelect.appendChild(leftOption);
        
        const rightOption = document.createElement('option');
        rightOption.value = `video:top`;
        rightOption.textContent = `📹 ${topVideo.label} (Top)`;
        rightChannelSelect.appendChild(rightOption);
      }
    }
    
    if (bottomVideoSelect?.value) {
      const bottomVideo = this.currentTab.videos.find(v => v.id === bottomVideoSelect.value);
      if (bottomVideo && bottomVideo.type === 'mp4') {
        const leftOption = document.createElement('option');
        leftOption.value = `video:bottom`;
        leftOption.textContent = `📹 ${bottomVideo.label} (Bottom)`;
        leftChannelSelect.appendChild(leftOption);
        
        const rightOption = document.createElement('option');
        rightOption.value = `video:bottom`;
        rightOption.textContent = `📹 ${bottomVideo.label} (Bottom)`;
        rightChannelSelect.appendChild(rightOption);
      }
    }
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
    this.updateVideoPlayers();
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
    }, 100);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MusicPlayerApp();
});