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
  private isWarmedUp: boolean = false;

  constructor(containerId: string, videoUrl: string) {
    this.containerId = containerId;
    this.videoId = this.extractVideoId(videoUrl);
    // Don't auto-load, wait for explicit load() call
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
    // Duration may not be available immediately, wait for video data
    this.waitForVideoData();
  }

  private waitForVideoData(): void {
    const checkDuration = () => {
      if (this.player && typeof this.player.getDuration === 'function') {
        try {
          const duration = this.player.getDuration();
          if (duration && duration > 0) {
            this.onLoadedMetadata?.(duration);
            return;
          }
        } catch (error) {
          // Duration not ready yet
        }
      }
      
      // Retry after a short delay
      setTimeout(checkDuration, 500);
    };
    
    checkDuration();
  }

  private onPlayerStateChange(event: any): void {
    const state = event.data;
    
    switch (state) {
      case window.YT.PlayerState.PLAYING:
        this.startTimeUpdateLoop();
        this.onPlay?.();
        // Ensure duration is available when video starts playing
        this.ensureDurationAvailable();
        break;
      case window.YT.PlayerState.PAUSED:
        this.stopTimeUpdateLoop();
        this.onPause?.();
        break;
      case window.YT.PlayerState.ENDED:
        this.stopTimeUpdateLoop();
        this.onEnded?.();
        break;
      case window.YT.PlayerState.CUED:
      case window.YT.PlayerState.BUFFERING:
        // Video metadata should be available
        this.ensureDurationAvailable();
        break;
    }
  }

  private ensureDurationAvailable(): void {
    if (this.player && typeof this.player.getDuration === 'function') {
      try {
        const duration = this.player.getDuration();
        if (duration && duration > 0) {
          this.onLoadedMetadata?.(duration);
        }
      } catch (error) {
        // Duration not available yet, that's OK
        console.log('YouTube duration not yet available');
      }
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
    this.isWarmedUp = false;

    if (this.player && this.player.loadVideoById) {
      // Player already exists, just load new video
      this.player.loadVideoById(this.videoId);
      await this.warmupPlayer();
    } else {
      // Initialize player for first time
      await this.loadYouTubeAPI();
      await new Promise((resolve) => {
        // Wait for player to be ready
        const checkReady = () => {
          if (this.player && this.player.getPlayerState) {
            resolve(undefined);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
      await this.warmupPlayer();
    }
  }

  /**
   * Warmup player by starting playback briefly then pausing.
   * This pre-buffers the video and reduces initial playback delay.
   */
  private async warmupPlayer(): Promise<void> {
    if (!this.player || this.isWarmedUp) return;

    console.log('[YouTubePlayer] Warming up player...');

    return new Promise((resolve) => {
      // Wait for video to be cued/buffering
      const checkCued = () => {
        const state = this.player?.getPlayerState();
        if (state === window.YT.PlayerState.CUED ||
            state === window.YT.PlayerState.PAUSED ||
            state === window.YT.PlayerState.PLAYING) {

          // Start playback briefly
          this.player?.playVideo();

          // Wait a short time for buffering to start
          setTimeout(() => {
            this.player?.pauseVideo();
            this.player?.seekTo(0, true);
            this.isWarmedUp = true;
            console.log('[YouTubePlayer] Warmup complete');
            resolve(undefined);
          }, 200); // 200ms should be enough to start buffering
        } else {
          setTimeout(checkCued, 100);
        }
      };
      checkCued();
    });
  }

  async play(): Promise<void> {
    if (!this.player || !this.player.playVideo) {
      return Promise.reject(new Error('Player not ready'));
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stateChangeHandler: ((event: any) => void) | null = null;
      let timeout: number | null = null;

      const cleanup = () => {
        if (stateChangeHandler && this.player) {
          // Note: YouTube API doesn't provide removeEventListener directly
          // The event is managed through the events object in player creation
        }
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      // Set timeout to prevent hanging (max 2 seconds)
      timeout = window.setTimeout(() => {
        cleanup();
        const elapsed = Date.now() - startTime;
        console.warn(`[YouTubePlayer] Play timeout after ${elapsed}ms, continuing anyway`);
        resolve(undefined);
      }, 2000);

      // Check if already playing
      const currentState = this.player.getPlayerState();
      if (currentState === window.YT.PlayerState.PLAYING) {
        cleanup();
        resolve(undefined);
        return;
      }

      // Monitor for PLAYING state
      const checkPlaying = () => {
        const state = this.player?.getPlayerState();
        if (state === window.YT.PlayerState.PLAYING) {
          cleanup();
          const elapsed = Date.now() - startTime;
          console.log(`[YouTubePlayer] Started playing after ${elapsed}ms`);
          resolve(undefined);
        } else if (state === window.YT.PlayerState.PAUSED ||
                   state === window.YT.PlayerState.CUED ||
                   state === window.YT.PlayerState.BUFFERING) {
          // Still waiting, check again
          setTimeout(checkPlaying, 50);
        } else {
          // Unexpected state, might be an error
          setTimeout(checkPlaying, 50);
        }
      };

      // Start playback
      this.player.playVideo();

      // Start monitoring
      setTimeout(checkPlaying, 50);
    });
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