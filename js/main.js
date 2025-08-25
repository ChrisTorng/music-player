import { ConfigLoader } from './config/loader.js';
class MusicPlayerApp {
    constructor() {
        this.config = null;
        this.currentTab = null;
        this.configLoader = new ConfigLoader();
        this.init();
    }
    async init() {
        try {
            this.showLoading(true);
            const { piece } = ConfigLoader.parseUrlParams();
            if (!piece) {
                throw new Error('No piece specified. Please add ?piece=<folder-name> to URL');
            }
            this.config = await this.configLoader.loadPieceConfig(piece);
            this.updatePieceInfo(piece);
            this.generateTabs();
            this.switchToTab(this.config.defaultTab || this.config.tabs[0].id);
            this.showLoading(false);
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }
    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
        }
    }
    showError(message) {
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
                errorEl.style.display = 'none';
                this.init();
            };
        }
    }
    updatePieceInfo(pieceName) {
        const pieceInfoEl = document.getElementById('piece-info');
        if (pieceInfoEl) {
            pieceInfoEl.textContent = `Current Piece: ${pieceName}`;
        }
    }
    generateTabs() {
        if (!this.config)
            return;
        const tabNavEl = document.getElementById('tab-nav');
        if (!tabNavEl)
            return;
        tabNavEl.innerHTML = '';
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
    switchToTab(tabId) {
        if (!this.config)
            return;
        const tab = this.config.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.warn(`Tab with id "${tabId}" not found`);
            return;
        }
        this.currentTab = tab;
        document.querySelectorAll('.tab').forEach(tabBtn => {
            tabBtn.classList.remove('active');
            if (tabBtn.dataset.tabId === tabId) {
                tabBtn.classList.add('active');
            }
        });
        this.updateVideoSelectors();
        this.updateAudioGroups();
        this.applyDefaults();
    }
    updateVideoSelectors() {
        if (!this.currentTab)
            return;
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        if (!topVideoSelect || !bottomVideoSelect)
            return;
        topVideoSelect.innerHTML = '<option value="">None</option>';
        bottomVideoSelect.innerHTML = '<option value="">None</option>';
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
        topVideoSelect.addEventListener('change', () => this.handleVideoSelectionChange());
        bottomVideoSelect.addEventListener('change', () => this.handleVideoSelectionChange());
    }
    handleVideoSelectionChange() {
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        if (!topVideoSelect || !bottomVideoSelect)
            return;
        const topValue = topVideoSelect.value;
        const bottomValue = bottomVideoSelect.value;
        if (topValue && bottomValue && topValue === bottomValue) {
            bottomVideoSelect.value = '';
        }
        this.updateVideoPlayers();
        this.updateChannelSelectors();
    }
    updateVideoPlayers() {
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        const topContainer = document.getElementById('top-video-container');
        const bottomContainer = document.getElementById('bottom-video-container');
        if (!topVideoSelect || !bottomVideoSelect || !topContainer || !bottomContainer)
            return;
        if (topVideoSelect.value) {
            topContainer.classList.remove('hidden');
            this.loadVideo('top-video-player', topVideoSelect.value);
        }
        else {
            topContainer.classList.add('hidden');
        }
        if (bottomVideoSelect.value) {
            bottomContainer.classList.remove('hidden');
            this.loadVideo('bottom-video-player', bottomVideoSelect.value);
        }
        else {
            bottomContainer.classList.add('hidden');
        }
    }
    loadVideo(playerId, videoId) {
        if (!this.currentTab)
            return;
        const video = this.currentTab.videos.find(v => v.id === videoId);
        const videoPlayer = document.getElementById(playerId);
        if (!video || !videoPlayer)
            return;
        if (video.type === 'mp4') {
            videoPlayer.src = video.url;
            videoPlayer.style.display = 'block';
        }
        else if (video.type === 'youtube') {
            console.warn('YouTube videos not yet implemented');
        }
    }
    updateAudioGroups() {
        if (!this.currentTab)
            return;
        const audioGroupSelect = document.getElementById('audio-group');
        if (!audioGroupSelect)
            return;
        audioGroupSelect.innerHTML = '';
        this.currentTab.audioGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.label;
            audioGroupSelect.appendChild(option);
        });
        audioGroupSelect.addEventListener('change', () => {
            this.updateAudioTracks();
            this.updateChannelSelectors();
        });
    }
    updateAudioTracks() {
        if (!this.currentTab)
            return;
        const audioGroupSelect = document.getElementById('audio-group');
        const audioTracksContainer = document.getElementById('audio-tracks');
        if (!audioGroupSelect || !audioTracksContainer)
            return;
        const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
        if (!selectedGroup)
            return;
        audioTracksContainer.innerHTML = '';
        selectedGroup.tracks.forEach(track => {
            const trackElement = this.createTrackElement(track);
            audioTracksContainer.appendChild(trackElement);
        });
    }
    createTrackElement(track) {
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
        const waveformToggle = trackDiv.querySelector('.waveform-toggle');
        const spectrogramToggle = trackDiv.querySelector('.spectrogram-toggle');
        if (waveformToggle) {
            waveformToggle.addEventListener('change', () => this.updateTrackVisuals(track.id));
        }
        if (spectrogramToggle) {
            spectrogramToggle.addEventListener('change', () => this.updateTrackVisuals(track.id));
        }
        this.updateTrackVisuals(track.id);
        return trackDiv;
    }
    updateTrackVisuals(trackId) {
        if (!this.currentTab)
            return;
        const audioGroupSelect = document.getElementById('audio-group');
        const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
        const track = selectedGroup?.tracks.find(t => t.id === trackId);
        if (!track)
            return;
        const visualsContainer = document.getElementById(`visuals-${trackId}`);
        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (!visualsContainer || !trackElement)
            return;
        const waveformToggle = trackElement.querySelector('.waveform-toggle');
        const spectrogramToggle = trackElement.querySelector('.spectrogram-toggle');
        visualsContainer.innerHTML = '';
        if (waveformToggle?.checked && track.images.waveform) {
            const waveformImg = document.createElement('img');
            waveformImg.src = track.images.waveform;
            waveformImg.className = 'visual-image waveform-image';
            waveformImg.alt = `Waveform for ${track.label}`;
            visualsContainer.appendChild(waveformImg);
        }
        if (spectrogramToggle?.checked && track.images.spectrogram) {
            const spectrogramImg = document.createElement('img');
            spectrogramImg.src = track.images.spectrogram;
            spectrogramImg.className = 'visual-image spectrogram-image';
            spectrogramImg.alt = `Spectrogram for ${track.label}`;
            spectrogramImg.style.marginTop = waveformToggle?.checked ? '5px' : '0';
            visualsContainer.appendChild(spectrogramImg);
        }
    }
    updateChannelSelectors() {
        if (!this.currentTab)
            return;
        const leftChannelSelect = document.getElementById('left-channel');
        const rightChannelSelect = document.getElementById('right-channel');
        const audioGroupSelect = document.getElementById('audio-group');
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        if (!leftChannelSelect || !rightChannelSelect || !audioGroupSelect)
            return;
        leftChannelSelect.innerHTML = '';
        rightChannelSelect.innerHTML = '';
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
    applyDefaults() {
        if (!this.currentTab)
            return;
        const defaults = this.currentTab.defaults;
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        if (topVideoSelect && defaults.topVideoId) {
            topVideoSelect.value = defaults.topVideoId;
        }
        if (bottomVideoSelect && defaults.bottomVideoId) {
            bottomVideoSelect.value = defaults.bottomVideoId || '';
        }
        const audioGroupSelect = document.getElementById('audio-group');
        if (audioGroupSelect && defaults.audioGroupId) {
            audioGroupSelect.value = defaults.audioGroupId;
        }
        this.updateVideoPlayers();
        this.updateAudioTracks();
        this.updateChannelSelectors();
        setTimeout(() => {
            const leftChannelSelect = document.getElementById('left-channel');
            const rightChannelSelect = document.getElementById('right-channel');
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
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayerApp();
});
//# sourceMappingURL=main.js.map