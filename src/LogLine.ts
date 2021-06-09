type ColorResolvable = string;

interface LogLineBadge {
    text: string,
    background: ColorResolvable,
    color: ColorResolvable
};

export class LogLine {
    public y: number | null;
    public content: string;
    public createdTime: number | null;
    public fadedTime: number | null;
    public badge: LogLineBadge;
    public persistent: boolean;
    public hidden: boolean;

    constructor(content: string) {
        this.y = null; // Updated by Game.update()
        this.content = content;
        this.createdTime = null;
        this.fadedTime = null;

        this.badge = {
            text: "Debug",
            background: "#888",
            color: "white"
        };

        this.persistent = false;
        this.hidden = false;
    }
}