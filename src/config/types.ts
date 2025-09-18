export interface VideoSource {
  id: string;
  type: 'mp4' | 'youtube';
  url: string;
  label: string;
  /**
   * Optional playback offset in seconds. Positive values jump ahead in the video,
   * negative values delay video start relative to the master audio clock.
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
