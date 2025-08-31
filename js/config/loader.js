export class ConfigLoader {
    constructor() {
        this.basePath = '';
    }
    static stripJsonComments(input) {
        let out = '';
        let i = 0;
        const n = input.length;
        let inString = false;
        let stringQuote = null;
        let inSingleLine = false;
        let inMultiLine = false;
        while (i < n) {
            const ch = input[i];
            const next = i + 1 < n ? input[i + 1] : '';
            if (inSingleLine) {
                if (ch === '\n' || ch === '\r') {
                    inSingleLine = false;
                    out += ch;
                }
                i++;
                continue;
            }
            if (inMultiLine) {
                if (ch === '*' && next === '/') {
                    inMultiLine = false;
                    i += 2;
                }
                else {
                    i++;
                }
                continue;
            }
            if (inString) {
                out += ch;
                if (ch === '\\') {
                    if (i + 1 < n) {
                        out += input[i + 1];
                        i += 2;
                        continue;
                    }
                }
                else if (ch === stringQuote) {
                    inString = false;
                    stringQuote = null;
                }
                i++;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inString = true;
                stringQuote = ch;
                out += ch;
                i++;
                continue;
            }
            if (ch === '/' && next === '/') {
                inSingleLine = true;
                i += 2;
                continue;
            }
            if (ch === '/' && next === '*') {
                inMultiLine = true;
                i += 2;
                continue;
            }
            out += ch;
            i++;
        }
        return out;
    }
    async loadPieceConfig(pieceName) {
        this.basePath = pieceName;
        const configUrl = `${pieceName}/config.json`;
        try {
            const response = await fetch(configUrl);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }
            const text = await response.text();
            const json = ConfigLoader.stripJsonComments(text);
            const config = JSON.parse(json);
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
            piece: params.get('piece') || undefined,
            tab: params.get('tab') || undefined,
        };
    }
}
//# sourceMappingURL=loader.js.map