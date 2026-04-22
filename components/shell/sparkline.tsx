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
  fill = "rgba(88,211,163,.08)",
}: Props) {
  if (points.length < 2) return null;
  const step = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${(i * step).toFixed(1)},${(height - v * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  const areaCoords = `0,${height} ${coords} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline fill={fill} stroke="none" points={areaCoords} />
      <polyline fill="none" stroke={stroke} strokeWidth={1.4} points={coords} />
    </svg>
  );
}
