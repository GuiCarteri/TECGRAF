"use client";
import { Skeleton } from "@/components/ui/skeleton";
/** Native selection keeps hundreds of channels keyboard-accessible without a portal per option. */
export function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      className="pick"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="loading-panel" role="status" aria-busy="true">
      <span>{label}</span>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
