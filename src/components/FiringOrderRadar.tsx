import React from 'react';
import { CylinderTelemetry, EngineId } from '../engine/types';
import { getEngineConfig } from '../engine/engineRegistry';
import { Zap } from 'lucide-react';

interface FiringOrderRadarProps {
  engineId?: EngineId;
  cylinders: CylinderTelemetry[];
  selectedCylinderId: number;
  onSelectCylinder: (id: number) => void;
}

export const FiringOrderRadar: React.FC<FiringOrderRadarProps> = ({
  engineId = 'v8_lexus',
  cylinders,
  selectedCylinderId,
  onSelectCylinder,
}) => {
  const engineCfg = getEngineConfig(engineId);
  const firingOrder = engineCfg.firingOrder;
  const firingInterval = engineCfg.firingIntervalDeg;
  const radarStep = (360 / firingOrder.length);

  const masterAngle = cylinders.length > 0 ? cylinders[0].crankAngle : 0;
  const radarSweepDeg = (masterAngle / 720) * 360;

  const size = 260;
  const center = size / 2;
  const radius = size * 0.40;

  // Polar to Cartesian
  const polarToCart = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const radarNodes = firingOrder.map((cylId, idx) => {
    const crankFireDeg = idx * firingInterval;
    const radarAngle = idx * radarStep;
    const pos = polarToCart(center, center, radius, radarAngle);
    const labelPos = polarToCart(center, center, radius * 1.22, radarAngle);

    const cylData = cylinders.find((c) => c.id === cylId);
    const isBank1 = cylData?.bank === 1;

    // Check if cylinder is currently firing (within threshold of crankFireDeg)
    const diff = Math.abs(masterAngle - crankFireDeg);
    const cyclicDiff = Math.min(diff, 720 - diff);
    const isFiring = cyclicDiff < 25;

    return {
      cylId,
      bank: isBank1 ? 1 : 2,
      order: idx + 1,
      crankFireDeg,
      radarAngle,
      pos,
      labelPos,
      isFiring,
      pressure: cylData?.pressureBar ?? 1,
      temp: cylData?.tempKelvin ?? 300,
    };
  });

  const sweepTip = polarToCart(center, center, radius * 1.12, radarSweepDeg);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {engineCfg.cylinderCount}-Cylinder Firing Radar
          </span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
          Interval: {firingInterval}°
        </span>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
          <defs>
            <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a101d" />
              <stop offset="70%" stopColor="#070c16" />
              <stop offset="100%" stopColor="#030712" />
            </radialGradient>
            <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Radar Background Scope */}
          <circle cx={center} cy={center} r={radius * 1.25} fill="url(#radarBg)" stroke="#1e293b" strokeWidth="2" />

          {/* Concentric Calibration Rings */}
          <circle cx={center} cy={center} r={radius * 0.40} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={center} cy={center} r={radius * 0.75} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={center} cy={center} r={radius * 1.05} fill="none" stroke="#334155" strokeWidth="1.5" />

          {/* Crosshairs */}
          <line x1={center - radius * 1.15} y1={center} x2={center + radius * 1.15} y2={center} stroke="#1e293b" strokeWidth="1" />
          <line x1={center} y1={center - radius * 1.15} x2={center} y2={center + radius * 1.15} stroke="#1e293b" strokeWidth="1" />

          {/* Radar Sweep Needle */}
          <line
            x1={center}
            y1={center}
            x2={sweepTip.x}
            y2={sweepTip.y}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <circle cx={center} cy={center} r="3" fill="#38bdf8" />

          {/* Connecting Firing Order Trajectory Line */}
          <polygon
            points={radarNodes.map((n) => `${n.pos.x},${n.pos.y}`).join(' ')}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.35"
          />

          {/* Cylinder Stations */}
          {radarNodes.map((node) => {
            const isSelected = selectedCylinderId === node.cylId;
            return (
              <g
                key={node.cylId}
                onClick={() => onSelectCylinder(node.cylId)}
                className="cursor-pointer transition-all duration-150"
              >
                {/* Active Combustion Flash Glow */}
                {node.isFiring && (
                  <circle
                    cx={node.pos.x}
                    cy={node.pos.y}
                    r="16"
                    fill="#ef4444"
                    opacity="0.5"
                    filter="url(#fireGlow)"
                  />
                )}

                {/* Node Target Circle */}
                <circle
                  cx={node.pos.x}
                  cy={node.pos.y}
                  r={isSelected ? '12' : '9.5'}
                  fill={
                    node.isFiring
                      ? '#dc2626'
                      : isSelected
                      ? '#38bdf8'
                      : node.bank === 1
                      ? '#1e3a5f'
                      : '#3b204f'
                  }
                  stroke={
                    isSelected
                      ? '#ffffff'
                      : node.isFiring
                      ? '#fca5a5'
                      : node.bank === 1
                      ? '#0284c7'
                      : '#9333ea'
                  }
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />

                {/* Cylinder Number inside Node */}
                <text
                  x={node.pos.x}
                  y={node.pos.y + 3.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={isSelected ? '10' : '9'}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {node.cylId}
                </text>

                {/* Outer Firing Order Badge Label */}
                <text
                  x={node.labelPos.x}
                  y={node.labelPos.y + 3.5}
                  textAnchor="middle"
                  fill={node.isFiring ? '#ef4444' : isSelected ? '#38bdf8' : '#64748b'}
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  #{node.order} ({node.crankFireDeg}°)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Sub-legend */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 px-1 border-t border-slate-800/80 pt-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
          <span>{engineCfg.cylinderCount === 6 ? 'Cylinders' : 'Bank 1'}</span>
        </div>
        {engineCfg.cylinderCount !== 6 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#9333ea]" />
            <span>Bank 2</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Firing Event</span>
        </div>
      </div>
    </div>
  );
};