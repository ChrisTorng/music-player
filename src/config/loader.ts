import { Config } from './types.js';

export class ConfigLoader {
  private basePath: string = '';

  async loadPieceConfig(pieceName: string): Promise<Config> {
    this.basePath = pieceName;
    const configUrl = `${pieceName}/config.json`;
    
    try {
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
      }
      
      const config: Config = await response.json();
      
      // Resolve all relative paths to absolute paths
      this.resolveConfigPaths(config);
      
      return config;
    } catch (error) {
      console.error(`Error loading config for piece "${pieceName}":`, error);
      throw error;
    }
  }

  private resolveConfigPaths(config: Config): void {
    for (const tab of config.tabs) {
      // Resolve video URLs (only for MP4, keep YouTube URLs as-is)
      for (const video of tab.videos) {
        if (video.type === 'mp4' && !video.url.startsWith('http')) {
          video.url = `${this.basePath}/${video.url}`;
        }
      }

      // Resolve audio track URLs and image paths
      for (const audioGroup of tab.audioGroups) {
        for (const track of audioGroup.tracks) {
          if (!track.url.startsWith('http')) {
            track.url = `${this.basePath}/${track.url}`;
          }
          
          if (track.images.waveform && !track.images.waveform.startsWith('http')) {
            track.images.waveform = `${this.basePath}/${track.images.waveform}`;
          }
          
          if (track.images.spectrogram && !track.images.spectrogram.startsWith('http')) {
            track.images.spectrogram = `${this.basePath}/${track.images.spectrogram}`;
          }
        }
      }

      // Resolve score base path
      if (!tab.score.basePath.startsWith('http')) {
        tab.score.basePath = `${this.basePath}/${tab.score.basePath}`;
      }
    }
  }

  static parseUrlParams(): { piece?: string } {
    const params = new URLSearchParams(window.location.search);
    return {
      piece: params.get('piece') || undefined
    };
  }
}