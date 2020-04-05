try {
    ($ => {
        function KLerp(a, b, t) {
            return a + (b - a) * t;
        }

        function KV2Normalize({x: x, y: y}) {
            var dist = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            return {x: x / dist, y: y / dist};
        }

        function KV2Mult({x: x, y: y}, n) {
            return {x: x * n, y: y * n}
        }

        function KV2Add({x: x1, y: y1}, {x: x2, y: y2}) {
            return {x: x1 + x2, y: y1 + y2};
        }

        function KV2Center({x: x1, y: y1}, {x: x2, y: y2}) {
            return {x: (x1 + x2) / 2, y: (y1 + y2) / 2};
        }

        function KV2Lerp(a, b, t) {
            return KV2Add(a, KV2Mult(KV2Add(b, KV2Mult(a, -1)), t));
        }

        var acClass = window.AudioContext || window.webkitAudioContext;

        /** @type {AudioContext} */
        var audioContext = new acClass();

        var hitsoundBuffer = null;

        class TimingPoints {
            constructor({time: time, bpm: bpm}) {
                this.time = time || 0;
                this.bpm = bpm || 60;
            }
        }

        var muteIcon = new Image();
        muteIcon.src = "./assets/mute-3-xxl.png";

        function KBpmToMillis(bpm) {
            return 120 / bpm * 1000;
        }

        function KMillisToBpm(millis) {
            return Math.round(millis / 1000 * 120);
        }

        class Game {
            constructor(canvas) {
                if(!canvas || !canvas.getContext) {
                    throw new Error("Invalid canvas parameter.");
                }

                this.bandoriMode = false;
                this.bandoriSpeed = 3.5;
                this.bandoriLineY = canvas.height * 0.85;
        
                this.canvas = canvas;
                this.context = canvas.getContext("2d");
        
                if(!this.context) {
                    throw new Error("Canvas is not supported.");
                }

                // Export our game for further use.
                Game.currentGame = this;

                // Fetch the hitsound!
                fetch("./assets/soft-hitsoft.wav")
                    .then(response => response.arrayBuffer())
                    .then(buffer => audioContext.decodeAudioData(buffer, b => {
                        hitsoundBuffer = b
                    }, ex => alert(ex)))

                // Viewport
                this.fieldWidth = canvas.width * 0.7;
                this.fieldHeight = canvas.height * 0.6;

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

                /** @type {HTMLAudioElement} */
                this.audioElem = document.getElementById("game-audio");
                this.enableClickSound = true;

                this.cachedBeatsInfo = null;

                // Render settings
                this.noteFadeInTime = 707;
                this.noteFadeOutTime = 100;
                
                /*fetch("./assets/85.chaos.json")
                    .then(response => response.json())
                    .then(json => {
                        this.parseMap(json);
                        this.update();
                    }); /**/

                this.loadBestdoriMap(243, "expert").then(() => {
                    this.update();
                }); /**/
            }

            exportMap() {
                function toSerializableNote(n) {
                    var type = "unknown";

                    if(n instanceof SliderNote) {
                        type = "slider";
                        return { type: type, x: n.x, time: n.time, nodes: n.nodes.map(x => {
                            return { x: x.x, time: x.time, snap: n.snap }
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
                    return { time: p.time, bpm: p.bpm };
                });

                var notes = this.notes.map(toSerializableNote);

                return {
                    song: {
                        ...this.songMeta,
                        audio: this.audioElem.currentSrc,
                        offset: this.globalOffset
                    },
                    timingPoints: points,
                    notes: notes
                }
            }

            snapNotes() {
                var snapLevel = 8;
                var beats = this.getBeats()

                var snap = n => {
                    if(n.nosnap) return;

                    var time = n.time;
                    var beatLen = this.getBeatLengthAt(time);
                    var beat = this.getBeatAtTime(time);

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
                    }
                });
            }

            snapTimingPoints() {
                var prevPoint = null;
                this.timingPoints.forEach(p => {
                    if(prevPoint != null) {
                        var beatLen = this.getBeatLengthAt(p.time - 10);
                        var beat = this.getBeatAtTime(p.time - 10);
                        p.time = beat.time + beatLen;
                    }
                    prevPoint = p;
                });
            }

            getBeatLengthAt(time) {
                var bpm = this.getBeatAtTime(time).bpm;
                return KBpmToMillis(bpm);
            }

            getYByTime(time) {
                var canvas = this.canvas;
                if(this.bandoriMode) {
                    var latency = audioContext.baseLatency || 0;
                    var gtime = (this.audioElem.currentTime + latency) * 1000 + this.globalOffset;
                    var result = this.bandoriLineY - this.bandoriSpeed * (time - gtime) * 0.125;
                    if(this.yFlip) result = canvas.height - result;
                    return result;
                }

                var direction = this.getDirection(time);
        
                var y = canvas.height / this.getBeatLengthAt(time) * this.getTimeInBeat(time);
                if(this.yFlip ? direction > 0 : direction < 0) {
                    y = canvas.height - y;
                }

                y = y * (this.fieldHeight / canvas.height) + (canvas.height - this.fieldHeight) / 2;
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
                    var beatLen = KBpmToMillis(a.bpm);
                    
                    var t = a.time;
                    do {
                        if(b.time - t < 0.001) break;
                        result.push({
                            time: t,
                            bpm: a.bpm
                        });
                        t += beatLen;
                    } while(t < b.time);
                }

                var last = this.timingPoints[this.timingPoints.length-1];
                result.push({
                    time: last.time,
                    bpm: last.bpm
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
                        bpm: last.bpm
                    };
                } else {
                    beat = beats[beatIndex];
                }
                return beat;
            }

            getBeatIndex(time) {
                var index = 0;
                var beats = this.getBeats();
                for(var i=1; i<beats.length; i++) {
                    if(beats[i].time > time) {
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
                return this.getBeatIndex(time) % 2 == 1 ? 1 : -1;
            }

            parseMap(json) {
                this.cachedBeatsInfo = null;
                this.songMeta = json.song;

                var timingPoints = [];
                json.timingPoints.forEach(p => {
                    timingPoints.push(new TimingPoints(p));
                });
                /** @type {TimingPoints[]} */
                this.timingPoints = timingPoints.sort((a, b) => a.time - b.time);
                this.timingPoints[0].time = 0;
                this.snapTimingPoints();

                this.coverImage.src = json.song.cover;
                if(!!json.song.audio && this.audioElem.src != json.song.audio) {
                    this.audioElem.src = json.song.audio;
                    this.audioElem.play();
                }

                this.globalOffset = json.song.offset;

                var notes = [];
                json.notes.forEach(n => {
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
                this.notes = notes.sort((a, b) => b.time - a.time);
                this.snapNotes();
                this.prevBeatLen = this.getBeatLengthAt(1);
            }

            parseBestdoriMap(json, { offset, cover, audio }) {
                var map = {
                    song: {
                        title: "Bestdori",
                        romanizedTitle: "Bestdori",
                        cover: cover || "./assets/cover.jpeg",
                        audio: audio,
                        offset: offset === undefined ? 40 : offset
                    },
                    timingPoints: [],
                    notes: []
                };

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
                    return KLerp(-0.9, 0.9, (lane - 1) / 6);
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
                this.parseMap(map);
                return map;
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
                    if(this.audioElem.src != src) {
                        this.audioElem.src = src;
                        var onLoad = () => { 
                            this.audioElem.play();
                            setTimeout(() => { 
                                this.audioElem.removeEventListener("canplay", onLoad);
                            }, 0);
                        };
                        this.audioElem.addEventListener("canplay", onLoad);
                    }

                    fetch(`./assets/charts/bandori/${id}.${level}.json`, {
                        cache: "no-cache"
                    })
                    .then(response => response.json())
                    .then(json => {
                        this.parseMap(json);
                        resolve(json);
                    })
                    .catch(ex => {
                        var url = `bestdori_chart.php?id=${id}&level=${level}`;
                        fetch(url).then(response => response.json())
                        .then(json => {
                            this.parseBestdoriMap(json, {
                                offset: 40
                            });
                        })
                        .then(map => {
                            resolve(map);
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
                    console.log(ex);
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
                return this.noteFadeInTime * (this.bandoriMode ? 3 * 5 / KLerp(1, 5.5, this.bandoriSpeed / 11) : 1);
            }

            update() {
                requestAnimationFrame(() => {
                    if(Game.currentGame == this)
                    this.update();
                });
        
                var canvas = this.canvas;
                var ctx = this.context;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Cover image
                if(this.coverImage.complete && this.coverImage.width > 0 && this.coverImage.height > 0) {
                    ctx.globalAlpha = 0.2;
                    ctx.drawImage(this.coverImage, canvas.width / 2 - 250, canvas.height / 2 - 250, 500, 500)
                    ctx.globalAlpha = 1;
                }
                
                var latency = audioContext.baseLatency || 0;
                var time = (this.audioElem.currentTime + latency) * 1000 + this.globalOffset;
                var y = this.getYByTime(time);

                this.notes.forEach(n => n.render(ctx, time));

                // Scanline
                if(this.resetScanlineAt <= time) {
                    this.scanlineColor = "white";
                }

                // Scanline transform
                var currBeatLen = this.getBeatLengthAt(time);
                var nextBeatLen = this.getBeatLengthAt(time + currBeatLen);
                if(nextBeatLen < currBeatLen) {
                    var progress = this.getTimeInBeat(time) / currBeatLen;
                    var color = KLerp(510, 0, progress * 1.5);
                    this.scanlineColor = `rgb(255, ${color}, ${color})`;
                } else if(nextBeatLen > currBeatLen) {
                    var progress = this.getTimeInBeat(time) / currBeatLen;
                    var color = KLerp(255 + 128, 255 - 128, progress);
                    this.scanlineColor = `rgb(${color}, 255, 255)`;
                }

                // Scanline temp color change
                if(this.prevBeatLen != currBeatLen) {
                    this.resetScanlineAt = time + currBeatLen * 4;
                    if(currBeatLen < this.prevBeatLen) {
                        this.scanlineColor = "#f00";
                    } else {
                        this.scanlineColor = "#8ff";
                    }
                }
                this.prevBeatLen = currBeatLen;

                ctx.fillStyle = this.scanlineColor;
                ctx.shadowColor = this.scanlineColor;
                ctx.shadowBlur = 60;
                ctx.fillRect(0, y, canvas.width, 5);
                ctx.shadowBlur = 0;
                ctx.font = "25px Arial";
                // ctx.fillText("length = " + this.getBeatLengthAt(time), 5, canvas.height - 5);

                // Mute indicator
                if(audioContext.state == "suspended") {
                    ctx.drawImage(muteIcon, 50, 50, 75, 75);
                    ctx.textBaseline = "middle";
                    ctx.font = "45px sans-serif";
                    ctx.fillStyle = "white";
                    ctx.fillText("點一下關閉靜音", 150, 50 + 75 / 2);
                    ctx.textBaseline = "alphabetic";
                }
            }
        }
        
        class Note {
            constructor({x: x, time: time, snap: snap}) {
                this.x = x || 0;
                this.time = time || 0;
                this.cleared = false;
                this.soundPlayed = false;

                this.snap = snap || 0;
            }
        
            render(ctx, time) {
                // Needs further implementation
                if(time >= this.time) {
                    this.cleared = true;
                } else {
                    this.cleared = false;
                    this.soundPlayed = false;
                }

                if(Game.currentGame.enableClickSound && this.cleared && !this.soundPlayed) {
                    this.soundPlayed = true;
                    
                    if(hitsoundBuffer != null) {
                        var src = audioContext.createBufferSource();
                        src.buffer = hitsoundBuffer;

                        var gain = audioContext.createGain();
                        gain.gain.value = 0.125;

                        src.connect(gain).connect(audioContext.destination);
                        src.start();
                    }
                }
            }
        }

        class CircleNote extends Note {
            render(ctx, time) {
                var game = Game.currentGame;
                var fadeInTime = game.getModeFadeIn();
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.time + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;
                super.render(ctx, time);
        
                var canvas = ctx.canvas;
                var centerX = canvas.width / 2;
                var width = game.getModeWidth();
                var progress = time > this.time ?
                    (fadeOutTime - time + this.time) / fadeOutTime :
                    (time - this.time + fadeInTime) / fadeInTime;

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * game.getModeScale();
                ctx.strokeStyle = "white";
                ctx.lineWidth = size * 0.15;
                ctx.fillStyle = game.getDirection(this.time) > 0 ? "#0af" : "#f05";
                if(time > this.time) {
                    ctx.globalAlpha = KLerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = KLerp(progress, 1, progress);
                }

                var y = game.getYByTime(this.time);

                ctx.beginPath();
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, progress * size * 0.92, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, KLerp(0.5, 1, progress) * size, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.arc(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y, KLerp(0.5, 1, progress) * size * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();

                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = stroke;
                ctx.fillStyle = fill;
                ctx.globalAlpha = alpha;
            }
        }

        class FlickNote extends Note {
            render(ctx, time) {
                var game = Game.currentGame;
                var fadeInTime = game.getModeFadeIn();
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.time + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;
                super.render(ctx, time);
        
                var canvas = ctx.canvas;
                var centerX = canvas.width / 2;
                var width = game.getModeWidth();
                var progress = time > this.time ?
                    (fadeOutTime - time + this.time) / fadeOutTime :
                    (time - this.time + fadeInTime) / fadeInTime;

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * game.getModeScale();
                ctx.strokeStyle = "white";
                ctx.lineWidth = size * 0.15;
                ctx.fillStyle = game.getDirection(this.time) > 0 ? "#0af" : "#f05";
                if(time > this.time) {
                    ctx.globalAlpha = KLerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = KLerp(progress, 1, progress);
                }

                var y = game.getYByTime(this.time);

                /**
                ctx.beginPath();
                ctx.arc(centerX + this.x * width / 2, y, progress * size, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(centerX + this.x * width / 2, y, KLerp(0.5, 1, progress) * size, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                **/

                ctx.save();
                ctx.translate(centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y);
                ctx.rotate(Math.PI / 4);

                var fillSize = progress;
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 60;
                ctx.fillRect(-size / 2 * fillSize, -size / 2 * fillSize, size * fillSize, size * fillSize);
                ctx.shadowBlur = 0;

                var strokeSize = KLerp(0.5, 1.3, progress);
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

                var scale = KLerp(KLerp(0.5, 1.0, progress), 1.0, progress);
                ctx.scale(scale, scale);

                var dist = size * 1.5 * KLerp(KLerp(2, 1.0, progress), 1.0, progress);
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
                        return l == 0 ? latterNode.x : KLerp(n.x, latterNode.x, t);
                    }
                    latterNode = n;
                }

                var l = latterNode.time - this.time;
                var t = (time - this.time) / l;
                return KLerp(this.x, latterNode.x, t);
            }

            render(ctx, time) {
                var game = Game.currentGame;
                var fadeInTime = game.getModeFadeIn();
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.getLastNodeTime() + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;
                super.render(ctx, time);

                var state = -1;
                if(time >= this.time && time < this.getLastNodeTime()) state = 0; 
                if(time >= this.getLastNodeTime()) state = 1;
        
                var canvas = ctx.canvas;
                var centerX = canvas.width / 2;
                var width = game.getModeWidth();
                var progress = time > this.time ?
                    time > this.getLastNodeTime() ?
                    (fadeOutTime - time + this.getLastNodeTime()) / fadeOutTime : 1 :
                    (time - this.time + fadeInTime) / fadeInTime;

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;

                var size = game.noteSize * 0.5 * game.getModeScale();

                // Since that make the view nonsense when the next node is in the next beat,
                // we will use vector linear interpolation during active time.
                var y = game.getYByTime(time > this.time ? Math.min(time, this.getLastNodeTime()) : this.time);
                
                ctx.strokeStyle = "white";
                var prevLocation = {x: centerX + this.x * width / 2 * (game.mirrored ? -1 : 1), y: game.getYByTime(this.time)};

                // Determine the Y by the previous and next node.
                var prevNode = this;

                var nodes = [];
                nodes.push.apply(nodes, this.nodes);
                nodes.sort((a, b) => a.time - b.time);

                nodes.forEach(n => {
                    var ny = game.getYByTime(n.time);
                    var np = time > n.time ?
                        (fadeOutTime - time + n.time) / fadeOutTime :
                        (time - n.time + fadeInTime) / fadeInTime;

                    if(time < n.time + fadeOutTime && time > n.time - fadeInTime) {
                        if(time > n.time) {
                            ctx.globalAlpha = KLerp(0, 0.5, np);
                        } else {
                            ctx.globalAlpha = KLerp(np, 1, np);
                        }

                        if(time >= prevNode.time && time < n.time) {
                            y = KLerp(
                                game.getYByTime(prevNode.time), ny,
                                (time - prevNode.time) / (n.time - prevNode.time)
                            );
                        }

                        ctx.beginPath();
                        ctx.fillStyle = "#fff";
                        ctx.shadowColor = ctx.fillStyle;
                        ctx.shadowBlur = 60;
                        ctx.arc(centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), ny, Math.max(0, np * size * 0.92 * 0.5), 0, Math.PI * 2);
                        ctx.fill();

                        var sp = {x: prevLocation.x, y: prevLocation.y};
                        var ep = {x: centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), y: ny};
                        var pad = KV2Mult(KV2Normalize(KV2Add(ep, KV2Mult(sp, -1))), 30);

                        sp = KV2Add(sp, pad);
                        ep = KV2Add(ep, KV2Mult(pad, -1));
                        var cp = KV2Center(sp, ep);
                        sp = KV2Lerp(cp, sp, KLerp(0.9, 1, np));
                        ep = KV2Lerp(cp, ep, KLerp(0.9, 1, np));

                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(ep.x, ep.y);
                        ctx.lineTo(sp.x, sp.y);
                        ctx.lineWidth = size * 0.15;
                        ctx.setLineDash([10, 10]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.restore();
                        ctx.beginPath();

                        super.render.apply(n, [ctx, time]);
                    }

                    prevNode = n;
                    prevLocation = {x: centerX + n.x * width / 2 * (game.mirrored ? -1 : 1), y: ny};
                });

                ctx.lineWidth = size * 0.5;
                ctx.fillStyle = "#0f5";
                if(time > this.getLastNodeTime()) {
                    ctx.globalAlpha = KLerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = KLerp(progress, 1, progress);
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
                    ctx.arc(x, y, Math.max(0, KLerp(0.5, 1, progress) * size), 0, Math.PI * 2);
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
                var game = Game.currentGame;
                var fadeInTime = game.getModeFadeIn();
                var fadeOutTime = game.noteFadeOutTime;

                if(time > this.getEndTime() + fadeOutTime) return;
                if(time < this.time - fadeInTime) return;
                super.render(ctx, time);

                var state = -1;
                if(time >= this.time && time < this.getEndTime()) state = 0; 
                if(time >= this.getEndTime()) state = 1;
        
                var canvas = ctx.canvas;
                var centerX = canvas.width / 2;
                var width = game.getModeWidth();
                var progress = time > this.time ?
                    time > this.getEndTime() ?
                    (fadeOutTime - time + this.getEndTime()) / fadeOutTime : 1 :
                    (time - this.time + fadeInTime) / fadeInTime;

                var stroke = ctx.strokeStyle;
                var fill = ctx.fillStyle;
                var lineWidth = ctx.lineWidth;
                var alpha = ctx.globalAlpha;
                var direction = game.getDirection(this.time);

                var size = game.noteSize * game.getModeScale();
                
                ctx.strokeStyle = "white";

                ctx.fillStyle = color;
                if(time > this.getEndTime()) {
                    ctx.globalAlpha = KLerp(0, 0.5, progress);
                } else {
                    ctx.globalAlpha = KLerp(progress, 1, progress);
                }
                var a = ctx.globalAlpha;
                var c = ctx.fillStyle;

                var x = centerX + this.x * width / 2 * (game.mirrored ? -1 : 1);
                var y = game.getYByTime(this.time);

                ctx.lineWidth = KLerp(0.35, 1, progress) * size;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();

                var hp =  Math.max(0, Math.min(1, (time - this.time) / (this.endTime - this.time)));
                ctx.strokeStyle = c;
                if(state >= 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, startY);
                    ctx.lineTo(x, KLerp(startY, endY, hp));
                    ctx.stroke();

                    var bl = game.getBeatLengthAt(time);
                    var bp = ((time - game.getBeatAtTime(time).time) / bl * 4) % 1;

                    // Beat indicator
                    var gy = game.getYByTime(time);
                    var a = ctx.globalAlpha;
                    ctx.globalAlpha = 0.2;
                    ctx.beginPath();
                    ctx.arc(x, game.bandoriMode ? gy : y, Math.max(0, progress * size * KLerp(1.75, 1.25, bp)), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, game.bandoriMode ? gy : y, Math.max(0, progress * size * 0.8 * KLerp(1.75, 1.25, bp)), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = a;

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(0, gy);
                    ctx.lineTo(x, game.bandoriMode ? gy : y);
                    ctx.lineTo(canvas.width, gy);
                    ctx.clip();
                    ctx.beginPath();
                    ctx.setLineDash([5, 10]);
                    ctx.strokeStyle = "rgba(255, 255, 255, " + a * 0.2 +")";
                    ctx.moveTo(0, 0);
                    ctx.lineTo(canvas.width, canvas.height);
                    ctx.lineWidth = Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2)) * 1.1;
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
                ctx.arc(x, y, Math.max(0, KLerp(0.5, 1, progress) * size), 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.lineWidth *= 0.5;
                ctx.arc(x, y, Math.max(0, KLerp(0.5, 1, progress) * size * 0.5), 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.lineWidth = size * 0.2;

                var ra = Math.PI * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, Math.max(0, progress * size * 1.25), -ra, -ra + Math.PI * 2 * hp * 1.2);
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
                var game = Game.currentGame;
                var direction = game.getDirection(this.time);
                var y = game.getYByTime(this.time);
                var endY = game.getYByTime(this.endTime);
                this.drawHoldNote(ctx, time, y, endY, direction > 0 ? "#0af" : "#f05");
            }
        }

        class LongHoldNote extends HoldNote {
            render(ctx, time) {
                var game = Game.currentGame;
                var direction = game.getDirection(this.time);

                var sy = direction > 0 ? 0 : canvas.height;
                var ey = direction < 0 ? 0 : canvas.height;

                if(game.bandoriMode) {
                    sy = game.getYByTime(this.time);
                    ey = game.getYByTime(this.endTime);
                }

                this.drawHoldNote(ctx, time, sy, ey, "#fc2");
            }
        }

        // Export our Game class.
        $.Game = Game;
    })(window);
} catch(ex) {
    // We will think of a new way to warn about initialization errors.
}