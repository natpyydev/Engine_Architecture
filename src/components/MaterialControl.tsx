import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { EngineParams, CylinderMaterialId } from '../engine/engineParams';
import { CYLINDER_MATERIAL_ORDER, CYLINDER_MATERIALS, getCylinderMaterial } from '../engine/cylinderMaterials';
import { getWallThermalState } from '../engine/thermodynamics';
import { LabSection, LabRow } from './LabUi';

interface MaterialControlProps {
  params: EngineParams;
  throttle: number;
  onChange: (patch: Partial<EngineParams>) => void;
}

const STATUS_STYLE = {
  ok: { text: 'text-emerald-300', bar: 'bg-emerald-500', label: 'WITHIN LIMIT' },
  hot: { text: 'text-amber-300', bar: 'bg-amber-500', label: 'NEAR LIMIT' },
  overheat: { text: 'text-red-400', bar: 'bg-red-500', label: 'OVERHEATING' },
} as const;

/** Cylinder material: changes the look of block / pistons / sleeves and the wall-temperature behaviour. */
export const MaterialControl: React.FC<MaterialControlProps> = ({ params, throttle, onChange }) => {
  const spec = getCylinderMaterial(params.material);
  const wall = useMemo(() => getWallThermalState(throttle, params), [throttle, params]);
  const st = STATUS_STYLE[wall.status];
  const fill = Math.min(100, Math.max(0, (wall.wallTempK / wall.maxServiceTempK) * 100));

  return (
    <LabSection
      title="4 · Cylinder Material"
      icon={<Layers className="w-4 h-4 text-violet-400" />}
      badge={<span className={`${st.text} font-bold text-[10px]`}>{st.label}</span>}
    >
      <select
        value={params.material}
        onChange={(e) => onChange({ material: e.target.value as CylinderMaterialId })}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs font-sans focus:outline-none focus:border-violet-500 cursor-pointer"
        aria-label="Cylinder material"
      >
        {CYLINDER_MATERIAL_ORDER.map((id) => (
          <option key={id} value={id}>
            {CYLINDER_MATERIALS[id].label}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-400 font-sans leading-snug">{spec.note}</p>

      <div className="space-y-0.5">
        <LabRow label="Conductivity k" value={`${spec.conductivityWmK} W/m·K`} />
        <LabRow label="Max service temp" value={`${spec.maxServiceTempK} K (${(spec.maxServiceTempK - 273.15).toFixed(0)} °C)`} />
        <LabRow label="Density" value={`${spec.densityKgM3} kg/m³`} />
      </div>

      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span className="text-slate-500">Wall temperature</span>
          <span className={`${st.text} font-bold`}>
            {wall.wallTempK.toFixed(0)} K ({(wall.wallTempK - 273.15).toFixed(0)} °C)
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full ${st.bar} transition-all`} style={{ width: `${fill}%` }} />
        </div>
        <div className="space-y-0.5 mt-2">
          <LabRow
            label="Margin to limit"
            value={`${wall.marginK >= 0 ? '+' : ''}${wall.marginK.toFixed(0)} K`}
            tone={st.text}
          />
          <LabRow label="Wall heat flux" value={`${wall.heatFluxKWm2.toFixed(0)} kW/m²`} />
        </div>
      </div>
    </LabSection>
  );
};
