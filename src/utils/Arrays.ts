export class Arrays {
    public static reversedCopy<T>(arr: T[]): T[] {
        var result: T[] = [];
        arr.forEach(n => {
            result.push(n);
        });
        return result.reverse();
    }
}