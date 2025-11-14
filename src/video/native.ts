export class NativeVideoPlayer {
  private video: HTMLVideoElement;
  private onTimeUpdate?: (currentTime: number) => void;
  private onLoadedMetadata?: (duration: number) => void;
  private onPlay?: () => void;
  private onPause?: () => void;
  private onEnded?: () => void;

  constructor(videoElement: HTMLVideoElement) {
    this.video = videoElement;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
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

    // Prevent default controls interference
    this.video.addEventListener('click', (e) => {
      e.preventDefault();
    });
  }

  async load(url: string): Promise<void> {
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

  async play(seekTo?: number): Promise<void> {
    const beforeTime = this.video.currentTime;
    const duration = this.video.duration;
    const readyState = this.video.readyState;
    console.log(`[NativeVideo] play() called | currentTime=${beforeTime.toFixed(2)} duration=${duration?.toFixed(2)} readyState=${readyState} seekTo=${seekTo?.toFixed(2)}`);
    try {
      await this.video.play();
      let afterTime = this.video.currentTime;

      // If seekTo specified and current position is wrong, wait for buffering then seek
      if (seekTo !== undefined && Math.abs(afterTime - seekTo) > 0.1) {
        console.log(`[NativeVideo] Need to seek to ${seekTo.toFixed(2)} after buffering (currently at ${afterTime.toFixed(2)})`);
        // CRITICAL: Must await to ensure seek completes before audio starts
        await this.seekWhenBuffered(seekTo);
        afterTime = this.video.currentTime;
      }

      console.log(`[NativeVideo] play() success | currentTime=${afterTime.toFixed(2)} (changed: ${(afterTime - beforeTime).toFixed(2)}s)`);
    } catch (error) {
      console.error('[NativeVideo] Video play error:', error);
      throw error;
    }
  }

  private async seekWhenBuffered(targetTime: number): Promise<void> {
    const maxAttempts = 30; // Max 3 seconds (30 * 100ms)

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      // Check if target time is in seekable range
      const seekable = this.video.seekable;
      let isSeekable = false;
      for (let i = 0; i < seekable.length; i++) {
        if (targetTime >= seekable.start(i) && targetTime <= seekable.end(i)) {
          isSeekable = true;
          break;
        }
      }

      if (isSeekable) {
        console.log(`[NativeVideo] Buffer ready, seeking to ${targetTime.toFixed(2)} (attempt ${attempts})`);
        this.video.currentTime = targetTime;
        const actualResult = this.video.currentTime;

        if (Math.abs(actualResult - targetTime) < 0.1) {
          console.log(`[NativeVideo] Seek successful: ${actualResult.toFixed(2)}`);
          return;
        } else if (Math.abs(actualResult - targetTime) < 1.0) {
          console.log(`[NativeVideo] Seek partially successful: ${actualResult.toFixed(2)} (target was ${targetTime.toFixed(2)})`);
          return; // Close enough
        } else {
          console.warn(`[NativeVideo] Seek failed: ${actualResult.toFixed(2)} != ${targetTime.toFixed(2)}`);
        }
      } else {
        const ranges = Array.from({ length: seekable.length }, (_, i) =>
          `[${seekable.start(i).toFixed(2)}-${seekable.end(i).toFixed(2)}]`
        ).join(', ');
        console.log(`[NativeVideo] Waiting for buffer... (attempt ${attempts}, seekable: ${ranges || 'none'})`);
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.error(`[NativeVideo] Buffer timeout after ${maxAttempts} attempts. Target ${targetTime.toFixed(2)} not seekable.`);
  }

  pause(): void {
    this.video.pause();
  }

  seek(time: number): void {
    const duration = this.video.duration;
    let target = Math.max(0, time);
    if (Number.isFinite(duration) && duration > 0) {
      target = Math.min(target, duration);
    }

    const beforeCurrentTime = this.video.currentTime;
    const readyState = this.video.readyState;
    const paused = this.video.paused;

    // Check if target time is within seekable ranges
    const seekable = this.video.seekable;
    let isSeekable = false;
    for (let i = 0; i < seekable.length; i++) {
      if (target >= seekable.start(i) && target <= seekable.end(i)) {
        isSeekable = true;
        break;
      }
    }

    if (!isSeekable && seekable.length > 0) {
      console.warn(`[NativeVideo] Target time ${target.toFixed(2)} not in seekable range. Seekable ranges:`,
        Array.from({ length: seekable.length }, (_, i) => `[${seekable.start(i).toFixed(2)}-${seekable.end(i).toFixed(2)}]`).join(', '));
      // If not seekable, try to seek to the nearest seekable position
      if (target > seekable.end(seekable.length - 1)) {
        target = seekable.end(seekable.length - 1);
      } else if (target < seekable.start(0)) {
        target = seekable.start(0);
      }
    }

    this.video.currentTime = target;

    const actualResult = this.video.currentTime;
    console.log(`[NativeVideo] Seek from ${beforeCurrentTime.toFixed(2)} to ${target.toFixed(2)} (requested ${time.toFixed(2)}) | duration=${duration?.toFixed(2)} readyState=${readyState} paused=${paused} seekable=${isSeekable} | actualResult=${actualResult.toFixed(2)}`);

    // If seek failed (common with paused videos that lost buffer), retry after a delay
    if (Math.abs(actualResult - target) > 0.1 && target > 0) {
      console.warn(`[NativeVideo] Seek failed (actualResult=${actualResult.toFixed(2)} != target=${target.toFixed(2)}), will retry during play`);
    }
  }

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getDuration(): number {
    return this.video.duration || 0;
  }

  isPaused(): boolean {
    return this.video.paused;
  }

  isEnded(): boolean {
    return this.video.ended;
  }

  setVolume(volume: number): void {
    this.video.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.video.volume;
  }

  mute(muted: boolean): void {
    this.video.muted = muted;
  }

  isMuted(): boolean {
    return this.video.muted;
  }

  show(): void {
    this.video.style.display = 'block';
  }

  hide(): void {
    this.video.style.display = 'none';
  }

  destroy(): void {
    this.video.pause();
    this.video.src = '';
    this.video.load();
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
