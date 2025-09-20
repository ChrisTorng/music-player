import { NativeVideoPlayer } from './native.js';
import { YouTubePlayer } from './youtube.js';
import { VideoSource } from '../config/types.js';

export type VideoPlayer = NativeVideoPlayer | YouTubePlayer;

export class VideoManager {
  private topPlayer: VideoPlayer | null = null;
  private bottomPlayer: VideoPlayer | null = null;
  private topVideoSource: VideoSource | null = null;
  private bottomVideoSource: VideoSource | null = null;

  private pendingPlayTimeouts: Partial<Record<'top' | 'bottom', number>> = {};
  private playRequested: boolean = false;
  private readonly nativeSyncThresholdSeconds = 0.05;
  private readonly youtubeSyncThresholdSeconds = 1.0;

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

  private getOffsetFor(position: 'top' | 'bottom'): number {
    const source = position === 'top' ? this.topVideoSource : this.bottomVideoSource;
    return source?.offsetSeconds ?? 0;
  }

  private clearPendingPlay(position: 'top' | 'bottom'): void {
    const timeoutId = this.pendingPlayTimeouts[position];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      delete this.pendingPlayTimeouts[position];
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
      
      // Ensure video element is visible and clean up any YouTube containers
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
      // Always mute native video to avoid double audio; audio comes from AudioEngine
      player.mute(true);
      
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
        // Always mute YouTube video as well
        player.mute(true);
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
    this.clearPendingPlay(position);
    
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

  private calculateTargetTime(position: 'top' | 'bottom', masterTime: number): number {
    const offset = this.getOffsetFor(position);
    const targetTime = masterTime + offset;
    return targetTime < 0 ? 0 : targetTime;
  }

  private applySeekWithOffset(position: 'top' | 'bottom', player: VideoPlayer, masterTime: number): void {
    const targetTime = this.calculateTargetTime(position, masterTime);
    player.seek(targetTime);
  }

  private getSyncThreshold(player: VideoPlayer): number {
    return player instanceof YouTubePlayer ? this.youtubeSyncThresholdSeconds : this.nativeSyncThresholdSeconds;
  }

  private async playWithOffset(
    position: 'top' | 'bottom',
    player: VideoPlayer,
    masterTime: number,
    getMasterTime: () => number
  ): Promise<void> {
    const offset = this.getOffsetFor(position);
    const desiredTime = masterTime + offset;

    this.clearPendingPlay(position);
    this.applySeekWithOffset(position, player, masterTime);

    if (desiredTime < 0) {
      player.pause();
      const waitMs = Math.max(0, Math.round(Math.abs(desiredTime) * 1000));
      const timeoutId = window.setTimeout(async () => {
        delete this.pendingPlayTimeouts[position];
        if (!this.playRequested) return;

        const currentMaster = getMasterTime();
        this.applySeekWithOffset(position, player, currentMaster);
        if (currentMaster + offset < 0) {
          // Master clock still not reached offset; reschedule a shorter delay.
          await this.playWithOffset(position, player, currentMaster, getMasterTime);
          return;
        }

        try {
          await player.play();
        } catch (error) {
          console.error(`Video play error (${position}):`, error);
        }
      }, waitMs);
      this.pendingPlayTimeouts[position] = timeoutId;
      return;
    }

    try {
      await player.play();
    } catch (error) {
      console.error(`Video play error (${position}):`, error);
      throw error;
    }
  }

  async playAll(masterTime: number, getMasterTime?: () => number): Promise<void> {
    this.playRequested = true;
    const resolveMasterTime = getMasterTime ?? (() => masterTime);
    const promises: Promise<void>[] = [];
    
    if (this.topPlayer) {
      promises.push(this.playWithOffset('top', this.topPlayer, masterTime, resolveMasterTime));
    }
    if (this.bottomPlayer) {
      promises.push(this.playWithOffset('bottom', this.bottomPlayer, masterTime, resolveMasterTime));
    }

    await Promise.all(promises);
  }

  pauseAll(): void {
    this.playRequested = false;
    this.clearPendingPlay('top');
    this.clearPendingPlay('bottom');
    if (this.topPlayer) {
      this.topPlayer.pause();
    }
    if (this.bottomPlayer) {
      this.bottomPlayer.pause();
    }
  }

  seekAll(time: number): void {
    if (this.topPlayer) {
      this.applySeekWithOffset('top', this.topPlayer, time);
    }
    if (this.bottomPlayer) {
      this.applySeekWithOffset('bottom', this.bottomPlayer, time);
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
    const pending = Object.keys(this.pendingPlayTimeouts).some(position => {
      const timeoutId = this.pendingPlayTimeouts[position as 'top' | 'bottom'];
      return timeoutId !== undefined;
    });
    return topPlaying || bottomPlaying || pending;
  }

  syncToMaster(masterTime: number): void {
    if (!this.playRequested) return;

    const activePlayers = this.getActivePlayers();
    activePlayers.forEach(({ position, player }) => {
      const offset = this.getOffsetFor(position);
      const targetTime = this.calculateTargetTime(position, masterTime);
      const current = player.getCurrentTime();
      const alignedCurrent = current - offset;
      const drift = Math.abs(alignedCurrent - masterTime);

      const driftThreshold = this.getSyncThreshold(player);
      if (drift > driftThreshold) {
        this.applySeekWithOffset(position, player, masterTime);
      }

      // If the player is paused (e.g., buffering) but the master clock
      // indicates playback should continue, attempt to resume.
      if (targetTime >= 0 && player.isPaused()) {
        // Avoid resuming when we still have a negative desired offset handled elsewhere.
        if (!this.pendingPlayTimeouts[position]) {
          player.play().catch((error) => {
            console.warn(`Video sync resume failed (${position}):`, error);
          });
        }
      }
    });
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
