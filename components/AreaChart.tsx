/**
 * A compact single-series area + line chart (change-over-time) rendered as pure
 * SVG — no dependencies, no client JS. Follows the house rules: one sequential
 * brand hue for the series, a 2px line, recessive grid/axes in border/muted
 * tokens, no legend (the title names the series), a labelled data-end, and a
 * per-point hover tooltip via native <title>.
 */
export default function AreaChart({
  data,
  unit = "",
}: {
  data: { label: string; value: number }[];
  unit?: string;
}) {
  const W = 680;
  const H = 190;
  const pad = { t: 14, r: 10, b: 26, l: 10 };
  const n = data.length;

  const maxV = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) =>
    pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
  const baseY = H - pad.b;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `M ${x(0)},${baseY} L ${data
    .map((d, i) => `${x(i)},${y(d.value)}`)
    .join(" L ")} L ${x(n - 1)},${baseY} Z`;

  // Recessive gridlines at 0 / 50 / 100% of the max.
  const gridVals = [0, maxV / 2, maxV];
  // Show ~4 date labels so the axis never crowds.
  const labelIdx = new Set(
    [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1].filter(
      (i) => i >= 0
    )
  );

  const last = data[n - 1];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Grafik: ${total} ${unit} sepanjang ${n} hari terakhir`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {gridVals.map((v, i) => (
        <line
          key={i}
          x1={pad.l}
          x2={W - pad.r}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
      ))}

      {/* Area + line */}
      <path d={area} fill="url(#area-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data-end marker + value label (the one selective direct label) */}
      <circle cx={x(n - 1)} cy={y(last.value)} r="4" fill="#7c3aed" />
      <text
        x={x(n - 1)}
        y={y(last.value) - 9}
        textAnchor="end"
        fontSize="12"
        fontWeight="700"
        fill="#7c3aed"
      >
        {last.value}
      </text>

      {/* X labels */}
      {data.map((d, i) =>
        labelIdx.has(i) ? (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="11"
            fill="var(--color-muted)"
          >
            {d.label}
          </text>
        ) : null
      )}

      {/* Invisible hover bands → native tooltip per day */}
      {data.map((d, i) => (
        <rect
          key={`h-${i}`}
          x={x(i) - (W - pad.l - pad.r) / (2 * Math.max(1, n - 1))}
          y={pad.t}
          width={(W - pad.l - pad.r) / Math.max(1, n - 1)}
          height={baseY - pad.t}
          fill="transparent"
        >
          <title>{`${d.label}: ${d.value} ${unit}`.trim()}</title>
        </rect>
      ))}
    </svg>
  );
}
