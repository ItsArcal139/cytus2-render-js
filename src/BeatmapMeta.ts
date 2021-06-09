interface BeatmapMetaInit {
    title?: string,
    icon?: string,
    background?: string,
    audio: string,
    offset?: number,
    [key: string]: any
}

export class BeatmapMeta {
    public title: string;
    public icon: string;
    public background: string;
    public audio: string;
    public offset: number;
    [key: string]: any;

    constructor({title, icon, background, audio, offset, ...params}: BeatmapMetaInit) {
        this.title = title || "Unknown";
        this.icon = icon || "./assets/cover.jpeg";
        this.background = background || "./assets/cover.jpeg";
        this.audio = audio;
        this.offset = offset === undefined ? 0 : offset;

        Object.keys(params).forEach(s => {
            this[s] = params[s];
        });
    }
}