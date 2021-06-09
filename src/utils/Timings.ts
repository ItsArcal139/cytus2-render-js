export class Timings {
    /**
     * Calculate the length of a beat in renderer.
     * @param bpm The beats amount per minutes.
     * @returns The corresponding milliseconds.
     */
    public static bpmToMillis(bpm: number) {
        return 120 / bpm * 1000;
    }
    
    /**
     * Calculate the BPM of the beat in renderer.
     * @param millis The time length of a beat in renderer.
     * @returns The beats amount per minutes. 
     */
    public static millisToBpm(millis: number) {
        return 120 / (millis / 1000);
    }

    public static speedToDetune(speed: number) {
        // 0.5x => -1200
        // 1x => 0
        // 2x => 1200
        return Math.log2(speed) * 1200;
    }
}