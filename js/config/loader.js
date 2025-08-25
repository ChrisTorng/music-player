export class ConfigLoader {
    constructor() {
        this.basePath = '';
    }
    async loadPieceConfig(pieceName) {
        this.basePath = pieceName;
        const configUrl = `${pieceName}/config.json`;
        try {
            const response = await fetch(configUrl);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }
            const config = await response.json();
            this.resolveConfigPaths(config);
            return config;
        }
        catch (error) {
            console.error(`Error loading config for piece "${pieceName}":`, error);
            throw error;
        }
    }
    resolveConfigPaths(config) {
        for (const tab of config.tabs) {
            for (const video of tab.videos) {
                if (video.type === 'mp4' && !video.url.startsWith('http')) {
                    video.url = `${this.basePath}/${video.url}`;
                }
            }
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
            if (!tab.score.basePath.startsWith('http')) {
                tab.score.basePath = `${this.basePath}/${tab.score.basePath}`;
            }
        }
    }
    static parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            piece: params.get('piece') || undefined
        };
    }
}
//# sourceMappingURL=loader.js.map