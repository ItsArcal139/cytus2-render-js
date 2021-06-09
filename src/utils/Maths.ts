export class Maths {
    /**
     * Linear interpolates between `a` and `b`.
     * @param a The `a` value.
     * @param b The `b` value.
     * @param t The progress of linear interpolation.
     * @returns The result value.
     */
    public static lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    public static clamp(min: number, max: number, t: number) {
        return Math.max(min, Math.min(max, t));
    }

    public static clampLerp(a: number, b: number, t: number) {
        return Maths.lerp(a, b, Maths.clamp(0, 1, t));
    }
}