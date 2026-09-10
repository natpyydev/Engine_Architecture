import React from 'react';
import { DiagnosticFaultType, EngineId } from '../engine/types';
import { getEngineConfig } from '../engine/engineRegistry';
import {
  Activity,
  Cpu,
  Layers,
  Wrench,
  BookOpen,
  Sliders,
  X,
} from 'lucide-react';

export type ActivePanelType = 'control' | 'thermo' | 'cylinders' | 'lessons' | 'diagnostics' | 'inspector' | null;

interface HeaderNavProps {
  engineId: EngineId;
  activePanel: ActivePanelType;
  onSelectPanel: (panel: ActivePanelType) => void;
  rpm: number;
  bhp: number;
  activeFault: DiagnosticFaultType;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  engineId,
  activePanel,
  onSelectPanel,
  rpm,
  bhp,
  activeFault,
}) => {
  const engineCfg = getEngineConfig(engineId);

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 h-14 flex items-center justify-between z-20 shrink-0 overflow-hidden select-none gap-2">
      {/* Brand Identity & Engine Name */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${engineCfg.badgeGradient} flex items-center justify-center text-white font-black text-xs shadow-md shrink-0`}>
          {engineCfg.badge}
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <span className="hidden sm:inline">3D Engine Lab ·</span>
            <span>{engineCfg.name}</span>
            <span className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border ${engineCfg.tagColor}`}>
              {engineCfg.engineCode}
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 hidden lg:block">
            {engineCfg.subtitle}
          </p>
        </div>
      </div>

      {/* Live Engine Status Pill */}
      <div className="hidden md:flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-3 py-1 rounded-full text-xs font-mono shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-slate-400">RPM:</span>
          <span className="text-white font-bold inline-block w-12 text-left">{rpm.toFixed(0)}</span>
        </div>
        <div className="w-px h-3 bg-slate-700 shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Power:</span>
          <span className="text-emerald-300 font-bold inline-block w-16 text-left">{bhp.toFixed(0)} BHP</span>
        </div>
        <div className="w-px h-3 bg-slate-700 shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Health:</span>
          <span
            className={`font-semibold ${
              activeFault === 'none' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {activeFault === 'none' ? 'NOMINAL' : 'FAULT DETECTED'}
          </span>
        </div>
      </div>

      {/* Mutually Exclusive Panel Toggles */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          onClick={() => onSelectPanel(activePanel === 'control' ? null : 'control')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'control'
              ? 'bg-amber-600 border-amber-400 text-white shadow-md shadow-amber-500/30 ring-1 ring-amber-400/40'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-300 hover:text-white hover:bg-amber-900/60'
          }`}
          title="Driving Cockpit: Gearbox, Shifter & Throttle"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold hidden sm:inline">Cockpit & Gearbox</span>
          <span className="font-bold sm:hidden">Cockpit</span>
        </button>

        <button
          onClick={() => onSelectPanel(activePanel === 'thermo' ? null : 'thermo')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'thermo'
              ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
          title="Otto Cycle P-v and T-s Thermodynamic Diagrams"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden md:inline">P-v Diagrams</span>
        </button>

        <button
          onClick={() => onSelectPanel(activePanel === 'cylinders' ? null : 'cylinders')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'cylinders'
              ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
          title="Cylinder Firing Radar & Sequence Matrix"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Firing Matrix</span>
        </button>

        <button
          onClick={() => onSelectPanel(activePanel === 'lessons' ? null : 'lessons')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'lessons'
              ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
          title="Guided Educational Chapters"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Lessons</span>
        </button>

        <button
          onClick={() => onSelectPanel(activePanel === 'diagnostics' ? null : 'diagnostics')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'diagnostics'
              ? 'bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
          title="Diagnostic Fault Simulator"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Diagnostics</span>
        </button>

        <button
          onClick={() => onSelectPanel(activePanel === 'inspector' ? null : 'inspector')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            activePanel === 'inspector'
              ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-500/20'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
          title="Component Inspector & Metallurgy Specs"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inspector</span>
        </button>

        {activePanel && (
          <button
            onClick={() => onSelectPanel(null)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition ml-1"
            title="Collapse Panel (Maximize 3D Viewport)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
