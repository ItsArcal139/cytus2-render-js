type Color4n = [number, number, number, number];

export class Colors {
    public static RGBAtoHSLA(r: number, g: number, b: number, a: number = 1): Color4n {
        var cMax = Math.max(r, g, b);
        var cMin = Math.min(r, g, b);
        var d = cMax - cMin;

        var h = 0;
        var s: number;
        var l: number;

        if(d == 0) {
            h = 0;
        } else if(cMax == r) {
            h = 60 * (((g - b) / d) % 6);
        } else if(cMax == g) {
            h = 60 * (((b - r) / d) + 2);
        } else if(cMax == b) {
            h = 60 * (((r - g) / d) + 4);
        }

        l = (cMax + cMin) / 2;
        s = d == 0 ? 0 : (d / (1 - Math.abs(2 * l - 1))); 

        return [h, s, l, a];
    }

    public static HSLAtoRGBA(h: number, s: number, l: number, a: number = 1): Color4n {
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs((h / 60) % 2 - 1));
        var m = l - c / 2;

        c += m;
        x += m;

        var result: number[] = [];
        if(0 <= h && h < 60) {
            result = [c, x, m];
        } else if(60 <= h && h < 120) {
            result = [x, c, m];
        } else if(120 <= h && h < 180) {
            result = [m, c, x];
        } else if(180 <= h && h < 240) {
            result = [m, x, c];
        } else if(240 <= h && h < 300) {
            result = [x, m, c];
        } else if(300 <= h && h < 360) {
            result = [c, m, x];
        }
        result.push(a);
        return result as Color4n;
    }

    public static shiftHue([r, g, b, a]: Color4n , shiftAmountDeg: number) {
        var [h, s, l] = Colors.RGBAtoHSLA(r, g, b, a);
        if(shiftAmountDeg < 0) {
            shiftAmountDeg += 360;
        }
        h += shiftAmountDeg;
        h %= 360;

        return this.HSLAtoRGBA(h, s, l, a);
    }

    public static getHueShiftedImage(src: HTMLImageElement | ImageBitmap | OffscreenCanvas | HTMLCanvasElement, shiftAmountDeg: number) {
        var bc = document.createElement("canvas");
        bc.width = src.width;
        bc.height = src.height;

        var bctx = bc.getContext("2d") as CanvasRenderingContext2D;
        bctx.drawImage(src, 0, 0, bc.width, bc.height);
        var idt = bctx.getImageData(0, 0, bc.width, bc.height);
        
        for(var c=0; c<idt.data.length; c+=4) {
            var r = idt.data[c] / 255;
            var g = idt.data[c+1] / 255;
            var b = idt.data[c+2] / 255;
            var a = idt.data[c+3] / 255;

            var [r2, g2, b2, a2] = Colors.shiftHue([r, g, b, a], shiftAmountDeg);
            idt.data[c] = r2 * 255;
            idt.data[c+1] = g2 * 255;
            idt.data[c+2] = b2 * 255;
            idt.data[c+3] = a2 * 255;
        }
        bctx.putImageData(idt, 0, 0);
        return bc;
    }
}