/**
 * Cubic B-spline *approximation*.
 *
 * Unlike monotonePath (which interpolates — the curve passes exactly through
 * every data point), this draws a uniform cubic B-spline whose line runs
 * *near* the points, not through them. The result is softer: peaks get shaved,
 * inflections round off. Endpoints are clamped (multiplicity 3) so the curve
 * still starts and ends on the first/last point.
 *
 * Same signature as monotonePath/monotoneAreaPath so it's a drop-in swap.
 */

/** Build clamped control array: first/last points duplicated to anchor ends. */
function clamp(vals: number[]): number[] {
  const f = vals[0];
  const l = vals[vals.length - 1];
  return [f, f, ...vals, l, l];
}

/**
 * SVG path `d` through (approximately) all (xs[i], ys[i]) via uniform cubic
 * B-spline segments, each converted exactly to a cubic Bézier.
 *
 * - < 2 points → ""
 * - exactly 2 points → straight line (matches monotonePath)
 */
export function bsplinePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return "";
  if (n === 2) {
    return `M ${xs[0].toFixed(2)},${ys[0].toFixed(2)} L ${xs[1].toFixed(2)},${ys[1].toFixed(2)}`;
  }

  const cx = clamp(xs);
  const cy = clamp(ys);
  const m = cx.length;

  // Uniform cubic B-spline → Bézier conversion, per segment i (controls i-1..i+2)
  let d = "";
  for (let i = 1; i <= m - 3; i++) {
    const b0x = (cx[i - 1] + 4 * cx[i] + cx[i + 1]) / 6;
    const b0y = (cy[i - 1] + 4 * cy[i] + cy[i + 1]) / 6;
    const b1x = (4 * cx[i] + 2 * cx[i + 1]) / 6;
    const b1y = (4 * cy[i] + 2 * cy[i + 1]) / 6;
    const b2x = (2 * cx[i] + 4 * cx[i + 1]) / 6;
    const b2y = (2 * cy[i] + 4 * cy[i + 1]) / 6;
    const b3x = (cx[i] + 4 * cx[i + 1] + cx[i + 2]) / 6;
    const b3y = (cy[i] + 4 * cy[i + 1] + cy[i + 2]) / 6;

    if (i === 1) d += `M ${b0x.toFixed(2)},${b0y.toFixed(2)}`;
    d += ` C ${b1x.toFixed(2)},${b1y.toFixed(2)} ${b2x.toFixed(2)},${b2y.toFixed(2)} ${b3x.toFixed(2)},${b3y.toFixed(2)}`;
  }
  return d;
}

/** Like bsplinePath but closed down to baselineY for a filled area. */
export function bsplineAreaPath(
  xs: number[],
  ys: number[],
  baselineY: number,
): string {
  const top = bsplinePath(xs, ys);
  if (!top) return "";
  const n = xs.length;
  return (
    top +
    ` L ${xs[n - 1].toFixed(2)},${baselineY.toFixed(2)}` +
    ` L ${xs[0].toFixed(2)},${baselineY.toFixed(2)}` +
    " Z"
  );
}
