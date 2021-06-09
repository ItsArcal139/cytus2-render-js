import { Assets } from "../Assets";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { Note, RawNote } from "./Note";

export class LongHoldNote extends Note {
    public holdTick = 0;

    constructor() {
        super(2);
    }

    public serialize() {
        return {
            ...super.serialize(),
            hold_tick: this.holdTick
        };
    }

    public getEndTick() {
        return this.tick + this.holdTick;
    }

    /** @param {Game} game */
    public renderLine(game: Renderer) {
        // For type check
        if(game.chart == null) return;

        var tick = game.currentTick;
        var ctx = game.context;
        var page = game.chart.pages[this.pageIndex];

        if(tick > this.tick) {
            var cw = ctx.canvas.width;
            var ch = ctx.canvas.height;
            var gy = game.getYPosition(game.getPage(tick), tick);
            var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
            var y = game.getYPosition(page, this.tick);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(x, y);
            ctx.lineTo(cw, gy);
            ctx.clip();
            ctx.globalAlpha = 0.2;
            ctx.drawImage(Assets.hold_strip, 0, 0, cw, ch);
            ctx.globalAlpha = 1;
            ctx.restore();
            ctx.lineWidth = 0;
        }

        var noteTime = game.getTimeByTick(this.tick);
        var duration = this.duration;

        var spriteId = Math.round(Math.max(0, Math.min(17, Maths.lerp(0, 17, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["lh_line_" + spriteId];

        var endTick = this.getEndTick();
        var endTime = game.getTimeByTick(endTick);

        var animateDuration = endTime - noteTime;
        var offset = 0;
        if(animateDuration > 1500) offset = animateDuration - 1500;
        animateDuration = Math.min(1500, animateDuration);

        if(tick >= this.tick && tick < endTick) {
            spriteId = Math.round(Math.max(17, Math.min(57, Maths.lerp(17, 57, (game.playbackTime * 1000 - noteTime - offset) / animateDuration))));
            texture = Assets["lh_line_" + spriteId];
        }

        var scale = 0.75 * game.ratio;
        var startY = game.canvas.height;
        var endY = 0;
        var dist = endY - startY;
        dist = (dist / Math.abs(dist)) * texture.height * scale;

        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();

        if(texture) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 100 * game.ratio, startY, 200 * game.ratio, endY - startY);
            ctx.clip();
            var count = Math.ceil((endY - startY) / dist);
            for(var i=0; i<=count; i++) {
                var y = startY + i * dist;
                ctx.drawImage(texture, x - texture.width / 2 * scale, y - texture.height / 2 * scale, texture.width * scale, texture.height * scale);
            }
            ctx.restore();
        }
    }

    /** @param {Game} game */
    public renderLineVector(game: Renderer) {
        // For type check
        if(game.chart == null) return;

        var canvas = game.canvas;
        var ctx = game.context;
        var page = game.chart.pages[this.pageIndex];
        var tick = game.currentTick;
        var endTick = this.getEndTick();
        var cp = game.getPage(tick);

        if(tick > this.tick) {
            var cw = ctx.canvas.width;
            var ch = ctx.canvas.height;
            var gy = game.getYPosition(cp, tick);
            var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
            var y = game.getYPosition(page, this.tick);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(x, y);
            ctx.lineTo(cw, gy);
            ctx.clip();
            ctx.globalAlpha = 0.2;
            ctx.drawImage(Assets.hold_strip, 0, 0, cw, ch);
            ctx.globalAlpha = 1;
            ctx.restore();
            ctx.lineWidth = 0;
        }

        var noteTime = game.getTimeByTick(this.tick);
        var endTime = game.getTimeByTick(endTick);
        var duration = this.duration;

        var startY = page.scanLineDirection == -1 ? 0 : canvas.height;
        var endY = page.scanLineDirection == 1 ? 0 : canvas.height;
        var dist = endY - startY;
        dist = (dist / Math.abs(dist)) * 21 * game.ratio;

        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        
        var progress = 0;
        if(noteTime >= game.playbackTime * 1000) {
            progress = (game.playbackTime * 1000 - noteTime) / duration;
        } else if(noteTime <= game.playbackTime * 1000 && endTime > game.playbackTime * 1000) {
            progress = 0;
        } else if(endTime <= game.playbackTime * 1000) {
            progress = (game.playbackTime * 1000 - endTime) / duration;
        }

        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        ctx.globalAlpha = s;
        // s = K.Maths.lerp(0.5, 1, s);

        var size = s * 80 * game.noteSize;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 100 * game.ratio, startY, 200 * game.ratio, endY - startY);
        ctx.clip();
        var count = Math.ceil((endY - startY) / dist);
        for(var i=0; i<count; i++) {
            var y = dist + startY + i * dist;
            var w = 100 * (1 - Math.pow(1 - s, 5));
            ctx.beginPath();
            ctx.moveTo(x - w / 2 * game.ratio, y);
            ctx.lineTo(x + w / 2 * game.ratio, y);
            ctx.setLineDash([5 * game.ratio, 5 * game.ratio, Math.max(0, w - 20) * game.ratio]);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 5 * game.ratio;
            ctx.stroke();
        }
        ctx.restore();

        var tick = game.currentTick;
        if(tick > this.tick) {
            endY = startY + ((tick - this.tick) / this.holdTick) * (endY - startY);
            dist = endY - startY;
            dist = (dist / Math.abs(dist)) * 21 * game.ratio;
    
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 100 * game.ratio, startY, 200 * game.ratio, endY - startY);
            ctx.clip();
            var count = Math.ceil((endY - startY) / dist);
            for(var i=0; i<count; i++) {
                var y = dist + startY + i * dist;
                var w = 100;
                ctx.beginPath();
                ctx.moveTo(x - w / 2 * game.ratio, y);
                ctx.lineTo(x + w / 2 * game.ratio, y);
                ctx.setLineDash([5 * game.ratio, 5 * game.ratio, 80 * game.ratio]);
                ctx.strokeStyle = "#ff0";
                ctx.lineWidth = 5 * game.ratio;
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    /** @param {Game} game */
    renderFire(game: Renderer) {
        // For type check
        if(game.chart == null) return;
        
        var startPage = game.chart.pages[this.pageIndex];
        var page = game.getPage(game.currentTick);
        var direction = page.scanLineDirection;
        var tick = game.currentTick;

        var time = game.getTimeByTick(this.tick);
        var endTime = game.getTimeByTick(this.tick + this.holdTick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, tick);

        var spriteId = Math.round(Math.max(0, Maths.lerp(0, 30, (game.playbackTime * 1000 - time) / duration + 1)));
        spriteId %= 31;
        var texture = Assets["lh_fire_" + spriteId];

        var animateDuration = endTime - time;
        var offset = 0;
        if(animateDuration > 1500) offset = animateDuration - 1500;
        animateDuration = Math.min(1500, animateDuration);

        var size = 0;
        var endTick = this.holdTick + this.tick;
        var noteTime = game.getTimeByTick(this.tick);
        var endTime = game.getTimeByTick(endTick);
        if(tick >= this.tick && tick < endTick) {
            size = Math.round(Math.max(17, Math.min(57, Maths.lerp(17, 57, (game.playbackTime * 1000 - noteTime - offset) / animateDuration))));
            size = (1 - (size - 17) / 40) * 2;
        }

        if(texture) {
            var w = texture.width / 193 * 150 * game.ratio * size;
            var h = texture.height / 193 * 150 * game.ratio * size;

            if(direction == 1) {
                ctx.drawImage(texture, x - w / 2, y - 50 * game.ratio, w, h);
            } else {
                ctx.scale(1, -1);
                ctx.drawImage(texture, x - w / 2, -y - 50 * game.ratio, w, h);
                ctx.scale(1, -1);
            }
        }
    }

    /** @param {Game} game */
    public renderFireVector(game: Renderer) {
        // For type check
        if(game.chart == null) return;
    }

    /** @param {Game} game */
    public render(game: Renderer) {
        super.render(game);

        // For type check
        if(game.chart == null) return;
        
        var tick = game.currentTick;
        var endTick = this.getEndTick();
        var page = game.chart.pages[this.pageIndex];

        var noteTime = game.getTimeByTick(this.tick);
        var endTime = game.getTimeByTick(endTick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);

        var spriteId = Math.round(Math.max(0, Math.min(40, Maths.lerp(0, 40, (game.playbackTime * 1000 - noteTime) / duration + 1))));
        var texture = Assets["lh_" + spriteId];

        if(tick >= this.tick && tick < endTick) {
            spriteId = Math.round(Math.max(0, Maths.lerp(0, 8, (game.playbackTime * 1000 - noteTime) / duration)));
            spriteId %= 9;
            texture = Assets["lh_btn_" + (spriteId + 41)];

            var backSpriteId = Math.round(Maths.lerp(0, 17, (game.playbackTime * 1000 - noteTime) / duration));
            var isLoop = backSpriteId >= 17;
            if(isLoop) backSpriteId = (backSpriteId - 17) % 15;
            var backTexture = Assets["lh_back_" + (isLoop ? "loop" : "in") + "_" + ((isLoop ? 58 : 41) + backSpriteId)];

            if(backTexture) {
                var w = backTexture.width / 193 * 150 * game.ratio;
                var h = backTexture.height / 193 * 150 * game.ratio;
                ctx.drawImage(backTexture, x - w / 2, y - h / 2, w, h);
            }
        }

        if(tick >= endTick) {
            spriteId = Math.round(Maths.lerp(57, 74, (game.playbackTime * 1000 - endTime) / duration));
            texture = Assets["lh_" + spriteId];
        } else {
            this.renderLine(game);
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }
        

        if(texture) {
            var w = texture.width / 193 * 150 * game.ratio;
            var h = texture.height / 193 * 150 * game.ratio;
            ctx.drawImage(texture, x - w / 2, y - h / 2, w, h);
        }

        if(tick >= this.tick && tick < endTick) {
            ctx.setLineDash([]);
            var hp = (tick - this.tick) / this.holdTick;
            
            var size = 115 * game.ratio;
            var c = "#fdd835";
            var ra = Math.PI * 0.5;
            ctx.lineWidth = 15 * game.ratio;
            ctx.strokeStyle = "#fff";

            ctx.beginPath();
            ctx.arc(x, y, size, -ra, -ra + Math.PI * 2 * hp * (1 / 0.75));
            ctx.stroke();
            ctx.strokeStyle = c;
            ctx.beginPath();
            ctx.arc(x, y, size, -ra, -ra + Math.PI * 2 * hp);
            ctx.stroke();

            this.renderFire(game);
        }

        ctx.lineWidth = 0;
    }

    /** @param {Game} game */
    public renderVector(game: Renderer) {
        super.renderVector(game);

        // For type check
        if(game.chart == null) return;
        
        var tick = game.currentTick;
        var endTick = this.getEndTick();
        var page = game.chart.pages[this.pageIndex];

        var noteTime = game.getTimeByTick(this.tick);
        var endTime = game.getTimeByTick(endTick);
        var duration = this.duration;

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);
        if(tick > endTick) y = game.getYPosition(page, endTick);

        if(tick < endTick) {
            this.renderLineVector(game);
        }

        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick);
        }

        var progress = 0;
        if(noteTime > game.playbackTime * 1000) {
            progress = (game.playbackTime * 1000 - noteTime) / duration;
        } else if(noteTime <= game.playbackTime * 1000 && endTime > game.playbackTime * 1000) {
            progress = 0;
        } else if(endTime <= game.playbackTime * 1000) {
            progress = (game.playbackTime * 1000 - endTime) / duration;
        }
        
        var s = Math.max(0, 1 - Math.abs(progress * (progress >= 0 ? 5 : 0.5)));
        s = progress >= 0 ? Math.pow(s, 6) : Math.max(0, s * 2 - 1);
        ctx.globalAlpha = s;
        s = Maths.lerp(0.5, 1, s);
        var color = page.scanLineDirection == -1 ? "#0af" : "#00bfa5";

        var size = s * 80 * game.noteSize;

        ctx.beginPath();
        if(typeof ctx.fillStyle == "string") {
            ctx.shadowColor = ctx.fillStyle;
        }
        ctx.shadowBlur = 60;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = size * 0.15;
        ctx.arc(x, y, Maths.lerp(0.5, 1, Math.max(0, 1 - Math.abs(progress))) * size * game.ratio * 0.92, 0, Math.PI * 2);
        ctx.fillStyle = color;
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

        if(tick >= this.tick && tick < endTick) {
            ctx.setLineDash([]);
            var hp = (tick - this.tick) / this.holdTick;
            
            var size = 115 * game.ratio;
            var c = "#fdd835";
            var ra = Math.PI * 0.5;
            ctx.lineWidth = 15 * game.ratio;
            ctx.strokeStyle = "#fff";

            ctx.beginPath();
            ctx.arc(x, y, size, -ra, -ra + Math.PI * 2 * hp * (1 / 0.75));
            ctx.stroke();
            ctx.strokeStyle = c;
            ctx.beginPath();
            ctx.arc(x, y, size, -ra, -ra + Math.PI * 2 * hp);
            ctx.stroke();

            this.renderFireVector(game);
        }

        ctx.lineWidth = 0;
    }

    public static deserialize(data: RawNote) {
        return Serializer.deserialize(data, LongHoldNote);
    }
}