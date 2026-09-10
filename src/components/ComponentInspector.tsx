import React from 'react';
import { ENGINE_COMPONENTS } from '../engine/componentSpecs';
import { Layers, ShieldCheck, Scale, Cpu, Flame } from 'lucide-react';

import { EngineId } from '../engine/types';
import { getEngineConfig } from '../engine/engineRegistry';

interface ComponentInspectorProps {
  engineId?: EngineId;
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
}

export const ComponentInspector: React.FC<ComponentInspectorProps> = ({
  engineId = 'v8_lexus',
  selectedComponentId,
  onSelectComponent,
}) => {
  const engineCfg = getEngineConfig(engineId);
  const componentKeys = Object.keys(ENGINE_COMPONENTS);
  const currentKey = selectedComponentId && ENGINE_COMPONENTS[selectedComponentId]
    ? selectedComponentId
    : 'crankshaft';

  const comp = ENGINE_COMPONENTS[currentKey];

  return (
    <div className="flex flex-col gap-3 text-xs font-sans text-slate-200">
      {/* Engine Global Overview Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded bg-gradient-to-tr ${engineCfg.badgeGradient} flex items-center justify-center text-white font-black text-[10px]`}>
              {engineCfg.badge}
            </span>
            <div>
              <h3 className="font-bold text-white text-xs leading-tight">{engineCfg.name}</h3>
              <p className="text-[10px] text-slate-400">{engineCfg.architecture}</p>
            </div>
          </div>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${engineCfg.tagColor}`}>
            {engineCfg.engineCode}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px]">
          {engineCfg.specs.slice(0, 6).map((sp, i) => (
            <div key={i} className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
              <span className="text-slate-400 block text-[9px] truncate">{sp.label}</span>
              <span className="text-slate-200 font-semibold font-mono truncate">{sp.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Component Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
        {componentKeys.map((key) => {
          const c = ENGINE_COMPONENTS[key];
          const isSelected = key === currentKey;
          return (
            <button
              key={key}
              onClick={() => onSelectComponent(key)}
              className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition shrink-0 ${
                isSelected
                  ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Detailed Technical Specification Sheet */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <span className="text-[10px] text-sky-400 font-mono uppercase tracking-wider block">
              {comp.category} Subsystem
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">{comp.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 px-2 py-1 rounded text-[11px] font-mono text-slate-300 flex items-center gap-1 border border-slate-700">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              {comp.massGrams > 1000 ? `${(comp.massGrams / 1000).toFixed(1)} kg` : `${comp.massGrams} g`}
            </span>
          </div>
        </div>

        {/* Material & Tolerance Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 block font-medium">Material Composition</span>
              <span className="text-slate-200 font-semibold">{comp.material}</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-start gap-2">
            <Layers className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 block font-medium">Machining Tolerance</span>
              <span className="text-slate-200 font-semibold">{comp.criticalTolerance}</span>
            </div>
          </div>
        </div>

        {/* Kinematic & Thermodynamic Roles */}
        <div className="space-y-2 text-[11px]">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="font-semibold text-sky-400 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5" />
              Kinematic Motion Role
            </span>
            <p className="text-slate-300 leading-relaxed">{comp.kinematicRole}</p>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
              <Flame className="w-3.5 h-3.5" />
              Thermodynamic Function
            </span>
            <p className="text-slate-300 leading-relaxed">{comp.thermodynamicFunction}</p>
          </div>
        </div>

        {/* Key Engineering Dimensions & Parameters */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Key Mechanical Specifications
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {comp.keySpecs.map((spec, sIdx) => (
              <div
                key={sIdx}
                className="bg-slate-950/40 p-2 rounded border border-slate-800/80 flex items-center justify-between text-[11px]"
              >
                <span className="text-slate-400">{spec.label}</span>
                <span className="font-mono font-semibold text-white">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
