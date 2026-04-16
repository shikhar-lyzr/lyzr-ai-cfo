"use client";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  slices,
  size = 120,
  thickness = 18,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
          opacity={0.35}
        />
        {total > 0 &&
          slices.map((slice, i) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const dashArray = `${dash} ${gap}`;
            const dashOffset = -offset;
            offset += dash;
            return (
              <circle
                key={`${slice.label}-${i}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        <g transform={`rotate(90 ${cx} ${cy})`}>
          {centerValue !== undefined && (
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground"
              style={{ fontSize: size * 0.22, fontWeight: 600 }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + size * 0.15}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground"
              style={{ fontSize: size * 0.09 }}
            >
              {centerLabel}
            </text>
          )}
        </g>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="text-foreground font-medium ml-auto tabular-nums">
              {slice.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
