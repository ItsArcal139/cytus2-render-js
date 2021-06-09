import { Assets } from "../Assets";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { Note, RawNote } from "./Note";

export class FlickNote extends Note {
    public constructor() {
        super(5);
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

        var spriteId = Math.round(Math.max(0, Math.min(59, Maths.lerp(1, 41, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["flick_" + spriteId];
        
        if(!texture) return;

        if(page.scanLineDirection == -1) {
            texture = Assets["flick_" + spriteId + "_b"];
            if(!texture) return;
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var w = texture.width * game.ratio;
        var h = texture.height * game.ratio;
        ctx.drawImage(texture, x - w / 2, y - h / 2, w, h);
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

        var progress = (game.playbackTime * 1000 - noteTime) / duration;

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        ctx.globalAlpha = s;
        s = Maths.lerp(0.5, 1, s);
        ctx.fillStyle = page.scanLineDirection == -1 ? "#0af" : "#00bfa5";

        var size = s * 80 * game.noteSize;

        ctx.lineWidth = size * 0.15;
        ctx.strokeStyle = "#fff";

        var tf = ctx.getTransform();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);

        var fillSize = Maths.lerp(0.5, 1, Math.max(0, 1 - Math.abs(progress))) * s;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 60;
        ctx.fillRect(-size / 2 * fillSize, -size / 2 * fillSize, size * fillSize, size * fillSize);
        ctx.shadowBlur = 0;

        var strokeSize = Maths.lerp(0.5, 1.3, s);
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
        ctx.restore();

        ctx.save();
        ctx.translate(x, y);

        var scale = Maths.lerp(Maths.lerp(0.5, 1.0, s), 1.0, s);
        ctx.scale(scale, scale);

        var dist = size * Maths.lerp(Maths.lerp(2, 1.0, s), 1.0, s);
        dist += (1 - s) * size * 2;
        if(progress >= 0) {
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

        ctx.globalAlpha = 1;
        ctx.setTransform(tf);
    }

    public static deserialize(data: RawNote) {
        return Serializer.deserialize(data, FlickNote);
    }
}