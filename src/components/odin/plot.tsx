import { useEffect, useRef } from "react";
import type { World } from "@/lib/odin/types";

interface PlotProps {
  world: World;
  whiteCell: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function Plot({ world, whiteCell, selected, onSelect }: PlotProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width < 2 || height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(wrap);
      const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const bg = pick("--color-bg", "#ffffff");
      const line = pick("--color-line", "#d6dce1");
      const fg = pick("--color-fg", "#111820");
      const muted = pick("--color-muted", "#52606b");
      const alert = pick("--color-alert", "#111820");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      const { w: bw, h: bh } = world.bounds;
      const sx = width / bw;
      const sy = height / bh;
      const X = (x: number) => x * sx;
      const Y = (y: number) => height - y * sy;

      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let g = 0; g <= bw; g += 800) {
        ctx.moveTo(X(g), 0);
        ctx.lineTo(X(g), height);
      }
      for (let g = 0; g <= bh; g += 800) {
        ctx.moveTo(0, Y(g));
        ctx.lineTo(width, Y(g));
      }
      ctx.stroke();

      for (const region of world.regions) {
        ctx.save();
        ctx.strokeStyle = region.kind === "objective" || region.kind === "base" ? fg : muted;
        ctx.setLineDash(region.kind === "water" || region.kind === "urban" ? [4, 4] : []);
        ctx.strokeRect(X(region.x), Y(region.y + region.h), region.w * sx, region.h * sy);
        ctx.fillStyle = muted;
        ctx.font = "12px Helvetica Neue, Helvetica, Arial, sans-serif";
        ctx.fillText(region.name, X(region.x) + 6, Y(region.y + region.h) + 14);
        ctx.restore();
      }

      for (const jam of world.jams) {
        ctx.beginPath();
        ctx.strokeStyle = alert;
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([3, 3]);
        ctx.arc(X(jam.x), Y(jam.y), jam.r * sx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (whiteCell) {
        for (const contact of world.contacts) {
          if (!contact.alive) continue;
          ctx.strokeStyle = muted;
          ctx.strokeRect(X(contact.pos.x) - 4, Y(contact.pos.y) - 4, 8, 8);
        }
      }

      for (const track of world.tracks) {
        const x = X(track.pos.x);
        const y = Y(track.pos.y);
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 6, y);
        ctx.closePath();
        ctx.strokeStyle = track.hostile ? alert : muted;
        ctx.stroke();
        if (selected === track.id) {
          ctx.strokeStyle = fg;
          ctx.strokeRect(x - 10, y - 10, 20, 20);
        }
        ctx.fillStyle = track.hostile ? alert : muted;
        ctx.font = "12px Helvetica Neue, Helvetica, Arial, sans-serif";
        ctx.fillText(track.id, x + 8, y - 6);
      }

      for (const asset of world.assets) {
        if (asset.status === "docked") continue;
        const x = X(asset.pos.x);
        const y = Y(asset.pos.y);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-asset.heading);
        ctx.beginPath();
        if (asset.klass === "FLOWER" || asset.klass === "EON") {
          ctx.rect(-5, -5, 10, 10);
        } else {
          ctx.moveTo(0, -8);
          ctx.lineTo(5, 6);
          ctx.lineTo(-5, 6);
          ctx.closePath();
        }
        ctx.strokeStyle = fg;
        ctx.stroke();
        ctx.restore();
        if (selected === asset.id) {
          ctx.strokeStyle = fg;
          ctx.strokeRect(x - 11, y - 11, 22, 22);
        }
        ctx.fillStyle = fg;
        ctx.font = "12px Helvetica Neue, Helvetica, Arial, sans-serif";
        ctx.fillText(asset.callsign, x + 8, y + 12);
      }

      ctx.fillStyle = muted;
      ctx.font = "12px Helvetica Neue, Helvetica, Arial, sans-serif";
      ctx.fillText("N", 10, 16);
      ctx.beginPath();
      ctx.moveTo(16, 22);
      ctx.lineTo(16, 40);
      ctx.moveTo(12, 26);
      ctx.lineTo(16, 22);
      ctx.lineTo(20, 26);
      ctx.strokeStyle = muted;
      ctx.stroke();
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [world, whiteCell, selected]);

  const pick = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * world.bounds.w;
    const y = (1 - (clientY - rect.top) / rect.height) * world.bounds.h;
    const best = { id: null as string | null, d: 180 };
    const consider = (id: string, px: number, py: number) => {
      const d = Math.hypot(px - x, py - y);
      if (d < best.d) {
        best.d = d;
        best.id = id;
      }
    };
    for (const asset of world.assets) {
      if (asset.status === "docked") continue;
      consider(asset.id, asset.pos.x, asset.pos.y);
    }
    for (const track of world.tracks) consider(track.id, track.pos.x, track.pos.y);
    onSelect(best.id);
  };

  return (
    <div ref={wrapRef} className="relative h-72 min-h-72 w-full sm:h-96 lg:h-full">
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full"
        onPointerDown={(event) => pick(event.clientX, event.clientY)}
        role="img"
        aria-label="Tactical plot of the simulated sector"
      />
    </div>
  );
}
