"use client";
import { useRef, useEffect } from "react";
import { drawTrack, locate, type Track } from "@/lib/dlis/plotting";
export function TrackCanvas({
  track,
  from,
  to,
  agc,
  onHover,
  onPin,
  onZoom,
  onPan,
  hoverDepth,
}: {
  track: Track;
  from: number;
  to: number;
  agc: boolean;
  onHover: (s: number, c: number) => void;
  onPin: (s: number, c: number) => void;
  onZoom: (factor: number, ratio: number) => void;
  onPan: (delta: number) => void;
  hoverDepth: number | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    drag = useRef<any>(null);
  useEffect(() => {
    if (ref.current) drawTrack(ref.current, track, from, to, agc);
    const obs = new ResizeObserver(() => {
      if (ref.current) drawTrack(ref.current, track, from, to, agc);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [track, from, to, agc]);
  const hit = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return locate(
      track,
      from + ((e.clientY - r.top) / r.height) * (to - from),
      (e.clientX - r.left) / r.width,
    );
  };
  const visible = track.index.indices.some(
    (i: number) => track.depth[i] >= from && track.depth[i] <= to,
  );
  return (
    <div className="track-plot">
      <canvas
        ref={ref}
        aria-label={`Track ${track.channel.name}. Use os campos de amostra e componente para seleção por teclado.`}
        style={{
          height: 620,
          width: "100%",
          display: "block",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, from, to, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && e.buttons) {
            const d = e.clientY - drag.current.y;
            if (Math.abs(d) > 4) {
              drag.current.moved = true;
              onPan((-d / 620) * (to - from));
              drag.current.y = e.clientY;
            }
            return;
          }
          const p = hit(e);
          if (p) onHover(p.sample, p.component);
        }}
        onPointerUp={(e) => {
          if (!drag.current?.moved) {
            const p = hit(e);
            if (p) onPin(p.sample, p.component);
          }
          drag.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          onZoom(e.deltaY > 0 ? 1.2 : 0.8, (e.clientY - r.top) / r.height);
        }}
      />
      {!visible && (
        <div className="no-data-interval">Sem dados neste intervalo</div>
      )}
      {hoverDepth !== null && hoverDepth >= from && hoverDepth <= to && (
        <div
          className="crosshair"
          style={{ top: ((hoverDepth - from) / (to - from)) * 620 }}
        />
      )}
    </div>
  );
}
