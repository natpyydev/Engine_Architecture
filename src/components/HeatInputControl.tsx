import React, { useMemo } from 'react';
import { Flame, RotateCcw } from 'lucide-react';
import { EngineParams, DEFAULT_ENGINE_PARAMS, ENGINE_PARAM_LIMITS } from '../engine/engineParams';
import { getCycleSummary } from '../engine/thermodynamics';
import { DiagnosticFaultType } from '../engine/types';
import { LabSection, LabSlider, LabRow } from './LabUi';

interface HeatInputControlProps {
  params: EngineParams;
  throttle: number;
  activeFault: DiagnosticFaultType;
  onChange: (patch: Partial<EngineParams>) => void;
}

const PRESETS: { label: string; pct: number }[] = [
  { label: 'Low', pct: 50 },
  { label: 'Baseline', pct: 100 },
  { label: 'High', pct: 135 },
];

/** Heat Input (Q_in): fuel energy released per cycle as a % of baseline. Results show in "Live Results" above. */
export const HeatInputControl: React.FC<HeatInputControlProps> = ({ params, throttle, activeFault, onChange }) => {
  const L = ENGINE_PARAM_LIMITS.heatInputPct;
  const summary = useMemo(() => getCycleSummary(throttle, activeFault, params), [throttle, activeFault, params]);
  const tone = params.heatInputPct > 115 ? 'text-red-400' : params.heatInputPct < 85 ? 'text-sky-400' : 'text-amber-400';
  const isDefault = params.heatInputPct === DEFAULT_ENGINE_PARAMS.heatInputPct;

  return (
    <LabSection
      title="3 · Heat Input (Q in)"
      icon={<Flame className="w-4 h-4 text-amber-400" />}
      badge={<span className={`${tone} font-bold`}>{params.heatInputPct.toFixed(0)}%</span>}
    >
      <LabSlider
        label="Fuel energy per cycle"
        valueText={`${params.heatInputPct.toFixed(0)}%`}
        min={L.min}
        max={L.max}
        step={L.step}
        value={params.heatInputPct}
        onChange={(v) => onChange({ heatInputPct: v })}
        accent="accent-amber-500"
        valueClass={tone}
        leftHint={`${L.min}% cool`}
        rightHint={`${L.max}% hot`}
      />
      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange({ heatInputPct: p.pct })}
            className={`flex-1 py-1 rounded-md border text-[11px] transition ${
              params.heatInputPct === p.pct
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="space-y-0.5 pt-2 border-t border-slate-800/80">
        <LabRow label="Q_in per cylinder" value={`${summary.qInJ.toFixed(0)} J`} />
        <LabRow label="Net work per cycle" value={`${summary.netWorkJ.toFixed(0)} J`} />
        <div className="text-[9px] text-slate-500 pt-1">Measured at {throttle.toFixed(0)}% throttle. Raise throttle for full load.</div>
      </div>
      <button
        onClick={() => onChange({ heatInputPct: DEFAULT_ENGINE_PARAMS.heatInputPct })}
        disabled={isDefault}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition"
      >
        <RotateCcw className="w-3 h-3" />
        Reset to 100%
      </button>
    </LabSection>
  );
};
