import React from 'react';

interface TachometerGaugeProps {
  rpm: number;
  maxRpm?: number;
  redlineRpm?: number;
  warningRpm?: number;
  size?: number;
  gear?: string | number;
}

export const TachometerGauge: React.FC<TachometerGaugeProps> = ({
  rpm,
  maxRpm = 9000,
  redlineRpm = 8500,
  warningRpm = 7500,
  size = 196,
  gear,
}) => {
  // Arc parameters: sweep from 135° (bottom left) to 405° (bottom right) = 270° total span
  const startAngle = 135;
  const sweepAngle = 270;
  const endAngle = startAngle + sweepAngle;

  const clampedRpm = Math.max(0, Math.min(maxRpm, rpm));
  const rpmRatio = clampedRpm / maxRpm;
  const currentAngle = startAngle + rpmRatio * sweepAngle;

  const center = size / 2;
  const radius = size * 0.38;

  // Polar to Cartesian conversion helper
  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(cx, cy, r, endA);
    const end = polarToCartesian(cx, cy, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Needle coordinates
  const needleLength = radius * 0.88;
  const needleTip = polarToCartesian(center, center, needleLength, currentAngle);
  const needleBack = polarToCartesian(center, center, -radius * 0.22, currentAngle);
  const needleLeft = polarToCartesian(center, center, radius * 0.12, currentAngle - 90);
  const needleRight = polarToCartesian(center, center, radius * 0.12, currentAngle + 90);

  // Ticks for each 1000 RPM (0 to 9)
  const ticks = [];
  const totalMajorTicks = 9;
  for (let i = 0; i <= totalMajorTicks; i++) {
    const tickRpm = i * 1000;
    const tickAngle = startAngle + (tickRpm / maxRpm) * sweepAngle;
    const p1 = polarToCartesian(center, center, radius * 0.96, tickAngle);
    const p2 = polarToCartesian(center, center, radius * 0.76, tickAngle);
    const textP = polarToCartesian(center, center, radius * 0.60, tickAngle);
    const isRedline = tickRpm >= redlineRpm;
    const isWarning = tickRpm >= warningRpm && !isRedline;

    ticks.push({
      val: i,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      tx: textP.x,
      ty: textP.y,
      color: isRedline ? '#ef4444' : isWarning ? '#f59e0b' : '#94a3b8',
    });
  }

  // Warning and Redline arc angles
  const warningStartAngle = startAngle + (warningRpm / maxRpm) * sweepAngle;
  const redlineStartAngle = startAngle + (redlineRpm / maxRpm) * sweepAngle;

  const isRedlining = rpm >= redlineRpm;

  return (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      title={`Engine Tachometer: ${rpm.toFixed(0)} RPM`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
        <defs>
          <radialGradient id="tachoFace" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="82%" stopColor="#090d16" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
          <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Dial Bezel */}
        <circle
          cx={center}
          cy={center}
          r={radius * 1.18}
          fill="url(#tachoFace)"
          stroke="#334155"
          strokeWidth="2.5"
        />

        {/* Inner Bezel Groove */}
        <circle
          cx={center}
          cy={center}
          r={radius * 1.08}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1.5"
        />

        {/* Dial Background Track Arc (Full 0 to 9k) */}
        <path
          d={describeArc(center, center, radius, startAngle, endAngle)}
          fill="none"
          stroke="#1e293b"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Amber Warning Track Arc */}
        <path
          d={describeArc(center, center, radius, warningStartAngle, redlineStartAngle)}
          fill="none"
          stroke="#78350f"
          strokeWidth="6"
        />

        {/* Redline Track Arc */}
        <path
          d={describeArc(center, center, radius, redlineStartAngle, endAngle)}
          fill="none"
          stroke="#7f1d1d"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Active Swept Arc */}
        {rpmRatio > 0.01 && (
          <path
            d={describeArc(center, center, radius, startAngle, currentAngle)}
            fill="none"
            stroke={isRedlining ? '#ef4444' : rpm > warningRpm ? '#f59e0b' : '#38bdf8'}
            strokeWidth="6"
            strokeLinecap="round"
            filter={isRedlining ? 'url(#glowRed)' : undefined}
          />
        )}

        {/* Dial Ticks and Numbers */}
        {ticks.map((t) => (
          <g key={t.val}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.color}
              strokeWidth={t.val % 2 === 0 ? '2.5' : '1.5'}
            />
            <text
              x={t.tx}
              y={t.ty + 4}
              fill={t.color}
              fontSize={size * 0.075}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t.val}
            </text>
          </g>
        ))}

        {/* Gear Position Badge in Center Top */}
        {gear !== undefined && (
          <g>
            <rect
              x={center - size * 0.09}
              y={center - radius * 0.68}
              width={size * 0.18}
              height={size * 0.16}
              rx="4"
              fill="#0b1120"
              stroke="#334155"
              strokeWidth="1.2"
            />
            <text
              x={center}
              y={center - radius * 0.44}
              fill="#f59e0b"
              fontSize={size * 0.10}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {gear}
            </text>
          </g>
        )}

        {/* Digital Numeric RPM Display below center */}
        <text
          x={center}
          y={center + radius * 0.48}
          fill="#f8fafc"
          fontSize={size * 0.11}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
          className="tracking-tight"
        >
          {rpm.toFixed(0)}
        </text>
        <text
          x={center}
          y={center + radius * 0.66}
          fill="#64748b"
          fontSize={size * 0.05}
          fontFamily="monospace"
          fontWeight="600"
          textAnchor="middle"
          letterSpacing="1"
        >
          RPM
        </text>

        {/* Glowing Radial Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleRight.x},${needleRight.y} ${needleBack.x},${needleBack.y} ${needleLeft.x},${needleLeft.y}`}
          fill={isRedlining ? '#ef4444' : '#ff4d4d'}
          filter="url(#glowRed)"
        />

        {/* Center Chrome Hub */}
        <circle cx={center} cy={center} r={radius * 0.20} fill="#334155" stroke="#94a3b8" strokeWidth="2" />
        <circle cx={center} cy={center} r={radius * 0.10} fill="#0f172a" />
      </svg>

      {/* Floating SHIFT Light Warning Badge */}
      {isRedlining && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white font-extrabold text-[10px] font-mono px-2.5 py-0.5 rounded-full shadow-lg shadow-red-500/60 ring-2 ring-red-400 animate-pulse pointer-events-none tracking-wider">
          SHIFT
        </div>
      )}
    </div>
  );
};