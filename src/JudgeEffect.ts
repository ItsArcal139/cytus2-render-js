import { AnimatedObject } from "./AnimatedObject";
import { Renderer } from "./Renderer";

interface JudgeParticle {
    spawnTime: number,
    position: [number, number],
    motion: [number, number]
};

export class JudgeEffect extends AnimatedObject {
    public x: number;
    public y: number;
    public particles: JudgeParticle[] = [];
    public startTime = performance.now();

    public constructor(game: Renderer, x: number, y: number, amount: number) {
        super();
        this.x = x;
        this.y = y;

        for(var i=0; i<amount; i++) {
            var r = Math.random() * Math.PI * 2;
            var force = (Math.random() * 7 + 7);
            this.particles.push({
                spawnTime: this.startTime,
                position: [0, 0],
                motion: [Math.cos(r) * force, Math.sin(r) * force]
            });
        }

        this.update = (game: Renderer) => {
            var ctx = game.context;
            var startTime = this.startTime;
    
            var progress = (performance.now() - startTime) / (500 / game.audioElem.playbackRate);
            var t = ctx.getTransform();
    
            var size = 100 * game.ratio;
    
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.translate(this.x, this.y);
            ctx.strokeStyle = "#fea";
            ctx.fillStyle = "#fea";
            ctx.lineWidth = 4 * game.ratio;
    
            ctx.globalAlpha = Math.pow(Math.max(0, 1 - progress), 1.1);
            var s2 = size * (0.8 + 0.3 * Math.pow(progress, 0.25));
            ctx.strokeRect(-s2, -s2, s2 * 2, s2 * 2);
            ctx.rotate(Math.PI / 4);
    
            ctx.globalAlpha = Math.pow(Math.max(0, 1 - progress), 2);
            ctx.strokeRect(-size, -size, size * 2, size * 2);
            ctx.rotate(-Math.PI / 4);
    
            var aa = ctx.globalAlpha;
            ctx.globalAlpha = Math.pow(aa, 0.33);
            var offset = (1 - Math.pow(1 - progress, 3)) * (Math.PI / 4) - Math.PI / 4;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.9, offset, offset - Math.PI / 2, true);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.9, offset + Math.PI / 2, offset + Math.PI);
            ctx.stroke();
            ctx.globalAlpha = aa;
    
            ctx.beginPath();
            ctx.arc(0, 0, size * Math.min(0.25, 0.1 / Math.max(0, 1 - Math.pow(1 - progress, 4))), 0, Math.PI * 2);
            ctx.fill();
    
            ctx.globalAlpha /= 4;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.5 * Math.pow(progress, 0.25), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha *= 4;
    
            // Particles
            this.particles.forEach(p => {
                var x = p.position[0] * game.ratio;
                var y = p.position[1] * game.ratio;
                var size = (Math.pow(progress, 0.25) * 7.5 + 7.5) * game.ratio;
                ctx.fillRect(-size + x, -size + y, size * 2, size * 2);
            });
    
            ctx.setTransform(t);
    
            ctx.lineWidth = 0;
            ctx.globalAlpha = 1;
    
            if(progress >= 1) {
                this.isFinished = true;
            }
        };

        this.fixedUpdate = (game: Renderer) => {
            // Particles
            this.particles.forEach(p => {
                p.position[0] += p.motion[0];
                p.position[1] += p.motion[1];
                p.motion[0] *= 0.92;
                p.motion[1] *= 0.92;
            });
        };
    }
}