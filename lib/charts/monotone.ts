/**
 * Monotone cubic interpolation using Fritsch–Carlson tangents.
 * Curves pass exactly through every data point and never overshoot
 * (no false peaks or dips between real data points).
 */

/**
 * Compute Fritsch–Carlson tangents for a sequence of (x, y) pairs.
 * Returns an array of tangent slopes, one per point.
 */
function computeTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  // Secant slopes between consecutive points
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  // Initial tangents: average of neighboring secants
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2;
  }

  // Fritsch–Carlson monotonicity constraints
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      // Flat segment — zero both tangents to prevent overshoot
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const h = alpha * alpha + beta * beta;
      if (h > 9) {
        // Clamp to keep the curve monotone
        const tau = 3 / Math.sqrt(h);
        m[i] = tau * alpha * d[i];
        m[i + 1] = tau * beta * d[i];
      }
    }
  }

  return m;
}

/**
 * Build an SVG path `d` string through all (xs[i], ys[i]) points using
 * monotone cubic Bézier segments (Fritsch–Carlson).
 *
 * - < 2 points → returns ""
 * - exactly 2 points → straight line "M x0,y0 L x1,y1"
 */
export function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return "";
  if (n === 2) {
    return `M ${xs[0].toFixed(2)},${ys[0].toFixed(2)} L ${xs[1].toFixed(2)},${ys[1].toFixed(2)}`;
  }

  const m = computeTangents(xs, ys);

  let d = `M ${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    // Control points at x ± dx/3, y ± (tangent * dx/3)
    const cp1x = xs[i] + dx / 3;
    const cp1y = ys[i] + (m[i] * dx) / 3;
    const cp2x = xs[i + 1] - dx / 3;
    const cp2y = ys[i + 1] - (m[i + 1] * dx) / 3;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/**
 * Like monotonePath but closes the shape downward to baselineY for use as a
 * filled area under the line.
 *
 * Resulting path: top curve → vertical to baselineY at last x →
 * horizontal to first x → Z.
 */
export function monotoneAreaPath(
  xs: number[],
  ys: number[],
  baselineY: number,
): string {
  const top = monotonePath(xs, ys);
  if (!top) return "";
  const n = xs.length;
  return (
    top +
    ` L ${xs[n - 1].toFixed(2)},${baselineY.toFixed(2)}` +
    ` L ${xs[0].toFixed(2)},${baselineY.toFixed(2)}` +
    " Z"
  );
}
