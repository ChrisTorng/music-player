export class NativeVideoPlayer {
    constructor(videoElement) {
        this.video = videoElement;
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.video.addEventListener('timeupdate', () => {
            this.onTimeUpdate?.(this.video.currentTime);
        });
        this.video.addEventListener('loadedmetadata', () => {
            this.onLoadedMetadata?.(this.video.duration);
        });
        this.video.addEventListener('play', () => {
            this.onPlay?.();
        });
        this.video.addEventListener('pause', () => {
            this.onPause?.();
        });
        this.video.addEventListener('ended', () => {
            this.onEnded?.();
        });
        this.video.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }
    async load(url) {
        return new Promise((resolve, reject) => {
            const onCanPlay = () => {
                this.video.removeEventListener('canplay', onCanPlay);
                this.video.removeEventListener('error', onError);
                resolve();
            };
            const onError = () => {
                this.video.removeEventListener('canplay', onCanPlay);
                this.video.removeEventListener('error', onError);
                reject(new Error(`Failed to load video: ${url}`));
            };
            this.video.addEventListener('canplay', onCanPlay);
            this.video.addEventListener('error', onError);
            this.video.src = url;
            this.video.load();
        });
    }
    async play() {
        try {
            await this.video.play();
        }
        catch (error) {
            console.error('Video play error:', error);
            throw error;
        }
    }
    pause() {
        this.video.pause();
    }
    seek(time) {
        this.video.currentTime = Math.max(0, Math.min(time, this.video.duration || 0));
    }
    getCurrentTime() {
        return this.video.currentTime;
    }
    getDuration() {
        return this.video.duration || 0;
    }
    isPaused() {
        return this.video.paused;
    }
    isEnded() {
        return this.video.ended;
    }
    setVolume(volume) {
        this.video.volume = Math.max(0, Math.min(1, volume));
    }
    getVolume() {
        return this.video.volume;
    }
    mute(muted) {
        this.video.muted = muted;
    }
    isMuted() {
        return this.video.muted;
    }
    show() {
        this.video.style.display = 'block';
    }
    hide() {
        this.video.style.display = 'none';
    }
    destroy() {
        this.video.pause();
        this.video.src = '';
        this.video.load();
    }
    onTimeUpdateCallback(callback) {
        this.onTimeUpdate = callback;
    }
    onLoadedMetadataCallback(callback) {
        this.onLoadedMetadata = callback;
    }
    onPlayCallback(callback) {
        this.onPlay = callback;
    }
    onPauseCallback(callback) {
        this.onPause = callback;
    }
    onEndedCallback(callback) {
        this.onEnded = callback;
    }
}
//# sourceMappingURL=native.js.map