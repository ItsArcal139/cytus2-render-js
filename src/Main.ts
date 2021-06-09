import { Beatmap } from "./beatmap/Beatmap";
import { CircleNote } from "./beatmap/CircleNote";
import { FlickNote } from "./beatmap/FlickNote";
import { HoldNote } from "./beatmap/HoldNote";
import { LongHoldNote } from "./beatmap/LongHoldNote";
import { Note } from "./beatmap/Note";
import { SliderNode } from "./beatmap/SliderNode";
import { SliderNote } from "./beatmap/SliderNote";
import { Renderer } from "./Renderer";

function hasQuery(key: string) {
    return location.search.indexOf("?"+key) != -1 || location.search.indexOf("&"+key) != -1;
}

// @ts-ignore
exports = window;

export { Renderer } from "./Renderer";

export class Game {
    static get currentGame() {
        return Renderer.current;
    }
}

Note.noteTypeMap = {
    0: CircleNote,
    1: HoldNote,
    2: LongHoldNote,
    3: SliderNote,
    6: SliderNote,
    4: SliderNode,
    7: SliderNode,
    5: FlickNote
};

export var canvas = (() => {
    var e = document.getElementById("main");
    if(!e) {
        throw new Error();
    }
    return e as HTMLCanvasElement;
})();

export var game = new Renderer(canvas, {
    audioCompatMode: hasQuery("audioCompat")
});

export var handler = (e: Event) => {
    e.preventDefault();
    if(game.audioContext.state == "suspended") {
        game.audioContext.resume();
    }
};

canvas.addEventListener("touchstart", handler);
canvas.addEventListener("click", handler);

export function setupDebugger(btn: HTMLButtonElement) {
    var s = document.createElement("script");
    s.src = "debugger.js";
    document.body.append(s);

    if(btn) {
        btn.disabled = true;
    }
}

if(hasQuery("dev")) {
    setupDebugger(document.getElementById("enable-debugger") as HTMLButtonElement);
}

if(hasQuery("bandori")) {
    Renderer.current.bandoriMode = true;
}

var btn = document.getElementById("switch-bandori");
btn?.classList.remove("btn-success", "btn-danger");
btn?.classList.add("btn-" + (Renderer.current.bandoriMode ? "danger" : "success"));

export function switchSpeed(btn: HTMLElement) {
    var speedText = btn.innerText;
    var speed = parseFloat(speedText.substring(0, speedText.length - 1));
    Renderer.current.setPlaybackRate(speed);
}

export function switchBandori() {
    Renderer.current.bandoriMode = !Renderer.current.bandoriMode;
    var btn = document.getElementById("switch-bandori");
    btn?.classList.remove("btn-success", "btn-danger");
    btn?.classList.add("btn-" + (Renderer.current.bandoriMode ? "danger" : "success"));
}

function refreshSwitch() {
}

export function fullScreen() {
    var canvas = document.getElementById("main");

    var createMatch = (s: string) => (regex: RegExp) => regex.test(s);
    var m = createMatch(navigator.userAgent);
    if(m(/iPhone/i) || m(/iPad/i) || m(/iPod/i) || (m(/Macintosh/i) && m(/Safari/i) && !m(/Chrome/i))) {
        canvas?.classList.add("fullscreen");
        setTimeout(() => {
            Renderer.current.audioElem.play();
        }, 1000);
    } else {
        canvas?.requestFullscreen();
        setTimeout(() => {
            Renderer.current.audioElem.play();
        }, 5000);
    }
}

var songDatabase = "./assets/song_database.json";

export function loadChart() {
    var audioInput = document.getElementById("input-audio") as HTMLInputElement;
    var chartInput = document.getElementById("input-chart") as HTMLInputElement;
    var rmfpBox = document.getElementById("remove-first-page") as HTMLInputElement;

    game.loadMap(URL.createObjectURL(chartInput.files?.item(0)), {
        audio: URL.createObjectURL(audioInput.files?.item(0))
    }).then(() => {
        if(rmfpBox.checked) {
            var map = game.chart;
            if(map == null) return;

            var firstPage = map.pages[0];
            var offset = firstPage.endTick - firstPage.startTick;
            map.pages.shift();

            map.pages.forEach(p => {
                p.startTick -= offset;
                p.endTick -= offset;
            });
            map.tempos.forEach(t => {
                t.tick = Math.max(0, t.tick - offset);
            });
            map.eventOrders.forEach(t => {
                t.tick = Math.max(0, t.tick - offset);
            });
            map.notes.forEach(n => {
                n.pageIndex--;
                n.tick -= offset;
            });
            game.refreshTickTimer();
        }
    });
}

export function loadC2ByButton(btn: HTMLButtonElement) {
    fetch(songDatabase)
        .then(r => r.json())
        .then(db => {
            // @ts-ignore
            var item = db.cytus2.find((s: any) => s.id == btn.parentNode?.previousElementSibling?.querySelector("[k-prop=c2-id]").innerText);
            
            fetch(item.chart)
                .then(r => r.text())
                .then(j => {
                    var m = Beatmap.deserialize(JSON.parse(j));
                    Renderer.current.parseMap(m, {
                        audio: item.audio,
                        title: item.title,
                        difficulty: item.difficulty,
                        icon: item.icon || "./assets/Icon.png"
                    });
                });
        });
    document.body.scroll({
        top: 0
    });
}

export function loadC2RawByButton(btn: HTMLButtonElement) {
    fetch(songDatabase)
        .then(r => r.json())
        .then(db => {
            var item = db.c2raw.find((s: any) => { 
                // @ts-ignore
                return ("c2raw:" + s.artist + "_" + s.sid + "_" + s.level) == btn.parentNode?.previousElementSibling?.querySelector("[k-prop=c2-id]").innerText;
            });
            
            var sid = item.artist + "_" + item.sid;
            var aid = sid;
            if(item.audioOverride) {
                aid += "_" + item.level;
            }

            fetch("./assets/game/songdata/" + sid + "/game/common/bundleassets/chartdata/" + sid + "/" + sid + "_" + item.level + ".bytes", {
                cache: "no-cache"
            })
                .then(r => r.text())
                .then(j => {
                    fetch("./assets/themes.json", {
                        cache: "no-cache"
                    }).then(_ => _.json()).then(tj => {
                        var m = Beatmap.deserialize(JSON.parse(j));
                        Renderer.current.parseMap(m, {
                            audio: "./assets/game/songdata/" + sid + "/game/common/bundleassets/musics/" + sid + "/" + aid + ".wav",
                            background: "./assets/game/songpackbgs/" + item.artist + ".png",
                            title: item.title,
                            difficulty: item.difficulty,
                            icon: "./assets/game/charactericons/" + item.artist + "_l.png",
                            themeColor: tj[item.artist] || "#fff"
                        });
                    });
                });
        });
    document.body.scroll({
        top: 0
    });
}


export function loadTables() {
    var c2Table = document.getElementById("c2-map-table") as HTMLTableElement;

    var t = `<tr>
        <th scope="col">#</th><th scope="col">歌名</th><th scope="col"> </th>
    </tr>`;
    c2Table.innerHTML = `<tr>
        <th scope="col">歌名</th><th scope="col"> </th>
    </tr>`;

    fetch(songDatabase, {
        cache: "no-cache"
    }).then(r => r.json())
    .then(db => {
        function create(name: string) {
            return document.createElement(name);
        }

        function createBadge(name: string, color: string) {
            var badge = create("span");
            badge.classList.add("badge", "align-middle", "mr-1");
            badge.style.background = color || "#90a4ae";
            badge.style.color = "#fff";
            badge.innerText = name;
            return badge;
        }

        var diffColor = {
            easy: "#3d5afe",
            normal: "#43a047",
            hard: "#ffa000",
            expert: "#d50000",
            special: "#d500f9"
        };
        
        db.cytus2.forEach((item: any) => {
            var row = create("tr");
            var idCell = create("th") as HTMLTableHeaderCellElement;
            idCell.scope = "row";
            idCell.innerText = item.id;

            var titleCell = create("td");
            var titleContainer = create("div");
            titleCell.classList.add("align-middle");
            titleContainer.innerHTML = `<div class="spinner-grow" role="status"><span class="sr-only">載入中...</span></div>`;
            titleContainer.style.display = "inline-block";
            titleContainer.classList.add("mr-4", "align-middle");
            titleCell.appendChild(titleContainer);

            var loadCell = create("td");
            loadCell.innerHTML = `<button class="btn btn-link" onclick="loadC2ByButton(this)">載入</button>`;

            row.appendChild(titleCell);
            row.appendChild(loadCell);

            var cid = item.id;

            var fillItem = (item: any) => {
                var html = `<span>${item.title}</span><br/><small style="opacity: 0.7" k-prop="c2-id">${cid}</small>`;
                function ra(s: string, a: string, b: string) {
                    var r = s;
                    while(r != r.replace(a, b)) {
                        r = r.replace(a, b);
                    }
                    return r;
                }
                html = ra(html, "[FULL]", `<div style="background-color: transparent; background-image: url('./assets/full.png'); background-size: cover; background-blend-mode: multiply; display: inline-block; vertical-align: middle; width: 1.6em; height: 0.8em; margin-top: -0.2em;"></div>`);
                
                var htmlA = html.split("<br/>");
                titleContainer.innerHTML = htmlA[0] + "&nbsp;&nbsp;&nbsp;";
                var diff = item.difficulty;
                titleContainer.appendChild(createBadge(diff.name + " " + diff.level, diff.color));
                titleContainer.innerHTML += "<br/>" + htmlA[1];
            };
            fillItem(item);

            c2Table.appendChild(row);
        });

        db.c2raw.forEach((item: any) => {
            var row = create("tr");
            var idCell = create("th") as HTMLTableHeaderCellElement;
            idCell.scope = "row";
            idCell.innerText = item.id;

            var titleCell = create("td");
            var titleContainer = create("div");
            titleCell.classList.add("align-middle");
            titleContainer.innerHTML = `<div class="spinner-grow" role="status"><span class="sr-only">載入中...</span></div>`;
            titleContainer.style.display = "inline-block";
            titleContainer.classList.add("mr-4", "align-middle");
            titleCell.appendChild(titleContainer);

            var loadCell = create("td");
            loadCell.innerHTML = `<button class="btn btn-link" onclick="loadC2RawByButton(this)">載入</button>`;

            row.appendChild(titleCell);
            row.appendChild(loadCell);

            var cid = item.id;

            var fillItem = (item: any) => {
                var html = `<span>${item.title}</span><br/><small style="opacity: 0.7" k-prop="c2-id">c2raw:${item.artist+"_"+item.sid+"_"+item.level}</small>`;
                function ra(s: string, a: string, b: string) {
                    var r = s;
                    while(r != r.replace(a, b)) {
                        r = r.replace(a, b);
                    }
                    return r;
                }
                html = ra(html, "[FULL]", `<div style="background-color: transparent; background-image: url('./assets/full.png'); background-size: cover; background-blend-mode: multiply; display: inline-block; vertical-align: middle; width: 1.6em; height: 0.8em; margin-top: -0.2em;"></div>`);
                
                var htmlA = html.split("<br/>");
                titleContainer.innerHTML = htmlA[0] + "&nbsp;&nbsp;&nbsp;";
                var diff = item.difficulty;
                titleContainer.appendChild(createBadge(diff.name + " " + diff.level, diff.color));
                titleContainer.innerHTML += "<br/>" + htmlA[1];
            };
            fillItem(item);

            c2Table.appendChild(row);
        });
    });
}
loadTables();