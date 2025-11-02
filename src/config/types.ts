export interface VideoSource {
  id: string;
  type: 'mp4' | 'youtube';
  url: string;
  label: string;
  /**
   * Optional playback offset in seconds relative to the master audio clock.
   * Positive values delay the video (video plays later than audio).
   * Negative values advance the video (video plays ahead of audio).
   * Example: offsetSeconds=1.0 means video time will be 1 second behind audio time.
   */
  offsetSeconds?: number;
}

export interface AudioTrack {
  id: string;
  url: string;
  label: string;
}

export interface AudioGroup {
  id: string;
  label: string;
  tracks: AudioTrack[];
}

export interface ScoreEntry {
  file: string;
  time: number;
}

export interface ScoreConfig {
  basePath: string;
  entries: ScoreEntry[];
  animation: {
    type: 'slideUp';
    durationMs: number;
    easing: string;
  };
  preload: {
    ahead: number;
  };
}

export interface AudioRouting {
  type: 'audio' | 'video';
  id?: string;
  position?: 'top' | 'bottom';
}

export interface TabDefaults {
  topVideoId?: string;
  bottomVideoId?: string;
  audioGroupId: string;
  routing: {
    left: AudioRouting;
    right: AudioRouting;
  };
}

export interface Tab {
  id: string;
  title: string;
  videos: VideoSource[];
  audioGroups: AudioGroup[];
  score: ScoreConfig;
  defaults: TabDefaults;
}

export interface Config {
  tabs: Tab[];
  defaultTab: string;
}
