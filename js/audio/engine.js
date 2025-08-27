export class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.leftChannelGain = null;
        this.rightChannelGain = null;
        this.channelMerger = null;
        this.audioTracks = new Map();
        this.videoSources = new Map();
        this.currentRouting = { left: null, right: null };
        this.masterClock = {
            currentTime: 0,
            isPlaying: false
        };
    }
    async initialize() {
        if (this.audioContext)
            return;
        try {
            this.audioContext = new AudioContext();
            this.masterGain = this.audioContext.createGain();
            this.leftChannelGain = this.audioContext.createGain();
            this.rightChannelGain = this.audioContext.createGain();
            this.channelMerger = this.audioContext.createChannelMerger(2);
            this.leftChannelGain.connect(this.channelMerger, 0, 0);
            this.rightChannelGain.connect(this.channelMerger, 0, 1);
            this.channelMerger.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);
        }
        catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            throw error;
        }
    }
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    async loadAudioTrack(id, url) {
        if (!this.audioContext) {
            throw new Error('AudioEngine not initialized');
        }
        try {
            const gainNode = this.audioContext.createGain();
            const track = {
                id,
                url,
                buffer: null,
                sourceNode: null,
                gainNode,
                isLoaded: false,
                isPlaying: false
            };
            this.audioTracks.set(id, track);
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            track.buffer = audioBuffer;
            track.isLoaded = true;
        }
        catch (error) {
            console.error(`Failed to load audio track ${id}:`, error);
            this.audioTracks.delete(id);
            throw error;
        }
    }
    unloadAudioTrack(id) {
        const track = this.audioTracks.get(id);
        if (track) {
            this.stopAudioTrack(id);
            this.audioTracks.delete(id);
        }
    }
    connectVideoSource(position, videoElement) {
        if (!this.audioContext) {
            throw new Error('AudioEngine not initialized');
        }
        try {
            this.disconnectVideoSource(position);
            const mediaElementSource = this.audioContext.createMediaElementSource(videoElement);
            const gainNode = this.audioContext.createGain();
            this.videoSources.set(position, {
                position,
                mediaElementSource,
                gainNode,
                element: videoElement
            });
        }
        catch (error) {
            console.error(`Failed to connect video source ${position}:`, error);
            throw error;
        }
    }
    disconnectVideoSource(position) {
        const videoSource = this.videoSources.get(position);
        if (videoSource && videoSource.mediaElementSource) {
            videoSource.mediaElementSource.disconnect();
            videoSource.gainNode.disconnect();
            this.videoSources.delete(position);
        }
    }
    setRouting(routing) {
        if (!this.audioContext || !this.leftChannelGain || !this.rightChannelGain) {
            throw new Error('AudioEngine not initialized');
        }
        this.leftChannelGain.disconnect();
        this.rightChannelGain.disconnect();
        this.leftChannelGain.connect(this.channelMerger, 0, 0);
        this.rightChannelGain.connect(this.channelMerger, 0, 1);
        if (routing.left) {
            this.connectSourceToChannel(routing.left, 'left');
        }
        if (routing.right) {
            this.connectSourceToChannel(routing.right, 'right');
        }
        this.currentRouting = routing;
    }
    connectSourceToChannel(source, channel) {
        const gainNode = channel === 'left' ? this.leftChannelGain : this.rightChannelGain;
        if (source.type === 'audio') {
            const track = this.audioTracks.get(source.id);
            if (track && track.gainNode) {
                track.gainNode.connect(gainNode);
            }
        }
        else if (source.type === 'video' && source.position) {
            const videoSource = this.videoSources.get(source.position);
            if (videoSource && videoSource.gainNode) {
                videoSource.mediaElementSource?.connect(videoSource.gainNode);
                videoSource.gainNode.connect(gainNode);
            }
        }
    }
    async playAll() {
        if (!this.audioContext) {
            throw new Error('AudioEngine not initialized');
        }
        await this.resume();
        const promises = [];
        if (this.currentRouting.left?.type === 'audio') {
            promises.push(this.playAudioTrack(this.currentRouting.left.id));
        }
        if (this.currentRouting.right?.type === 'audio' &&
            this.currentRouting.right.id !== this.currentRouting.left?.id) {
            promises.push(this.playAudioTrack(this.currentRouting.right.id));
        }
        await Promise.all(promises);
        this.masterClock.isPlaying = true;
    }
    pauseAll() {
        this.audioTracks.forEach((track) => {
            this.stopAudioTrack(track.id);
        });
        this.masterClock.isPlaying = false;
    }
    seekAll(time) {
        this.masterClock.currentTime = time;
        if (this.masterClock.isPlaying) {
            this.pauseAll();
            setTimeout(() => {
                this.playAll();
            }, 10);
        }
    }
    async playAudioTrack(id) {
        const track = this.audioTracks.get(id);
        if (!track || !track.buffer || !this.audioContext)
            return;
        if (track.sourceNode) {
            track.sourceNode.stop();
            track.sourceNode.disconnect();
        }
        track.sourceNode = this.audioContext.createBufferSource();
        track.sourceNode.buffer = track.buffer;
        track.sourceNode.connect(track.gainNode);
        const startTime = this.masterClock.currentTime;
        track.sourceNode.start(0, startTime);
        track.isPlaying = true;
    }
    stopAudioTrack(id) {
        const track = this.audioTracks.get(id);
        if (track && track.sourceNode) {
            try {
                track.sourceNode.stop();
            }
            catch (error) {
            }
            track.sourceNode.disconnect();
            track.sourceNode = null;
            track.isPlaying = false;
        }
    }
    setTrackVolume(id, volume) {
        const track = this.audioTracks.get(id);
        if (track) {
            track.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    setChannelVolume(channel, volume) {
        const gainNode = channel === 'left' ? this.leftChannelGain : this.rightChannelGain;
        if (gainNode) {
            gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    getMasterClock() {
        return { ...this.masterClock };
    }
    updateMasterClock(currentTime) {
        this.masterClock.currentTime = currentTime;
    }
    getLoadedTracks() {
        return Array.from(this.audioTracks.keys()).filter(id => {
            const track = this.audioTracks.get(id);
            return track?.isLoaded;
        });
    }
    getPlayingTracks() {
        return Array.from(this.audioTracks.keys()).filter(id => {
            const track = this.audioTracks.get(id);
            return track?.isPlaying;
        });
    }
    isInitialized() {
        return this.audioContext !== null;
    }
    destroy() {
        this.pauseAll();
        this.audioTracks.clear();
        this.videoSources.clear();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
//# sourceMappingURL=engine.js.map