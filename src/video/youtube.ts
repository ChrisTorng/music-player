declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubePlayer {
  private player: any = null;
  private containerId: string;
  private videoId: string;
  private onTimeUpdate?: (currentTime: number) => void;
  private onLoadedMetadata?: (duration: number) => void;
  private onPlay?: () => void;
  private onPause?: () => void;
  private onEnded?: () => void;
  private timeUpdateInterval?: number;

  constructor(containerId: string, videoUrl: string) {
    this.containerId = containerId;
    this.videoId = this.extractVideoId(videoUrl);
    this.loadYouTubeAPI();
  }

  private extractVideoId(url: string): string {
    // Extract video ID from various YouTube URL formats
    const regexps = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const regexp of regexps) {
      const match = url.match(regexp);
      if (match) return match[1];
    }

    throw new Error(`Invalid YouTube URL: ${url}`);
  }

  private async loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        this.initializePlayer();
        resolve();
        return;
      }

      // Load YouTube IFrame API
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        window.onYouTubeIframeAPIReady = () => {
          this.initializePlayer();
          resolve();
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      } else {
        // API is loading, wait for it
        const checkAPI = () => {
          if (window.YT && window.YT.Player) {
            this.initializePlayer();
            resolve();
          } else {
            setTimeout(checkAPI, 100);
          }
        };
        checkAPI();
      }
    });
  }

  private initializePlayer(): void {
    // Create iframe container
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Create YouTube player
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
        onReady: (event: any) => this.onPlayerReady(event),
        onStateChange: (event: any) => this.onPlayerStateChange(event)
      }
    });
  }

  private onPlayerReady(event: any): void {
    console.log('YouTube player ready');
    const duration = this.player.getDuration();
    this.onLoadedMetadata?.(duration);
  }

  private onPlayerStateChange(event: any): void {
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

  private startTimeUpdateLoop(): void {
    this.stopTimeUpdateLoop();
    this.timeUpdateInterval = window.setInterval(() => {
      if (this.player && this.onTimeUpdate) {
        const currentTime = this.player.getCurrentTime();
        this.onTimeUpdate(currentTime);
      }
    }, 100); // Update every 100ms
  }

  private stopTimeUpdateLoop(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = undefined;
    }
  }

  async load(url: string): Promise<void> {
    this.videoId = this.extractVideoId(url);
    if (this.player && this.player.loadVideoById) {
      this.player.loadVideoById(this.videoId);
      return Promise.resolve();
    } else {
      await this.loadYouTubeAPI();
    }
  }

  async play(): Promise<void> {
    if (this.player && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (this.player && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
  }

  seek(time: number): void {
    if (this.player && this.player.seekTo) {
      this.player.seekTo(time, true);
    }
  }

  getCurrentTime(): number {
    return this.player && this.player.getCurrentTime ? this.player.getCurrentTime() : 0;
  }

  getDuration(): number {
    return this.player && this.player.getDuration ? this.player.getDuration() : 0;
  }

  isPaused(): boolean {
    if (!this.player || !this.player.getPlayerState) return true;
    const state = this.player.getPlayerState();
    return state !== window.YT.PlayerState.PLAYING;
  }

  isEnded(): boolean {
    if (!this.player || !this.player.getPlayerState) return false;
    return this.player.getPlayerState() === window.YT.PlayerState.ENDED;
  }

  setVolume(volume: number): void {
    if (this.player && this.player.setVolume) {
      this.player.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }

  getVolume(): number {
    return this.player && this.player.getVolume ? this.player.getVolume() / 100 : 1;
  }

  mute(muted: boolean): void {
    if (this.player) {
      if (muted && this.player.mute) {
        this.player.mute();
      } else if (!muted && this.player.unMute) {
        this.player.unMute();
      }
    }
  }

  isMuted(): boolean {
    return this.player && this.player.isMuted ? this.player.isMuted() : false;
  }

  show(): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.display = 'block';
    }
  }

  hide(): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.display = 'none';
    }
  }

  destroy(): void {
    this.stopTimeUpdateLoop();
    if (this.player && this.player.destroy) {
      this.player.destroy();
    }
    this.player = null;
  }

  // Event handlers
  onTimeUpdateCallback(callback: (currentTime: number) => void): void {
    this.onTimeUpdate = callback;
  }

  onLoadedMetadataCallback(callback: (duration: number) => void): void {
    this.onLoadedMetadata = callback;
  }

  onPlayCallback(callback: () => void): void {
    this.onPlay = callback;
  }

  onPauseCallback(callback: () => void): void {
    this.onPause = callback;
  }

  onEndedCallback(callback: () => void): void {
    this.onEnded = callback;
  }
}