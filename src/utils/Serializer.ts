type Type<T> = new(...args: any[]) => T;

export class Serializer {
    public static deserialize<T>(data: any, clazz: Type<T>, keys?: any[]): T {
        var result: any = {};
        keys = keys || Object.keys(data);
        keys.forEach(k => {
            var newName = "";
            if(typeof k == "string") {
                var upperCase = false;
                for(var i = 0; i < k.length; i++) {
                    if(k[i] == "_") {
                        upperCase = true;
                        continue;
                    }
                    newName += (upperCase ? k[i].toUpperCase() : k[i].toLowerCase());
                    upperCase = false;
                }
                result[newName] = data[k];
            } else {
                newName = k[1];
                result[newName] = data[k[0]];
            }
        });
        result.__proto__ = clazz.prototype;
        return result;
    }

    public static serialize(data: any, keys?: string[]) {
        var result: any = {};
        keys = keys || Object.keys(data);
        keys.forEach(k => {
            var newName = "";
            if(typeof k == "string") {
                for(var i = 0; i < k.length; i++) {
                    var c = k[i];
                    if(c.toUpperCase() == c) {
                        c = c.toLowerCase();
                        newName += "_";
                    }
                    newName += c;
                }
                result[newName] = data[k];
            } else {
                newName = k[1];
                result[newName] = data[k[0]];
            }
        });
        return result;
    }
}