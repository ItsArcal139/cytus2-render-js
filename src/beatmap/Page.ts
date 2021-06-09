import { Serializer } from "../utils/Serializer";

export interface PositionFunction {
    Arguments: [number, number]
}

export interface RawPage {
    start_tick: number,
    end_tick: number,
    PositionFunction?: PositionFunction
}

export class Page {
    public startTick = 0;
    public endTick = 0;
    public scanLineDirection = 0;
    public posFunc?: PositionFunction;

    public getTickLength() {
        return this.endTick - this.startTick;
    }

    public serialize(): any {
        return Serializer.serialize(this);
    }

    public static deserialize(data: RawPage): Page {
        return Serializer.deserialize(data, Page, [
            "start_tick", "end_tick",
            "scan_line_direction", [
                "PositionFunction", "posFunc"
            ]
        ]);
    }
}
