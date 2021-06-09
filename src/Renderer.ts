import { Assets } from "./Assets";
import { Beatmap } from "./beatmap/Beatmap";
import { EventOrder } from "./beatmap/EventOrder";
import { HoldNote } from "./beatmap/HoldNote";
import { LongHoldNote } from "./beatmap/LongHoldNote";
import { Note } from "./beatmap/Note";
import { Page } from "./beatmap/Page";
import { SliderNode } from "./beatmap/SliderNode";
import { SliderNote } from "./beatmap/SliderNote";
import { LogLine } from "./LogLine";
import { Arrays } from "./utils/Arrays";
import { Colors } from "./utils/Colors";
import { Maths } from "./utils/Maths";

interface RendererInit {
    audioCompatMode?: boolean;
}

interface RendererChartMetaInit {
    audio: string,
    [key: string]: any
}

interface RendererChartDiff {
    name: string,
    color: string,
    backColor: string,
    level: number,
}

export class AnimatedObject {
    [key: string]: any;

    constructor() {
        this.data = {};
        this.update = () => {};
        this.isFinished = false;
    }
}

export class Renderer {
    public static current: Renderer;
    public canvas: HTMLCanvasElement;
    public context: CanvasRenderingContext2D;
    public comboFxCanvas: HTMLCanvasElement;
    public comboFxCtx: CanvasRenderingContext2D;

    public enableOverlay = false;
    public enableDebugLog = location.search.indexOf("?dev") != -1;
    public debugLogCount = 30;
    public debugUseGameRatio = false;
    public debugLines: LogLine[] = [];
    public defaultLines: any = {};

    public audioCompatMode: boolean;

    public bandoriMode = false;
    public bandoriSpeed = 9.6;

    public noRayarkTexture = true;
    public maxFPS = 300;
    public enableClickSound = false;
    public enableTaptic = false;
    public noteSize = 1;
    public noteRevHueOffset = 22.5;
    public comboFxStep = 25;
    public noteSpeedSmooth = 100;
    public enableMMEffect = true;

    public lastRenderTime = 0;
    public currentTick = 0;
    public playbackTime = 0;
    public lastScore = 0;
    public lastNoteTick = 0;
    public isAllNoteAssetsLoaded = false;

    public animatedObjects: AnimatedObject[] = [];

    constructor(canvas: HTMLCanvasElement, { audioCompatMode }: RendererInit) {
        Renderer.current = this;

        this.canvas = canvas;
        var ctx = canvas.getContext("2d");
        if(!ctx) {
            throw new Error("Your browser doesn't support Canvas 2D!");
        }
        this.context = ctx;

        canvas.width = screen.height < screen.width ? screen.width : screen.height;
        canvas.height = screen.height < screen.width ? screen.height : screen.width;

        this.comboFxCanvas = document.createElement("canvas");
        var comboFxCtx = this.comboFxCanvas.getContext("2d");
        if(!comboFxCtx) {
            throw new Error("Your browser doesn't support Canvas 2D!");
        }
        this.comboFxCtx = comboFxCtx;

        this.setupDefaultDebugLines();

        this.setResolutionScale(devicePixelRatio);
        this.audioCompatMode = audioCompatMode ?? false;
        this.setupAudio();
        
        Assets.loadImageAsset("default_bg", "./assets/game/songpackbgs/conner001.png").then(() => {
            this.background = Assets.default_bg;
        });

        Assets.loadImageAsset("default_icon", "./assets/game/charactericons/conner001_l.png").then(() => {
            this.icon = Assets.default_icon;
        });

        // Loader
        var loader = new AnimatedObject();
        loader.loaded = false;
        loader.finishTime = 0;
        loader.update = () => {
            if(this.isAllNoteAssetsLoaded && !loader.loaded) {
                loader.loaded = true;
                loader.finishTime = performance.now();
            }

            var duration = 3000;
            var progress = loader.loaded ? (performance.now() - loader.finishTime) / duration : 0;
            if(progress > 1) {
                loader.isFinished = true;
                return;
            }

            var a = Math.max(0, 1 - Math.max(0, (progress - 0.5) * 2));
            a = Math.pow(a, 5);

            var ctx = this.context;
            ctx.globalAlpha = a;
            ctx.filter = `blur(${20 * this.ratio}px)`;
            var cw = this.canvas.width;
            var ch = this.canvas.height;
            var w = cw + 50 * this.ratio;
            var h = ch + 50 * this.ratio;
            ctx.drawImage(this.canvas, (cw - w) / 2, (ch - h) / 2, w, h);
            ctx.filter = "none";

            // @start - Spinning surrounding

            var tf = ctx.getTransform();
            var rot = (performance.now() / 1000 / Math.PI * 3) % (Math.PI * 2);
            ctx.translate(cw / 2, ch / 2);
            ctx.rotate(rot);

            var s = 1 - Math.pow(1 - (progress * 2), 3);
            s += 1;

            ctx.globalAlpha = Math.max(0, 1 - progress * 5);
            ctx.beginPath();
            ctx.arc(0, 0, 500 * this.ratio * s, 0, Math.PI * 2);
            ctx.setLineDash([375 * this.ratio]);
            ctx.lineWidth = 60 * this.ratio;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.stroke();
            
            ctx.rotate(-rot * 2);
            ctx.beginPath();
            ctx.arc(0, 0, 500 * this.ratio * s, 0, Math.PI * 2);
            ctx.lineWidth = 20 * this.ratio;
            ctx.setLineDash([1000 * this.ratio, 400 * this.ratio]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.setTransform(tf);

            // @end - Spinning surrounding

            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(cw / 2, ch / 2, 300 * this.ratio, 0, Math.PI * 2);
            var g = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, 300 * this.ratio);
            g.addColorStop(0, "#746f60");
            g.addColorStop(0.75, "#424242");
            ctx.fillStyle = g;
            ctx.strokeStyle = "#ffecb3";
            ctx.lineWidth = 10 * this.ratio;
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(cw / 2, ch / 2, 260 * this.ratio, 0, Math.PI * 2);
            ctx.globalAlpha = 0.25 * a;
            ctx.lineWidth = 5 * this.ratio;
            ctx.stroke();
            ctx.globalAlpha = a;

            var font1 = "Rajdhani, 'Noto Sans CJK TC'";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.font = "500 " + (60 * this.ratio) + "px " + font1;
            ctx.fillStyle = "#ffecb3";
            ctx.fillText("Loading...", cw / 2, ch / 2 - 30 * this.ratio);
            ctx.font = "500 " + (30 * this.ratio) + "px " + font1;
            ctx.textBaseline = "top";
            ctx.globalAlpha = a * Math.max(0, 1 - progress * 6);
            ctx.fillText("Cytus II is loading note assets.", cw / 2, ch / 2 + 20 * this.ratio);
            ctx.fillText("Please wait for a moment.", cw / 2, ch / 2 + 60 * this.ratio);
            ctx.globalAlpha = a * (() => {
                if(progress <= 1 / 6) {
                    return 0;
                } else if(progress > 1 / 6 && progress < 0.5) {
                    return Math.max(0, Math.min(1, (progress - 1 / 6) * 6));
                } else {
                    return 1;
                }
            })();
            ctx.fillText("Done loading!", cw / 2, ch / 2 + 60 * this.ratio);
        };
        this.animatedObjects.push(loader);

        this.setupNoteAssets();
        this.setupOtherAssets();

        this.update();
    }

    public setupOtherAssets() {
        for(var i=0; i<=85; i++) {
            Assets.loadImageAsset("mm_" + i, `./assets/mm/MM_Logo-MM_Logo_000${i<10?"0":""}${i}.png`);
        }
        Assets.loadAudioAsset("mm_audio", "./assets/mm/mm_sound.wav");
        Assets.loadAudioAsset("click_fx", "./assets/tapFX_3.wav");
        Assets.loadImageAsset("muted", "./assets/mute-3-xxl.png");
        Assets.loadImageAsset("hold_strip", "./assets/hold-strip.png");
    }

    public getCurrentNoteSpeedSmooth() {
        return this.audioElem.paused ? 1 : this.noteSpeedSmooth;
    }

    public playOneShotAudio(buffer: AudioBuffer) {
        var ctx = this.audioContext;
        if(buffer && ctx.state == "running") {
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            var gain = ctx.createGain();
            gain.gain.value = 1;
            source.connect(gain).connect(ctx.destination);
            source.addEventListener("ended", e => {
                source.disconnect();
            });
            source.start(0);
        }
    }

    public audioElem!: HTMLAudioElement;
    public audioContext!: AudioContext;
    public audioSource!: AudioBufferSourceNode | null;
    public audioAnalyser!: AnalyserNode;
    public activeAudioBuffer!: AudioBuffer;
    public isPlaying!: boolean;
    public gainNode!: GainNode;

    public setupAudio() {
        this.audioElem = (() => {
            var e = document.getElementById("game-audio");
            if(!e) {
                throw new Error("The main audio element is not found");
            }
            return e as HTMLAudioElement;
        })();

        // @ts-ignore
        var ctx = this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if(!window.AudioContext) {
            var line1 = new LogLine("Your browser doesn't support the standard AudioContext API.");
            var line2 = new LogLine("Audio compatible mode will be enabled.");
            var badge = {
                ...line1.badge,
                text: "Audio"
            };

            line1.badge = line2.badge = badge;
            this.debugLines.push(line1, line2);
            this.audioCompatMode = true;
        }

        /** @type {AudioBufferSourceNode} */
        this.audioSource = null;
        ctx.suspend();

        this.audioAnalyser = ctx.createAnalyser();
        if(!this.audioCompatMode) {
            var src = ctx.createMediaElementSource(this.audioElem);

            var gn = ctx.createGain();
            gn.gain.value = 0;
            src.connect(gn);
            gn.connect(this.audioAnalyser);
        } else {
            // this.audioElem.volume = 0;
        }

        this.audioElem.addEventListener("play", e => {
            var s = ctx.createBufferSource();
            s.buffer = this.activeAudioBuffer;

            if(this.audioSource != null) {
                s.playbackRate.value = this.audioSource.playbackRate.value;
                try {
                    this.audioSource.stop();
                } catch {}
                this.audioSource.disconnect();
            }
            this.audioSource = s;

            s.loop = this.audioElem.loop;
            s.connect(this.audioAnalyser);
            s.start(0, this.audioElem.currentTime);
            this.isPlaying = true;
            this.playbackTime = this.audioElem.currentTime;
        });
        
        this.audioElem.addEventListener("pause", e => {
            this.audioSource?.stop();
            this.isPlaying = false;
        });

        var gain = this.gainNode = ctx.createGain();
        gain.gain.value = this.audioCompatMode ? 0 : 1;

        this.audioAnalyser.connect(gain).connect(this.audioContext.destination);
    }

    public setPlaybackRate(rate: number) {
        this.audioElem.playbackRate = rate;
        if(this.audioSource) {
            this.audioSource.playbackRate.value = rate;
        }
    }

    private setupDefaultDebugLines() {
        var acLog = new LogLine("AudioContext");
        acLog.badge.text = "AudioContext";
        acLog.persistent = true;
        
        var resLog = new LogLine("Resolution");
        resLog.badge.text = "Renderer";
        resLog.persistent = true;

        var fpsLog = new LogLine("FPS");
        fpsLog.badge.text = "Renderer";
        fpsLog.persistent = true;

        var fpsWarning = new LogLine("FPS is lower than 20 on your browser. Consider switching to low resolution mode in debug menu.");
        fpsWarning.badge.text = "Renderer";
        fpsWarning.badge.background = "#f50";
        fpsWarning.hidden = true;
        fpsWarning.persistent = true;

        this.defaultLines = {
            acLog, resLog, fpsLog, fpsWarning
        };

        Object.keys(this.defaultLines).forEach(k => {
            this.debugLines.push(this.defaultLines[k]);
        });
    }

    public fieldWidth!: number;
    public fieldHeight!: number;
    
    private setupPlayfield() {
        var canvas = this.canvas;
        this.fieldWidth = canvas.width * 0.85;
        this.fieldHeight = canvas.height - 325 * this.ratio;
    }

    public ratio!: number;

    public setResolutionScale(ratio: number, w?: number, h?: number) {
        ratio = ratio || window.devicePixelRatio;

        var _w = Math.max(w || screen.width, h || screen.height);
        var _h = Math.min(w || screen.width, h || screen.height);

        var aspect = _w / _h;
        var mix = ((min: number, max: number, n: number) => {
            var a = (n - min) / (max - min);
            return Math.max(Math.min(1, a), 0);
        });

        var ahr = 99999999999;
        var awr = 4 / 3;
        this.ratio = ratio * Maths.lerp(_h / 1080, _w / 1920, mix(ahr, awr, aspect));

        var canvas = this.canvas;
        canvas.width = _w * ratio;
        canvas.height = _h * ratio;

        this.setupPlayfield();
    }
    
    public log(content: string, tag: any) {
        var line = new LogLine(content);
        line.badge.text = tag + "";
        this.debugLines.push(line);
    }

    public setupNoteAssets() {
        if(this.noRayarkTexture) {
            this.log("Note assets loading process is skipped due to not using Rayark assets.", "Cytus2");
            this.log("Cytus II will use our custom vector renderer.", "Cytus2");
            this.isAllNoteAssetsLoaded = true;
            return;
        }

        this.log("Loading all the note assets...", "Cytus2");
        this.log("This will also generate hue-shifted assets.", "Cytus2");

        var proms: Promise<any>[] = [];
        
        for(var i=1; i<=40; i++) {
            proms.push(
                Assets.loadImageAsset("circle_" + i, `./assets/circle/Note-Click-Enter-Textures-Click_in_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, this.noteRevHueOffset * 0.9);
                    Assets[name + "_b"] = bc;
                }), 
                Assets.loadImageAsset("flick_" + i, `./assets/flick/Note-Flick-Enter-Textures-Flick_in_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, this.noteRevHueOffset * 2);
                    Assets[name + "_b"] = bc;
                })
            );
        }

        for(var i=41; i<=50; i++) {
            proms.push(
                Assets.loadImageAsset("circle_" + i, `./assets/circle/Note-Click-Bloom-Textures-Click_Boom_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, this.noteRevHueOffset * 0.9);
                    Assets[name + "_b"] = bc;
                }),
                Assets.loadImageAsset("flick_" + i, `./assets/flick/Note-Flick-Bloom-Textures-Flick_BoomR_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, this.noteRevHueOffset * 2);
                    Assets[name + "_b"] = bc;
                })
            );
        }

        for(var i=51; i<=58; i++) {
            proms.push(
                Assets.loadImageAsset("flick_" + i, `./assets/flick/Note-Flick-Bloom-Textures-Flick_BoomR_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, this.noteRevHueOffset * 2);
                    Assets[name + "_b"] = bc;
                })
            );
        }

        for(var i=146; i<=158; i++) {
            var j = 12 - i + 146;
            proms.push(
                Assets.loadImageAsset("perfect_" + i, `./assets/perfect2/Perfect_00${j<10?"0":""}${j}_PERFECT_Gold_top_00${i}.png`)
            );
        }

        for(var i=1; i<=47; i++) {
            proms.push(
                Assets.loadImageAsset("sn_" + i, `./assets/drag_child/Note-DragChild-Textures-DragChild_in_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;
                    
                    bc = Colors.getHueShiftedImage(texture, -50);
                    Assets[name + "_cd"] = bc;

                    texture = bc;
                    bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_cd_b"] = bc;
                }),
                Assets.loadImageAsset("slider_" + i, `./assets/drag_head/Note-Drag-Enter-Textures-Drag_in_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;
                })
            );
        }

        for(var i=48; i<=54; i++) {
            proms.push(
                Assets.loadImageAsset("sn_" + i, `./assets/drag_child/Note-DragChild-Textures-DragChild_in_00047.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;

                    bc = Colors.getHueShiftedImage(texture, -50);
                    Assets[name + "_cd"] = bc;

                    texture = bc;
                    bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_cd_b"] = bc;
                }),
                Assets.loadImageAsset("slider_" + i, `./assets/drag_head/Note-Drag-Enter-Textures-Drag_in_00047.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;

                    if(name.split("_")[1] == "54") {
                        bc = Colors.getHueShiftedImage(texture, -50);
                        Assets["cDrag"] = bc;

                        texture = bc;
                        bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset);
                        Assets["cDrag_b"] = bc;
                    }
                })
            );
        }

        for(var i=41; i<=50; i++) {
            var j = i + 14;
            proms.push(
                Assets.loadImageAsset("sn_" + j, `./assets/drag_head/Note-Drag-Bloom-Textures-Drag_Boom_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;

                    bc = Colors.getHueShiftedImage(texture, -50);
                    Assets[name + "_cd"] = bc;

                    texture = bc;
                    bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_cd_b"] = bc;
                }),
                Assets.loadImageAsset("slider_" + j, `./assets/drag_head/Note-Drag-Bloom-Textures-Drag_Boom_000${i<10?"0":""}${i}.png`).then(({ name, image: texture }) => {
                    var bc = Colors.getHueShiftedImage(texture, -this.noteRevHueOffset * 1.5);
                    Assets[name + "_b"] = bc;
                })
            );
        }

        for(var i=1; i<=40; i++) {
            proms.push(
                Assets.loadImageAsset("hold_" + i, `./assets/hold/Note-Hold-Enter-Textures-Hold_Note-Hold_in_000${i<10?"0":""}${i}.png`)
            );
        }
        for(var i=41; i<=56; i++) {
            proms.push(
                Assets.loadImageAsset("hold_back_" + i, `./assets/hold/Note-Hold-Holding-Textures-Hold_Back-Hold_Back_000${i}.png`)
            );
        }
        for(var i=41; i<=49; i++) {
            proms.push(
                Assets.loadImageAsset("hold_btn_" + i, `./assets/hold/Note-Hold-Holding-Textures-Hold_Button_in-Hold_Button_in_000${i}.png`)
            );
        }
        for(var i=1; i<=30; i++) {
            proms.push(
                Assets.loadImageAsset("hold_fire_" + i, `./assets/hold/Note-Hold-Holding-Textures-Hold_Fire-Hold_Fire_000${i<10?"0":""}${i}.png`)
            );
        }
        for(var i=57; i<=74; i++) {
            proms.push(
                Assets.loadImageAsset("hold_" + i, `./assets/hold/Note-Hold-Bloom-Textures-Hold_Boom_000${i}.png`),
                Assets.loadImageAsset("lh_" + (i + 1), `./assets/longhold/Note-LongHold-Bloom-Textures-LongHold_Boom_000${(i + 1)}.png`)
            );
        }

        for(var i=0; i<=46; i++) {
            proms.push(
                Assets.loadImageAsset("hold_line_" + i, `./assets/hold/Hold_Line_Single_000${i<10?"0":""}${i}.png`)
            );
        }

        for(var i=0; i<=40; i++) {
            proms.push(
                Assets.loadImageAsset("lh_" + i, `./assets/longhold/Note-LongHold-Enter-Textures-LongHold_in-LongHold_in_000${i<10?"0":""}${i}.png`)
            );
        }

        for(var i=0; i<=57; i++) {
            var j = 1874 + i;
            proms.push(
                Assets.loadImageAsset("lh_line_" + i, `./assets/longhold/Hold_Line_Sample_0${j}.png`)
            );
        }
        for(var i=41; i<=58; i++) {
            proms.push(
                Assets.loadImageAsset("lh_back_in_" + i, `./assets/longhold/Note-LongHold-Holding-Textures-LongHold_Back_in-LongHold_Back_in_000${i}.png`)
            );
        }
        for(var i=58; i<=73; i++) {
            proms.push(
                Assets.loadImageAsset("lh_back_loop_" + i, `./assets/longhold/Note-LongHold-Holding-Textures-LongHold_Back_loop-LongHold_Back_loop_000${i}.png`)
            );
        }
        for(var i=41; i<=57; i++) {
            proms.push(
                Assets.loadImageAsset("lh_btn_" + i, `./assets/longhold/Note-LongHold-Holding-Textures-LongHold_Button_in-LongHold_Button_in_000${i<10?"0":""}${i}.png`)
            );
        }
        for(var i=58; i<=75; i++) {
            proms.push(
                Assets.loadImageAsset("lh_" + i, `./assets/longhold/Note-LongHold-Bloom-Textures-LongHold_Boom_000${i<10?"0":""}${i}.png`)
            );
        }

        for(var i=0; i<=30; i++) {
            proms.push(
                Assets.loadImageAsset("hold_fire_" + i, `./assets/hold/Note-Hold-Holding-Textures-Hold_Fire-Hold_Fire_000${i<10?"0":""}${i}.png`),
                Assets.loadImageAsset("lh_fire_" + i, `./assets/longhold/Note-LongHold-Holding-Textures-LongHold_Fire-LongHold_Fire_000${i<10?"0":""}${i}.png`)
            );
        }
        proms.push(
            Assets.loadImageAsset("hold_light", `./assets/hold/Hold_Line_Light.png`)
        );

        Promise.all(proms).then(() => {
            this.log("Done!", "Cytus2");
            this.isAllNoteAssetsLoaded = true;
        });
    }

    public tickTimeMap: number[] = [];

    public getTimeByTick(tick: number) {
        if(this.tickTimeMap[tick] != null) {
            return this.tickTimeMap[tick];
        }

        if(tick > 0) {
            var c = this.getMsPerTick(tick, this.chart?.timeBase ?? 480);
            var l = this.tickTimeMap.length - 1;
            var a = tick - l;
            return c * a;
        } else {
            var c = this.getMsPerTick(1, this.chart?.timeBase ?? 480);
            var a = tick;
            return c * a;
        }
    }

    public refreshTickTimer() {
        var map = this.chart;
        if(map == null) return;

        var pages = map.pages.sort((a, b) => a.startTick - b.startTick);
        var totalTicks = pages[pages.length - 1].endTick;
        var timeBase = map.timeBase;
        var counter = 0;
        this.tickTimeMap = [0];

        for(var i=0; i<totalTicks; i++) {
            var currentMsPerTick = this.getMsPerTick(i, timeBase);
            counter += currentMsPerTick;
            this.tickTimeMap.push(counter);
        }
    }
    
    public getMsPerTick(tick: number, timeBase: number) {
        return this.getTempo(tick).value / timeBase
    }
    
    public getTempo(tick: number) {
        var map = this.chart;
        if(map == null) {
            throw new Error("Chart is not loaded");
        }

        var tempos = map.tempos;
        
        var result = tempos.find(t => t.tick <= tick);
        return result || tempos[0];
    }

    public getPage(tick: number) {
        var map = this.chart;
        if(map == null) {
            throw new Error("Chart is not loaded");
        }
        
        return map.pages.find(p => p.endTick >= tick) || map.pages[0];
    }

    public getPageIndex(tick: number) {
        var map = this.chart;
        if(map == null) {
            throw new Error("Chart is not loaded");
        }

        return map.pages.findIndex(p => p.endTick >= tick);
    }
    
    public getYPosition(page: Page, tick: number) {
        var args = page.posFunc?.Arguments ?? [1, 0];
        var ch = this.canvas.height;
        var h = this.fieldHeight * (this.bandoriMode ? 1 : args[0]);
        var bottomY = ch / 2 + h / 2;
        var topY = ch - bottomY;

        topY += 23 * this.ratio;
        bottomY += 23 * this.ratio;

        if(this.bandoriMode) {
            var stayTime = 5.5 - (this.bandoriSpeed - 1) / 2;
            var t = this.currentTick;
            var result = bottomY - ((tick - t) / stayTime * 0.85) * this.ratio;
            return result;
        }

        topY -= this.fieldHeight / 2 * args[1];
        bottomY -= this.fieldHeight / 2 * args[1];

        var yPerTick = h / page.getTickLength();
        var pos = (tick - page.startTick) * yPerTick;
        if(page.scanLineDirection == 1) {
            return bottomY - pos;
        } else {
            return topY + pos;
        }
    }

    public chart: Beatmap | null = null;
    public musicTitle: string = "Secret";
    public chartDifficulty: RendererChartDiff = {
        name: "CHAOS",
        color: "#a81ca8",
        backColor: "#a81ca8",
        level: 12
    };
    public icon: HTMLImageElement | ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null = null;
    public background: HTMLImageElement | ImageBitmap | OffscreenCanvas | HTMLCanvasElement | null = null;
    public themeColor: string = "#cd8145"; 

    parseMap(map: Beatmap, { audio, ...meta }: RendererChartMetaInit) {
        this.chart = map;
        this.refreshTickTimer();

        var lastNoteTick = 0;
        map.notes.forEach(n => {
            lastNoteTick = Math.max(n.tick, lastNoteTick);
        });
        this.lastNoteTick = lastNoteTick;

        // Meta
        this.playMusic(audio);
        if(meta.title) {
            this.musicTitle = meta.title;
        }
        if(meta.difficulty) {
            this.chartDifficulty = {
                name: meta.difficulty.name,
                color: meta.difficulty.color,
                backColor: meta.difficulty.color,
                level: meta.difficulty.level,
            };
        }
        if(meta.icon) {
            var icon = new Image();
            icon.onload = () => {
                this.icon = icon;
            }
            icon.src = meta.icon;
        }

        if(meta.background) {
            var bg = new Image();
            bg.onload = () => {
                this.background = bg;
            }
            bg.src = meta.background;
        }

        if(meta.themeColor) {
            this.themeColor = meta.themeColor;
        }

        this.log(`Loaded chart: ${(meta?.title ?? "<unknown>")} [${(meta?.difficulty?.name ?? "<unknown>")} ${(meta?.difficulty?.level ?? "<?>")}]...`, "Cytus2");
    }

    public loadMap(src: string, meta: RendererChartMetaInit) {
        return new Promise<void>((resolve, _) => {
            fetch(src, {
                cache: "no-cache"
            }).then(r => r.json())
            .then(json => {
                this.parseMap(Beatmap.deserialize(json), meta);
                resolve();
            });
        });
    }

    public playMusic(src: string) {
        this.audioElem.src = src;
        if(!this.audioCompatMode) {
            var ctx = this.audioContext;
            fetch(src)
                .then(r => r.arrayBuffer())
                .then(buf => ctx.decodeAudioData(buf))
                .then(buf => {
                    this.activeAudioBuffer = buf;
                    var s = ctx.createBufferSource();
                    s.buffer = buf;

                    if(this.audioSource != null) {
                        this.audioSource.stop();
                        this.audioSource.disconnect();
                    }
                    this.audioSource = s;
                    s.connect(this.audioAnalyser);
                    s.start(0);
                    this.audioElem.play();
                });
        } else {
            var ctx = this.audioContext;
            fetch(src)
                .then(r => r.arrayBuffer())
                .then(arr => {
                    // @ts-ignore
                    var buf = ctx.createBuffer(arr, false);
                    this.activeAudioBuffer = buf;
                    var s = ctx.createBufferSource();
                    s.buffer = buf;

                    if(this.audioSource != null) {
                        this.audioSource.stop();
                        this.audioSource.disconnect();
                    }
                    this.audioSource = s;
                    s.connect(this.audioAnalyser);
                    s.start(0);
                    this.audioElem.play();
                });
        }
    }

    public getModeWidth() {
        return this.fieldWidth * (this.bandoriMode ? 0.8 : 1);
    }

    public update() {
        window.requestAnimationFrame(() => {
            this.update();
        });

        var deltaTime = performance.now() - this.lastRenderTime;
        if(deltaTime < 1000 / this.maxFPS) return;
        this.lastRenderTime = performance.now();
        this.defaultLines.fpsWarning.hidden = deltaTime < 1000 / 20;
        
        /** 
        if(this.isPlaying && this.audioContext.state == "running") {
            this.playbackTime += deltaTime / 1000 * this.audioElem.playbackRate;
        }*/
        this.playbackTime = Maths.lerp(this.playbackTime, this.audioElem.currentTime, this.isPlaying ? 1 : (deltaTime / 100));

        if(!this.audioCompatMode) {
            this.gainNode.gain.value = this.audioElem.volume;
        } else {
            // this.audioElem.volume = 0;
        }

        if(innerWidth < innerHeight) {
            this.canvas.classList.remove("fullscreen");
        }

        this.currentTick = this.tickTimeMap.findIndex(t => t >= this.playbackTime * 1000);
        if(this.currentTick == -1) this.currentTick = this.tickTimeMap.length - 1;

        this._renderReset();
        this._renderBack();
        this._renderNotes();
        this._renderUI();

        if(this.enableOverlay) {
            this._renderOverlay();
        }

        this._renderDebug(deltaTime);

        var removalObjectsIdx: any[] = [];
        this.animatedObjects.forEach((obj, i) => {
            obj.update(this);
            if(obj.isFinished) removalObjectsIdx.push(i);
        });
        removalObjectsIdx.reverse().forEach(i => {
            this.animatedObjects.splice(i, 1);
        });
    }

    private _renderReset() {
        var ctx = this.context;
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 0;
        ctx.textBaseline = "bottom";

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    private _renderBack() {
        var canvas = this.canvas;
        var ctx = this.context;
        var background = this.background;
        if(background) {
            var sc = canvas.width / background.width;
            ctx.drawImage(background, 0, (canvas.height - (background.height * sc)) / 2, canvas.width, background.height * sc);
        }

        var icon = this.icon;
        if(icon) {
            var size = 600 * this.ratio;
            ctx.globalAlpha = 0.1;
            ctx.drawImage(icon, canvas.width - size / 4 * 3, canvas.height - size / 4 * 3, size, size);
        }

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;

        this._renderComboFX();
    }

    private _renderComboFX() {
        var lastFXTime = 0;
        var combo = 0;

        var comboStep = this.comboFxStep;

        if(this.chart) {
            var n = this.chart.comboSortedNotes;
            if(n == null) {
                this.chart.initComboSortedNotes();
                n = this.chart.comboSortedNotes!;
            }
            n.forEach(n => {
                if(n instanceof LongHoldNote || n instanceof HoldNote) {
                    var endTick = n.getEndTick();
                    if(this.currentTick > endTick) {
                        combo++;
                        if(combo % comboStep == 0) {
                            lastFXTime = this.getTimeByTick(endTick);
                        }
                    }
                } else {
                    if(this.currentTick > n.tick) {
                        combo++;
                        if(combo % comboStep == 0) {
                            lastFXTime = this.getTimeByTick(n.tick);
                        }
                    }
                }
            });
        }

        combo = Math.floor(combo / comboStep) * comboStep;
        if(combo == 0) return;

        var duration = 1500;
        var progress = (this.playbackTime * 1000 - lastFXTime) / duration;
        if(progress > 1) return;


        var canvas = this.canvas;
        var ctx = this.context;

        var fCanvas = this.comboFxCanvas;
        fCanvas.width = canvas.width;
        fCanvas.height = canvas.height;

        /** @type {CanvasRenderingContext2D} */
        var fCtx = this.comboFxCtx;

        // Draw striped background
        if(!Assets.comboFXBack) {
            var dCanvas = document.createElement("canvas");
            var dCtx = dCanvas.getContext("2d");
            if(!dCtx) {
                throw new Error("Context lost");
            }
            dCanvas.width = 1920;
            dCanvas.height = 1080;
            dCtx.clearRect(0, 0, 1920, 1080);
            dCtx.lineWidth = 3840;
            dCtx.strokeStyle = "#000";
            dCtx.setLineDash([3, 6]);
            dCtx.beginPath();
            dCtx.moveTo(0, 0);
            dCtx.lineTo(1920, 1080);
            dCtx.stroke();
            Assets.comboFXBack = dCanvas;
        }
        fCtx.drawImage(Assets.comboFXBack, 0, 0, canvas.width, canvas.height);

        // Draw text and clip
        fCtx.globalCompositeOperation = "source-in";
        fCtx.textAlign = "center";
        fCtx.textBaseline = "middle";
        fCtx.font = (canvas.height / 2) + "px 'Source Sans Pro', sans-serif";
        fCtx.fillStyle = "#f55";
        fCtx.fillText(combo + "", canvas.width / 2, canvas.height * 0.55);
        fCtx.globalCompositeOperation = "source-over";

        var sizeA = Math.min(1, progress * 4);
        sizeA = 1 - Math.pow(1 - sizeA, 3);
        var wA = sizeA * canvas.width;
        var hA = sizeA * canvas.height;

        var sizeB = Math.max(0, Math.min(1, (progress) * 1.75));
        sizeB = 1 - Math.pow((1 - sizeB), 3);
        sizeB *= 1.25;
        sizeB = Math.max(sizeA, sizeB);
        var wB = sizeB * canvas.width;
        var hB = sizeB * canvas.height;

        var oA = Math.max(0, Math.min(1, progress * 2));
        oA = 1 - Math.pow(oA, 2);

        var oB = Math.max(0, Math.min(1, (progress ) * 2));
        oB = 1 - Math.pow(oB, 4);
        oB *= 0.25;

        var sc = 1.1;
        wA *= sc; hA *= sc;
        wB *= sc; hB *= sc;

        ctx.globalAlpha = oA;
        ctx.drawImage(fCanvas, (canvas.width - wA) / 2, (canvas.height - hA) / 2, wA, hA);
        ctx.filter = `blur(${3 * this.ratio}px)`;
        ctx.globalAlpha = oB;
        ctx.drawImage(fCanvas, (canvas.width - wB) / 2, (canvas.height - hB) / 2, wB, hB);
        ctx.filter = "none";

        ctx.globalAlpha = 1;
    }

    private _renderNotes() {
        var canvas = this.canvas;
        var ctx = this.context;
        var ch = canvas.height;

        // Top & bottom dash lines
        var page = this.chart ? this.getPage(this.currentTick) : null;
        var rbp = (page == null || page.startTick == 0) ? 1 : ((this.currentTick - page.startTick) / (page.endTick - page.startTick));
        var ctxt = ctx.getTransform();

        ctx.globalAlpha = 0.5;
        var bottomY = ch / 2 + this.fieldHeight / 2;
        var topY = ch - bottomY;

        topY += 23 * this.ratio;
        bottomY += 23 * this.ratio;

        ctx.strokeStyle = "#fff";
        ctx.setLineDash([3 * this.ratio, 122 * this.ratio]);

        ctx.translate(-(performance.now() % 1500) / 1500 * 125 * this.ratio, 0);
        ctx.lineWidth = 7 * this.ratio;
        if(page && page.scanLineDirection == -1) ctx.lineWidth += (Math.pow(1 - rbp, 10) * 15) * this.ratio;
        ctx.beginPath();
        ctx.moveTo(-50 * this.ratio, topY);
        ctx.lineTo(canvas.width + 50 * this.ratio, topY);
        ctx.stroke();

        ctx.setTransform(ctxt);
        ctx.translate((performance.now() % 1500) / 1500 * 125 * this.ratio, 0);
        ctx.lineWidth = 7 * this.ratio;
        if(page && page.scanLineDirection == 1) ctx.lineWidth += (Math.pow(1 - rbp, 10) * 15) * this.ratio;
        ctx.beginPath();
        ctx.moveTo(-50 * this.ratio, bottomY);
        ctx.lineTo(canvas.width + 50 * this.ratio, bottomY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();

        ctx.setTransform(ctxt);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0;

        if(this.chart) {
            var notes = this.chart.notes;

            var sliderNotes = [];
            var holdNotes = [];
            var otherNotes = [];

            for(var i = notes.length - 1; i >= 0; i--) {
                var n = notes[i];
                if(n instanceof SliderNote) {
                    sliderNotes.push(n);
                } else if(n instanceof HoldNote || n instanceof LongHoldNote) {
                    holdNotes.push(n);
                } else if(!(n instanceof SliderNode)) {
                    otherNotes.push(n);
                }
            }

            for(var i = holdNotes.length - 1; i >= 0; i--) {
                var h = holdNotes[i];

                try {
                    h.update(this);
                } catch(ex) {
                    var line = new LogLine(`Error while rendering note: ${h}, ${ex}`);
                    line.badge.text = "Cytus2";
                    line.badge.background = "#ff7b51";
                    this.debugLines.push(line);
                }
            }

            for(var i = sliderNotes.length - 1; i >= 0; i--) {
                var note = sliderNotes[i];
                var endTime = this.tickTimeMap[note.getEndTick()];
                var startTime = this.tickTimeMap[note.tick] - note.duration;
                var time = this.playbackTime * 1000;

                if(time > startTime && time < endTime) {
                    note.drawDashedPath(this);
                }
            }

            var rNotes: Note[] = [];
            rNotes.push.apply(rNotes, sliderNotes);
            rNotes.push.apply(rNotes, otherNotes);

            for(var i = rNotes.length - 1; i >= 0; i--) {
                var n = rNotes[i];

                try {
                    n.update(this);
                } catch(ex) {
                    var line = new LogLine(`Error while rendering note: ${n}, ${ex}`);
                    line.badge.text = "Cytus2";
                    line.badge.color = "#ff7b51";
                    this.debugLines.push(line);
                }
            }
        }
    }

    private _renderUI() {
        var canvas = this.canvas;
        var ctx = this.context;

        // TODO: Automation
        var uiAnimData = {
            type: 6,
            args: "0,1,2,3,4,5,6,7",
            progress: Math.min(1, this.playbackTime / 2),

            scanLineAlpha: null,
            scanLineMutateProgress: null
        };

        if(this.chart) {
            var events: EventOrder[] = [];
            events.push.apply(events, this.chart.eventOrders);

            // UI Animation
            events.forEach(e => {
                if(e.tick <= this.currentTick && [2, 3, 4, 5, 6, 7].indexOf(e.type) != -1) {
                    e.renderUIAnim(this, uiAnimData);
                }
            });
        }
        
        var grd = ctx.createLinearGradient(0, 0, 0, canvas.height / 6);
        grd.addColorStop(0, "black");
        grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var font1 = "Rajdhani, 'Noto Sans CJK TC'";
        var font2 = "Electronize, 'Noto Sans CJK TC'";

        this._renderScanline(uiAnimData);
        this._renderMusicChartInfo(uiAnimData);

        if(this.audioContext.state == "suspended") {
            this.defaultLines.acLog.content = "AudioContext is suspended.";
            ctx.font = `700 ${36 * this.ratio}px ${font1}`;
            ctx.fillStyle = "white";
            if(Assets.muted) {
                ctx.globalAlpha = 0.75;
                ctx.drawImage(Assets.muted, 58 * this.ratio, 40 * this.ratio, 47 * this.ratio, 47 * this.ratio);
            }
            ctx.globalAlpha = 0.5;
            ctx.fillText("Tap to start", 135 * this.ratio, 67 * this.ratio);
            ctx.globalAlpha = 1;
        } else {
            this.defaultLines.acLog.content = "AudioContext is working.";
        }

        // Play bar.
        var audioProgress = this.playbackTime / this.audioElem.duration;
        ctx.fillStyle = this.themeColor;
        ctx.fillRect(0, 0, canvas.width * audioProgress, 6 * this.ratio);
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowOffsetY = this.ratio * 2;
        ctx.fillRect(canvas.width * audioProgress - 5 * this.ratio, 0, 10 * this.ratio, 6 * this.ratio);

        ctx.globalAlpha = 0.1;
        ctx.shadowColor = ctx.fillStyle = "#fff";
        ctx.fillRect(canvas.width * audioProgress - 2.5 * this.ratio, 0, 5 * this.ratio, 6 * this.ratio);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        var drawText = (txt: string, space: number, y: number, s: number) => {
            var width = space * (txt.length - 1);
            var anchor = 107 * this.ratio;
            y -= anchor;
            for(var i=0; i<txt.length; i++) {
                var c = txt[i];
                var x = canvas.width / 2 - width / 2 + space * i;
                x -= canvas.width / 2;

                var t = ctx.getTransform();
                ctx.translate(canvas.width / 2, anchor);
                ctx.scale(s, s);
                ctx.fillText(c, x, y);
                ctx.setTransform(t);
            }
        }

        var lastClearTime = -5000;
        var count = 0;
        if(this.chart) {
            this.chart.notes.forEach(n => {
                if(n instanceof LongHoldNote || n instanceof HoldNote) {
                    var endTick = n.getEndTick();
                    if(this.currentTick > endTick) {
                        lastClearTime = this.tickTimeMap[endTick];
                        count++;
                    }
                } else {
                    if(this.currentTick > n.tick) {
                        lastClearTime = this.tickTimeMap[n.tick];
                        count++;
                    }
                }
            });
        }

        var time = this.playbackTime * 1000;
        var comboScale = (1 - Math.pow(Math.min(Math.max((time - lastClearTime) / 300, 0), 1), 0.25)) / 4.5 + 1;

        ctx.textAlign = "center";
        ctx.font = `700 ${84 * this.ratio}px ${font1}`;
        ctx.fillStyle = "#fff176";
        if(count > 1) drawText(count + "", 56 * this.ratio, 64 * this.ratio, comboScale);
        ctx.font = `500 ${29 * this.ratio}px ${font1}`;
        ctx.fillStyle = "#fff";
        drawText("COMBO", 28 * this.ratio, 107 * this.ratio, comboScale);
        ctx.textAlign = "left";

        this._renderAnalyser();

        var score = (n => {
            if(n == 0) return "000000";
            var d = Math.log10(n + 1);
            var r = "";
            for(var i=0; i < 5 - d; i++) {
                r += "0";
            }
            return r + n;
        })((() => {
            var s = 0;
            if(!this.chart) return 0;
            var N = this.chart.notes.length;
            this.chart.notes.forEach((_, i) => {
                if(i < count)
                s += 900000 / N + 200000 / (N * (N - 1)) * i;
            });
            return Math.round(s);
        })());

        ctx.textBaseline = "alphabetic";
        ctx.font = "700 " + (58.5 * this.ratio) + "px " + font1;
        ctx.fillStyle = "white";
        ctx.shadowColor = ctx.fillStyle;
        ctx.textAlign = "center";
        var sc = (1 - Math.pow(Math.min(Math.max((time - lastClearTime) / 300, 0), 1), 1 / 2.5)) / 2.5 + 1;

        score.split("").reverse().forEach((c, i) => {
            var d = Math.log10(parseInt(score) + 1);
            var s = 6 - d < (6 - i) ? Math.pow(sc, 1): 1;
            var x = canvas.width - (45 + i * 40) * this.ratio;
            var y = 93 * this.ratio;
            ctx.translate(x, y);
            ctx.scale(s, s);
            ctx.fillText(c, 0, -(s - 1) * this.ratio * 3);
            ctx.scale(1 / s, 1 / s);
            ctx.translate(-x, -y);
        });

        var sn = parseInt(score);
        if(this.lastScore < sn && sn == 1000000 && this.isPlaying && !this.enableMMEffect) {
            this.playMMEffect();
        }

        this.lastScore = parseInt(score);
    }

    private _renderScanline(uiAnimData: any) {
        var canvas = this.canvas;
        var ctx = this.context;
        var alpha = 1;

        if(uiAnimData.scanLineAlpha != null) {
            alpha = uiAnimData.scanLineAlpha;
        }

        if(this.chart) {
            var mutatingTicks = this.chart.pages[0].getTickLength() / 3 * 2;
            var sample = 100;

            var mutateProgress = Math.max(0, mutatingTicks - (this.currentTick - this.chart.pages[0].startTick)) / mutatingTicks;
            if(uiAnimData.scanLineMutateProgress != null) {
                mutateProgress = uiAnimData.scanLineMutateProgress;
            }

            var page = this.getPage(this.currentTick);
            var y = this.getYPosition(page, this.currentTick);

            ctx.globalAlpha = alpha;
            if(mutateProgress > 0) {
                var amount = mutateProgress * 20 * this.ratio;
                var width = canvas.width * (1 - mutateProgress);
                var startX = canvas.width * mutateProgress / 2;
                y = canvas.height / 2 - (canvas.height / 2 - y) * (1 - mutateProgress);

                ctx.lineWidth = 5 * this.ratio;
                ctx.strokeStyle = "#fff";
                ctx.beginPath();
                ctx.moveTo(startX, y);
                for(var i=1; i<=sample; i++) {
                    var yOffset = amount * Math.random() - 1;
                    ctx.lineTo(startX + width / sample * i, y + yOffset);
                }
                ctx.stroke();
                ctx.lineWidth = 0;
            } else {
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, y - 1.5 * this.ratio, canvas.width, 5 * this.ratio);
            }

            var events: EventOrder[]= [];
            events.push.apply(events, this.chart.eventOrders);

            // Scanline
            var scanLineRendered = false;
            events.forEach(e => {
                if([0, 1, 8].indexOf(e.type) != -1) {
                    e.renderLine(this);
                }
            });
            events.reverse().forEach(e => {
                if(scanLineRendered) return;
                if(e.tick <= this.currentTick && [0, 1, 8].indexOf(e.type) != -1) {
                    e.renderText(this);
                    scanLineRendered = true;
                }
            });
        }

        ctx.globalAlpha = 1;
    }

    private _renderMusicChartInfo(uiAnimData: any) {
        var canvas = this.canvas;
        var ctx = this.context;
        canvas.style.letterSpacing = "0px";

        var font1 = "Rajdhani, 'Noto Sans CJK TC', sans-serif";
        var font2 = "Electrolize, 'Noto Sans CJK TC', sans-serif";

        // Song title
        ctx.globalAlpha = 0.3;
        var icon = this.icon;
        if(icon) {
            var size = 64 * this.ratio;
            ctx.drawImage(icon, 47 * this.ratio, canvas.height - 95 * this.ratio, size, size);
        }

        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "white";
        ctx.font = `700 ${38 * this.ratio}px ${font1}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(this.musicTitle, 132 * this.ratio, canvas.height - 58.5 * this.ratio);

        // Song difficulty
        ctx.font = `400 ${37.8 * this.ratio}px ${font2}`;
        var diffText = this.chartDifficulty.name + " " + this.chartDifficulty.level;
        var diffColor = this.chartDifficulty.color;
        var diffBackColor = this.chartDifficulty.backColor;

        var diffWidth = ctx.measureText(diffText).width + 30 * this.ratio;
        var diffRectX = canvas.width - diffWidth - 35 * this.ratio;
        var diffRectY = canvas.height - 70 * this.ratio;

        ctx.fillStyle = diffBackColor;
        ctx.fillRect(diffRectX, diffRectY, diffWidth, 40 * this.ratio);
        ctx.fillStyle = "#000";
        ctx.fillRect(diffRectX, diffRectY, diffWidth, 40 * this.ratio);

        ctx.globalAlpha = 1;
        ctx.fillStyle = diffColor;
        ctx.fillText(diffText, diffRectX + 15 * this.ratio, diffRectY + 22.5 * this.ratio);
    }

    private _renderAnalyser() {
        var canvas = this.canvas;
        var cw = canvas.width;
        var ctx = this.context;
        var buflen = this.audioAnalyser.frequencyBinCount * 0.15;
        var buffer = new Uint8Array(buflen);
        this.audioAnalyser.getByteFrequencyData(buffer);

        var indexes = [];
        for(var i=0; i<8; i++) {
            indexes.push(Math.floor(buflen / 8 * i));
        }

        var distance = 115;

        (() => {
            ctx.translate(cw / 2, 0);
            var stroke = ctx.strokeStyle;
            ctx.strokeStyle = "#fff";
            ctx.beginPath();
            indexes.reverse().forEach((i, o) => {
                var y = (22 + o * 11.8) * this.ratio;
                ctx.moveTo(distance * this.ratio, y);
                ctx.lineTo((distance + Math.pow(buffer[i] / 255, 1.5) * 150) * this.ratio, y);
                ctx.moveTo(-distance * this.ratio, y);
                ctx.lineTo((distance + Math.pow(buffer[i] / 255, 1.5) * 150) * -this.ratio, y);
            });
            ctx.setLineDash([5 * this.ratio, 15 * this.ratio]);
            ctx.lineWidth = 3 * this.ratio;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = stroke;
            ctx.translate(-cw / 2, 0);
        })();
    }

    private _renderOverlay() {
        var ctx = this.context;
        var img = new Image();
        img.src = "./assets/overlay.png";
        if(img.width != 0) {
            ctx.globalAlpha = 0.5;
            ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalAlpha = 1;
        }
    }

    private _renderDebug(deltaTime: number) {
        var canvas = this.canvas;
        var ctx = this.context;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        var preferredFont = Assets.preferredFont;

        var removalLines: number[] = [];
        var pn = performance.now();
        var counter = 0;
        var persistentCount = 0;
        var persistentRenderCount = 0;
        this.debugLines.forEach(l => (l.persistent && !l.hidden) ? persistentCount++ : 0);
        
        this.defaultLines.resLog.content = `Resolution: ${this.canvas.width}x${this.canvas.height} @ ${Math.round(this.ratio*1000)/1000}x`;
        this.defaultLines.fpsLog.content = "FPS: " + (Math.round(100000 / deltaTime) / 100);

        var ratio = this.debugUseGameRatio ? this.ratio : 1;
            
        Arrays.reversedCopy(this.debugLines).forEach((line: LogLine, i: number) => {
            if(!line.createdTime) {
                line.createdTime = performance.now();
            }

            ctx.globalAlpha = Math.sqrt(Math.max((pn - line.createdTime) / 100, 0));

            if((!line.persistent ? persistentCount - persistentRenderCount : 0) + counter >= this.debugLogCount || line.hidden) {
                if(!line.fadedTime) {
                    line.fadedTime = performance.now() + 100;
                }
                ctx.globalAlpha = Maths.lerp(0, ctx.globalAlpha, Math.max((line.fadedTime - pn) / 100, 0));
            } else {
                counter++;
                if(!!line.fadedTime) {
                    line.fadedTime = null;
                    line.createdTime = performance.now();
                }
                if(line.persistent) persistentRenderCount++;
            }

            var targetY = canvas.height / ratio - counter * 35;
            line.y = Maths.lerp(line.y || targetY + 30, targetY, Math.min(1, deltaTime / 100));

            if(line.fadedTime != null && pn - line.fadedTime > 500 && !line.persistent) {
                removalLines.push(this.debugLines.length - 1 - i);
            } 

            if(this.enableDebugLog && line.y > -100) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctx.font = "600 " + (18 * ratio) + "px " + preferredFont;
                var badgeWidth = ctx.measureText(line.badge.text).width;
                ctx.font = "600 " + (19 * ratio) + "px " + preferredFont;
                var contentWidth = ctx.measureText(line.content).width;
                ctx.fillRect(0, line.y * ratio, contentWidth + (32 + 10) * ratio + badgeWidth, 30 * ratio);

                ctx.fillStyle = line.badge.background;
                ctx.fillRect(10 * ratio, (line.y + 3) * ratio, badgeWidth + 16 * ratio, 26 * ratio);
                ctx.fillStyle = line.badge.color;
                ctx.fillText(line.badge.text, 16 * ratio, (line.y + 17) * ratio);

                ctx.fillStyle = "white";
                ctx.font = "600 " + (19 * ratio) + "px " + preferredFont;
                ctx.fillText(line.content, 32 * ratio + badgeWidth, (line.y + 17) * ratio);
            }
            ctx.globalAlpha = 1;
        });

        removalLines.forEach(l => {
            this.removeLogLine(null, l);
        });

        ctx.textBaseline = "alphabetic";
    }

    public addLogLine(content: string) {
        var line = new LogLine(content);
        this.debugLines.push(line);
        return line;
    }
    
    public removeLogLine(line: LogLine | null, i?: number) {
        this.debugLines.splice(i == null ? this.debugLines.indexOf(line!) : i, 1);
    }

    public playMMEffect() {
        this.playOneShotAudio(Assets.mm_audio);
        var obj = new AnimatedObject();
        obj.data.startTime = performance.now();
        obj.update = (game: Renderer) => {
            var ctx = this.context;
            var time = performance.now() - obj.data.startTime;
            var duration = 3000;
            var spriteId = Math.round(Math.max(0, Math.min(85, Maths.lerp(0, 85, time / duration))));
            if(spriteId > 36 && spriteId < 65) spriteId = 36;
            var texture = Assets["mm_" + spriteId];

            var x = this.canvas.width / 2;
            var y = this.canvas.height / 2;
            var size = 1.5 * this.ratio;

            if(texture) {
                ctx.drawImage(texture, x - texture.width / 2 * size, y - texture.height / 2 * size, texture.width * size, texture.height * size);
            }

            if(time > duration) obj.isFinished = true;
        };
        this.animatedObjects.push(obj);
    }
}