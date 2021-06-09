import { Renderer } from "./Renderer";

interface BaseAsset {
    name: string
}

interface ImageAsset extends BaseAsset {
    image: HTMLImageElement | ImageBitmap | OffscreenCanvas | HTMLCanvasElement
}

interface AudioAsset extends BaseAsset {
    audioBuffer: AudioBuffer
}

class AssetsManager {
    public preferredFont = `Rajdhani, "Noto Sans CJK TC", sans-serif`;
    [key: string]: any;

    public loadImageAsset(name: string, source: string): Promise<ImageAsset> {
        return new Promise((resolve, _) => {
            var img = new Image();
            img.onload = () => {
                this[name] = img;
                resolve({
                    name,
                    image: img
                });
            };
            img.src = source;
        });
    }

    public loadAudioAsset(name: string, source: string): Promise<AudioAsset> {
        return new Promise((resolve, _) => {
            /** @type {Game} */
            var game = Renderer.current;
            var ctx = game.audioContext;
            var prom = fetch(source)
                .then(r => r.arrayBuffer());

            if(game.audioCompatMode) {
                prom.then(buf => {
                    // @ts-ignore
                    this[name] = ctx.createBuffer(buf, false);
                    resolve({
                        name,
                        audioBuffer: this[name]
                    });
                })
            } else {
                prom.then(buf => ctx.decodeAudioData(buf))
                    .then(buf => {
                        this[name] = buf;
                        resolve({
                            name,
                            audioBuffer: this[name]
                        });
                    });
            }
        });
    }
}

export var Assets = new AssetsManager();