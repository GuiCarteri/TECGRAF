"use client";
import { useI18n } from "@/lib/i18n/provider";
import { RegionEditor } from "./regions";
import type { Region } from "@/lib/dlis/regions";
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
  fileHash,
  regions = [],
  onRegions,
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
  fileHash?: string;
  regions?: Region[];
  onRegions?: (r: Region[]) => void;
}) {
  const { translate } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null),
    drag = useRef<{
      y: number;
      from: number;
      to: number;
      moved: boolean;
    } | null>(null),
    hoverFrame = useRef<number>(0);
  useEffect(() => {
    let pending = 0;
    const render = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        if (ref.current) drawTrack(ref.current, track, from, to, agc);
      });
    };
    render();
    const obs = new ResizeObserver(render);
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(pending);
      cancelAnimationFrame(hoverFrame.current);
    };
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
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            onZoom(0.8, 0.5);
          }
          if (e.key === "-") {
            e.preventDefault();
            onZoom(1.2, 0.5);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onPan((to - from) * 0.1);
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onPan(-(to - from) * 0.1);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        aria-label={translate("track_accessible", {
          channel: track.channel.name,
        })}
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
          cancelAnimationFrame(hoverFrame.current);
          if (p)
            hoverFrame.current = requestAnimationFrame(() =>
              onHover(p.sample, p.component),
            );
        }}
        onPointerUp={(e) => {
          if (!drag.current?.moved) {
            const p = hit(e);
            if (p) onPin(p.sample, p.component);
          }
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          onZoom(e.deltaY > 0 ? 1.2 : 0.8, (e.clientY - r.top) / r.height);
        }}
      />
      {fileHash && onRegions && (
        <RegionEditor
          key={fileHash + track.id + track.depthName}
          track={track}
          hash={fileHash}
          from={from}
          to={to}
          regions={regions}
          onChange={onRegions}
        />
      )}
      {!visible && (
        <div className="no-data-interval">
          {translate("Sem dados neste intervalo")}
        </div>
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
