import { NativeVideoPlayer } from './native.js';
import { YouTubePlayer } from './youtube.js';
import { VideoSource } from '../config/types.js';

export type VideoPlayer = NativeVideoPlayer | YouTubePlayer;

export class VideoManager {
  private topPlayer: VideoPlayer | null = null;
  private bottomPlayer: VideoPlayer | null = null;
  private topVideoSource: VideoSource | null = null;
  private bottomVideoSource: VideoSource | null = null;

  private onTimeUpdate?: (currentTime: number, source: 'top' | 'bottom') => void;
  private onPlay?: (source: 'top' | 'bottom') => void;
  private onPause?: (source: 'top' | 'bottom') => void;

  constructor() {
    this.setupContainers();
  }

  private setupContainers(): void {
    const topContainer = document.getElementById('top-video-container');
    const bottomContainer = document.getElementById('bottom-video-container');

    if (topContainer) {
      topContainer.classList.add('hidden');
    }
    if (bottomContainer) {
      bottomContainer.classList.add('hidden');
    }
  }

  async loadTopVideo(videoSource: VideoSource): Promise<void> {
    await this.loadVideo('top', videoSource);
  }

  async loadBottomVideo(videoSource: VideoSource): Promise<void> {
    await this.loadVideo('bottom', videoSource);
  }

  private async loadVideo(position: 'top' | 'bottom', videoSource: VideoSource): Promise<void> {
    const containerId = position === 'top' ? 'top-video-container' : 'bottom-video-container';
    const playerId = position === 'top' ? 'top-video-player' : 'bottom-video-player';
    
    // Clean up existing player
    if (position === 'top' && this.topPlayer) {
      this.topPlayer.destroy();
      this.topPlayer = null;
    } else if (position === 'bottom' && this.bottomPlayer) {
      this.bottomPlayer.destroy();
      this.bottomPlayer = null;
    }

    let player: VideoPlayer;

    if (videoSource.type === 'mp4') {
      const videoElement = document.getElementById(playerId) as HTMLVideoElement;
      if (!videoElement) {
        throw new Error(`Video element ${playerId} not found`);
      }
      
      player = new NativeVideoPlayer(videoElement);
      await player.load(videoSource.url);
      
    } else if (videoSource.type === 'youtube') {
      // For YouTube, we need to replace the video element with a div
      const container = document.getElementById(containerId);
      const existingVideo = document.getElementById(playerId);
      
      if (container && existingVideo) {
        existingVideo.style.display = 'none';
        
        // Create YouTube container div
        const youtubeDiv = document.createElement('div');
        youtubeDiv.id = `${playerId}-youtube`;
        youtubeDiv.style.width = '100%';
        youtubeDiv.style.height = '100%';
        container.appendChild(youtubeDiv);
        
        player = new YouTubePlayer(youtubeDiv.id, videoSource.url);
        await player.load(videoSource.url);
      } else {
        throw new Error(`Container ${containerId} not found`);
      }
    } else {
      throw new Error(`Unsupported video type: ${videoSource.type}`);
    }

    // Set up event handlers
    player.onTimeUpdateCallback((currentTime) => {
      this.onTimeUpdate?.(currentTime, position);
    });

    player.onPlayCallback(() => {
      this.onPlay?.(position);
    });

    player.onPauseCallback(() => {
      this.onPause?.(position);
    });

    // Store player reference
    if (position === 'top') {
      this.topPlayer = player;
      this.topVideoSource = videoSource;
    } else {
      this.bottomPlayer = player;
      this.bottomVideoSource = videoSource;
    }

    // Show container
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.remove('hidden');
    }
  }

  unloadVideo(position: 'top' | 'bottom'): void {
    const containerId = position === 'top' ? 'top-video-container' : 'bottom-video-container';
    const playerId = position === 'top' ? 'top-video-player' : 'bottom-video-player';
    
    if (position === 'top' && this.topPlayer) {
      this.topPlayer.destroy();
      this.topPlayer = null;
      this.topVideoSource = null;
    } else if (position === 'bottom' && this.bottomPlayer) {
      this.bottomPlayer.destroy();
      this.bottomPlayer = null;
      this.bottomVideoSource = null;
    }

    // Clean up YouTube container if exists
    const youtubeDiv = document.getElementById(`${playerId}-youtube`);
    if (youtubeDiv) {
      youtubeDiv.remove();
    }

    // Show original video element and hide container
    const videoElement = document.getElementById(playerId);
    if (videoElement) {
      videoElement.style.display = 'block';
    }

    const container = document.getElementById(containerId);
    if (container) {
      container.classList.add('hidden');
    }
  }

  async playAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.topPlayer) {
      promises.push(this.topPlayer.play());
    }
    if (this.bottomPlayer) {
      promises.push(this.bottomPlayer.play());
    }

    await Promise.all(promises);
  }

  pauseAll(): void {
    if (this.topPlayer) {
      this.topPlayer.pause();
    }
    if (this.bottomPlayer) {
      this.bottomPlayer.pause();
    }
  }

  seekAll(time: number): void {
    if (this.topPlayer) {
      this.topPlayer.seek(time);
    }
    if (this.bottomPlayer) {
      this.bottomPlayer.seek(time);
    }
  }

  getActivePlayers(): Array<{ position: 'top' | 'bottom', player: VideoPlayer, source: VideoSource }> {
    const active = [];
    
    if (this.topPlayer && this.topVideoSource) {
      active.push({ position: 'top' as const, player: this.topPlayer, source: this.topVideoSource });
    }
    if (this.bottomPlayer && this.bottomVideoSource) {
      active.push({ position: 'bottom' as const, player: this.bottomPlayer, source: this.bottomVideoSource });
    }
    
    return active;
  }

  getPlayer(position: 'top' | 'bottom'): VideoPlayer | null {
    return position === 'top' ? this.topPlayer : this.bottomPlayer;
  }

  isAnyPlaying(): boolean {
    const topPlaying = this.topPlayer ? !this.topPlayer.isPaused() : false;
    const bottomPlaying = this.bottomPlayer ? !this.bottomPlayer.isPaused() : false;
    return topPlaying || bottomPlaying;
  }

  areAllPaused(): boolean {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) return true;
    
    return activePlayers.every(({ player }) => player.isPaused());
  }

  // Event handlers
  onTimeUpdateCallback(callback: (currentTime: number, source: 'top' | 'bottom') => void): void {
    this.onTimeUpdate = callback;
  }

  onPlayCallback(callback: (source: 'top' | 'bottom') => void): void {
    this.onPlay = callback;
  }

  onPauseCallback(callback: (source: 'top' | 'bottom') => void): void {
    this.onPause = callback;
  }
}