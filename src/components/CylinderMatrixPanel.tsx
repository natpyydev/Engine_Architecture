import React from 'react';
import { CylinderTelemetry, StrokeStage, EngineId } from '../engine/types';
import { getEngineConfig } from '../engine/engineRegistry';
import { FiringOrderRadar } from './FiringOrderRadar';
import { Flame, Wind, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface CylinderMatrixPanelProps {
  engineId?: EngineId;
  cylinders: CylinderTelemetry[];
  selectedCylinderId: number;
  onSelectCylinder: (id: number) => void;
  onJumpToStroke: (stroke: StrokeStage) => void;
}

export const CylinderMatrixPanel: React.FC<CylinderMatrixPanelProps> = ({
  engineId = 'v8_lexus',
  cylinders,
  selectedCylinderId,
  onSelectCylinder,
  onJumpToStroke,
}) => {
  const engineCfg = getEngineConfig(engineId);
  const isInline6 = engineId === 'i6_bmw';
  const isBoxer = engineId === 'boxer4_subaru';

  const bank1 = isInline6
    ? cylinders
    : cylinders.filter((c) => c.bank === 1);
  const bank2 = isInline6
    ? []
    : cylinders.filter((c) => c.bank === 2);

  // Identify which cylinder is currently in active power stroke
  const activeFiringCyl = cylinders.find(
    (c) => c.stroke === 'Power' && c.crankAngle >= 350 && c.crankAngle <= 410
  );

  return (
    <div className="flex flex-col gap-4 text-xs font-sans text-slate-200">
      {/* Firing Radar Scope */}
      <FiringOrderRadar
        engineId={engineId}
        cylinders={cylinders}
        selectedCylinderId={selectedCylinderId}
        onSelectCylinder={onSelectCylinder}
      />

      {/* Clickable Four-Stroke Quick Scrub Buttons */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <span className="text-[11px] font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
          Four-Stroke Phase Scrub & Inspection
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => onJumpToStroke('Intake')}
            className="flex items-center gap-2 p-2 rounded-lg bg-sky-950/40 border border-sky-800/50 hover:bg-sky-900/60 transition text-left group"
          >
            <Wind className="w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition" />
            <div>
              <span className="block font-bold text-sky-300">1. Intake</span>
              <span className="text-[10px] text-sky-500/80 font-mono">0° – 180°</span>
            </div>
          </button>

          <button
            onClick={() => onJumpToStroke('Compression')}
            className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 hover:bg-amber-900/60 transition text-left group"
          >
            <ArrowUpCircle className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition" />
            <div>
              <span className="block font-bold text-amber-300">2. Compression</span>
              <span className="text-[10px] text-amber-500/80 font-mono">180° – 360°</span>
            </div>
          </button>

          <button
            onClick={() => onJumpToStroke('Power')}
            className="flex items-center gap-2 p-2 rounded-lg bg-red-950/40 border border-red-800/50 hover:bg-red-900/60 transition text-left group"
          >
            <Flame className="w-4 h-4 text-red-400 shrink-0 group-hover:scale-110 transition" />
            <div>
              <span className="block font-bold text-red-300">3. Power</span>
              <span className="text-[10px] text-red-500/80 font-mono">360° – 540°</span>
            </div>
          </button>

          <button
            onClick={() => onJumpToStroke('Exhaust')}
            className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-700/60 transition text-left group"
          >
            <ArrowDownCircle className="w-4 h-4 text-slate-300 shrink-0 group-hover:scale-110 transition" />
            <div>
              <span className="block font-bold text-slate-200">4. Exhaust</span>
              <span className="text-[10px] text-slate-400 font-mono">540° – 720°</span>
            </div>
          </button>
        </div>
      </div>

      {/* Firing Order Flow Sequence Indicator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Firing Sequence ({engineCfg.firingOrder.join(' - ')})
          </span>
          <span className="text-[10px] font-mono text-slate-400">{engineCfg.firingIntervalDeg}° Intervals</span>
        </div>
        <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
          {engineCfg.firingOrder.map((cylNum, idx) => {
            const isFiringNow = activeFiringCyl?.id === cylNum;
            const isSelected = selectedCylinderId === cylNum;
            const cylData = cylinders.find((c) => c.id === cylNum);
            const isBank1 = cylData?.bank === 1;

            return (
              <button
                key={cylNum}
                onClick={() => onSelectCylinder(cylNum)}
                className={`flex-1 min-w-[34px] py-1.5 px-1 rounded-lg flex flex-col items-center justify-center border transition relative ${
                  isFiringNow
                    ? 'bg-red-500/30 border-red-500 shadow-lg shadow-red-500/30 scale-105 ring-1 ring-red-400'
                    : isSelected
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                }`}
              >
                <span className="text-[9px] text-slate-400 font-mono">#{idx + 1}</span>
                <span className="font-bold text-sm text-white font-mono">{cylNum}</span>
                <span
                  className={`text-[8px] font-semibold px-1 rounded mt-0.5 ${
                    isInline6
                      ? 'bg-sky-950 text-sky-300'
                      : isBank1
                      ? 'bg-sky-950 text-sky-300'
                      : 'bg-amber-950 text-amber-300'
                  }`}
                >
                  {isInline6 ? `C${cylNum}` : isBank1 ? 'B1' : 'B2'}
                </span>
                {isFiringNow && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cylinder Matrix Cards */}
      {isInline6 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
            <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400" />
              Inline-6 Cylinder Bank (Front to Rear: Cyl 1 to 6)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">120° Crank Throw Intervals</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cylinders.map((c) => (
              <CylinderRow
                key={c.id}
                cylinder={c}
                isSelected={c.id === selectedCylinderId}
                onSelect={() => onSelectCylinder(c.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Bank 1 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
              <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400" />
                {isBoxer ? 'Bank 1 (Left Side, -90°)' : 'Bank 1 (Left Bank, +45°)'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isBoxer ? 'Cyl 1, 3' : 'Cyl 1, 3, 5, 7'}
              </span>
            </div>

            <div className="space-y-2">
              {bank1.map((c) => (
                <CylinderRow
                  key={c.id}
                  cylinder={c}
                  isSelected={c.id === selectedCylinderId}
                  onSelect={() => onSelectCylinder(c.id)}
                />
              ))}
            </div>
          </div>

          {/* Bank 2 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400" />
                {isBoxer ? 'Bank 2 (Right Side, +90°)' : 'Bank 2 (Right Bank, -45°)'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isBoxer ? 'Cyl 2, 4' : 'Cyl 2, 4, 6, 8'}
              </span>
            </div>

            <div className="space-y-2">
              {bank2.map((c) => (
                <CylinderRow
                  key={c.id}
                  cylinder={c}
                  isSelected={c.id === selectedCylinderId}
                  onSelect={() => onSelectCylinder(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CylinderRowProps {
  cylinder: CylinderTelemetry;
  isSelected: boolean;
  onSelect: () => void;
}

const CylinderRow: React.FC<CylinderRowProps> = ({ cylinder, isSelected, onSelect }) => {
  const getStrokeBadgeClass = (stroke: StrokeStage) => {
    switch (stroke) {
      case 'Power':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'Compression':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Intake':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'Exhaust':
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const pressureRatio = Math.min(1, cylinder.pressureBar / 80);

  return (
    <div
      onClick={onSelect}
      className={`p-2 rounded-lg border cursor-pointer transition ${
        isSelected
          ? 'bg-slate-800/95 border-sky-500 shadow-md shadow-sky-500/10'
          : cylinder.isFaulty
          ? 'bg-red-950/40 border-red-800/80 hover:bg-red-900/40'
          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold font-mono text-xs ${
              isSelected ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-800 text-slate-200'
            }`}
          >
            {cylinder.id}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getStrokeBadgeClass(
                  cylinder.stroke
                )}`}
              >
                {cylinder.stroke}
              </span>
              {cylinder.isSparking && (
                <span className="flex items-center text-[10px] font-bold text-indigo-300 animate-pulse">
                  <Flame className="w-3 h-3 text-indigo-400 mr-0.5" /> SPARK
                </span>
              )}
              {cylinder.isFaulty && (
                <span className="text-[9px] font-bold text-red-400 bg-red-950 px-1 py-0.2 rounded border border-red-800">
                  FAULT
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              θ: {cylinder.crankAngle.toFixed(0)}° | Pos: {(cylinder.normalizedPistonPos * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-white font-bold block text-sm">{cylinder.pressureBar.toFixed(1)} bar</span>
          <span className="text-[10px] text-slate-400">{cylinder.tempKelvin.toFixed(0)} K</span>
        </div>
      </div>

      {/* Mini Dynamic Pressure Meter Bar */}
      <div className="mt-1.5 w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden flex">
        <div
          className={`h-full transition-all duration-75 ${
            cylinder.stroke === 'Power'
              ? 'bg-gradient-to-r from-amber-500 to-red-500'
              : cylinder.stroke === 'Compression'
              ? 'bg-amber-400'
              : 'bg-sky-400'
          }`}
          style={{ width: `${Math.max(4, pressureRatio * 100)}%` }}
        />
      </div>
    </div>
  );
};