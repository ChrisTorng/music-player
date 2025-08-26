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

  async play(): Promise<void> {
    try {
      await this.video.play();
    } catch (error) {
      console.error('Video play error:', error);
      throw error;
    }
  }

  pause(): void {
    this.video.pause();
  }

  seek(time: number): void {
    this.video.currentTime = Math.max(0, Math.min(time, this.video.duration || 0));
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