import { useI18n } from "@/lib/i18n/provider";
import type { CurveThumbnail } from "@/lib/dlis/types";

export function Thumbnail({ trace }: { trace: CurveThumbnail }) {
  const { number } = useI18n();
  const measured = trace.points.filter((p) => p !== null);
  if (measured.length < 2) return null;
  const x = measured.map((p) => p[0]),
    y = measured.map((p) => p[1]);
  const xMin = Math.min(...x),
    xSpan = Math.max(...x) - xMin,
    yMin = Math.min(...y),
    ySpan = Math.max(...y) - yMin;
  const path = trace.points
    .map((p, i) => {
      if (!p) return "";
      const command = !i || !trace.points[i - 1] ? "M" : "L";
      return (
        command +
        (xSpan ? 8 + ((p[0] - xMin) / xSpan) * 144 : 80).toFixed(2) +
        " " +
        (ySpan ? 4 + ((p[1] - yMin) / ySpan) * 84 : 46).toFixed(2)
      );
    })
    .join(" ");
  return (
    <figure className="curve-thumbnail">
      <svg
        viewBox="0 0 160 92"
        role="img"
        aria-label={
          trace.channel +
          " · " +
          number(yMin, { maximumSignificantDigits: 8 }) +
          "–" +
          number(Math.max(...y), { maximumSignificantDigits: 8 }) +
          " m"
        }
      >
        <path
          d="M40 0V92 M80 0V92 M120 0V92 M0 23H160 M0 46H160 M0 69H160"
          stroke="currentColor"
          opacity=".12"
          fill="none"
        />
        <path
          d={path}
          stroke="currentColor"
          strokeWidth="1.7"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
      <figcaption>
        {trace.channel}
        {trace.unit && " · " + trace.unit}
      </figcaption>
    </figure>
  );
}
