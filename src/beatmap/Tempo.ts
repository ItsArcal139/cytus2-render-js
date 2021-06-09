export interface RawTempo {
    tick: number,
    value: number
}

export class Tempo {
    public tick = 0;
    public value = 0;

    public serialize() {
        return {
            tick: this.tick,
            value: Math.round(this.value * 1000)
        };
    }

    public static deserialize(data: any) {
        var result = new Tempo();
        result.tick = data.tick;
        result.value = data.value / 1000;
        return result;
    }
}