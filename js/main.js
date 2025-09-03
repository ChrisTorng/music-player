import { ConfigLoader } from './config/loader.js';
import { VideoManager } from './video/manager.js';
import { AudioEngine } from './audio/engine.js';
class MusicPlayerApp {
    constructor() {
        this.config = null;
        this.currentTab = null;
        this.isPlaying = false;
        this.cursorRaf = null;
        this.pieceName = '';
        this.configLoader = new ConfigLoader();
        this.videoManager = new VideoManager();
        this.audioEngine = new AudioEngine();
        this.trackImageInfo = new Map();
        this.init();
    }
    async init() {
        try {
            this.showLoading(true);
            const { piece, tab } = ConfigLoader.parseUrlParams();
            if (!piece) {
                throw new Error('No piece specified. Please add ?piece=<folder-name> to URL');
            }
            this.config = await this.configLoader.loadPieceConfig(piece);
            this.pieceName = piece;
            await this.audioEngine.initialize();
            this.updatePieceInfo(piece);
            this.generateTabs();
            this.setupGlobalControls();
            const availableTabIds = new Set(this.config.tabs.map(t => t.id));
            const initialTab = (tab && availableTabIds.has(tab)) ? tab : (this.config.defaultTab || this.config.tabs[0].id);
            this.switchToTab(initialTab);
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
            const a = document.createElement('a');
            a.className = 'tab';
            a.textContent = tab.title;
            a.dataset.tabId = tab.id;
            const url = new URL(window.location.href);
            if (this.pieceName) {
                url.searchParams.set('piece', this.pieceName);
            }
            url.searchParams.set('tab', tab.id);
            a.href = url.toString();
            tabNavEl.appendChild(a);
        });
    }
    setupGlobalControls() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        this.videoManager.onTimeUpdateCallback((_currentTime, _source) => {
        });
        this.videoManager.onPlayCallback((source) => {
            console.log(`Play from ${source}`);
            this.updatePlayPauseButton();
        });
        this.videoManager.onPauseCallback((source) => {
            console.log(`Pause from ${source}`);
            this.updatePlayPauseButton();
        });
    }
    async togglePlayPause() {
        try {
            if (this.videoManager.isAnyPlaying()) {
                this.videoManager.pauseAll();
                this.audioEngine.pauseAll();
                this.isPlaying = false;
            }
            else {
                await this.audioEngine.resume();
                await this.audioEngine.playAll();
                await this.videoManager.playAll();
                this.isPlaying = true;
                this.startCursorLoop();
            }
            this.updatePlayPauseButton();
        }
        catch (error) {
            console.error('Playback error:', error);
            if (error instanceof Error && error.message.includes('play')) {
                alert('Please click play again to start playback. Browser autoplay restrictions may apply.');
            }
        }
    }
    updatePlayPauseButton() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            const isPlaying = this.videoManager.isAnyPlaying();
            playPauseBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
        }
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
        this.loadSelectedGroupAudioTracks().then(() => {
            this.applyRoutingFromSelectors();
        }).catch(err => console.error('Audio preload failed:', err));
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
    async updateVideoPlayers() {
        const topVideoSelect = document.getElementById('top-video');
        const bottomVideoSelect = document.getElementById('bottom-video');
        if (!topVideoSelect || !bottomVideoSelect || !this.currentTab)
            return;
        try {
            if (topVideoSelect.value) {
                const topVideo = this.currentTab.videos.find(v => v.id === topVideoSelect.value);
                if (topVideo) {
                    await this.videoManager.loadTopVideo(topVideo);
                }
            }
            else {
                this.videoManager.unloadVideo('top');
            }
            if (bottomVideoSelect.value) {
                const bottomVideo = this.currentTab.videos.find(v => v.id === bottomVideoSelect.value);
                if (bottomVideo) {
                    await this.videoManager.loadBottomVideo(bottomVideo);
                }
            }
            else {
                this.videoManager.unloadVideo('bottom');
            }
        }
        catch (error) {
            console.error('Error loading videos:', error);
            alert(`Failed to load video: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            this.loadSelectedGroupAudioTracks().then(() => this.applyRoutingFromSelectors()).catch(err => console.error(err));
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
            this.updateTrackVisuals(track.id);
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
        visualsContainer.style.position = 'relative';
        if (waveformToggle?.checked && track.images.waveform) {
            const waveformImg = document.createElement('img');
            waveformImg.src = track.images.waveform;
            waveformImg.className = 'visual-image waveform-image';
            waveformImg.alt = `Waveform for ${track.label}`;
            waveformImg.style.display = 'block';
            waveformImg.onload = () => {
                const prev = this.trackImageInfo.get(track.id);
                this.trackImageInfo.set(track.id, { pxPerSecond: track.images.pxPerSecond, imgEl: waveformImg, spectEl: prev?.spectEl || null });
            };
            visualsContainer.appendChild(waveformImg);
        }
        if (spectrogramToggle?.checked && track.images.spectrogram) {
            const spectrogramImg = document.createElement('img');
            spectrogramImg.src = track.images.spectrogram;
            spectrogramImg.className = 'visual-image spectrogram-image';
            spectrogramImg.alt = `Spectrogram for ${track.label}`;
            spectrogramImg.style.marginTop = waveformToggle?.checked ? '5px' : '0';
            spectrogramImg.style.display = 'block';
            spectrogramImg.onload = () => {
                const prev = this.trackImageInfo.get(track.id);
                this.trackImageInfo.set(track.id, { pxPerSecond: track.images.pxPerSecond, imgEl: prev?.imgEl || null, spectEl: spectrogramImg });
            };
            visualsContainer.appendChild(spectrogramImg);
        }
        const cursor = document.createElement('div');
        cursor.className = 'cursor-line';
        cursor.style.position = 'absolute';
        cursor.style.top = '0';
        cursor.style.bottom = '0';
        cursor.style.width = '2px';
        cursor.style.left = '0';
        cursor.style.background = 'rgba(255,0,0,0.9)';
        cursor.style.pointerEvents = 'none';
        visualsContainer.appendChild(cursor);
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
        leftChannelSelect.addEventListener('change', () => this.applyRoutingFromSelectors());
        rightChannelSelect.addEventListener('change', () => this.applyRoutingFromSelectors());
    }
    async loadSelectedGroupAudioTracks() {
        if (!this.currentTab)
            return;
        const audioGroupSelect = document.getElementById('audio-group');
        if (!audioGroupSelect)
            return;
        const selectedGroup = this.currentTab.audioGroups.find(g => g.id === audioGroupSelect.value);
        if (!selectedGroup)
            return;
        for (const t of selectedGroup.tracks) {
            try {
                await this.audioEngine.loadAudioTrack(t.id, t.url);
            }
            catch (e) {
                console.error(`Failed to load audio track ${t.id}`, e);
            }
        }
    }
    parseRoutingValue(value) {
        if (!value)
            return null;
        const [type, rest] = value.split(':');
        if (type === 'audio')
            return { type: 'audio', id: rest };
        if (type === 'video')
            return { type: 'video', position: rest };
        return null;
    }
    applyRoutingFromSelectors() {
        const leftChannelSelect = document.getElementById('left-channel');
        const rightChannelSelect = document.getElementById('right-channel');
        if (!leftChannelSelect || !rightChannelSelect)
            return;
        const left = this.parseRoutingValue(leftChannelSelect.value);
        const right = this.parseRoutingValue(rightChannelSelect.value);
        this.audioEngine.setRouting({
            left: left ? (left.type === 'audio' ? { type: 'audio', id: left.id } : { type: 'video', id: '', position: left.position }) : null,
            right: right ? (right.type === 'audio' ? { type: 'audio', id: right.id } : { type: 'video', id: '', position: right.position }) : null,
        });
    }
    startCursorLoop() {
        if (this.cursorRaf !== null)
            cancelAnimationFrame(this.cursorRaf);
        const tick = () => {
            const clock = this.audioEngine.getMasterClock();
            document.querySelectorAll('.track-visuals').forEach((containerEl) => {
                const container = containerEl;
                const parent = container.closest('.audio-track');
                const trackId = parent?.dataset.trackId;
                if (!trackId)
                    return;
                const info = this.trackImageInfo.get(trackId);
                const cursor = container.querySelector('.cursor-line');
                if (!info || !cursor)
                    return;
                const refImg = info.imgEl || info.spectEl;
                if (!refImg || refImg.naturalWidth === 0)
                    return;
                const scale = refImg.clientWidth / refImg.naturalWidth;
                const pxPerSecDisplayed = info.pxPerSecond * scale;
                const x = Math.max(0, clock.currentTime * pxPerSecDisplayed);
                cursor.style.left = `${x}px`;
            });
            this.cursorRaf = requestAnimationFrame(tick);
        };
        this.cursorRaf = requestAnimationFrame(tick);
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
            this.applyRoutingFromSelectors();
        }, 100);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayerApp();
});
//# sourceMappingURL=main.js.map