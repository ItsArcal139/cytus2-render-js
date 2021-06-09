import { Assets } from "../Assets";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { Vector2 } from "../utils/Vector2";
import { CircleNote } from "./CircleNote";
import { Note, RawNote } from "./Note";
import { SliderNode } from "./SliderNode";

export interface Slidable extends Note {
    nextId: number;
    isHeadTapRequired(): boolean;
}

type SlidableMeta = { x: number, y: number, note: Slidable }

export class SliderNote extends Note implements Slidable {
    public nextId = 0;
    public nodes: Slidable[] | null = null;

    public constructor(requiresHeadTap: boolean) {
        super(requiresHeadTap ? 6 : 3);
    }

    public isHeadTapRequired() {
        return this.type == 6;
    }

    public serialize() {
        return {
            ...super.serialize(),
            next_id: this.nextId
        };
    }

    public getLastNode(): Slidable {
        var next: Slidable | undefined = this;
        var nodes = this.nodes;
        if(!nodes) {
            nodes = [];
            var notes = Renderer.current.chart?.notes ?? [];
            while(next && next.nextId != 0) {
                nodes.push(next);
                next = notes.find(n => n.id == next?.nextId) as SliderNote | SliderNote | undefined;
            }
            this.nodes = nodes;
        }
        return nodes[nodes.length - 1];
    }

    public getEndTick() {
        var node = this.getLastNode();
        return node ? node.tick : this.tick;
    }

    /** @param {Game} game */
    public drawDashedPath(game: Renderer) {
        // For type check
        if(game.chart == null) return;

        var ctx = game.context;
        var page = game.chart.pages[this.pageIndex];
        var points: { x: number, y: number, note: SliderNode }[] = [];
        this.nodes?.forEach(n => {
            // For type check
            if(game.chart == null) return;

            var nextX = (game.canvas.width - game.getModeWidth()) / 2 + n.x * game.getModeWidth();
            var nextY = game.getYPosition(game.chart.pages[n.pageIndex], n.tick);
            points.push({
                x: nextX, y: nextY, note: n
            });
        });

        var prevPoint = {
            x: (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth(),
            y: game.getYPosition(page, this.tick),
            note: this as Slidable
        };

        ctx.strokeStyle = this.type == 3 ? "#baacc8" : "#bbdefb";
        ctx.lineWidth = 16 * game.ratio;
        ctx.setLineDash([8 * game.ratio, 8 * game.ratio]);

        points.forEach(p => {
            // For type check
            if(game.chart == null) return;

            var segmentStartTime = game.getTimeByTick(prevPoint.note.tick);
            var segmentEndTime = game.getTimeByTick(p.note.tick);
            var time = game.playbackTime * 1000;

            if(time < segmentEndTime) {
                if(time >= segmentStartTime) {
                    var thisPos = this.getCurrentPos(game);
                    prevPoint.x = thisPos.x;
                    prevPoint.y = thisPos.y;
                }

                var progress = Maths.clamp(-1, 0, (time - segmentEndTime + p.note.duration) / (segmentEndTime - segmentStartTime)) + 1;
                ctx.beginPath();
                if(progress != 1) {
                    var x = Maths.lerp(prevPoint.x, p.x, progress);
                    var y = Maths.lerp(prevPoint.y, p.y, progress);
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(x, y);
                } else {
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(prevPoint.x, prevPoint.y);
                }
                ctx.stroke();
            }
            prevPoint = p;
        });
        
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0;
        ctx.setLineDash([]);
    }

    /** @param {Game} game */
    public getCurrentPos(game: Renderer) {
        // For type check
        if(game.chart == null) {
            throw new Error("Chart is not loaded");
        }

        var ctx = game.context;
        var page = game.chart.pages[this.pageIndex];
        var points: { x: number, y: number, note: SliderNode }[] = [];
        this.nodes?.forEach(n => {
            // For type check
            if(game.chart == null) return;

            var nextX = (game.canvas.width - game.getModeWidth()) / 2 + n.x * game.getModeWidth();
            var nextY = game.getYPosition(game.chart.pages[n.pageIndex], n.tick);
            points.push({
                x: nextX, y: nextY, note: n
            });
        });

        var prevPoint = {
            x: (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth(),
            y: game.getYPosition(page, this.tick),
            note: this as Slidable
        };

        var result = new Vector2(prevPoint.x, prevPoint.y);
        var over = false;
        points.forEach(p => {
            var segmentStartTime = game.getTimeByTick(prevPoint.note.tick);
            var segmentEndTime = game.getTimeByTick(p.note.tick);
            var time = game.playbackTime * 1000;

            if(time >= segmentStartTime && time < segmentEndTime) {
                result = Vector2.lerp(new Vector2(prevPoint.x, prevPoint.y), new Vector2(p.x, p.y), (time - segmentStartTime) / (segmentEndTime - segmentStartTime));
            }
            over = (time >= segmentEndTime);
            prevPoint = p;
        });

        if(over) {
            return prevPoint;
        }

        return result;
    }

    /** @param {Game} game */
    public render(game: Renderer) {
        super.render(game);

        // For type check
        if(game.chart == null) return;

        var tick = game.currentTick;
        var page = game.chart.pages[this.pageIndex];

        var endTick = this.getEndTick();
        var noteTime = game.getTimeByTick(tick > this.tick ? (tick < endTick ? tick : endTick) : this.tick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);

        var spriteId = Math.round(Math.max(0, Math.min(66, Maths.lerp(1, 54, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["slider_" + spriteId];

        if(texture && page.scanLineDirection == 1) {
            texture = Assets["slider_" + spriteId + "_b"];
            if(!texture) return;
        }

        var duringDrag = tick > this.tick && tick <= this.getEndTick();

        if(this.type == 6) {
            spriteId = Math.round(Math.max(0, Math.min(51, Maths.lerp(1, 40, (game.playbackTime * 1000 - noteTime) / duration + 1))));
            texture = Assets["circle_" + spriteId];

            if(duringDrag) {
                texture = Assets["cDrag"];
                if(!texture) return;
            }
    
            if(texture && page.scanLineDirection == (duringDrag ? 1 : -1)) {
                texture = Assets[(duringDrag ? "cDrag" : "circle_" + spriteId) +"_b"];
                if(!texture) return;
            }
        }

        if(texture) {
            var points: SlidableMeta[] = [];
            var next = game.chart.notes.find(n => n.id == this.nextId) as Slidable;
            while(next && next.nextId != 0) {
                var nextX = (game.canvas.width - game.getModeWidth()) / 2 + next.x * game.getModeWidth();
                var nextY = game.getYPosition(game.chart.pages[next.pageIndex], next.tick);
                points.push({
                    x: nextX, y: nextY, note: next
                });
                next = game.chart.notes.find(n => n.id == next.nextId) as Slidable;
            }
            var nextN = points.find(p => p.note.tick > game.currentTick) || points[0];

            for(var i = points.length - 1; i >= 0; i--) {
                var n = points[i].note;
                n.update(game);
                n.render(game);
            }

            var {x, y} = this.getCurrentPos(game);

            if(tick >= this.tick) {
                if(game.bandoriMode) y = game.getYPosition(page, tick);
            }

            var w = texture.width / 193 * 150 * game.ratio;
            var h = texture.height / 193 * 150 * game.ratio;

            if(this.type == 6 && !duringDrag) {
                w = texture.width * game.ratio;
                h = texture.height * game.ratio;
            }

            var t = ctx.getTransform();
            ctx.translate(x, y);

            var nextX = nextN.x;
            var nextY = nextN.y;

            var nextPos = new Vector2(nextX, nextY);
            var thisPos = new Vector2(x, y);
            var nm = nextPos.minus(thisPos).normalize();

            ctx.rotate(-Math.PI / 4);
            ctx.transform(-nm.y, nm.x, -nm.x, -nm.y, 0, 0);
            ctx.drawImage(texture, -w / 2, -h / 2, w, h);
            ctx.setTransform(t);
        }

        var pointsN = this.nodes ?? [];
        for(var i = pointsN.length - 1; i >= 0; i--) {
            var n = pointsN[i];
            if(n.clearTime) {
                n.renderJudge(game);
            }
        }
    }

    /** @param {Game} game */
    public renderVector(game: Renderer) {
        super.renderVector(game);

        // For type check
        if(game.chart == null) return;

        var tick = game.currentTick;
        var page = game.chart.pages[this.pageIndex];

        var endTick = this.getEndTick();
        var noteTime = game.getTimeByTick(tick > this.tick ? (tick < endTick ? tick : endTick) : this.tick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);
        
        var progress = (game.playbackTime * 1000 - noteTime) / duration;

        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        var _a = ctx.globalAlpha = s;
        s = Maths.lerp(0.5, 1, s);

        if(this.type == 6) {
            ctx.fillStyle = page.scanLineDirection == -1 ? "#0af" : "#00bfa5";
        } else {
            ctx.fillStyle = page.scanLineDirection == -1 ? "#6969ff" : "#4360f0";
        }

        var size = s * 80 * game.noteSize;

        var duringDrag = tick >= this.tick && tick < this.getEndTick();

        var points: SlidableMeta[] = [];
        var next = game.chart.notes.find(n => n.id == this.nextId) as Slidable;
        while(next && next.nextId != 0) {
            var nextX = (game.canvas.width - game.getModeWidth()) / 2 + next.x * game.getModeWidth();
            var nextY = game.getYPosition(game.chart.pages[next.pageIndex], next.tick);
            points.push({
                x: nextX, y: nextY, note: next
            });
            next = game.chart.notes.find(n => n.id == next.nextId) as Slidable;
        }
        var nextN = points.find(p => p.note.tick > game.currentTick) || points[0];

        for(var i = points.length - 1; i >= 0; i--) {
            var n = points[i].note;
            n.renderVector(game);
        }
        
        var {x, y} = this.getCurrentPos(game);

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var t = ctx.getTransform();
        ctx.translate(x, y);

        var nextX = nextN.x;
        var nextY = nextN.y;

        var nextPos = new Vector2(nextX, nextY);
        var thisPos = new Vector2(x, y);
        var nm = nextPos.minus(thisPos).normalize();

        ctx.rotate(-Math.PI / 4);
        ctx.transform(-nm.y, nm.x, -nm.x, -nm.y, 0, 0);

        ctx.globalAlpha = _a;
        if(this.type == 6 && !duringDrag) {
            CircleNote.drawWith(game, 0, 0, size, progress);
        } else {
            size *= 0.6;
            ctx.beginPath();
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 60;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = size * 0.15;
            ctx.arc(0, 0, Maths.lerp(0.5, 1, Math.max(0, 1 - Math.abs(progress))) * size * game.ratio * 0.92, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(0, 0, size * game.ratio, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.fillStyle = "white";
            ctx.arc(0, 0, size * game.ratio * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.shadowColor = "none";
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.setTransform(t);
        ctx.globalAlpha = 1;

        var pointsN = this.nodes ?? [];
        for(var i = pointsN.length - 1; i >= 0; i--) {
            var n = pointsN[i];
            if(n.clearTime) {
                n.renderJudge(game);
            }
        }
    }

    static deserialize(data: RawNote) {
        return Serializer.deserialize(data, SliderNote);
    }
}