import { NativeVideoPlayer } from './native.js';
import { YouTubePlayer } from './youtube.js';
export class VideoManager {
    constructor() {
        this.topPlayer = null;
        this.bottomPlayer = null;
        this.topVideoSource = null;
        this.bottomVideoSource = null;
        this.setupContainers();
    }
    setupContainers() {
        const topContainer = document.getElementById('top-video-container');
        const bottomContainer = document.getElementById('bottom-video-container');
        if (topContainer) {
            topContainer.classList.add('hidden');
        }
        if (bottomContainer) {
            bottomContainer.classList.add('hidden');
        }
    }
    async loadTopVideo(videoSource) {
        await this.loadVideo('top', videoSource);
    }
    async loadBottomVideo(videoSource) {
        await this.loadVideo('bottom', videoSource);
    }
    async loadVideo(position, videoSource) {
        const containerId = position === 'top' ? 'top-video-container' : 'bottom-video-container';
        const playerId = position === 'top' ? 'top-video-player' : 'bottom-video-player';
        if (position === 'top' && this.topPlayer) {
            this.topPlayer.destroy();
            this.topPlayer = null;
        }
        else if (position === 'bottom' && this.bottomPlayer) {
            this.bottomPlayer.destroy();
            this.bottomPlayer = null;
        }
        let player;
        if (videoSource.type === 'mp4') {
            const videoElement = document.getElementById(playerId);
            if (!videoElement) {
                throw new Error(`Video element ${playerId} not found`);
            }
            const container = document.getElementById(containerId);
            const youtubeDiv = document.getElementById(`${playerId}-youtube`);
            if (youtubeDiv) {
                youtubeDiv.remove();
            }
            videoElement.style.display = 'block';
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            player = new NativeVideoPlayer(videoElement);
            await player.load(videoSource.url);
            player.mute(true);
        }
        else if (videoSource.type === 'youtube') {
            const container = document.getElementById(containerId);
            const existingVideo = document.getElementById(playerId);
            if (container && existingVideo) {
                existingVideo.style.display = 'none';
                const youtubeDiv = document.createElement('div');
                youtubeDiv.id = `${playerId}-youtube`;
                youtubeDiv.style.width = '100%';
                youtubeDiv.style.height = '100%';
                container.appendChild(youtubeDiv);
                player = new YouTubePlayer(youtubeDiv.id, videoSource.url);
                await player.load(videoSource.url);
                player.mute(true);
            }
            else {
                throw new Error(`Container ${containerId} not found`);
            }
        }
        else {
            throw new Error(`Unsupported video type: ${videoSource.type}`);
        }
        player.onTimeUpdateCallback((currentTime) => {
            this.onTimeUpdate?.(currentTime, position);
        });
        player.onPlayCallback(() => {
            this.onPlay?.(position);
        });
        player.onPauseCallback(() => {
            this.onPause?.(position);
        });
        if (position === 'top') {
            this.topPlayer = player;
            this.topVideoSource = videoSource;
        }
        else {
            this.bottomPlayer = player;
            this.bottomVideoSource = videoSource;
        }
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.remove('hidden');
        }
    }
    unloadVideo(position) {
        const containerId = position === 'top' ? 'top-video-container' : 'bottom-video-container';
        const playerId = position === 'top' ? 'top-video-player' : 'bottom-video-player';
        if (position === 'top' && this.topPlayer) {
            this.topPlayer.destroy();
            this.topPlayer = null;
            this.topVideoSource = null;
        }
        else if (position === 'bottom' && this.bottomPlayer) {
            this.bottomPlayer.destroy();
            this.bottomPlayer = null;
            this.bottomVideoSource = null;
        }
        const youtubeDiv = document.getElementById(`${playerId}-youtube`);
        if (youtubeDiv) {
            youtubeDiv.remove();
        }
        const videoElement = document.getElementById(playerId);
        if (videoElement) {
            videoElement.style.display = 'block';
        }
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.add('hidden');
        }
    }
    async playAll() {
        const promises = [];
        if (this.topPlayer) {
            promises.push(this.topPlayer.play());
        }
        if (this.bottomPlayer) {
            promises.push(this.bottomPlayer.play());
        }
        await Promise.all(promises);
    }
    pauseAll() {
        if (this.topPlayer) {
            this.topPlayer.pause();
        }
        if (this.bottomPlayer) {
            this.bottomPlayer.pause();
        }
    }
    seekAll(time) {
        if (this.topPlayer) {
            this.topPlayer.seek(time);
        }
        if (this.bottomPlayer) {
            this.bottomPlayer.seek(time);
        }
    }
    getActivePlayers() {
        const active = [];
        if (this.topPlayer && this.topVideoSource) {
            active.push({ position: 'top', player: this.topPlayer, source: this.topVideoSource });
        }
        if (this.bottomPlayer && this.bottomVideoSource) {
            active.push({ position: 'bottom', player: this.bottomPlayer, source: this.bottomVideoSource });
        }
        return active;
    }
    getPlayer(position) {
        return position === 'top' ? this.topPlayer : this.bottomPlayer;
    }
    isAnyPlaying() {
        const topPlaying = this.topPlayer ? !this.topPlayer.isPaused() : false;
        const bottomPlaying = this.bottomPlayer ? !this.bottomPlayer.isPaused() : false;
        return topPlaying || bottomPlaying;
    }
    areAllPaused() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 0)
            return true;
        return activePlayers.every(({ player }) => player.isPaused());
    }
    onTimeUpdateCallback(callback) {
        this.onTimeUpdate = callback;
    }
    onPlayCallback(callback) {
        this.onPlay = callback;
    }
    onPauseCallback(callback) {
        this.onPause = callback;
    }
}
//# sourceMappingURL=manager.js.map