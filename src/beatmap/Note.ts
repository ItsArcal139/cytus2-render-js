import { Assets } from "../Assets";
import { JudgeEffect } from "../JudgeEffect";
import { Renderer } from "../Renderer";
import { Maths } from "../utils/Maths";
import { Serializer } from "../utils/Serializer";
import { CircleNote } from "./CircleNote";
import { FlickNote } from "./FlickNote";
import { HoldNote } from "./HoldNote";
import { LongHoldNote } from "./LongHoldNote";
import { Page } from "./Page";
import { SliderNode } from "./SliderNode";
import { SliderNote } from "./SliderNote";

export type NoteType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RawNote {
    page_index: number;
    type: NoteType,
    id: number,
    tick: number,
    x: number,
    has_sibling: boolean,
    next_id: number,
    is_forward: boolean,
    hold_tick: number
}

export class Note {
    // Range: 0.0 ~ 1.0
    public x = 0.5;
    public id = 0;
    public tick = 0;
    public pageIndex = 0;
    public hasSibling = false;
    public isForward = false;
    public type: NoteType;

    /** 
     * @param type - The note type.
     */
    public constructor(type: NoteType) {
        this.type = type;
    }

    public duration!: number;
    public clearTime: number | null = null;
    protected clickPlayedTime: number | null = null;

    /** @param game */
    public update(game: Renderer) {
        // For type check
        if(game.chart == null) return;

        var page = game.chart.pages[this.pageIndex];
        if(!this.duration) {
            var currPage = game.chart.pages[this.pageIndex - 1] || (() => {
                var p = new Page();
                var l = page.getTickLength();
                p.endTick = page.startTick;
                p.startTick = page.startTick - l;
                return p;
            })();
            var curr2Page = game.chart.pages[this.pageIndex - 2] || (() => {
                var p = new Page();
                var l = currPage.getTickLength();
                p.endTick = currPage.startTick;
                p.startTick = currPage.startTick - l;
                return p;
            })();;

            var pageLen = game.getMsPerTick(page.startTick, game.chart.timeBase) * page.getTickLength();
            var currPageLen = game.getMsPerTick(Math.max(0, currPage.startTick), game.chart.timeBase) * currPage.getTickLength();
            var curr2PageLen = game.getMsPerTick(Math.max(0, curr2Page.startTick), game.chart.timeBase) * curr2Page.getTickLength();

            var p = (this.tick - page.startTick) / page.getTickLength();
            var n = curr2PageLen * Maths.clamp(0, 1, 0.25 - p);
            n += currPageLen * Maths.clamp(0.25, 1, 1.25 - p);
            n += pageLen * p;

            var defDur = Maths.clamp(0, 1750, n);
            this.duration = defDur;
        }
        var duration = this.duration;

        var condition =  Math.abs(game.getTimeByTick(game.currentTick) - game.getTimeByTick(this.tick)) < duration;
        // @ts-ignore
        if(this.__proto__.constructor.name == "SliderNode") {
            condition = false;
        }

        // @ts-ignore
        if(this.__proto__.constructor.name.endsWith("HoldNote")) {
            // @ts-ignore
            var endTime = this.getEndTick();
            condition = condition || (game.currentTick > this.tick && game.currentTick < endTime + game.getPage(endTime).getTickLength());
        }
        // @ts-ignore
        if(this.__proto__.constructor.name == "SliderNote") {
            // @ts-ignore
            var endTime = this.getEndTick();
            condition = condition || (game.currentTick > this.tick && game.currentTick < endTime + 480);
        }
        
        if(condition) {
            if(game.noRayarkTexture) {
                this.renderVector(game);
            } else {
                this.render(game);
            }
        }

        var judgeTick = this.tick;
        // @ts-ignore
        if(this.__proto__.constructor.name.endsWith("HoldNote")) {
            // @ts-ignore
            judgeTick = this.getEndTick();
        }
        if(game.currentTick > judgeTick && game.currentTick - judgeTick < page.getTickLength()) {
            if(this.clearTime == null) {
                this.clearTime = game.playbackTime;
            }
            // @ts-ignore
            if(this.__proto__.constructor.name != "SliderNode") {
                this.renderJudge(game);
            }
        } else {
            this.clearTime = null;
        }

        if(game.currentTick > this.tick && game.currentTick - this.tick < page.getTickLength()) {
            if(this.clickPlayedTime == null) {
                this.clickPlayedTime = game.playbackTime;
                if(game.enableClickSound) {
                    game.playOneShotAudio(game.noRayarkTexture ? Assets.click_fx2 : Assets.click_fx);
                }
                if(game.enableTaptic) {
                    if(navigator.vibrate) navigator.vibrate(15);
                }
                if(game.noRayarkTexture) {
                    var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
                    var y = game.getYPosition(page, this.tick);
                    var effect = new JudgeEffect(game, x, y, 10);
                    game.animatedObjects.push(effect);
                }
            }
        } else {
            this.clickPlayedTime = null;
        }
    }

    /** @param game */
    public render(game: Renderer) {

    }

    /** @param game */
    public renderVector(game: Renderer) {

    }

    /** @param game */
    public renderJudge(game: Renderer) {
        // For type check
        if(game.chart == null) return;
        if(this.clearTime == null) return;
        if(game.noRayarkTexture) return;

        var tick = game.currentTick;
        var page = game.chart.pages[this.pageIndex];

        var ctx = game.context;
        var x = (game.canvas.width - game.getModeWidth()) / 2 + this.x * game.getModeWidth();
        var y = game.getYPosition(page, this.tick);
        // @ts-ignore
        if(this.__proto__.constructor.name == "HoldNote") {
            // @ts-ignore
            y = game.getYPosition(page, this.getEndTick());
        }

        var spriteId = Math.round(Math.max(149, Math.min(159, Maths.lerp(149, 159, (game.playbackTime - this.clearTime) / 0.5))));
        var texture = Assets["perfect_" + spriteId];
        if(tick >= this.tick) {
            if(game.bandoriMode) y = game.getYPosition(page, tick) + 25 * game.ratio;
        }
        if(texture) {
            var w = texture.width / 145 * 175 * game.ratio;
            var h = texture.height / 145 * 175 * game.ratio;
            ctx.drawImage(texture, x - w / 2, y - h / 2, w, h);
        }
    }

    public serialize() {
        return Serializer.serialize(this, [
            "x", "tick", "pageIndex", "type",
            "hasSibling", "isForward", "id"
        ]);
    }

    public static noteTypeMap: any = {};

    public static deserialize(data: RawNote) {
        var n: any = Note.noteTypeMap[data.type];
        if(n != null) {
            return n.deserialize(data) as Note;
        }
        return Serializer.deserialize(data, Note);
    }
}