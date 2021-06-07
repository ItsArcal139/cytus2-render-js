($ => {
    class TimingPoints {
        constructor({time: time, bpm: bpm, ...params}) {
            this.time = time || 0;
            this.bpm = bpm || 60;

            Object.keys(params).forEach(k => {
                this[k] = params[k];
            });
        }
    }

    var Assets = {
        preferredFont: `Exo, "Noto Sans CJK TC", sans-serif`,
        loadImageAsset(name, source) {
            return new Promise((resolve, _) => {
                var img = new Image();
                img.src = source;
                img.onload = () => {
                    resolve();
                };
                this[name] = img;
            });
        },
        loadAudioAsset(name, source) {
            return new Promise((resolve, _) => {
                
            });
        }
    };
    $.Assets = Assets;

    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var AudioManager = {
        context: new AudioContext(),
        setup() {
            this.context.suspend();
        }
    };

    class LogLine {
        constructor(content) {
            this.y = null; // Updated by Game.update()
            this.content = content;
            this.createdTime = null;
            this.fadedTime = null;

            this.badge = {
                text: "Debug",
                background: "#888",
                color: "white"
            };

            this.persistent = false;
            this.hidden = false;
        }
    }

    class BeatmapMeta {
        constructor({title, romanizedTitle, cover, audio, offset, ...params}) {
            this.title = title || "Unknown";
            this.romanizedTitle = romanizedTitle || "Unknown";
            this.cover = cover || "./assets/cover.jpeg";
            this.audio = audio;
            this.offset = offset === undefined ? 0 : offset;

            Object.keys(params).forEach(s => {
                this[s] = params[s];
            });
        }
    }

    class Beatmap {
        /**
         * 
         * @param {BeatmapMeta} meta 
         */
        constructor(meta) {
            this.song = meta || new BeatmapMeta();

            /** @type {TimingPoints[]} */
            this.timingPoints = [];

            /** @type {Note[]} */
            this.notes = [];
        }

        static bindProto(raw) {
            raw.__proto__ = Beatmap.prototype;
            raw.song = new BeatmapMeta(raw.song);
            return raw;
        }

        /**
         * @param {any} json 
         * @param {{ offset: number, cover: string, audio: string, params: any[]}} config 
         * @returns {Beatmap}
         */
        static parseBestdoriMap(json, { offset, cover, audio, ...params}) {
            var map = new Beatmap(new BeatmapMeta({
                title: "Not imported map",
                romanizedTitle: "Download from Bestdori!",
                cover: cover || "./assets/cover.jpeg",
                audio: audio,
                offset: offset === undefined ? 0 : offset,
                ...params
            }));

            /** @type { {type: "slider", x: number, time: number, nodes: { x: number, time: number }}[] } */
            var pendSliders = [];

            var searchSiblingSlider = (x, time) => {
                for(var i=0; i<pendSliders.length; i++) {
                    var s = pendSliders[i];
                    var n = s.nodes[s.nodes.length - 1];
                    if(Math.abs(n.x - x) < 0.1 && Math.abs(n.time - time) < 1) {
                        return s;
                    }
                }
                return null;
            };

            function laneToX(lane) {
                var range = 0.6;
                return K.Maths.lerp(-0.9, 0.9, (lane - 1) / 6);
            }

            json.forEach(event => {
                if(event.type == "BPM") {
                    map.timingPoints.push({ time: event.time * 1000, bpm: event.bpm });
                }
                if(event.type == "Single" || event.type == "SingleOff" || event.type == "Skill") {
                    map.notes.push({
                        type: "circle", x: laneToX(event.lane),
                        time: event.time * 1000, snap: 1000
                    });
                }
                if(event.type == "Flick") {
                    map.notes.push({
                        type: "flick", x: laneToX(event.lane),
                        time: event.time * 1000, snap: 1000
                    });
                }

                if(event.type == "Bar") {
                    var sibling = searchSiblingSlider(laneToX(event.lane[0]), event.time[0] * 1000);
                    if(sibling == null) {
                        pendSliders.push({
                            type: "slider", x: laneToX(event.lane[0]),
                            time: event.time[0] * 1000, snap: 1000,
                            nodes: [
                                { x: laneToX(event.lane[1]), time: event.time[1] * 1000, snap: 1000 }
                            ]
                        });
                    } else {
                        sibling.nodes.push(
                            { x: laneToX(event.lane[1]), time: event.time[1] * 1000, snap: 1000 }
                        );
                    }
                }
            });

            pendSliders = pendSliders.map(s => {
                // Remove circles overlapping the slider start.
                var removalNotes = [];
                map.notes.forEach((sn, i) => {
                    if(sn.type == "circle" && Math.abs(sn.x - s.x) < 0.01 && Math.abs(sn.time - s.time) < 0.1) {
                        removalNotes.push(i);
                    }
                });

                removalNotes.sort((a, b) => b - a).forEach(n => {
                    map.notes.splice(n, 1);
                });

                if(s.nodes.length == 1 && Math.abs(s.nodes[0].x - s.x) < 0.01) {
                    var length = s.nodes[0].time - s.time;
                    return {
                        type: length > 750 ? "longhold" : "hold", x: s.x, time: s.time, endTime: s.nodes[0].time
                    }
                }
                return s;
            });
            map.notes.push.apply(map.notes, pendSliders);
            map.notes = map.notes.sort((a, b) => a.time - b.time);

            console.log(map);
            return map;
        }

        /**
         * @param {any} json 
         * @param {{ offset: number, cover: string, audio: string, params: any[]}} config 
         * @returns {Beatmap}
         */
        static parseBestdoriRawMap(json, { offset, cover, audio, ...params}) {
            var obj = json;
            if(typeof obj === "string") obj = JSON.parse(obj);

            var map = new Beatmap(new BeatmapMeta({
                title: "Not imported map",
                romanizedTitle: "Download from Bestdori!",
                cover: cover || "./assets/cover.jpeg",
                audio: audio,
                offset: offset === undefined ? 0 : offset,
                ...params
            }));

            /** @type { {type: "slider", x: number, time: number, nodes: { x: number, time: number }}[] } */
            var pendSliders = [];

            function laneToX(lane) {
                return K.Maths.lerp(-0.9, 0.9, (lane - 1) / 6);
            }

            var timingPoints = [];

            var sliderA = null;
            var sliderB = null;

            obj.forEach(event => {
                if(event.type == "System" && event.cmd == "BPM") {
                    timingPoints.push({ beat: -event.beat / 2, bpm: event.bpm });
                }
                if(event.type == "Note" && event.note == "Single" && !event.flick) {
                    map.notes.push({
                        type: "circle", x: laneToX(event.lane),
                        time: -event.beat / 2, snap: 1000
                    });
                }
                if(event.type == "Note" && event.flick) {
                    map.notes.push({
                        type: "flick", x: laneToX(event.lane),
                        time: -event.beat / 2, snap: 1000
                    });
                }

                if(event.type == "Note" && event.note == "Slide") {
                    if(event.start) {
                        if(event.pos == "A") {
                            sliderA = { type: "slider", x: laneToX(event.lane),
                            time: -event.beat / 2, snap: 1000, nodes: [] };
                        } else {
                            sliderB = { type: "slider", x: laneToX(event.lane),
                            time: -event.beat / 2, snap: 1000, nodes: [] };
                        }
                    } else {
                        var slider = event.pos == "A" ? sliderA : sliderB;
                        slider.nodes.push({ x: laneToX(event.lane), time: -event.beat / 2, snap: 1000 });

                        if(event.end) {
                            pendSliders.push(slider);

                            if(event.flick) {
                                map.notes.push({
                                    type: "flick", x: laneToX(event.lane),
                                    time: -event.beat / 2, snap: 1000
                                });
                            }

                            if(event.pos == "A") {
                                sliderA = null;
                            } else {
                                sliderB = null;
                            }
                        }
                    }
                }
            });
            
            // Deal with the timing points.
            var prevPoint = null;
            var beatLen = 0;
            var currBeat = 0;
            timingPoints.forEach(p => {
                if(prevPoint != null) {
                    p.time = prevPoint.time + (-p.beat - currBeat) * beatLen;
                } else {
                    p.time = 0;
                }
                beatLen = K.Timings.bpmToMillis(p.bpm);
                prevPoint = p;
            });

            map.timingPoints = timingPoints;

            pendSliders = pendSliders.map(s => {
                // Remove circles overlapping the slider start.
                var removalNotes = [];
                map.notes.forEach((sn, i) => {
                    if(sn.type == "circle" && Math.abs(sn.x - s.x) < 0.01 && Math.abs(sn.time - s.time) < 0.1) {
                        removalNotes.push(i);
                    }
                });

                removalNotes.sort((a, b) => b - a).forEach(n => {
                    map.notes.splice(n, 1);
                });

                if(s.nodes.length == 1 && Math.abs(s.nodes[0].x - s.x) < 0.01) {
                    var length = s.nodes[0].time - s.time;
                    return {
                        type: length > 750 ? "longhold" : "hold", x: s.x, time: s.time, endTime: s.nodes[0].time
                    }
                }
                return s;
            });
            map.notes.push.apply(map.notes, pendSliders);
            map.notes = map.notes.sort((a, b) => a.time - b.time);

            console.log(map);
            return map;
        }
    }

    class Game {
        /**
         * 
         * @param {HTMLCanvasElement} canvas 
         * @param {{ audioCompatMode: boolean, keepInstance: boolean }} config 
         */
        constructor(canvas, { audioCompatMode, keepInstance }) {
            if(!canvas || !canvas.getContext) {
                throw new Error("Invalid canvas parameter");
            }

            // Setup values.
            (() => {
                this.canvas = canvas;
                this._initSize = {
                    w: canvas.width, h: canvas.height
                };
                this.toLowRes();

                this.bandoriMode = false;
                this.bandoriSpeed = 9.5;
                this.bandoriLineY = canvas.height * 0.85;

                this.context = canvas.getContext("2d");

                this.timingPoints = [];
                this.notes = [];
            })();
            
        }
    }
})(window);

Assets.loadImageAsset("muteIcon", "./assets/mute-3-xxl.png");
Assets.loadImageAsset("arrowUpIcon", "./assets/arrow-up.png");
Assets.loadImageAsset("playIcon", "./assets/play-icon.png");