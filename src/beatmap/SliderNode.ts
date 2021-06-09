import { Assets } from "../Assets";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { Note, RawNote } from "./Note";
import { Slidable } from "./SliderNote";

export class SliderNode extends Note implements Slidable {
    public nextId = 0;

    public constructor(requiresHeadTap: boolean) {
        super(requiresHeadTap ? 7 : 4);
    }

    public isHeadTapRequired() {
        return this.type == 7;
    }

    public serialize() {
        return {
            ...super.serialize(),
            next_id: this.nextId
        };
    }

    /** @param {Game} game */
    public render(game: Renderer) {
        super.render(game);

        // For type check
        if(game.chart == null) return;

        var tick = game.currentTick;
        var page = game.chart.pages[this.pageIndex];

        var noteTime = game.getTimeByTick(this.tick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);

        var spriteId = Math.round(Math.max(0, Math.min(66, Maths.lerp(1, 54, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["sn_" + spriteId];
        if(!texture) return;

        // c-drag
        if(this.type == 7) {
            texture = Assets["sn_" + spriteId + "_cd"];
            if(!texture) return;
        }

        if(page.scanLineDirection == 1) {
            texture = Assets["sn_" + spriteId + (this.type == 7 ? "_cd" : "") + "_b"];
            if(!texture) return;
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var w = texture.width / 150 * 75 * game.ratio;
        var h = texture.height / 150 * 75 * game.ratio;
        if(tick >= this.tick) {
            w *= 2;
            h *= 2;
        }
        ctx.drawImage(texture, x - w / 2, y - h / 2, w, h);
    }

    /** @param {Game} game */
    renderVector(game: Renderer) {
        super.renderVector(game);

        // For type check
        if(game.chart == null) return;

        var tick = game.currentTick;
        var page = game.chart.pages[this.pageIndex];

        var noteTime = game.getTimeByTick(this.tick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);

        var progress = (game.playbackTime * 1000 - noteTime) / duration;

        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        ctx.globalAlpha = s;
        s = Maths.lerp(0.5, 1, s);

        if(tick >= this.tick) {
            s *= 2;
        }

        if(this.type == 7) {
            ctx.fillStyle = page.scanLineDirection == -1 ? "#0af" : "#00bfa5";
        } else {
            ctx.fillStyle = page.scanLineDirection == -1 ? "#6969ff" : "#4360f0";
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var size = s * 30 * game.noteSize;
        ctx.beginPath();
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 60;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = size * 0.4;
        ctx.arc(x, y, size * game.ratio * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x, y, size * game.ratio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowColor = "none";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    static deserialize(data: RawNote) {
        return Serializer.deserialize(data, SliderNode);
    }
}