export class Promiser {
    public static noop() {
        return new Promise<void>((resolve, _) => { resolve() });
    }
};