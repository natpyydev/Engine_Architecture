import React from 'react';
import { Ruler, RotateCcw } from 'lucide-react';
import {
  EngineParams,
  DEFAULT_ENGINE_PARAMS,
  ENGINE_PARAM_LIMITS,
  getDerivedGeometry,
  getTotalDisplacementL,
  withDisplacement,
} from '../engine/engineParams';
import { LabSection, LabSlider, LabRow } from './LabUi';

interface DisplacementControlProps {
  params: EngineParams;
  onChange: (patch: Partial<EngineParams>) => void;
}

/**
 * Displacement: one master slider (scales bore + stroke together) plus fine Bore and Stroke sliders.
 * Edits the shared EngineParams, so the 3D pistons / crank throw, cylinder volume and thermodynamics follow live.
 */
export const DisplacementControl: React.FC<DisplacementControlProps> = ({ params, onChange }) => {
  const L = ENGINE_PARAM_LIMITS;
  const geo = getDerivedGeometry(params);
  const dispL = getTotalDisplacementL(params);
  const ratio = params.boreMm / params.strokeMm;
  const isDefault = params.boreMm === DEFAULT_ENGINE_PARAMS.boreMm && params.strokeMm === DEFAULT_ENGINE_PARAMS.strokeMm;

  return (
    <LabSection
      title="2 · Displacement"
      icon={<Ruler className="w-4 h-4 text-sky-400" />}
      badge={<span className="text-sky-400 font-bold">{dispL.toFixed(2)} L</span>}
    >
      <LabSlider
        label="Total displacement"
        valueText={`${dispL.toFixed(2)} L`}
        min={L.displacementL.min}
        max={L.displacementL.max}
        step={L.displacementL.step}
        value={Math.min(L.displacementL.max, Math.max(L.displacementL.min, dispL))}
        onChange={(v) => onChange(withDisplacement(params, v))}
        accent="accent-sky-500"
        valueClass="text-sky-400"
        leftHint={`${L.displacementL.min} L`}
        rightHint={`${L.displacementL.max} L`}
      />
      <LabSlider
        label="Bore (cylinder width)"
        valueText={`${params.boreMm.toFixed(1)} mm`}
        min={L.boreMm.min}
        max={L.boreMm.max}
        step={L.boreMm.step}
        value={params.boreMm}
        onChange={(v) => onChange({ boreMm: v })}
        accent="accent-emerald-500"
      />
      <LabSlider
        label="Stroke (piston travel)"
        valueText={`${params.strokeMm.toFixed(1)} mm`}
        min={L.strokeMm.min}
        max={L.strokeMm.max}
        step={L.strokeMm.step}
        value={params.strokeMm}
        onChange={(v) => onChange({ strokeMm: v })}
        accent="accent-amber-500"
      />
      <div className="space-y-0.5 pt-2 border-t border-slate-800/80">
        <LabRow label="Per cylinder" value={`${geo.displacementPerCylCc.toFixed(0)} cc`} />
        <LabRow label="Clearance volume" value={`${geo.clearanceVolumeCc.toFixed(1)} cc`} />
        <LabRow
          label="Bore / stroke"
          value={`${ratio.toFixed(2)} ${ratio > 1.02 ? '(oversquare)' : ratio < 0.98 ? '(undersquare)' : '(square)'}`}
        />
      </div>
      <button
        onClick={() => onChange({ boreMm: DEFAULT_ENGINE_PARAMS.boreMm, strokeMm: DEFAULT_ENGINE_PARAMS.strokeMm })}
        disabled={isDefault}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition"
      >
        <RotateCcw className="w-3 h-3" />
        Reset to 5.0 L
      </button>
    </LabSection>
  );
};
