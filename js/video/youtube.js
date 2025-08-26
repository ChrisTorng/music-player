export class YouTubePlayer {
    constructor(containerId, videoUrl) {
        this.player = null;
        this.containerId = containerId;
        this.videoId = this.extractVideoId(videoUrl);
        this.loadYouTubeAPI();
    }
    extractVideoId(url) {
        const regexps = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /^([a-zA-Z0-9_-]{11})$/
        ];
        for (const regexp of regexps) {
            const match = url.match(regexp);
            if (match)
                return match[1];
        }
        throw new Error(`Invalid YouTube URL: ${url}`);
    }
    async loadYouTubeAPI() {
        return new Promise((resolve) => {
            if (window.YT && window.YT.Player) {
                this.initializePlayer();
                resolve();
                return;
            }
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                window.onYouTubeIframeAPIReady = () => {
                    this.initializePlayer();
                    resolve();
                };
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                document.head.appendChild(script);
            }
            else {
                const checkAPI = () => {
                    if (window.YT && window.YT.Player) {
                        this.initializePlayer();
                        resolve();
                    }
                    else {
                        setTimeout(checkAPI, 100);
                    }
                };
                checkAPI();
            }
        });
    }
    initializePlayer() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with id "${this.containerId}" not found`);
            return;
        }
        container.innerHTML = '';
        this.player = new window.YT.Player(this.containerId, {
            width: '100%',
            height: '100%',
            videoId: this.videoId,
            playerVars: {
                controls: 1,
                disablekb: 0,
                enablejsapi: 1,
                fs: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                modestbranding: 1
            },
            events: {
                onReady: (event) => this.onPlayerReady(event),
                onStateChange: (event) => this.onPlayerStateChange(event)
            }
        });
    }
    onPlayerReady(event) {
        console.log('YouTube player ready');
        const duration = this.player.getDuration();
        this.onLoadedMetadata?.(duration);
    }
    onPlayerStateChange(event) {
        const state = event.data;
        switch (state) {
            case window.YT.PlayerState.PLAYING:
                this.startTimeUpdateLoop();
                this.onPlay?.();
                break;
            case window.YT.PlayerState.PAUSED:
                this.stopTimeUpdateLoop();
                this.onPause?.();
                break;
            case window.YT.PlayerState.ENDED:
                this.stopTimeUpdateLoop();
                this.onEnded?.();
                break;
        }
    }
    startTimeUpdateLoop() {
        this.stopTimeUpdateLoop();
        this.timeUpdateInterval = window.setInterval(() => {
            if (this.player && this.onTimeUpdate) {
                const currentTime = this.player.getCurrentTime();
                this.onTimeUpdate(currentTime);
            }
        }, 100);
    }
    stopTimeUpdateLoop() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = undefined;
        }
    }
    async load(url) {
        this.videoId = this.extractVideoId(url);
        if (this.player && this.player.loadVideoById) {
            this.player.loadVideoById(this.videoId);
            return Promise.resolve();
        }
        else {
            await this.loadYouTubeAPI();
        }
    }
    async play() {
        if (this.player && this.player.playVideo) {
            this.player.playVideo();
        }
    }
    pause() {
        if (this.player && this.player.pauseVideo) {
            this.player.pauseVideo();
        }
    }
    seek(time) {
        if (this.player && this.player.seekTo) {
            this.player.seekTo(time, true);
        }
    }
    getCurrentTime() {
        return this.player && this.player.getCurrentTime ? this.player.getCurrentTime() : 0;
    }
    getDuration() {
        return this.player && this.player.getDuration ? this.player.getDuration() : 0;
    }
    isPaused() {
        if (!this.player || !this.player.getPlayerState)
            return true;
        const state = this.player.getPlayerState();
        return state !== window.YT.PlayerState.PLAYING;
    }
    isEnded() {
        if (!this.player || !this.player.getPlayerState)
            return false;
        return this.player.getPlayerState() === window.YT.PlayerState.ENDED;
    }
    setVolume(volume) {
        if (this.player && this.player.setVolume) {
            this.player.setVolume(Math.max(0, Math.min(100, volume * 100)));
        }
    }
    getVolume() {
        return this.player && this.player.getVolume ? this.player.getVolume() / 100 : 1;
    }
    mute(muted) {
        if (this.player) {
            if (muted && this.player.mute) {
                this.player.mute();
            }
            else if (!muted && this.player.unMute) {
                this.player.unMute();
            }
        }
    }
    isMuted() {
        return this.player && this.player.isMuted ? this.player.isMuted() : false;
    }
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
        }
    }
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    destroy() {
        this.stopTimeUpdateLoop();
        if (this.player && this.player.destroy) {
            this.player.destroy();
        }
        this.player = null;
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
//# sourceMappingURL=youtube.js.map