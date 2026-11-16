import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

export interface DualSeriesItem {
  label: string;
  primary: number;
  secondary: number;
}

export function DualSeriesTrendChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#2563EB',
  secondaryColor = '#059669',
  mode = 'bar',
  emptyMessage = 'Insufficient circulation records for the selected range.',
}: {
  data: DualSeriesItem[];
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor?: string;
  secondaryColor?: string;
  mode?: 'bar' | 'line';
  emptyMessage?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasData =
    data.length > 0 && data.some((d) => d.primary > 0 || d.secondary > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 px-4 text-center">
        <BarChart3 className="h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-xs font-medium text-[#64748B]">{emptyMessage}</p>
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.primary, d.secondary))
  );
  const niceMax = Math.max(4, Math.ceil(maxVal / 2) * 2);

  const width = 560;
  const height = 210;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  const buildPolyline = (getter: (d: DualSeriesItem) => number) => {
    if (data.length === 1) {
      const x = padLeft + chartW / 2;
      const y = padTop + chartH - (getter(data[0]) / niceMax) * chartH;
      return `${x},${y}`;
    }
    return data
      .map((d, idx) => {
        const x = padLeft + idx * stepX;
        const y = padTop + chartH - (getter(d) / niceMax) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1E293B]">
            <span
              className="h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: primaryColor }}
              aria-hidden="true"
            />
            {primaryLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1E293B]">
            <span
              className="h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: secondaryColor }}
              aria-hidden="true"
            />
            {secondaryLabel}
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="font-mono-tabular rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
            {data[hoveredIdx].label}: {primaryLabel} {data[hoveredIdx].primary} ·{' '}
            {secondaryLabel} {data[hoveredIdx].secondary}
          </span>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${primaryLabel} vs ${secondaryLabel} chart`}
          className="h-52 w-full min-w-[360px]"
        >
          {/* Horizontal grid lines */}
          {yTicks.map((ratio) => {
            const y = padTop + chartH - ratio * chartH;
            const tickLabel = Math.round(ratio * niceMax);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748B"
                >
                  {tickLabel}
                </text>
              </g>
            );
          })}

          {mode === 'line' ? (
            <>
              <polyline
                fill="none"
                stroke={primaryColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={buildPolyline((d) => d.primary)}
              />
              <polyline
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={buildPolyline((d) => d.secondary)}
              />
              {data.map((d, idx) => {
                const x = data.length === 1 ? padLeft + chartW / 2 : padLeft + idx * stepX;
                const y1 = padTop + chartH - (d.primary / niceMax) * chartH;
                const y2 = padTop + chartH - (d.secondary / niceMax) * chartH;
                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <circle cx={x} cy={y1} r="4" fill={primaryColor} stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx={x} cy={y2} r="4" fill={secondaryColor} stroke="#FFFFFF" strokeWidth="1.5" />
                    <text
                      x={x}
                      y={height - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748B"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            data.map((d, idx) => {
              const slotW = chartW / Math.max(1, data.length);
              const centerX = padLeft + idx * slotW + slotW / 2;
              const barW = Math.min(18, Math.max(8, slotW * 0.28));
              const h1 = (d.primary / niceMax) * chartH;
              const h2 = (d.secondary / niceMax) * chartH;
              return (
                <g
                  key={d.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={centerX - barW - 1.5}
                    y={padTop + chartH - h1}
                    width={barW}
                    height={Math.max(2, h1)}
                    rx="3"
                    fill={primaryColor}
                    opacity={hoveredIdx === null || hoveredIdx === idx ? 1 : 0.65}
                  />
                  <rect
                    x={centerX + 1.5}
                    y={padTop + chartH - h2}
                    width={barW}
                    height={Math.max(2, h2)}
                    rx="3"
                    fill={secondaryColor}
                    opacity={hoveredIdx === null || hoveredIdx === idx ? 1 : 0.65}
                  />
                  <text
                    x={centerX}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748B"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}

export interface HorizontalBarItem {
  label: string;
  value: number;
  helper?: string;
  color?: string;
}

export function HorizontalDistributionChart({
  items,
  valueSuffix = '',
  emptyMessage = 'No records available for the selected filters.',
}: {
  items: HorizontalBarItem[];
  valueSuffix?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0 || items.every((i) => i.value <= 0)) {
    return (
      <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 px-4 text-center">
        <p className="text-xs font-medium text-[#64748B]">{emptyMessage}</p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const widthPct = Math.max(4, Math.round((item.value / maxVal) * 100));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-[#1E293B]" title={item.label}>
                {item.label}
              </span>
              <span className="font-mono-tabular shrink-0 font-semibold text-[#142B4A]">
                {item.value}
                {valueSuffix}
                {item.helper ? (
                  <span className="ml-1.5 font-normal text-[#64748B]">({item.helper})</span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: item.color ?? '#2563EB',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface DoughnutSegment {
  label: string;
  value: number;
  color: string;
}

export function StatusDoughnutChart({
  segments,
  centerLabel,
  centerValue,
  emptyMessage = 'No records match the current filters.',
}: {
  segments: DoughnutSegment[];
  centerLabel: string;
  centerValue: number;
  emptyMessage?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  if (total <= 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 px-4 text-center">
        <p className="text-xs font-medium text-[#64748B]">{emptyMessage}</p>
      </div>
    );
  }

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let cumulativeRatio = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={centerLabel}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="14"
          />
          {segments
            .filter((s) => s.value > 0)
            .map((segment) => {
              const ratio = segment.value / total;
              const dashLength = ratio * circumference;
              const dashOffset = -cumulativeRatio * circumference;
              cumulativeRatio += ratio;
              return (
                <circle
                  key={segment.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="14"
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono-tabular text-xl font-bold text-[#142B4A]">
            {centerValue}
          </span>
          <span className="text-[10px] font-medium text-[#64748B]">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-2 text-xs">
        {segments.map((segment) => {
          const pct = Math.round((segment.value / total) * 100);
          return (
            <li key={segment.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[#1E293B]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span>{segment.label}</span>
              </span>
              <span className="font-mono-tabular font-semibold text-[#142B4A]">
                {segment.value}{' '}
                <span className="font-normal text-[#64748B]">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
