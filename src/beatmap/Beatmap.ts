import { Serializer } from "../utils/Serializer";
import { EventOrder, RawEventOrder } from "./EventOrder";
import { HoldNote } from "./HoldNote";
import { LongHoldNote } from "./LongHoldNote";
import { Note } from "./Note";
import { Page, RawPage } from "./Page";
import { Slidable, SliderNote } from "./SliderNote";
import { RawTempo, Tempo } from "./Tempo";

export interface RawBeatmap {
    page_list: RawPage[],
    tempo_list: RawTempo[]
}

export class Beatmap {
    public formatVersion = 2;
    public timeBase = 480;
    public startOffsetTime = 0;
    public pages: Page[] = [];
    public tempos: Tempo[] = [];
    public eventOrders: EventOrder[] = [];
    public notes: Note[] = [];
    public comboSortedNotes: Note[] | null = null;

    initComboSortedNotes() {
        var n: Note[] = [];
        n.push.apply(n, this.notes);
        n.sort((a, b) => {
            var cta = (a instanceof LongHoldNote || a instanceof HoldNote) ? a.getEndTick() : a.tick;
            var ctb = (b instanceof LongHoldNote || b instanceof HoldNote) ? b.getEndTick() : b.tick;
            return cta - ctb;
        })
        this.comboSortedNotes = n;
    }

    static deserialize(data: any) {
        var map = Serializer.deserialize(data, Beatmap, [
            "format_version", "time_base", "start_offset_time"
        ]);
        map.pages = data.page_list.map((p: any) => Page.deserialize(p));
        map.tempos = data.tempo_list.map((t: any) => Tempo.deserialize(t)).sort((a: any, b: any) => b.tick - a.tick);
        map.notes = data.note_list.map((n: any) => Note.deserialize(n));
        map.eventOrders = data.event_order_list.map((e: any) => EventOrder.deserialize(e)).flat();

        // Cache slider nodes data for further use.
        map.notes.forEach(n => {
            if(n instanceof SliderNote) {
                var nodes = [];
                var notes = map.notes;
                var next = notes.find(nn => nn.id == n.nextId) as Slidable;
                while(next && next.nextId != 0) {
                    nodes.push(next);
                    next = notes.find(nn => nn.id == next.nextId) as Slidable;
                }
                n.nodes = nodes;
            }
        });
        return map;
    }

    serialize() {
        var data = Serializer.serialize(this, [
            "formatVersion", "timeBase", "startOffsetTime"
        ]);

        var eventOrders: RawEventOrder[] = [];
        this.eventOrders.forEach(e => {
            var item = eventOrders.find(n => {
                return n.tick == e.tick;
            });
            if(!item) {
                item = {
                    tick: e.tick,
                    event_list: []
                };
                eventOrders.push(item);
            }
            item.event_list.push(e.serialize());
        });

        data = {
            ...data,
            page_list: this.pages.map(p => p.serialize()),
            tempo_list: this.tempos.map(t => t.serialize()).sort((a, b) => a.tick - b.tick),
            event_order_list: eventOrders,
            note_list: this.notes.map(n => n.serialize()).sort((a, b) => a.id - b.id)
        }

        return data;
    }
}