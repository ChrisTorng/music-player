export interface AudioRouting {
  left: AudioSource | null;
  right: AudioSource | null;
}

export interface AudioSource {
  type: 'audio' | 'video';
  id: string;
  position?: 'top' | 'bottom'; // For video sources
}

export interface LoadedAudioTrack {
  id: string;
  url: string;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  isLoaded: boolean;
  isPlaying: boolean;
}

export interface LoadedVideoSource {
  position: 'top' | 'bottom';
  mediaElementSource: MediaElementAudioSourceNode | null;
  gainNode: GainNode;
  element: HTMLVideoElement;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private leftChannelGain: GainNode | null = null;
  private rightChannelGain: GainNode | null = null;
  private channelMerger: ChannelMergerNode | null = null;
  
  private audioTracks = new Map<string, LoadedAudioTrack>();
  private videoSources = new Map<'top' | 'bottom', LoadedVideoSource>();
  private currentRouting: AudioRouting = { left: null, right: null };
  
  private masterClock: { currentTime: number; isPlaying: boolean } = {
    currentTime: 0,
    isPlaying: false
  };

  // Playback time base for accurate master clock while playing
  private playStartContextTime: number | null = null;
  private playStartOffset: number = 0;

  async initialize(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();
      
      // Create audio graph
      this.masterGain = this.audioContext.createGain();
      this.leftChannelGain = this.audioContext.createGain();
      this.rightChannelGain = this.audioContext.createGain();
      this.channelMerger = this.audioContext.createChannelMerger(2);
      
      // Connect the audio graph
      // Left channel: leftChannelGain -> merger channel 0
      this.leftChannelGain.connect(this.channelMerger, 0, 0);
      
      // Right channel: rightChannelGain -> merger channel 1  
      this.rightChannelGain.connect(this.channelMerger, 0, 1);
      
      // Final output: merger -> masterGain -> destination
      this.channelMerger.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async loadAudioTrack(id: string, url: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized');
    }

    try {
      // Create track entry
      const gainNode = this.audioContext.createGain();
      const track: LoadedAudioTrack = {
        id,
        url,
        buffer: null,
        sourceNode: null,
        gainNode,
        isLoaded: false,
        isPlaying: false
      };
      
      this.audioTracks.set(id, track);
      
      // Load audio buffer
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      track.buffer = audioBuffer;
      track.isLoaded = true;
      
    } catch (error) {
      console.error(`Failed to load audio track ${id}:`, error);
      this.audioTracks.delete(id);
      throw error;
    }
  }

  unloadAudioTrack(id: string): void {
    const track = this.audioTracks.get(id);
    if (track) {
      this.stopAudioTrack(id);
      this.audioTracks.delete(id);
    }
  }

  connectVideoSource(position: 'top' | 'bottom', videoElement: HTMLVideoElement): void {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized');
    }

    try {
      // Disconnect existing source if any
      this.disconnectVideoSource(position);
      
      // Create media element source
      const mediaElementSource = this.audioContext.createMediaElementSource(videoElement);
      const gainNode = this.audioContext.createGain();
      
      // Store the connection
      this.videoSources.set(position, {
        position,
        mediaElementSource,
        gainNode,
        element: videoElement
      });
      
    } catch (error) {
      console.error(`Failed to connect video source ${position}:`, error);
      throw error;
    }
  }

  disconnectVideoSource(position: 'top' | 'bottom'): void {
    const videoSource = this.videoSources.get(position);
    if (videoSource && videoSource.mediaElementSource) {
      videoSource.mediaElementSource.disconnect();
      videoSource.gainNode.disconnect();
      this.videoSources.delete(position);
    }
  }

  setRouting(routing: AudioRouting): void {
    if (!this.audioContext || !this.leftChannelGain || !this.rightChannelGain) {
      throw new Error('AudioEngine not initialized');
    }

    // Capture current state/time for seamless switch
    const wasPlaying = this.masterClock.isPlaying;
    const currentPos = this.getMasterClock().currentTime;

    // Fully disconnect previous wiring
    try {
      this.leftChannelGain.disconnect();
    } catch {}
    try {
      this.rightChannelGain.disconnect();
    } catch {}
    // Disconnect all track/video outputs from previous channels
    this.audioTracks.forEach((t) => {
      try { t.gainNode.disconnect(); } catch {}
    });
    this.videoSources.forEach((vs) => {
      try { vs.mediaElementSource?.disconnect(); } catch {}
      try { vs.gainNode.disconnect(); } catch {}
    });

    // Reconnect channels to merger
    this.leftChannelGain.connect(this.channelMerger!, 0, 0);
    this.rightChannelGain.connect(this.channelMerger!, 0, 1);

    // Apply new routing
    if (routing.left) this.connectSourceToChannel(routing.left, 'left');
    if (routing.right) this.connectSourceToChannel(routing.right, 'right');
    this.currentRouting = routing;

    // Stop all non-selected tracks to avoid bleed-through
    const selectedIds = new Set<string>();
    if (routing.left?.type === 'audio' && routing.left.id) selectedIds.add(routing.left.id);
    if (routing.right?.type === 'audio' && routing.right.id) selectedIds.add(routing.right.id);
    this.audioTracks.forEach((t) => {
      if (!selectedIds.has(t.id)) {
        this.stopAudioTrack(t.id);
      }
    });

    // If playing, restart selected tracks at the preserved time
    if (wasPlaying) {
      this.masterClock.currentTime = currentPos;
      // Reset time base to avoid drift
      this.playStartContextTime = this.audioContext.currentTime;
      this.playStartOffset = currentPos;
      // Start only selected tracks
      if (routing.left?.type === 'audio' && routing.left.id) {
        this.playAudioTrack(routing.left.id);
      }
      if (routing.right?.type === 'audio' && routing.right.id && routing.right.id !== routing.left?.id) {
        this.playAudioTrack(routing.right.id);
      }
      this.masterClock.isPlaying = true;
    }
  }

  private connectSourceToChannel(source: AudioSource, channel: 'left' | 'right'): void {
    const gainNode = channel === 'left' ? this.leftChannelGain! : this.rightChannelGain!;
    
    if (source.type === 'audio') {
      const track = this.audioTracks.get(source.id);
      if (track && track.gainNode) {
        track.gainNode.connect(gainNode);
      }
    } else if (source.type === 'video' && source.position) {
      const videoSource = this.videoSources.get(source.position);
      if (videoSource && videoSource.gainNode) {
        videoSource.mediaElementSource?.connect(videoSource.gainNode);
        videoSource.gainNode.connect(gainNode);
      }
    }
  }

  async playAll(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized');
    }

    await this.resume();

    const promises: Promise<void>[] = [];
    
    // Play audio tracks that are routed
    if (this.currentRouting.left?.type === 'audio') {
      promises.push(this.playAudioTrack(this.currentRouting.left.id));
    }
    if (this.currentRouting.right?.type === 'audio' && 
        this.currentRouting.right.id !== this.currentRouting.left?.id) {
      promises.push(this.playAudioTrack(this.currentRouting.right.id));
    }

    await Promise.all(promises);
    // Establish time base
    this.playStartContextTime = this.audioContext.currentTime;
    this.playStartOffset = this.masterClock.currentTime;
    this.masterClock.isPlaying = true;
  }

  pauseAll(): void {
    // Pause all audio tracks
    this.audioTracks.forEach((track) => {
      this.stopAudioTrack(track.id);
    });
    
    // Freeze master clock at current position based on time base
    if (this.audioContext && this.playStartContextTime !== null) {
      const elapsed = this.audioContext.currentTime - this.playStartContextTime;
      this.masterClock.currentTime = this.playStartOffset + Math.max(0, elapsed);
    }
    this.playStartContextTime = null;
    this.masterClock.isPlaying = false;
  }

  seekAll(time: number): void {
    this.masterClock.currentTime = time;
    
    // If playing, restart tracks from new time
    if (this.masterClock.isPlaying) {
      this.pauseAll();
      setTimeout(() => {
        this.playAll();
      }, 10);
    }
  }

  private async playAudioTrack(id: string): Promise<void> {
    const track = this.audioTracks.get(id);
    if (!track || !track.buffer || !this.audioContext) return;

    // Stop existing source
    if (track.sourceNode) {
      track.sourceNode.stop();
      track.sourceNode.disconnect();
    }

    // Create new source
    track.sourceNode = this.audioContext.createBufferSource();
    track.sourceNode.buffer = track.buffer;
    
    // Connect to gain node
    track.sourceNode.connect(track.gainNode);
    
    // Start playback
    const startTime = this.masterClock.currentTime;
    track.sourceNode.start(0, startTime);
    track.isPlaying = true;
  }

  private stopAudioTrack(id: string): void {
    const track = this.audioTracks.get(id);
    if (track && track.sourceNode) {
      try {
        track.sourceNode.stop();
      } catch (error) {
        // Ignore if already stopped
      }
      track.sourceNode.disconnect();
      track.sourceNode = null;
      track.isPlaying = false;
    }
  }

  setTrackVolume(id: string, volume: number): void {
    const track = this.audioTracks.get(id);
    if (track) {
      track.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  setChannelVolume(channel: 'left' | 'right', volume: number): void {
    const gainNode = channel === 'left' ? this.leftChannelGain : this.rightChannelGain;
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMasterClock(): { currentTime: number; isPlaying: boolean } {
    if (this.audioContext && this.masterClock.isPlaying && this.playStartContextTime !== null) {
      const elapsed = this.audioContext.currentTime - this.playStartContextTime;
      const currentTime = this.playStartOffset + Math.max(0, elapsed);
      return { currentTime, isPlaying: true };
    }
    return { ...this.masterClock };
  }

  updateMasterClock(currentTime: number): void {
    this.masterClock.currentTime = currentTime;
  }

  getLoadedTracks(): string[] {
    return Array.from(this.audioTracks.keys()).filter(id => {
      const track = this.audioTracks.get(id);
      return track?.isLoaded;
    });
  }

  getPlayingTracks(): string[] {
    return Array.from(this.audioTracks.keys()).filter(id => {
      const track = this.audioTracks.get(id);
      return track?.isPlaying;
    });
  }

  // Returns the master audio duration in seconds based on currently routed audio sources.
  // If both left and right route audio, returns the max of their durations.
  // Returns null if no routed audio with a known duration is available.
  getMasterAudioDuration(): number | null {
    const durations: number[] = [];
    const collect = (src: AudioSource | null) => {
      if (src?.type === 'audio' && src.id) {
        const t = this.audioTracks.get(src.id);
        const d = t?.buffer?.duration;
        if (typeof d === 'number' && isFinite(d)) durations.push(d);
      }
    };
    collect(this.currentRouting.left);
    collect(this.currentRouting.right);
    if (durations.length === 0) return null;
    return Math.max(...durations);
  }

  isInitialized(): boolean {
    return this.audioContext !== null;
  }

  destroy(): void {
    // Stop all tracks
    this.pauseAll();
    
    // Disconnect everything
    this.audioTracks.clear();
    this.videoSources.clear();
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
