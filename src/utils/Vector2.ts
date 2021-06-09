export class Vector2 {
    public x: number;
    public y: number;

    /**
     * Creates a `Vector2` data represents a 2D vector.
     * @param x The x coordinate.
     * @param y The y coordinate.
     */
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    /**
     * 
     * @param n The multiplier.
     * @returns The multiplied vector.
     */
    public times(n: number) {
        return new Vector2(this.x * n, this.y * n);
    }

    /**
     * Get a copy of the normalized vector.
     * @returns The normalized vector.
     */
    public normalize() {
        var dist = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
        return new Vector2(this.x / dist, this.y / dist);
    }

    /**
     * 
     * @param v The second vector.
     * @returns The result vector.
     */
    public plus(v: Vector2) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    /**
     * 
     * @param v The second vector.
     * @returns The result vector.
     */
    public minus(v: Vector2) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    /**
     * 
     * @param a 
     * @param b 
     * @param t 
     * @returns The result vector.
     */
    public static lerp(a: Vector2, b: Vector2, t: number) {
        return a.plus(b.minus(a).times(t));
    }

    /**
     * 
     * @param a 
     * @param b 
     * @returns The result vector.
     */
    public static center(a: Vector2, b: Vector2) {
        return Vector2.lerp(a, b, 0.5);
    }

    public clone() {
        return this.times(1);
    }
}