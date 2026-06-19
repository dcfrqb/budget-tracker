import { monotonePath, monotoneAreaPath } from "@/lib/charts/monotone";

type Props = {
  points: number[]; // normalized 0..1, chronological
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
};

export function Sparkline({
  points,
  width = 260,
  height = 48,
  stroke = "var(--accent)",
  fill = "color-mix(in srgb, var(--accent) 8%, transparent)",
}: Props) {
  if (points.length < 2) return null;
  const step = width / (points.length - 1);
  const xs = points.map((_, i) => i * step);
  const ys = points.map((v) => height - v * (height - 4) - 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={monotoneAreaPath(xs, ys, height)} fill={fill} stroke="none" />
      <path
        d={monotonePath(xs, ys)}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
      />
    </svg>
  );
}
