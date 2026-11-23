import React, { useState } from 'react';
import { Ruler, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  EngineParams,
  DEFAULT_ENGINE_PARAMS,
  ENGINE_PARAM_LIMITS,
  getDerivedGeometry,
  getTotalDisplacementL,
  withDisplacement,
} from '../engine/engineParams';

interface DisplacementControlProps {
  params: EngineParams;
  onChange: (patch: Partial<EngineParams>) => void;
}

/**
 * Displacement control: one master Displacement slider (scales bore + stroke together),
 * plus fine Bore and Stroke sliders. All changes go through the shared EngineParams state,
 * so the 3D pistons / crank throw, cylinder volume and thermodynamic numbers update live.
 */
export const DisplacementControl: React.FC<DisplacementControlProps> = ({ params, onChange }) => {
  const [open, setOpen] = useState(true);
  const L = ENGINE_PARAM_LIMITS;
  const geo = getDerivedGeometry(params);
  const dispL = getTotalDisplacementL(params);
  const ratio = params.boreMm / params.strokeMm;
  const isDefault =
    params.boreMm === DEFAULT_ENGINE_PARAMS.boreMm && params.strokeMm === DEFAULT_ENGINE_PARAMS.strokeMm;

  const sliderClass = 'w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer';

  return (
    <div className="absolute top-20 left-3 z-10 pointer-events-auto w-64 bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-xl shadow-2xl font-mono text-[11px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-slate-200 hover:text-white"
        title="Show / hide displacement controls"
      >
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
          <Ruler className="w-3.5 h-3.5 text-sky-400" />
          Displacement
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sky-400 font-bold">{dispL.toFixed(2)} L</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-800/80 pt-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400">TOTAL DISPLACEMENT</span>
              <span className="text-sky-400 font-bold">{dispL.toFixed(2)} L</span>
            </div>
            <input
              type="range"
              min={L.displacementL.min}
              max={L.displacementL.max}
              step={L.displacementL.step}
              value={Math.min(L.displacementL.max, Math.max(L.displacementL.min, dispL))}
              onChange={(e) => onChange(withDisplacement(params, parseFloat(e.target.value)))}
              className={`${sliderClass} accent-sky-500`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400">BORE</span>
              <span className="text-slate-200 font-bold">{params.boreMm.toFixed(1)} mm</span>
            </div>
            <input
              type="range"
              min={L.boreMm.min}
              max={L.boreMm.max}
              step={L.boreMm.step}
              value={params.boreMm}
              onChange={(e) => onChange({ boreMm: parseFloat(e.target.value) })}
              className={`${sliderClass} accent-emerald-500`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400">STROKE</span>
              <span className="text-slate-200 font-bold">{params.strokeMm.toFixed(1)} mm</span>
            </div>
            <input
              type="range"
              min={L.strokeMm.min}
              max={L.strokeMm.max}
              step={L.strokeMm.step}
              value={params.strokeMm}
              onChange={(e) => onChange({ strokeMm: parseFloat(e.target.value) })}
              className={`${sliderClass} accent-amber-500`}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-2 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-500">Per cylinder</span>
            <span className="text-slate-200 text-right">{geo.displacementPerCylCc.toFixed(0)} cc</span>
            <span className="text-slate-500">Clearance vol.</span>
            <span className="text-slate-200 text-right">{geo.clearanceVolumeCc.toFixed(1)} cc</span>
            <span className="text-slate-500">Piston travel</span>
            <span className="text-slate-200 text-right">{params.strokeMm.toFixed(1)} mm</span>
            <span className="text-slate-500">Bore / stroke</span>
            <span className="text-slate-200 text-right">
              {ratio.toFixed(2)} {ratio > 1.02 ? '(oversquare)' : ratio < 0.98 ? '(undersquare)' : '(square)'}
            </span>
          </div>

          <button
            onClick={() => onChange({ boreMm: DEFAULT_ENGINE_PARAMS.boreMm, strokeMm: DEFAULT_ENGINE_PARAMS.strokeMm })}
            disabled={isDefault}
            className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to 5.0 L
          </button>
        </div>
      )}
    </div>
  );
};
