try {
    ($ => {
        var acClass = window.AudioContext || window.webkitAudioContext;

        /** @type {AudioContext} */
        var audioContext = new acClass();
        audioContext.suspend();
        $.audioContext = audioContext;

        var hitsoundBuffer = null;

        class TimingPoints {
            constructor({time: time, bpm: bpm, ...params}) {
                this.time = time || 0;
                this.bpm = bpm || 60;

                Object.keys(params).forEach(k => {
                    this[k] = params[k];
                });
            }
        }

        var muteIcon = new Image();
        muteIcon.src = "./assets/mute-3-xxl.png";

        var arrowUpIcon = new Image();
        arrowUpIcon.src = "./assets/arrow-up.png";

        var playIcon = new Image();
        playIcon.src = "./assets/play-icon.png";

        var perferredFont = `Exo, "Noto Sans CJK TC", sans-serif`;

        class LogLine {
            constructor(content) {
                this.y = null; // Updated by Game.update()
                this.content = content;
                this.createdTime = null;
                this.fadedTime = null;

                this.badgeText = "Debug";
                this.badgeColor = "#888";
                this.badgeTextColor = "white";

                this.persistent = false;
                this.hidden = false;
            }
        }

        var fpsWarning = new LogLine("FPS is lower than 20 on your browser. Consider switching to low resolution mode in debug menu.");
        fpsWarning.badgeText = "Renderer";
        fpsWarning.badgeColor = "#f50";
        fpsWarning.hidden = true;
        fpsWarning.persistent = true;

        var acLog = new LogLine("AudioContext");
        acLog.badgeText = "AudioContext";
        acLog.persistent = true;
        
        var resLog = new LogLine("Resolution");
        resLog.badgeText = "Renderer";
        resLog.persistent = true;

        var fpsLog = new LogLine("FPS");
        fpsLog.badgeText = "Renderer";
        fpsLog.persistent = true;

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
                    return K.Maths.lerp(-0.7, 0.7, (lane - 1) / 6);
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
                
                return map;
            }

            static parseCytus1Map(content, { offset, cover, audio, ...params}) {
                var map = new Beatmap(new BeatmapMeta({
                    title: "Not imported map",
                    romanizedTitle: "Download from Bestdori!",
                    cover: cover || "./assets/cover.jpeg",
                    audio: audio,
                    offset: offset === undefined ? 0 : offset,
                    ...params
                }));

                var bpm = 0;
                var pageShift = 0;
                var lines = content.split("\n");
                var notes = [];

                lines.forEach(l => {
                    if(l.startsWith("BPM")) {
                        bpm = parseFloat(l.substring(4));
                    }
                    if(l.startsWith("PAGE_SHIFT")) {
                        pageShift = parseFloat(l.substring(11)) * 1000;
                    }
                    if(l.startsWith("NOTE")) {
                        var note = l.split("\t");
                        note.shift();

                        var obj = {
                            type: "circle",
                            id: parseInt(note[0]),
                            time: parseFloat(note[1]) * 1000,
                            x: parseFloat(note[2]) * 2 - 1,
                            snap: 1000
                        }; 

                        var holdTime = parseFloat(note[3]) * 1000;
                        if(holdTime > 0) {
                            obj.type = "hold";
                            obj.endTime = obj.time + holdTime;
                        }
                        notes.push(obj);
                    }
                    if(l.startsWith("LINK")) {
                        var ids = l.split(" ");
                        ids.shift();

                        var arr = [];

                        ids.forEach(id => {
                            if(id == "") return;
                            arr.push(parseInt(id));
                        });

                        var headID = arr.shift();
                        var dragHead = notes.find(n => n.id == headID);
                        if(!dragHead) return;

                        dragHead.type = "slider";
                        dragHead.nodes = [];
                        
                        arr.forEach(child => {
                            var index = notes.findIndex(n => n.id == child);
                            var node = notes[index];
                            if(!node) return;

                            notes.splice(index, 1);
                            dragHead.nodes.push({
                                x: node.x,
                                time: node.time,
                                snap: 1000
                            });
                        });
                    }
                });

                map.timingPoints.push(new TimingPoints({
                    time: 0,
                    bpm: K.Timings.millisToBpm(pageShift),
                    stickYToZero: true
                }));

                map.timingPoints.push(new TimingPoints({
                    time: pageShift,
                    bpm: bpm / 2,
                    flipY: true
                }));

                map.notes = notes;
                return map;
            }

            static parseCytus2Map(json, { offset, cover, audio, ...params}) {
                var obj = json;
                if(typeof obj === "string") {
                    try {
                        obj = JSON.parse(obj);
                    } catch {
                        return Beatmap.parseCytus1Map(json, {
                            offset, cover, audio, ...params
                        });
                    }
                }

                var map = new Beatmap(new BeatmapMeta({
                    title: "Not imported map",
                    romanizedTitle: "Download from Bestdori!",
                    cover: cover || "./assets/cover.jpeg",
                    audio: audio,
                    offset: offset === undefined ? 0 : offset,
                    ...params
                }));

                var pendSliders = [];

                var timingPoints = [];

                var { time_base: timeBase, page_list: pageList, tempo_list: tempoList, note_list: noteList } = obj;
                
                var msPerTickList = [];
                tempoList.forEach(tempo => {
                    var bpm = 60000000 / tempo.value;
                    var { tick } = tempo;

                    var newItem = {
                        sinceTick: tick,
                        msPerTick: K.Timings.bpmToMillis(bpm) / timeBase / 2,
                        bpm
                    };
                    var prevItem = msPerTickList[msPerTickList.length - 1];
                    if(prevItem) {
                        newItem.startTime = (newItem.sinceTick - prevItem.sinceTick) * prevItem.msPerTick + prevItem.startTime;
                    } else {
                        newItem.startTime = 0;
                    }
                    msPerTickList.push(newItem);
                });
                console.log(msPerTickList);

                var tickToMs = (tick) => {
                    var lastMsPerTick = null;
                    msPerTickList.forEach(m => {
                        if(m.sinceTick <= tick) {
                            lastMsPerTick = m;
                        }
                    });

                    return (tick - lastMsPerTick.sinceTick) * lastMsPerTick.msPerTick + lastMsPerTick.startTime;
                };

                var tickToBPM = (tick) => {
                    var lastMsPerTick = null;
                    msPerTickList.forEach(m => {
                        if(m.sinceTick <= tick) {
                            lastMsPerTick = m;
                        }
                    });

                    return lastMsPerTick.bpm;
                };

                pageList.forEach(page => {
                    timingPoints.push({
                        time: tickToMs(page.start_tick),
                        direction: page.scan_line_direction * -1,
                        bpm: tickToBPM(page.start_tick) * (timeBase / (page.end_tick - page.start_tick)) * 2
                    });
                });

                noteList.forEach(n => {
                    var note = {
                        x: n.x * 2 - 1,
                        time: tickToMs(n.tick),
                        snap: 1000
                    };
                    if(n.type == 0) {
                        note.type = "circle";
                    }
                    if(n.type == 1 || n.type == 2) {
                        note.type = n.type == 1 ? "hold" : "longhold";
                        note.endTime = tickToMs(n.tick + n.hold_tick);
                    }
                    if(n.type == 3 || n.type == 6) {
                        note.type = "slider";
                        note.nodes = [];
                        note.expectedId = n.next_id;
                        if(n.type == 6) note.c2Type7 = true;
                        pendSliders.push(note);
                        note = null;
                    }
                    if(n.type == 4 || n.type == 7) {
                        var slider = pendSliders.find(s => s.expectedId == n.id);
                        slider.nodes.push(note);
                        if(n.next_id <= 0) {
                            note = slider;
                            pendSliders.splice(pendSliders.indexOf(slider), 1);
                            delete slider.expectedId;
                        } else {
                            slider.expectedId = n.next_id;
                            note = null; 
                        }
                    }

                    if(n.type == 5) {
                        note.type = "flick";
                    }

                    if(note) map.notes.push(note);
                });

                map.timingPoints = timingPoints;
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
                    return K.Maths.lerp(-0.75, 0.75, (lane - 1) / 6);
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
        $.Beatmap = Beatmap;

        var activeAudioBuffer = null;

        var bgGainNode = null;

        /** @type {AudioBufferSourceNode} */
        var audioSource = null;

        var playbackTime = 0;
        var isPlaying = false;

        class Game {
            /**
             * 
             * @param {HTMLCanvasElement} canvas 
             * @param {{ audioCompatMode: boolean, keepInstance: boolean }} config
             */
            constructor(canvas, { audioCompatMode, keepInstance }) {
                if(!canvas || !canvas.getContext) {
                    throw new Error("Invalid canvas parameter.");
                }

                this.canvas = canvas;

                canvas.width = screen.height < screen.width ? screen.width * devicePixelRatio : screen.height * devicePixelRatio;
                canvas.height = screen.height < screen.width ? screen.height * devicePixelRatio : screen.width * devicePixelRatio;

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
        
                if(!this.context) {
                    throw new Error("Canvas is not supported.");
                }

                if(!keepInstance) {
                    // Export our game for further use.
                    Game.currentGame = this;
                }

                // Fetch the hitsound!
                fetch("./assets/soft-hitsoft.wav")
                    .then(response => response.arrayBuffer())
                    .then(buffer => audioContext.decodeAudioData(buffer, b => {
                        hitsoundBuffer = b
                    }, ex => alert(ex)));

                this.startTime = performance.now();
                this.resetScanlineAt = 0;
                this.scanlineColor = "white";

                this.noteSize = 72;

                this.globalOffset = 0;
                this.songMeta = {};

                this.mirrored = false;
                this.yFlip = false;

                this.coverImage = new Image();

                this.timeSinceLastSwitch = 0;
                
                // Input
                this.autoClear = true;
                this.touches = [];
                var touchDownHandle = t => {
                    this.touches.push({
                        ...t,
                        state: 0
                    });
                };
                var touchMoveHandle = t => {
                    var i = null;
                    this.touches.forEach(n => {
                        if(i != null) return;
                        if(n.id == t.id) {
                            i = n;
                        }
                    });
                    if(i != null) {
                        i.x = t.x;
                        i.y = t.y;
                    }
                };
                var touchUpHandle = t => {
                    var i = -9999;
                    this.touches.forEach((n, j) => {
                        if(i != -9999) return;
                        if(n.id == t.id) {
                            i = j;
                        }
                    });
                    if(i != -9999) this.touches.splice(i, 1);
                };
        
                canvas.addEventListener("touchstart", e => {
                    var touches = e.changedTouches;
                    for(var i=0; i<touches.length; i++) {
                        var t = touches[i];
                        touchDownHandle({
                            id: t.identifier,
                            x: t.clientX - canvas.offsetLeft,
                            y: t.clientY - canvas.offsetTop
                        });
                    }
                });
                canvas.addEventListener("touchmove", e => {
                    var touches = e.changedTouches;
                    for(var i=0; i<touches.length; i++) {
                        var t = touches[i];
                        touchMoveHandle({
                            id: t.identifier,
                            x: t.clientX - canvas.offsetLeft,
                            y: t.clientY - canvas.offsetTop
                        });
                    }
                });
                canvas.addEventListener("touchend", e => {
                    var touches = e.changedTouches;
                    for(var i=0; i<touches.length; i++) {
                        var t = touches[i];
                        touchUpHandle({
                            id: t.identifier,
                            x: t.clientX - canvas.offsetLeft,
                            y: t.clientY - canvas.offsetTop
                        });
                    }
                })
                canvas.addEventListener("mousedown", e => {
                    touchDownHandle({
                        id: -1,
                        x: e.clientX - canvas.offsetLeft,
                        y: e.clientY - canvas.offsetTop
                    });
                });
                canvas.addEventListener("mousemove", e => {
                    touchMoveHandle({
                        id: -1,
                        x: e.clientX - canvas.offsetLeft,
                        y: e.clientY - canvas.offsetTop
                    });
                });
                canvas.addEventListener("mouseup", e => {
                    touchUpHandle({
                        id: -1,
                        x: e.clientX - canvas.offsetLeft,
                        y: e.clientY - canvas.offsetTop
                    });
                });

                /** @type {HTMLAudioElement} */
                this.audioElem = document.getElementById("game-audio");
                this.enableClickSound = true;
                
                // Setup the element as media source so we can
                // render visualizer at the top.
                this.audioAnalyser = audioContext.createAnalyser();

                var createMatch = s => regex => regex.test(s);
                
                this.supportAudioContextBG = false;
                var m = createMatch(navigator.userAgent);
                this.isSafari = m(/iPhone/i) || m(/iPad/i) || m(/iPod/i) || (m(/Macintosh/i) && m(/Safari/i) && !m(/Chrome/i));
                if(!audioCompatMode) {
                    var src = audioContext.createMediaElementSource(this.audioElem);

                    var gn = audioContext.createGain();
                    gn.gain.value = 0;
                    src.connect(gn);
                    gn.connect(this.audioAnalyser);

                    this.supportAudioContextBG = true;

                    this.audioElem.addEventListener("play", e => {
                        var s = audioContext.createBufferSource();
                        s.buffer = activeAudioBuffer;

                        if(audioSource != null) {
                            s.playbackRate.value = audioSource.playbackRate.value;
                            audioSource.stop();
                            audioSource.disconnect();
                        }
                        window.audioSource = audioSource = s;
                        s.connect(this.audioAnalyser);
                        s.start(0, this.audioElem.currentTime);
                        isPlaying = true;
                        playbackTime = this.audioElem.currentTime;
                    });
                    
                    this.audioElem.addEventListener("pause", e => {
                        audioSource.stop();
                        isPlaying = false;
                    });
                }

                var gn = bgGainNode = audioContext.createGain();
                gn.gain.value = 1;
                this.audioAnalyser.connect(gn);

                gn.connect(audioContext.destination);

                this.cachedBeatsInfo = null;

                // Render settings
                this.noteFadeInTime = 1500;
                this.noteFadeOutTime = 200;

                // Caching the canvas dimension here may improve the performance
                this.canvasSize = {
                    w: 0, h: 0
                };

                // Debug helper
                this.enableDebugLog = false;
                this.debugLogCount = 5;
                this.logLines = [
                    acLog, resLog, fpsLog, fpsWarning
                ];

                this.lastRenderTime = performance.now();
                this.maxFPS = 300;

                /*fetch("./assets/85.chaos.json")
                    .then(response => response.json())
                    .then(json => {
                        this.parseMap(json);
                        this.update();
                    }); /**/

                this.loadBestdoriMap(128, "expert").then(() => {
                    this.update();
                }); /**/

                // Easter Eggs
                var g = this;
                this.exclusive = {
                    nightcore() {
                        g.setPlaybackRate(1.15);
                    },
                    daycore() {
                        g.setPlaybackRate(1 / 1.15);
                    }
                };
            }

            playMusic(src) {
                this.audioElem.src = src;
                if(this.supportAudioContextBG) {
                    fetch(src)
                    .then(r => r.arrayBuffer())
                    .then(buf => audioContext.decodeAudioData(buf))
                    .then(buf => {
                        activeAudioBuffer = buf;
                        var s = audioContext.createBufferSource();
                        s.buffer = buf;

                        if(audioSource != null) {
                            audioSource.stop();
                            audioSource.disconnect();
                        }
                        window.audioSource = audioSource = s;
                        s.connect(this.audioAnalyser);
                        s.start(0);
                        this.audioElem.play();
                    });
                } else {
                    this.audioElem.play();
                }
            }

            setPlaybackRate(rate) {
                this.audioElem.playbackRate = rate;
                if(this.supportAudioContextBG) {
                    audioSource.playbackRate.value = rate;
                }
            }

            toHiRes() {
                this.ratio = window.devicePixelRatio;
                canvas.width = this._initSize.w * this.ratio;
                canvas.height = this._initSize.h * this.ratio;

                // Viewport
                this.fieldWidth = canvas.width * 0.85;
                this.fieldHeight = canvas.height - 275 * this.ratio;
            }

            toLowRes() {
                this.ratio = 1;
                canvas.width = this._initSize.w;
                canvas.height = this._initSize.h;

                // Viewport
                this.fieldWidth = canvas.width * 0.85;
                this.fieldHeight = canvas.height - 275 * this.ratio;
            }

            getCurrentTime() {
                if(this.supportAudioContextBG) {
                    return playbackTime * 1000;
                } else {
                    var latency = (audioContext.baseLatency || 0) + 40 / 1000;
                    return (this.audioElem.currentTime + latency) * 1000 + this.globalOffset;
                }
            }

            getSongDifficulty() {
                return {
                    name: "unknown",
                    level: 7,
                    color: "#888",
                    ...this.songMeta.difficulty || {}
                };
            }

            exportMap() {
                function toSerializableNote(n) {
                    var type = "unknown";

                    if(n instanceof SliderNote) {
                        type = "slider";
                        return { type: type, x: n.x, time: n.time, c2Type7: n.c2Type7, nodes: n.nodes.map(x => {
                            return { x: x.x, time: x.time, snap: x.snap }
                        })};
                    }

                    if(n instanceof HoldNote) {
                        type = "hold";

                        if(n instanceof LongHoldNote) {
                            type = "longhold";
                        }

                        return { type: type, x: n.x, time: n.time, endTime: n.endTime, snap: n.snap };
                    }

                    if(n instanceof CircleNote) {
                        type = "circle";
                    }

                    if(n instanceof FlickNote) {
                        type = "flick";
                    }
                    return { type: type, x: n.x, time: n.time, snap: n.snap }
                }
                
                var points = this.timingPoints.map(p => {
                    return {
                        time: p.time, bpm: p.bpm, flipY: p.flipY, stickYToZero: p.stickYToZero,
                        direction: p.direction
                    };
                });

                var notes = this.notes.map(toSerializableNote);

                return {
                    song: {
                        ...this.songMeta,
                        audio: this.audioElem.currentSrc
                    },
                    timingPoints: points,
                    notes: notes
                }
            }

            exportToCytus(allowType7) {
                var timeBase = 480;
                
                var timeToTick = (time) => {
                    var tickPerMs = this.getBeatLengthAt(time) / timeBase / 2;
                    var startTick = this.getBeatIndex(time) * timeBase * 2;
                    return Math.round(this.getTimeInBeat(time) / tickPerMs) + startTick
                }

                var map = {
                    "format_version": 0,
                    "time_base": timeBase,
                    "start_offset_time": 0,
                    "page_list": [],
                    "tempo_list": [],
                    "event_order_list": [],
                    "note_list": []
                };
                this.notes.sort((a, b) => a.time - b.time);

                var pageCount = this.getBeatIndex(this.notes[this.notes.length - 1].time) + 2;
                var tickCount = 0;
                for(var i=0; i<pageCount; i++) {
                    map["page_list"].push({
                        "start_tick": tickCount,
                        "end_tick": tickCount + timeBase * 2,
                        "scan_line_direction": -1 * this.getDirection(this.getBeatByIndex(i).time + 10)
                    });
                    tickCount += timeBase * 2;
                }

                var prevPoint = null;
                this.timingPoints.forEach(p => {
                    var tick = timeToTick(p.time);

                    var point = {
                        tick,
                        value: Math.round(60000000 / p.bpm)
                    };
                    map["tempo_list"].push(point);

                    if(prevPoint != null) {
                        var isSlower = prevPoint.value < point.value;
                        map["event_order_list"].push({
                            tick: tick - timeBase,
                            event_list: [
                                {
                                    type: isSlower ? 1 : 0,
                                    args: isSlower ? "G" : "R"
                                }
                            ]
                        });
                    }

                    prevPoint = point;
                });

                

                var noteCounter = 0;
                this.notes.forEach(n => {
                    var note = {
                        "page_index": this.getBeatIndex(n.time + 10),
                        type: 0,
                        id: noteCounter++,
                        tick: timeToTick(n.time),
                        x: (n.x + 1) / 2
                    };

                    if(n instanceof FlickNote) {
                        note.type = 5;
                    }

                    if(n instanceof HoldNote) {
                        note.type = (n instanceof LongHoldNote ? 2 : 1);
                        note["hold_tick"] = timeToTick(n.endTime) - timeToTick(n.time)
                    }

                    if(n instanceof SliderNote) {
                        note.type = allowType7 ? 7 : 3;
                    }

                    map["note_list"].push(note);

                    if(n instanceof SliderNote) {
                        n.nodes.reverse().forEach(nn => {
                            var nid = noteCounter++;
                            map["note_list"][nid - 1]["next_id"] = nid;
                            map["note_list"].push({
                                "page_index": this.getBeatIndex(nn.time + 10),
                                type: allowType7 ? 7 : 4,
                                id: nid,
                                tick: timeToTick(nn.time),
                                x: (nn.x + 1) / 2,
                                next_id: -1
                            });
                        });
                        n.nodes.reverse();
                    }
                });
                
                this.notes.sort((a, b) => b.time - a.time);

                return map;
            }

            snapNotes() {
                var snapLevel = 8;
                var snap = n => {
                    if(n.nosnap) return;

                    var time = n.time;
                    var beatLen = time > 0 ? this.getBeatLengthAt(time) : K.Timings.bpmToMillis(this.getBeatByIndex(Math.floor(-time)).bpm);
                    var beat = time > 0 ? this.getBeatAtTime(time) : this.getBeatByIndex(Math.floor(-time));

                    if(time < 0) {
                        time = beat.time + beatLen * (-time % 1);
                    }

                    if(n instanceof HoldNote && n.endTime < 0) {
                        var nbeatLen = K.Timings.bpmToMillis(this.getBeatByIndex(Math.floor(-n.endTime)).bpm);
                        var nbeat = this.getBeatByIndex(Math.floor(-n.endTime));
                        n.endTime = nbeat.time + nbeatLen * (-n.endTime % 1);
                    }

                    time -= beat.time;
                    time /= beatLen;
                    time *= n.snap || snapLevel;

                    time = Math.round(time);

                    time /= n.snap || snapLevel;
                    time *= beatLen;
                    time += beat.time;

                    time = Math.round(time * 1000) / 1000;

                    n.time = time;
                };

                this.notes.forEach(n => {
                    snap(n);
                    if(n instanceof SliderNote) {
                        n.nodes.forEach(n2 => {
                            snap(n2);
                        });
                        n.nodes = n.nodes.sort((a, b) => b.time - a.time);
                    }
                });
            }

            snapTimingPoints() {
                var prevPoint = null;
                this.timingPoints.forEach(p => {
                    if(prevPoint != null) {
                        var beatLen = this.getBeatLengthAt(p.time - 10);
                        var beat = this.getBeatAtTime(p.time - 10);
                    }
                    prevPoint = p;
                });
            }

            getBeatLengthAt(time) {
                var bpm = this.getBeatAtTime(time).bpm;
                return K.Timings.bpmToMillis(bpm);
            }

            getYByTime(time) {
                var ch = this.canvasSize.h;
                var canvas = this.canvas;
                var beat = this.getBeatAtTime(time);

                if(this.bandoriMode) {
                    var stayTime = 5.5 - (this.bandoriSpeed - 1) / 2;
                    var latency = (audioContext.baseLatency || 0) + (this.supportAudioContextBG ? -15 : 40) / 1000;
                    var gtime = this.getCurrentTime();
                    var result = 0.85 * ch - ((time - gtime) / stayTime * 0.85) * this.ratio;
                    if(this.yFlip) result = ch - result;
                    return result;
                }

                var direction = this.getDirection(time);
        
                var y = ch / this.getBeatLengthAt(time) * (beat.stickYToZero ? 0 : this.getTimeInBeat(time));
                if(this.yFlip ? direction > 0 : direction < 0) {
                    y = ch - y;
                }

                y = y * (this.fieldHeight / ch) + (ch - this.fieldHeight) / 2 + ch * 0.015;
                return y;
            }

            getTimeInBeat(time) {
                var start = this.getBeatAtTime(time);
                // console.log(time - start.time)
                return time - start.time;
            }

            getBeats() {
                if(this.cachedBeatsInfo != null) return this.cachedBeatsInfo;

                var result = [];
                for(var i=1; i<this.timingPoints.length; i++) {
                    var a = this.timingPoints[i-1];
                    var b = this.timingPoints[i];

                    if(b.bpm < 0) {
                        b.bpm *= -a.bpm;
                    }
                }

                for(var i=1; i<this.timingPoints.length; i++) {
                    var a = this.timingPoints[i-1];
                    var b = this.timingPoints[i];
                    var c = this.timingPoints[i+1];
                    var beatLen = K.Timings.bpmToMillis(a.bpm);
                    
                    var t = a.time;
                    do {
                        if(b.time - t < 0.001) break;
                        result.push({
                            time: t,
                            bpm: a.bpm,
                            
                            // Glitch mechanism in Cytus 2
                            stickYToZero: a.stickYToZero || false,
                            flipY: a.flipY || false,
                            direction: a.direction,
                            noNotifyChange: a.noNotifyChange
                        });
                        t += beatLen;
                    } while(t < b.time);
                }

                var last = this.timingPoints[this.timingPoints.length-1];
                result.push({
                    time: last.time,
                    bpm: last.bpm,
                    flipY: last.flipY || false,
                    stickYToZero: last.stickYToZero || false,
                    direction: last.direction,
                    noNotifyChange: last.noNotifyChange
                });
                this.cachedBeatsInfo = result;
                return result;
            }

            getBeatAtTime(time) {
                var beats = this.getBeats();
                var beatIndex = this.getBeatIndex(time);
                var beat = null;
                if(beatIndex >= beats.length) {
                    var last = beats[beats.length-1];
                    var beatLen = this.getBeatLengthAt(last.time);

                    beat = {
                        time: last.time + (beatIndex - beats.length + 1) * beatLen,
                        bpm: last.bpm,
                        flipY: last.flipY || false,
                        stickYToZero: last.stickYToZero || false,
                        direction: last.direction,
                        noNotifyChange: last.noNotifyChange
                    };
                } else {
                    beat = beats[beatIndex];
                }
                return beat;
            }

            getBeatByIndex(index) {
                var beats = this.getBeats();
                var beatIndex = index;
                var beat = null;
                if(beatIndex >= beats.length) {
                    var last = beats[beats.length-1];
                    var beatLen = this.getBeatLengthAt(last.time);

                    beat = {
                        time: last.time + (beatIndex - beats.length + 1) * beatLen,
                        bpm: last.bpm,
                        flipY: last.flipY || false,
                        stickYToZero: last.stickYToZero || false,
                        direction: last.direction,
                        noNotifyChange: last.noNotifyChange
                    };
                } else {
                    beat = beats[beatIndex];
                }
                return beat;
            }

            getBeatIndex(time) {
                time += 0.000001;
                var index = 0;
                var beats = this.getBeats();
                for(var i=1; i<beats.length; i++) {
                    if(beats[i].time >= time) {
                        index = i - 1;
                        break;
                    }
                }

                var last = beats[beats.length-1];
                if(time >= last.time) {
                    return beats.length - 1 + Math.floor((time - last.time) / (120 / last.bpm * 1000));
                }
                return index;
            }

            getDirection(time) {
                var beatIndex = this.getBeatIndex(time);
                var beat = this.getBeatByIndex(beatIndex);
                if(beat.direction != null) return beat.direction;
                
                return (beatIndex % 2 == 1 ? 1 : -1) * (beat.flipY ? -1 : 1);
            }

            /**
             * 
             * @param {Beatmap} map 
             */
            parseMap(map) {
                if(!(map instanceof Beatmap)) {
                    Beatmap.bindProto(map);
                }

                this.cachedBeatsInfo = null;
                this.songMeta = map.song;

                var timingPoints = [];
                map.timingPoints.forEach(p => {
                    timingPoints.push(new TimingPoints(p));
                });
                /** @type {TimingPoints[]} */
                this.timingPoints = timingPoints.sort((a, b) => a.time - b.time);
                this.timingPoints[0].time = 0;
                this.snapTimingPoints();

                this.coverImage.src = map.song.cover;
                if(!!map.song.audio && this.audioElem.src != map.song.audio) {
                    this.playMusic(map.song.audio);
                }

                this.globalOffset = map.song.offset;

                var notes = [];
                map.notes.forEach(n => {
                    if(n.type == "circle") {
                        notes.push(new CircleNote(n));
                    }
                    if(n.type == "flick") {
                        notes.push(new FlickNote(n));
                    }
                    if(n.type == "slider") {
                        notes.push(new SliderNote(n));
                    }
                    if(n.type == "hold") {
                        notes.push(new HoldNote(n));
                    }
                    if(n.type == "longhold") {
                        notes.push(new LongHoldNote(n));
                    }
                })
                /** @type {Note[]} */
                this.notes = notes;
                this.snapNotes();
                this.notes = notes.map(n => {
                    if(n instanceof HoldNote) {
                        if(this.getBeatAtTime(n.endTime - 10).time > n.time + 10) {
                            return new LongHoldNote(n);
                        }
                    }
                    return n;
                }).sort((a, b) => b.time - a.time);
                this.prevBeatLen = this.getBeatLengthAt(1);

                // We will change our structure later.
                this.map = map;
            }

            parseBestdoriMap(json, { offset, cover, audio, ...params}) {
                var map = Beatmap.parseBestdoriMap(json, {
                    offset: offset,
                    audio: audio,
                    cover: cover,
                    ...params
                });
                this.parseMap(map);
                return map;
            }

            parseBestdoriRawMap(json, { offset, cover, audio, ...params}) {
                var map = Beatmap.parseBestdoriRawMap(json, {
                    offset: offset,
                    audio: audio,
                    cover: cover,
                    ...params
                });
                this.parseMap(map);
                return map;
            }

            loadBestdoriRawMap(url, options) {
                fetch(url, { cache: "no-cache" }).then(response => response.json()).then(json => this.parseBestdoriRawMap(json, options || {}));
            }

            loadBestdoriMap(id, level) {
                return new Promise((resolve, reject) => {
                    function _3d(n) {
                        var p = "";
                        var dn = Math.ceil(Math.log10(parseInt(n)+1));
                        for(var i=2; i>=dn; i--) {
                            p += "0";
                        }
                        p += n.toString();
                        return p;
                    }
                    var _d = _3d(id); // console.log(id, _d);
                    var src = `https://bestdori.com/assets/${id == 1002 ? "en" : "jp"}/sound/bgm${_d}_rip/bgm${_d}.mp3`;

                    var diffColor = {
                        easy: "#3d5afe",
                        normal: "#43a047",
                        hard: "#ffa000",
                        expert: "#d50000",
                        special: "#d500f9"
                    };

                    var diffIndex = {
                        easy: 0,
                        normal: 1,
                        hard: 2,
                        expert: 3,
                        special: 4
                    };

                    fetch(`./assets/charts/bandori/${id}.${level}.json`, {
                        cache: "no-cache"
                    })
                    .then(response => response.json())
                    .then(json => {
                        json.song.audio = json.song.audio || src;
                        this.parseMap(json);
                        resolve(json);
                    })
                    .catch(ex => {
                        fetch(`bestdori_song_info.php?id=${id}`, { cache: "no-cache" })
                        .then(r => r.json()).then(s => {
                            var l = s.difficulty[diffIndex[level]].playLevel;
                            var t = s.musicTitle;

                            var url = `bestdori_chart.php?id=${id}&level=${level}`;
                            fetch(url).then(response => response.json())
                            .then(json => {
                                this.parseBestdoriMap(json, {
                                    offset: -20,
                                    difficulty: {
                                        name: level,
                                        level: l,
                                        color: diffColor[level]
                                    },
                                    title: t[0],
                                    romanizedTitle: t[1],
                                    audio: src
                                });
                            })
                            .then(map => {
                                resolve(map);
                            });
                        });
                    });
                });
            }
        
            loadBestdoriComMap(id) {
                fetch(`./assets/charts/community/${id}.json`, {
                    cache: "no-cache"
                })
                .then(r => r.json())
                .then(r => this.parseMap(r))
                .catch(ex => {
                    fetch("bestdori_com_chart.php?id="+id)
                    .then(r => r.json())
                    .then(r => this.parseBestdoriMap(r.post.graphicsChart, {
                        offset: 0,
                        cover: r.post.song.cover,
                        audio: r.post.song.audio
                    }));
                });
            }

            getModeWidth() {
                return this.fieldWidth * (this.bandoriMode ? 0.5 : 1);
            }

            getModeScale() {
                return this.bandoriMode ? 0.7 : 1;
            }

            getModeFadeIn() {
                return this.noteFadeInTime * (this.bandoriMode ? 3 * 5 / K.Maths.lerp(1, 5.5, this.bandoriSpeed / 11) : 1);
            }

            addLogLine(content) {
                var line = new LogLine(content);
                this.logLines.push(line);
                return line;
            }

            removeLogLine(line, i) {
                this.logLines.splice(i == null ? this.logLines.indexOf(line) : i, 1);
            }

            update(canvas, ctx) {
                requestAnimationFrame(() => {
                    if(Game.currentGame == this)
                    this.update();
                });

                var deltaTime = performance.now() - this.lastRenderTime;
                if(deltaTime < 1000 / this.maxFPS) return;

                fpsWarning.hidden = deltaTime < 1000 / 20;

                this.lastRenderTime = performance.now();
                if(isPlaying) {
                    playbackTime += deltaTime / 1000 * this.audioElem.playbackRate;
                }
        
                canvas = canvas || this.canvas;
                ctx = ctx || this.context;

                this.canvasSize = {
                    w: canvas.width, h: canvas.height
                };

                var cw = this.canvasSize.w;
                var ch = this.canvasSize.h;

                ctx.clearRect(0, 0, cw, ch);
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, cw, ch);

                this.audioAnalyser.fftSize = 2048;
                var buflen = this.audioAnalyser.frequencyBinCount * 0.75;
                var buffer = new Uint8Array(buflen);
                this.audioAnalyser.getByteFrequencyData(buffer);

                bgGainNode.gain.value = this.audioElem.volume;

                var indexes = [];
                for(var i=0; i<128; i++) {
                    indexes.push(Math.floor(buflen * 0.75 / 128 * i));
                }

                var time = this.getCurrentTime();
                var y = this.getYByTime(time);

                if(!this.supportAudioContextBG || (this.supportAudioContextBG && audioContext.state == "suspended")) {
                    for(var i=0; i<buflen; i++) {
                        buffer[i] = Math.round(Math.abs(Math.sin((time + i) / 128) * K.Maths.lerp(0.5, 1, Math.abs(Math.sin((time + 2 * i) / 128)))) * 128);
                    }
                }

                // Cover image
                var pt = (this.supportAudioContextBG ? audioContext.state == "suspended" : this.audioElem.paused) ? performance.now() : time;
                var bl = this.getBeatLengthAt(time);
                var rbp = Math.max(0, Math.min(1, ((pt - this.getBeatAtTime(time).time) / bl) % 1));
                var bp = Math.pow(Math.abs(Math.cos(rbp * Math.PI)), 3);

                if(this.coverImage.complete && this.coverImage.width > 0 && this.coverImage.height > 0) {
                    ctx.drawImage(this.coverImage, cw / 2 - 250 * this.ratio, ch / 2 - 250 * this.ratio, 500 * this.ratio, 500 * this.ratio)
                }
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.fillRect(0, 0, cw, ch);

                var maxCombo = 0;
                var clearedCombo = 0;
                var lastClearTime = -1000;

                // Top & bottom dash lines
                var ctxt = ctx.getTransform();

                ctx.globalAlpha = 0.3;
                var bottomY = canvas.height / 2 + this.fieldHeight / 2;
                var topY = canvas.height - bottomY;

                bottomY += ch * 0.015;
                topY += ch * 0.015;

                ctx.strokeStyle = "#fff";
                ctx.setLineDash([5 * this.ratio, 100 * this.ratio]);

                ctx.translate(-(performance.now() % 1500) / 1500 * 105 * this.ratio, 0);
                ctx.lineWidth = 5 * this.ratio;
                if(this.getDirection(time) == 1)
                ctx.lineWidth += (Math.pow(1 - rbp, 10) * 10) * this.ratio;
                ctx.beginPath();
                ctx.moveTo(-50 * this.ratio, topY);
                ctx.lineTo(canvas.width + 50 * this.ratio, topY);
                ctx.stroke();

                ctx.setTransform(ctxt);
                ctx.translate((performance.now() % 1500) / 1500 * 105 * this.ratio, 0);
                ctx.lineWidth = 5 * this.ratio;
                if(this.getDirection(time) == -1)
                ctx.lineWidth += (Math.pow(1 - rbp, 10) * 10) * this.ratio;
                ctx.beginPath();
                ctx.moveTo(-50 * this.ratio, bottomY);
                ctx.lineTo(canvas.width + 50 * this.ratio, bottomY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath();

                ctx.setTransform(ctxt);
                ctx.globalAlpha = 1;
                ctx.lineWidth = 0;

                // Update each note object.
                this.notes.forEach(n => {
                    if(!Game.currentGame && Editor.currentEditor) {
                        n.game = Editor.currentEditor;
                        if(n instanceof SliderNote) {
                            n.nodes.forEach(nn => nn.game = Editor.currentEditor);
                        }
                    }

                    // Render.
                    n.render(ctx, time);

                    // Calculate combo amount.
                    if(this.bandoriMode || (!this.bandoriMode && !(n instanceof HoldNote))) {
                        maxCombo++;
                        if(n.cleared) {
                            clearedCombo++;
                            lastClearTime = Math.max(lastClearTime, n.time);
                        }
                    }
                    
                    if(n instanceof FlickNote) {
                        this.notes.forEach(sn => {
                            if(sn instanceof SliderNote) {
                                var nn = sn.nodes[0];
                                if(Math.abs(nn.x - n.x) < 0.01 && Math.abs(nn.time - n.time) < 0.1 && this.bandoriMode) {
                                    maxCombo--;
                                    if(time > n.time) {
                                        clearedCombo--;
                                    }
                                }
                                return;
                            }

                            if(sn instanceof HoldNote) {
                                if(Math.abs(sn.x - n.x) < 0.01 && Math.abs(sn.endTime - n.time) < 0.1 && this.bandoriMode) {
                                    maxCombo--;
                                    if(time > n.time) {
                                        clearedCombo--;
                                    }
                                }
                            }
                        });
                    }

                    if(n instanceof SliderNote) {
                        n.nodes.forEach(nn => {
                            maxCombo++;
                            if(nn.cleared) {
                                clearedCombo++;
                                lastClearTime = Math.max(lastClearTime, nn.time);
                            }
                        });
                    }

                    if(n instanceof HoldNote) {
                        maxCombo++;
                        if(n.cleared) {
                            clearedCombo++;
                            lastClearTime = Math.max(lastClearTime, n.time);
                        }
                    }
                });

                if(lastClearTime > time) {
                    // lastClearTime = time - 1000;
                }

                // Process input
                var removalTouches = [];
                this.touches.forEach((t, i) => {
                    if(t.state == 0) {
                        t.state = 1;
                    }
                    if(t.state == 2) {
                        removalTouches.push(i);
                    }

                    if(t.state == 1) {
                        var n = this.findNearestNote(t.x, t.y, time);
                        if(n != null && !n.cleared) {
                            n.clearNote(time);
                        }
                    }
                });
                removalTouches.reverse().forEach(i => {
                    this.touches.splice(i, 1);
                });

                // Scanline transform
                var currBeatLen = this.getBeatLengthAt(time);
                var nextBeatLen = this.getBeatLengthAt(time + currBeatLen);

                // Scanline
                if(this.resetScanlineAt <= time || Math.abs(this.resetScanlineAt - time) > currBeatLen * 4) {
                    this.scanlineColor = "white";
                }
                
                // Scanline temp color change
                if(this.prevBeatLen != currBeatLen && !this.getBeatAtTime(time).noNotifyChange) {
                    this.resetScanlineAt = time + currBeatLen * 4;
                    if(currBeatLen < this.prevBeatLen) {
                        this.scanlineColor = "#f00";
                    } else {
                        this.scanlineColor = "#8ff";
                    }
                }

                // Draw scanline.
                ctx.fillStyle = this.scanlineColor;
                ctx.shadowColor = this.scanlineColor;
                ctx.shadowBlur = 60;
                ctx.fillRect(0, y, cw, 5 * this.ratio);

                if(nextBeatLen != currBeatLen && !this.getBeatAtTime(time + currBeatLen).noNotifyChange) {
                    var color = this.scanlineColor;
                    if(nextBeatLen < currBeatLen) {
                        ctx.globalAlpha = this.getTimeInBeat(time) / currBeatLen;
                        color = "#f00";
                    } else if(nextBeatLen > currBeatLen) {
                        ctx.globalAlpha = this.getTimeInBeat(time) / currBeatLen;
                        color = "#8ff";
                    }
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.fillRect(0, y, cw, 5 * this.ratio);
                    ctx.globalAlpha = 1;
                }
                this.prevBeatLen = currBeatLen;
                ctx.shadowColor = "transparent";

                // ======== UI ==========
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                var grd = ctx.createLinearGradient(0, 0, 0, ch / 4 / (this.bandoriMode ? 1 : 1.5));
                grd.addColorStop(0, "black");
                grd.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, cw, ch);

                if(audioContext.state == "suspended") {
                    acLog.content = "AudioContext is suspended.";
                    ctx.beginPath();
                    ctx.fillStyle = "white";
                    ctx.globalAlpha *= 0.2;
                    ctx.arc(45.5 * this.ratio, 45.5 * this.ratio, K.Maths.lerp(35 * this.ratio, 45 * this.ratio, bp), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha /= 0.2;
                    ctx.beginPath();

                    ctx.drawImage(muteIcon, 25 * this.ratio, 25 * this.ratio, 37.5 * this.ratio, 37.5 * this.ratio);
                    ctx.textBaseline = "middle";
                    ctx.font = (22.5 * this.ratio) + "px " + perferredFont;
                    ctx.fillStyle = "white";
                    ctx.fillText("Tap to " + (this.supportAudioContextBG ? "start" : "unmute tap sounds"), 75 * this.ratio, (28 + 75 / 4) * this.ratio);
                    ctx.textBaseline = "alphabetic";
                } else {
                    acLog.content = "AudioContext is now working. ";
                }

                var score = (n => {
                    if(n == 0) return "000000";
                    var d = Math.log10(n + 1);
                    var r = "";
                    for(var i=0; i < 5 - d; i++) {
                        r += "0";
                    }
                    return r + n;
                })(Math.round(
                    1000000 * clearedCombo / Math.max(1, maxCombo)
                ));

                ctx.textBaseline = "alphabetic";
                ctx.font = (35 * this.ratio) + "px " + perferredFont;
                ctx.fillStyle = "white";
                ctx.shadowColor = ctx.fillStyle;
                ctx.textAlign = "center";
                var sc = (1 - Math.pow(Math.min(Math.max((time - lastClearTime) / 200, 0), 1), 1 / 2.5)) / 2.5 + 1;

                score.split("").reverse().forEach((c, i) => {
                    var d = Math.log10(parseInt(score) + 1);
                    var s = 6 - d < (6 - i) ? Math.pow(sc, 1 / 1.5): 0.75;
                    var x = cw - (45 + i * 25) * this.ratio;
                    var y = 55 * this.ratio;
                    ctx.translate(x, y);
                    ctx.scale(s, s);
                    ctx.fillText(c, 0, -(s - 1) * this.ratio * 3);
                    ctx.scale(1 / s, 1 / s);
                    ctx.translate(-x, -y);
                });

                // Combo text
                ctx.textBaseline = "middle";
                this.canvas.style.letterSpacing = (5 * this.ratio) + "px";
                ctx.textAlign = "center";
                ctx.font = "500 " + (50 * this.ratio) +"px " + perferredFont;
                ctx.fillStyle = "#fff59d";
                ctx.shadowColor = ctx.fillStyle;
                ctx.translate(cw / 2, 45 * this.ratio);
                ctx.scale(sc, sc);
                if(clearedCombo >= 2) {
                    ctx.fillText(clearedCombo, 0 + 2.5 * this.ratio, 0);
                }
                ctx.scale(1 / sc, 1 / sc);
                ctx.translate(-cw / 2, -45 * this.ratio);
                this.canvas.style.letterSpacing = "0px";
                
                ctx.textBaseline = "top";
                ctx.fillStyle = "#888";
                ctx.shadowColor = ctx.fillStyle;
                ctx.font = "bold " + (25 * this.ratio) + "px " + perferredFont;
                ctx.fillText("COMBO".split("").join(" "), cw / 2, 70 * this.ratio);

                ctx.textBaseline = "alphabetic";
                ctx.textAlign = "left";

                // Spectrum
                var indexes = [];
                for(var i=0; i<8; i++) {
                    indexes.push(Math.floor(buflen / 8 * i));
                }

                (() => {
                    ctx.translate(cw / 2, 0);
                    var stroke = ctx.strokeStyle;
                    ctx.strokeStyle = "#fff";
                    ctx.beginPath();
                    indexes.reverse().forEach((i, o) => {
                        var y = (18 + o * 10) * this.ratio;
                        ctx.moveTo(85 * this.ratio, y);
                        ctx.lineTo((85 + Math.pow(buffer[i] / 255, 1.5) * 150) * this.ratio, y);
                        ctx.moveTo(-85 * this.ratio, y);
                        ctx.lineTo((85 + Math.pow(buffer[i] / 255, 1.5) * 150) * -this.ratio, y);
                    });
                    ctx.setLineDash([5 * this.ratio, 10 * this.ratio]);
                    ctx.lineWidth = 2 * this.ratio;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.strokeStyle = stroke;
                    ctx.translate(-cw / 2, 0);
                })();

                ctx.shadowBlur = 0;

                // Play progress
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(0, 0, cw, 7.5 * this.ratio);
                
                ctx.fillStyle = "#f48fb1";
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 20;
                ctx.fillRect(0, 0, cw * this.audioElem.currentTime / this.audioElem.duration, 7.5 * this.ratio);

                // Difficulty
                ctx.font = "600 " + (25 * this.ratio) + "px " + perferredFont;
                var difficulty = this.getSongDifficulty();
                ctx.fillStyle = difficulty.color;
                ctx.shadowColor = ctx.fillStyle;
                var txt = difficulty.name.toUpperCase() + " " + difficulty.level;
                var tw = ctx.measureText(txt).width;
                ctx.globalAlpha *= 0.2;
                ctx.fillRect(cw - tw - 60 * this.ratio, ch - (25 + 40) * this.ratio, tw + 20 * this.ratio, 35 * this.ratio);
                ctx.globalAlpha /= 0.2;
                ctx.textBaseline = "middle";
                ctx.fillText(txt, cw - tw - 50 * this.ratio, ch - (this.isSafari ? 46 : 44) * this.ratio, tw + 20 * this.ratio, 35 * this.ratio);
                ctx.textBaseline = "alphabetic";

                // Song Title - Renderer exclusive (?)
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.shadowColor = "transparent";
                ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
                ctx.arc(60 * this.ratio, ch - 55 * this.ratio, K.Maths.lerp(35 * this.ratio, 40 * this.ratio, bp), 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.drawImage(playIcon, 45 * this.ratio, ch - 80 * this.ratio, 40 * this.ratio, 50 * this.ratio);
                ctx.globalAlpha = 1;

                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                ctx.shadowColor = ctx.fillStyle;
                ctx.font = "500 " + (27 * this.ratio) + "px " + perferredFont;
                ctx.fillText(this.songMeta.title, 100 * this.ratio, ch - 55 * this.ratio);

                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.font = "500 " + (20 * this.ratio) + "px " + perferredFont;
                ctx.fillText(this.songMeta.romanizedTitle, 100 * this.ratio, ch - 30 * this.ratio);

                ctx.shadowBlur = 0;

                // Debug Content
                resLog.content = `Resolution: ${this.canvasSize.w}x${this.canvasSize.h} @ ${Math.round(this.ratio*10)/10}x`;
                fpsLog.content = "FPS: " + (Math.round(100000 / deltaTime) / 100);

                // Debug
                ctx.textBaseline = "middle";
                var removalLines = [];
                var pn = performance.now();
                var counter = 0;
                var persistentCount = 0;
                var persistentRenderCount = 0;
                this.logLines.forEach(l => (l.persistent && !l.hidden) ? persistentCount++ : 0);

                K.Arrays.reversedCopy(this.logLines).forEach((line, i) => {
                    if(!line.createdTime) {
                        line.createdTime = performance.now();
                    }

                    ctx.globalAlpha = Math.sqrt(Math.max((pn - line.createdTime) / 100, 0));

                    if((!line.persistent ? persistentCount - persistentRenderCount : 0) + counter >= this.debugLogCount || line.hidden) {
                        if(!line.fadedTime) {
                            line.fadedTime = performance.now() + 100;
                        }
                        ctx.globalAlpha = K.Maths.lerp(0, ctx.globalAlpha, Math.max((line.fadedTime - pn) / 100, 0));
                    } else {
                        counter++;
                        if(!!line.fadedTime) {
                            line.fadedTime = null;
                            line.createdTime = performance.now();
                        }
                        if(line.persistent) persistentRenderCount++;
                    }

                    var targetY = canvas.height - counter * 35;
                    line.y = K.Maths.lerp(line.y || targetY + 30, targetY, Math.min(1, deltaTime / 100));

                    if(line.fadedTime != null && pn - line.fadedTime > 500 && !line.persistent) {
                        removalLines.push(this.logLines.length - 1 - i);
                    } 

                    if(this.enableDebugLog && line.y > -100) {
                        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                        ctx.fillRect(0, line.y, canvas.width, 30);

                        ctx.font = "600 18px " + perferredFont;
                        var badgeWidth = ctx.measureText(line.badgeText).width;
                        ctx.fillStyle = line.badgeColor;
                        ctx.fillRect(10, line.y + 3, badgeWidth + 12, 26);
                        ctx.fillStyle = line.badgeTextColor;
                        ctx.fillText(line.badgeText, 16, line.y + 17);

                        ctx.fillStyle = "white";
                        ctx.font = "600 19px " + perferredFont;
                        ctx.fillText(line.content, 32 + badgeWidth, line.y + 18);
                    }
                    ctx.globalAlpha = 1;
                });

                removalLines.forEach(l => {
                    this.removeLogLine(null, l);
                });

                ctx.textBaseline = "alphabetic";

                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }

            /**
             * Find the nearest note.
             * @param {number} x The x position of the touch in **pixel**.
             * @param {number} y The y position of the touch in **pixel**.
             * @param {number} time The player time.
             * @param {number} maxDeltaTime The max distance between the touch and the note. Defaults to `600`.
             * @returns {Note} The nearest note. 
             */
            findNearestNote(x, y, time, maxDeltaTime) {
                if(typeof maxDeltaTime === "undefined") {
                    maxDeltaTime = 600;
                }

                if(typeof x !== "number") {
                    return null;
                }

                x /= this.canvas.offsetWidth / this.canvas.width;
                x -= this.canvas.width / 2;
                x /= this.getModeWidth() / 2;

                var nearest = null;
                var nearNotes = [];
                this.notes.forEach(n => {
                    if(Math.abs(n.time - time) > maxDeltaTime) return;
                    nearNotes.push(n);
                });
                nearNotes.sort((a, b) => {
                    return Math.abs(a.time - time) - Math.abs(b.time - time);
                });
                nearNotes.sort((a, b) => {
                    return Math.abs(a.x - x) - Math.abs(b.x - x);
                });
                nearest = nearNotes[0];

                return nearest;
            }
        }
        /** @type {Game} */
        Game.currentGame = null;
        $.Game = Game;

        class Editor extends Game {
            constructor(canvas, previewCanvas, options) {
                super(canvas, {
                    audioCompatMode: true,
                    keepInstance: true
                });
                Editor.currentEditor = this;

                this.bandoriMode = true;
                this.previewCanvas = previewCanvas;
                this.previewCtx = previewCanvas.getContext("2d");

                this.config = {
                    gridDivisor: 0.25,
                    offsetY: 0,
                    scaleY: 1,
                    autoScroll: false
                };

                this.pointer = { x: -1, y: -1 };

                // Load default values.
                this.timingPoints.push(new TimingPoints({
                    time: 0,
                    bpm: 100
                }));

                this.noteSize = 25;

                this.logLines.shift();
                this.pointerLog = new LogLine("Mouse");
                this.pointerLog.persistent = true;
                this.pointerLog.badgeText = "Mouse";
                this.pointerLog.badgeColor = "#085";
                this.logLines.unshift(this.pointerLog);
            }

            getLastObjectTime() {
                return this.notes[0].time;
            }

            getYByTime(time) {
                var ch = this.canvasSize.h;
                return ch - 10 * this.ratio - time * 0.2 * this.config.scaleY * this.ratio;
            }

            getModeFadeIn() {
                return 9999999999;
            }

            getModeScale() {
                return 1;
            }

            getModeWidth() {
                return this.canvas.width * 0.8;
            }

            update() {
                super.update(this.previewCanvas, this.previewCtx);
                this.noteFadeInTime = this.getLastObjectTime();

                requestAnimationFrame(() => {
                    if(Editor.currentEditor == this)
                    this.update();
                });

                var deltaTime = performance.now() - this.lastRenderTime;
                if(deltaTime < 1000 / this.maxFPS) return;

                fpsWarning.hidden = deltaTime < 1000 / 20;

                this.lastRenderTime = performance.now();
                this.pointerLog.content = `x: ${this.pointer.x}, y: ${this.pointer.y}`;
    
                var canvas = this.canvas;
                var scroller = canvas.parentNode.parentNode;

                this.canvasSize = {
                    w: canvas.width, h: canvas.height
                };

                var ctx = this.context;
                var h = Math.max(window.innerHeight, canvas.height - this.getYByTime(this.getLastObjectTime()) / this.ratio + 50) * this.ratio + scroller.offsetHeight / 2;
                canvas.height = scroller.offsetHeight;
                canvas.parentNode.style.height = h;
                var scrollY = h - scroller.scrollTop - scroller.offsetHeight;

                this.canvasSize = {
                    w: canvas.width, h: canvas.height
                };

                var cw = this.canvasSize.w;
                var ch = this.canvasSize.h;

                ctx.translate(0, scrollY);
                ctx.clearRect(0, -scrollY, cw, ch);
                ctx.fillStyle = "black";
                ctx.fillRect(0, -scrollY, cw, ch);

                var latency = (audioContext.baseLatency || 0) + this.supportAudioContextBG ? 0 : 40;
                var time = (this.audioElem.currentTime + latency) * 1000 + this.globalOffset;

                // Draw grids
                (() => {
                    var y = ch;
                    var bi = 0;
                    ctx.globalAlpha = 0.5;

                    ctx.fillStyle = "#555";
                    ctx.fillRect(cw / 2 - this.getModeWidth() / 2, -scrollY, 1 * this.ratio, ch);
                    ctx.fillRect(cw / 2 + this.getModeWidth() / 2, -scrollY, 1 * this.ratio, ch);

                    while(y >= Math.min(0, this.getYByTime(this.getLastObjectTime()))) {
                        var beat = this.getBeatByIndex(bi);
                        y = this.getYByTime(beat.time);
                        var beatLen = this.getBeatLengthAt(beat.time);

                        bi++;
                        
                        ctx.fillStyle = "#fff";
                        ctx.font = "500 " + (13 * this.ratio) + "px " + perferredFont;
                        ctx.fillText(bi + "", 5 * this.ratio, y - 3 * this.ratio);

                        ctx.fillStyle = "white";
                        ctx.fillRect(0, y, cw, 2 * this.ratio);

                        y = this.getYByTime(beat.time + beatLen * 0.5);
                        ctx.fillStyle = "#888";
                        ctx.fillRect(0, y, cw, this.ratio);

                        y = this.getYByTime(beat.time + beatLen * 0.25);
                        ctx.fillStyle = "#42a5f5";
                        ctx.fillRect(0, y, cw, this.ratio);

                        y = this.getYByTime(beat.time + beatLen * 0.75);
                        ctx.fillRect(0, y, cw, this.ratio);
                    }
                    ctx.globalAlpha = 1;
                })();

                this.timingPoints.forEach(p => {
                    var y = this.getYByTime(p.time);
                    ctx.textAlign = "right";
                    ctx.fillStyle = "#fc2";
                    ctx.fillRect(0, y, cw, this.ratio);
                    ctx.font = "400 " + (13 * this.ratio) + "px " + perferredFont;
                    ctx.fillText("BPM: " + p.bpm, cw - 5 * this.ratio, y - 3 * this.ratio);
                    ctx.textAlign = "left";
                });

                var w = this.getModeWidth();
                this.notes.forEach(n => {
                    if(!n.game) n.game = this;
                    if(n instanceof SliderNote) {
                        n.nodes.forEach(nn => {
                            if(!nn.game) nn.game = this;
                        });
                    }

                    ctx.globalAlpha = 0.5;
                    var isHovering = Math.abs(this.pointer.x - (cw / 2 + n.x * w / 2)) <= this.noteSize * 1.1 &&
                        Math.abs(this.pointer.y - (this.getYByTime(n.time) + scrollY)) <= this.noteSize * 1.1;
                    if(isHovering) {
                        ctx.globalAlpha = 0.2;
                        ctx.beginPath();
                        ctx.fillStyle = "#f48fb1";
                        ctx.arc(cw / 2 + n.x * w / 2, this.getYByTime(n.time), this.noteSize * 1.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.globalAlpha = 1;
                    }
                    n.render(ctx, 0);

                    if(isHovering && this.pointer.clicked) {
                        this.audioElem.currentTime = n.time / 1000;
                    }
                    ctx.globalAlpha = 1;
                });

                var scanlineY = this.getYByTime(time);
                ctx.fillStyle = "red";
                ctx.fillRect(0, scanlineY, cw, 1);

                if(this.config.autoScroll && !this.audioElem.paused) {
                    scroller.scroll(0, canvas.parentNode.offsetHeight - canvas.offsetHeight * 1.75 + scanlineY);
                }
                
                ctx.translate(0, -scrollY);

                this.pointer.clicked = false;

                // Debug Content
                resLog.content = `Resolution: ${this.canvasSize.w}x${this.canvasSize.h} @ ${Math.round(this.ratio*10)/10}x`;
                fpsLog.content = "FPS: " + (Math.round(100000 / deltaTime) / 100);

                // Debug
                ctx.textBaseline = "middle";
                var removalLines = [];
                var pn = performance.now();
                var counter = 0;
                var persistentCount = 0;
                var persistentRenderCount = 0;
                this.logLines.forEach(l => (l.persistent && !l.hidden) ? persistentCount++ : 0);

                K.Arrays.reversedCopy(this.logLines).forEach((line, i) => {
                    if(!line.createdTime) {
                        line.createdTime = performance.now();
                    }

                    ctx.globalAlpha = Math.sqrt(Math.max((pn - line.createdTime) / 100, 0));

                    if((!line.persistent ? persistentCount - persistentRenderCount : 0) + counter >= this.debugLogCount || line.hidden) {
                        if(!line.fadedTime) {
                            line.fadedTime = performance.now() + 100;
                        }
                        ctx.globalAlpha = K.Maths.lerp(0, ctx.globalAlpha, Math.max((line.fadedTime - pn) / 100, 0));
                    } else {
                        counter++;
                        if(!!line.fadedTime) {
                            line.fadedTime = null;
                            line.createdTime = performance.now();
                        }
                        if(line.persistent) persistentRenderCount++;
                    }

                    var targetY = canvas.height - counter * 35;
                    line.y = K.Maths.lerp(line.y || targetY + 30, targetY, Math.min(1, deltaTime / 100));

                    if(line.fadedTime != null && pn - line.fadedTime > 500 && !line.persistent) {
                        removalLines.push(this.logLines.length - 1 - i);
                    } 

                    if(this.enableDebugLog && line.y > -100) {
                        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                        ctx.fillRect(0, line.y, canvas.width, 30);

                        ctx.font = "600 18px " + perferredFont;
                        var badgeWidth = ctx.measureText(line.badgeText).width;
                        ctx.fillStyle = line.badgeColor;
                        ctx.fillRect(10, line.y + 3, badgeWidth + 12, 26);
                        ctx.fillStyle = line.badgeTextColor;
                        ctx.fillText(line.badgeText, 16, line.y + 17);

                        ctx.fillStyle = "white";
                        ctx.font = "600 19px " + perferredFont;
                        ctx.fillText(line.content, 32 + badgeWidth, line.y + 18);
                    }
                    ctx.globalAlpha = 1;
                });

                removalLines.forEach(l => {
                    this.removeLogLine(null, l);
                });

                ctx.textBaseline = "alphabetic";
            }
        }
        $.Editor = Editor;
        
        class Note {
            constructor({x: x, time: time, snap: snap}) {
                this.x = x || 0;
                this.time = time || 0;
                this.soundPlayed = false;

                // Gameplay mechanism
                this.cleared = false;
                this.accuracy = 0;
                this.acceptedTimeRange = 300;
                
                this.snap = snap || 0;
            }

            getDefaultColor() {
                var game = this.game || Game.currentGame;
                return game.getDirection(this.time) > 0 ? "#0af" : "#00bfa5";
            }

            getAccuracy(time) {
                var delta = Math.abs(this.time - time);
                return 1 - (delta / this.acceptedTimeRange);
            }

            clearNote(time) {
                this.cleared = true;
                this.accuracy = this.getAccuracy(time);
            }

            undoClearNote() {
                this.cleared = false;
                this.accuracy = 0;
                this.soundPlayed = false;
            }
        
            render(ctx, time) {
                var game = this.game || Game.currentGame;
                // Needs further implementation
                if(time >= this.time) {
                    if(game.autoClear && !this.cleared) {
                        this.clearNote(this.time);

                        if(this instanceof SliderNote) {
                            this.nodes.forEach(n => {
                                n.clearNote(this.time);
                            });
                        }
                    }
                } else {
                    this.undoClearNote();

                    if(this instanceof SliderNote) {
                        this.nodes.forEach(n => {
                            n.undoClearNote();
                        });
                    }
                }

                // Playing sound in suspended state will result in
                // too many sounds playing in the same time, which causes
                // sound cracking, immediately after being unmuted.
                if(game.enableClickSound && this.cleared && !this.soundPlayed) {
                    this.soundPlayed = true;
                    
                    if(hitsoundBuffer != null && audioContext.state != "suspended" && Math.abs(time - this.time) < 1000) {
                        var src = audioContext.createBufferSource();
                        src.buffer = hitsoundBuffer;

                        var gain = audioContext.createGain();
                        gain.gain.value = 0.125;

                        src.connect(gain)
                        gain.connect(audioContext.destination);
                        src.start();
                    }
                }
            }
        }

        class CircleNote extends Note {
            render(ctx, time) {
                super.render(ctx, time);
                var game = this.game || Game.currentGame;
                var fadeInTime = game.getModeFadeIn() * (!game.bandoriMode ? 120 / game.getBeatAtTime(this.time).bpm : 1);
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.time + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;

                var cw = game.canvasSize.w;
                var ch = game.canvasSize.h;
        
                var canvas = ctx.canvas;
                var centerX = cw / 2;
                var width = game.getModeWidth();
                var progress = Math.pow(time > this.time ?
                    (fadeOutTime - time + this.time) / fadeOutTime :
                    (time - this.time + fadeInTime) / fadeInTime, 3);

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * game.getModeScale() * game.ratio;
                ctx.strokeStyle = "white";
                ctx.lineWidth = size * 0.15;
                ctx.fillStyle = this.getDefaultColor();
                if(time > this.time) {
                    ctx.globalAlpha = alpha * K.Maths.lerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = alpha * K.Maths.lerp(progress, 1, progress);
                }

                var y = game.getYByTime(this.time);

                ctx.beginPath();
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, progress * size * 0.92, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, K.Maths.lerp(0.5, 1, progress) * size, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, K.Maths.lerp(0.5, 1, progress) * size * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();

                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = stroke;
                ctx.fillStyle = fill;
                ctx.globalAlpha = alpha;
            }
        }
        $.CircleNote = CircleNote;

        class FlickNote extends Note {
            render(ctx, time) {
                super.render(ctx, time);
                var game = this.game || Game.currentGame;
                var fadeInTime = game.getModeFadeIn() * (!game.bandoriMode ? 120 / game.getBeatAtTime(this.time).bpm : 1);
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.time + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;

                var cw = game.canvasSize.w;
                var ch = game.canvasSize.h;
        
                var canvas = ctx.canvas;
                var centerX = cw / 2;
                var width = game.getModeWidth();
                var progress = Math.pow(time > this.time ?
                    (fadeOutTime - time + this.time) / fadeOutTime :
                    (time - this.time + fadeInTime) / fadeInTime, 3);

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * game.getModeScale() * game.ratio;
                ctx.strokeStyle = "white";
                ctx.lineWidth = size * 0.15;
                ctx.fillStyle = this.getDefaultColor();
                if(time > this.time) {
                    ctx.globalAlpha = alpha * K.Maths.lerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = alpha * K.Maths.lerp(progress, 1, progress);
                }

                var y = game.getYByTime(this.time);

                ctx.save();
                ctx.translate(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y);
                ctx.rotate(Math.PI / 4);

                var fillSize = progress;
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;
                ctx.fillRect(-size / 2 * fillSize, -size / 2 * fillSize, size * fillSize, size * fillSize);
                ctx.shadowBlur = 0;

                var strokeSize = K.Maths.lerp(0.5, 1.3, progress);
                ctx.strokeRect(-size / 2 * strokeSize, -size / 2 * strokeSize, size * strokeSize, size * strokeSize);

                var patternSize = strokeSize * 0.4;
                ctx.fillStyle = "white";
                ctx.rotate(-Math.PI / 4);

                ctx.beginPath();
                ctx.rect(-1.3 * size / 2 * patternSize, -size / 2 * patternSize, size * patternSize * 0.5, size * patternSize);
                ctx.rect(0.3 * size / 2 * patternSize, -size / 2 * patternSize, size * patternSize * 0.5, size * patternSize);
                ctx.clip();
                ctx.rotate(Math.PI / 4);

                // Center pattern
                ctx.fillRect(-size / 2 * patternSize, -size / 2 * patternSize, size * patternSize, size * patternSize);
                ctx.restore();

                ctx.save();
                ctx.translate(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y);

                var scale = K.Maths.lerp(K.Maths.lerp(0.5, 1.0, progress), 1.0, progress);
                ctx.scale(scale, scale);

                var dist = size * K.Maths.lerp(K.Maths.lerp(2, 1.0, progress), 1.0, progress);
                if(time >= this.time) {
                    dist *= 1.2;
                }
                ctx.translate(-dist, 0);
                ctx.rotate(Math.PI / 4);

                ctx.lineWidth = size * 0.1;
                var arrowSize = size * 0.8;

                // Left
                ctx.beginPath();
                ctx.moveTo(arrowSize, 0);
                ctx.lineTo(0, 0);
                ctx.lineTo(0, -arrowSize);
                ctx.stroke();
                // Right
                ctx.rotate(-Math.PI / 4);
                ctx.translate(dist * 2, 0);
                ctx.rotate(Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(-arrowSize, 0);
                ctx.lineTo(0, 0);
                ctx.lineTo(0, arrowSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.restore();

                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = stroke;
                ctx.fillStyle = fill;
                ctx.globalAlpha = alpha;
            }
        }

        class SliderNote extends Note {
            constructor(meta) {
                super(meta);
                var nodes = meta.nodes || (() => {
                    throw new Error("Empty nodes is not supported.");
                })();
                this.nodes = nodes.sort((a, b) => b.time - a.time);
                this.c2Type7 = meta.c2Type7;

                this.nodes.forEach(n => {
                    n.__proto__ = Note.prototype;
                })
            }

            getSliderLength() {
                return this.getLastNodeTime() - this.time;
            }

            getLastNodeTime() {
                return this.nodes[0].time;
            }

            getCurrSliderX(time) {
                var latterNode = this.nodes[0];
                for(var i=0; i<this.nodes.length; i++) {
                    var n = this.nodes[i];
                    if(time >= n.time) {
                        var l = latterNode.time - n.time;
                        var t = (time - n.time) / l;
                        return l == 0 ? latterNode.x : K.Maths.lerp(n.x, latterNode.x, t);
                    }
                    latterNode = n;
                }

                var l = latterNode.time - this.time;
                var t = (time - this.time) / l;
                return K.Maths.lerp(this.x, latterNode.x, t);
            }

            render(ctx, time) {
                super.render(ctx, time);
                var game = this.game || Game.currentGame;
                var fadeInTime = game.getModeFadeIn() * (!game.bandoriMode ? 120 / game.getBeatAtTime(this.time).bpm : 1);
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.getLastNodeTime() + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;

                var cw = game.canvasSize.w;
                var ch = game.canvasSize.h;

                var state = -1;
                if(time >= this.time && time < this.getLastNodeTime()) state = 0; 
                if(time >= this.getLastNodeTime()) state = 1;
        
                var canvas = ctx.canvas;
                var centerX = cw / 2;
                var width = game.getModeWidth();
                var progress = Math.pow(time > this.time ?
                    time > this.getLastNodeTime() ?
                    (fadeOutTime - time + this.getLastNodeTime()) / fadeOutTime : 1 :
                    (time - this.time + fadeInTime) / fadeInTime, 3);

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * 0.5 * game.getModeScale() * game.ratio;

                // Since that make the view nonsense when the next node is in the next beat,
                // we will use vector linear interpolation during active time.
                var y = game.getYByTime(time > this.time ? Math.min(time, this.getLastNodeTime()) : this.time);
                
                ctx.strokeStyle = "white";
                var prevLocation = new K.Vector2(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), game.getYByTime(this.time));

                // Determine the Y by the previous and next node.
                var prevNode = this;

                var nodes = [];
                nodes.push.apply(nodes, this.nodes);
                nodes.sort((a, b) => a.time - b.time);

                ctx.fillStyle = "#fff";
                ctx.shadowColor = ctx.fillStyle;

                var prevNp = progress;
                nodes.forEach(n => {
                    var ny = game.getYByTime(n.time);
                    var nFadeInTime = game.getModeFadeIn() * (!game.bandoriMode ? 120 / game.getBeatAtTime(n.time).bpm : 1) * 1.2;
                    var np = time > n.time ?
                        (fadeOutTime - time + n.time) / fadeOutTime :
                        (time - (n.time - prevNode.time > nFadeInTime ? prevNode.time + nFadeInTime / 2 : n.time) + nFadeInTime) / nFadeInTime;
                    np = Math.pow(Math.max(0, Math.min(1, np)), 3);
                    
                    if(time >= prevNode.time && time < n.time) {
                        y = K.Maths.lerp(
                            game.getYByTime(prevNode.time), ny,
                            (time - prevNode.time) / (n.time - prevNode.time)
                        );
                    }
                    
                    var sp = prevLocation.clone();
                    var ep = new K.Vector2(centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), ny);
                    var nm = ep.minus(sp).normalize();
                    var pad = nm.times(size * 0);

                    if(time < prevNode.time + fadeOutTime && time > prevNode.time - nFadeInTime && !(prevNode instanceof SliderNote)) {
                        var m = ctx.getTransform();
                        ctx.translate(sp.x, sp.y);
                        ctx.transform(-nm.y, nm.x, -nm.x, -nm.y, 0, 0);
                        var asz = Math.max(0, K.Maths.lerp(0.5, 1, prevNp) * size * 1.5 * 0.45);
                        ctx.drawImage(arrowUpIcon, -asz / 2, -asz / 2 - 0.05 * size, asz, asz);
                        ctx.setTransform(m);
                    }

                    if(time < n.time + fadeOutTime && np > 0) {
                        if(time > n.time) {
                            ctx.globalAlpha = alpha * K.Maths.lerp(0, 0.5, Math.pow(np, 3));
                        } else {
                            ctx.globalAlpha = alpha * K.Maths.lerp(np, 1, Math.pow(np, 3));
                        }
                        ctx.beginPath();
                        ctx.shadowBlur = 60;
                        ctx.arc(centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), ny, Math.max(0, K.Maths.lerp(0.5, 1, np) * size * 1.5 * 0.5), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        super.render.apply(n, [ctx, time]);
                        prevNp = np;
                    }

                    ctx.globalAlpha = alpha * K.Maths.lerp(0, 1, np);

                    sp = sp.plus(pad);
                    ep = ep.minus(pad);
                    var cp = K.Vector2.center(sp, ep);
                    sp = K.Vector2.lerp(cp, sp, K.Maths.lerp(1, 1, np));
                    ep = K.Vector2.lerp(cp, ep, K.Maths.lerp(1, 1, np));

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(ep.x, ep.y);
                    ctx.lineTo(sp.x, sp.y);
                    ctx.lineWidth = size * 0.35;
                    ctx.setLineDash([size * 0.3, size * 0.3 ]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                    ctx.beginPath();

                    prevNode = n;
                    prevLocation = new K.Vector2(centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), ny);
                });

                ctx.lineWidth = size * 0.5;
                ctx.fillStyle = this.c2Type7 ? this.getDefaultColor() : "#ab47bc";
                if(this.c2Type7) size *= 1.5; 
                if(time > this.getLastNodeTime()) {
                    ctx.globalAlpha = alpha * K.Maths.lerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = alpha * K.Maths.lerp(progress, 1, progress);
                }

                ctx.beginPath();
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;

                var x = centerX + this.x * width / 2 * (game.mirrored ? -1 : 1);
                if(time > this.time) {
                    x = centerX + this.getCurrSliderX(time) * width / 2 * (game.mirrored ? -1 : 1);
                }
                
                ctx.arc(x, y, Math.max(0, progress * size * 0.92), 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();

                if(time < this.getLastNodeTime() + fadeOutTime) {
                    ctx.arc(x, y, Math.max(0, K.Maths.lerp(0.5, 1, progress) * size), 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                }

                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = stroke;
                ctx.fillStyle = fill;
                ctx.globalAlpha = alpha;
            }
        }

        class HoldNote extends Note {
            constructor(config) {
                super(config);
                this.endTime = config.endTime || this.time;
                if(!!config.length) {
                    this.endTime += config.length;
                }
            }

            getEndTime() {
                return this.endTime;
            }

            drawHoldNote(ctx, time, startY, endY, color) {
                super.render(ctx, time);
                var game = this.game || Game.currentGame;
                var fadeInTime = game.getModeFadeIn() * (!game.bandoriMode ? 120 / game.getBeatAtTime(this.time).bpm : 1);
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.getEndTime() + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;

                var cw = game.canvasSize.w;
                var ch = game.canvasSize.h;

                var state = -1;
                if(time >= this.time && time < this.getEndTime()) state = 0; 
                if(time >= this.getEndTime()) state = 1;
        
                var canvas = ctx.canvas;
                var centerX = cw / 2;
                var width = game.getModeWidth();
                var progress = Math.pow(time > this.time ?
                    time > this.getEndTime() ?
                    (fadeOutTime - time + this.getEndTime()) / fadeOutTime : 1 :
                    (time - this.time + fadeInTime) / fadeInTime, 3);

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * game.getModeScale() * game.ratio;
                
                ctx.strokeStyle = "white";

                ctx.fillStyle = color;
                if(time > this.getEndTime()) {
                    ctx.globalAlpha = alpha * K.Maths.lerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = alpha * K.Maths.lerp(progress, 1, progress);
                }
                var a = ctx.globalAlpha;
                var c = ctx.fillStyle;

                var x = centerX + this.x * width / 2 * (game.mirrored ? -1 : 1);
                var y = game.getYByTime(this.time);

                ctx.lineWidth = K.Maths.lerp(0.35, 1, progress) * size;
                ctx.setLineDash([size * 0.15, size * 0.15]);
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();

                var hp =  Math.max(0, Math.min(1, (time - this.time) / (this.endTime - this.time)));
                ctx.strokeStyle = c;
                if(state >= 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, startY);
                    ctx.lineTo(x, K.Maths.lerp(startY, endY, hp));
                    ctx.stroke();

                    var bl = game.getBeatLengthAt(time);
                    var bp = ((time - game.getBeatAtTime(time).time) / bl * 4) % 1;

                    // Beat indicator
                    var gy = game.getYByTime(time);
                    var a = ctx.globalAlpha;
                    ctx.globalAlpha = a * 0.2;
                    ctx.beginPath();
                    ctx.arc(x, game.bandoriMode ? gy : y, Math.max(0, progress * size * K.Maths.lerp(1.75, 1.25, bp)), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, game.bandoriMode ? gy : y, Math.max(0, progress * size * 0.8 * K.Maths.lerp(1.75, 1.25, bp)), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = a;

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(0, gy);
                    ctx.lineTo(x, y);
                    ctx.lineTo(cw, gy);
                    ctx.clip();
                    ctx.beginPath();
                    ctx.setLineDash([5 * game.ratio, 10 * game.ratio]);
                    ctx.strokeStyle = "rgba(255, 255, 255, " + a * 0.2 +")";
                    ctx.moveTo(0, 0);
                    ctx.lineTo(cw, ch);
                    ctx.lineWidth = Math.sqrt(Math.pow(cw, 2) + Math.pow(ch, 2)) * 1.1;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.restore();
                    if(game.bandoriMode) y = game.getYByTime(time);
                }

                ctx.strokeStyle = "white";
                ctx.setLineDash([]);
                ctx.lineWidth = size * 0.15;
                ctx.beginPath();
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;
                ctx.arc(x, y, Math.max(0, progress * size * 0.92), 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(0, K.Maths.lerp(0.5, 1, progress) * size), 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.lineWidth *= 0.5;
                ctx.arc(x, y, Math.max(0, K.Maths.lerp(0.5, 1, progress) * size * 0.5), 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.lineWidth = size * 0.2;


                // Spinner
                var ra = Math.PI * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(0, progress * size * 1.25), -ra, -ra + Math.PI * 2 * hp * (1 / 0.75));
                ctx.stroke();
                ctx.strokeStyle = c;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(0, progress * size * 1.25), -ra, -ra + Math.PI * 2 * hp);
                ctx.stroke();

                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = stroke;
                ctx.fillStyle = fill;
                ctx.globalAlpha = alpha;
            }

            render(ctx, time) {
                var game = this.game || Game.currentGame;
                var direction = game.getDirection(this.time);
                var y = game.getYByTime(this.time);
                var endY = game.getYByTime(this.endTime);
                this.drawHoldNote(ctx, time, y, endY, direction > 0 ? "#ec407a" : "#e53935");
            }
        }

        class LongHoldNote extends HoldNote {
            render(ctx, time) {
                var game = this.game || Game.currentGame;
                var direction = game.getDirection(this.time);
                var ch = game.canvasSize.h;

                var sy = direction > 0 ? 0 : ch;
                var ey = direction < 0 ? 0 : ch;

                if(game.bandoriMode) {
                    sy = game.getYByTime(this.time);
                    ey = game.getYByTime(this.endTime);
                }

                this.drawHoldNote(ctx, time, sy, ey, "#fc2");
            }
        }
    })(window);
} catch(ex) {
    // We will think of a new way to warn about initialization errors.
}