import { Renderer } from "./Renderer";

export class AnimatedObject {
    [key: string]: any;

    constructor() {
        this.data = {};
        this.update = (game: Renderer) => {};
        this.fixedUpdate = (game: Renderer) => {};
        this.isFinished = false;
    }
}