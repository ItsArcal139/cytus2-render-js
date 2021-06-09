import { Assets } from "../Assets";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { Note, RawNote } from "./Note";

export class CircleNote extends Note {
    public constructor() {
        super(0);
    }
    
    public static drawWith(game: Renderer, x: number, y: number, size: number, progress: number) {
        var ctx = game.context;
        ctx.beginPath();
        if(typeof ctx.fillStyle == "string") {
            ctx.shadowColor = ctx.fillStyle;
        }
        ctx.shadowBlur = 60;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = size * 0.15;
        ctx.arc(x, y, Maths.lerp(0.5, 1, Math.max(0, 1 - Math.abs(progress))) * size * game.ratio * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x, y, size * game.ratio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.arc(x, y, size * game.ratio * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.shadowColor = "none";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
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

        var spriteId = Math.round(Math.max(0, Math.min(51, Maths.lerp(1, 41, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["circle_" + spriteId];

        if(!texture) return;

        if(page.scanLineDirection == -1) {
            texture = Assets["circle_" + spriteId + "_b"];
            if(!texture) return;
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }
        var size = texture.width * game.ratio;
        ctx.drawImage(texture, x - size / 2, y - size / 2, size, size);
    }

    /** @param {Game} game */
    public renderVector(game: Renderer) {
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

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var progress = (game.playbackTime * 1000 - noteTime) / duration;

        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        ctx.globalAlpha = s;
        s = Maths.lerp(0.5, 1, s);
        ctx.fillStyle = page.scanLineDirection == -1 ? "#0af" : "#00bfa5";

        var size = s * 80 * game.noteSize;
        CircleNote.drawWith(game, x, y, size, progress);
    }

    public serialize() {
        return super.serialize();
    }

    public static deserialize(data: RawNote) {
        return Serializer.deserialize(data, CircleNote);
    }
}