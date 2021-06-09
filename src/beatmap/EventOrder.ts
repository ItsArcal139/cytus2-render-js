import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";

type EventOrderType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface RawEventOrderEvent {
    type: number,
    args: string
}

export interface RawEventOrder {
    tick: number,
    event_list: RawEventOrderEvent[]
}

export class EventOrder {
    public tick = 0;
    public type: EventOrderType = 1;
    public args = "";

    public serialize(): RawEventOrderEvent {
        return {
            type: this.type,
            args: this.args
        };
    }

    public static deserialize(data: any): EventOrder[] {
        var result: EventOrder[] = [];
        data.event_list.forEach((e: RawEventOrderEvent) => {
            var c = new EventOrder();
            c.tick = data.tick;
            c.type = e.type as EventOrderType;
            c.args = e.args;
            result.push(c);
        });
        return result;
    }

    public renderLine(game: Renderer) {
        var eventTime = game.getTimeByTick(this.tick);
        var deltaTime = game.playbackTime * 1000 - eventTime;
        if(deltaTime < 0) return;
        if(deltaTime > 5000) return;
        
        var page = game.getPage(this.tick);
        var canvas = game.canvas;
        var ctx = game.context;
        ctx.fillStyle = (() => {
            if(this.type == 8) {
                var args = this.args.split(",");
                return args[args.length-1];
            }
            return this.type == 0 ? "#d81b60" : "#4db6ac";
        })();

        var alpha = 1;
        if(deltaTime >= 0 && deltaTime < 500) alpha = Maths.lerp(0, 1, deltaTime / 500);
        if(deltaTime > 4000) alpha = Maths.lerp(1, 0, (deltaTime - 4000) / 1000)
        ctx.globalAlpha = alpha;

        var page = game.getPage(game.currentTick);
        var y = game.getYPosition(page, game.currentTick);
        ctx.fillRect(0, y - 1.5 * game.ratio, canvas.width, 5 * game.ratio);
        
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
    }

    public renderText(game: Renderer) {
        var eventTime = game.getTimeByTick(this.tick);
        var deltaTime = game.playbackTime * 1000 - eventTime;
        if(deltaTime < 0) return;
        if(deltaTime > 5000) return;
        
        var canvas = game.canvas;
        var ctx = game.context;

        var font1 = "Rajdhani, 'Noto Sans CJK TC'";

        ctx.font = `700 ${35 * game.ratio}px ${font1}`;

        ctx.textAlign = "left";
        if(deltaTime < 2000) {
            var alpha = 1;
            var space = 0;

            if(deltaTime <= 450 || deltaTime > 1150) {
                alpha = (deltaTime % 70) < 35 ? 1 : 0;
            }

            if(deltaTime > 450) {
                space += Math.pow((deltaTime - 450) / 1150, 4) * 80 * game.ratio;
            }

            if(deltaTime > 1500) {
                return;
            }

            var drawText = (txt: string, y: number) => {
                var width = ctx.measureText(txt).width + space * (txt.length - 1);
                var x0 = canvas.width / 2 - width / 2;
                var x = x0;
                for(var i=0; i<txt.length; i++) {
                    var c = txt[i];
                    var s = ctx.measureText(txt[i-1] ?? "").width + space;
                    x += s;
                    ctx.fillText(c, x, y);
                }
            }
            
            var y = canvas.height - 58.5 * game.ratio;

            var text = (() => {
                if(this.type == 8) {
                    var args = this.args.split(",");
                    args.pop();
                    return args.join(",");
                }
                return this.type == 0 ? "SPEED UP" : "SPEED DOWN";
            })();

            ctx.textBaseline = "middle";
            ctx.globalAlpha = alpha;
            ctx.fillStyle = (() => {
                if(this.type == 8) {
                    var args = this.args.split(",");
                    return args[args.length-1];
                }
                return this.type == 0 ? "#d81b60" : "#4db6ac";
            })();
            drawText(text, y);
            ctx.textBaseline = "alphabetic";
        }
    }

    /** 
     * @param {Game} game
     * @param {any} uiAnimData
     */
    public renderUIAnim(game: Renderer, uiAnimData: any) {
        var eventTime = game.getTimeByTick(this.tick);
        var progress = (game.playbackTime * 1000 - eventTime) / 2000;
        progress = Math.max(0, Math.min(1, progress));

        if(this.type >= 2 && this.type <= 5) {
            if(this.args.indexOf("4") != -1) {
                if(this.type <= 3) {
                    uiAnimData.scanLineAlpha = (this.type % 2 == 1 ? 1 : 0);
                } else {
                    uiAnimData.scanLineAlpha = (this.type % 2 == 1 ? -1 : 1) * progress;
                }
            }
        }

        if(this.type >= 6 && this.type <= 7) {
            if(this.args.indexOf("4") != -1) {
                if(this.type == 6) {
                    uiAnimData.scanLineMutateProgress = 1 - progress;
                } else {
                    uiAnimData.scanLineMutateProgress = progress;
                }
            }
        }
    }

    /** @param {Game} game */
    public render(game: Renderer) {
        
    }
}