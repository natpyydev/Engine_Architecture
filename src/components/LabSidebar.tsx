import React, { useMemo } from 'react';
import { Power, Play, Pause, Gauge, Layers, Scissors, ChevronLeft, RotateCcw } from 'lucide-react';
import { EngineParams, getTotalDisplacementL } from '../engine/engineParams';
import { getCycleSummary } from '../engine/thermodynamics';
import { DiagnosticFaultType, ViewMode } from '../engine/types';
import { LabSection, LabSlider, LabStat } from './LabUi';
import { DisplacementControl } from './DisplacementControl';
import { HeatInputControl } from './HeatInputControl';
import { MaterialControl } from './MaterialControl';

interface LabSidebarProps {
  onClose: () => void;
  onResetLab: () => void;

  engineParams: EngineParams;
  onChangeParams: (patch: Partial<EngineParams>) => void;
  activeFault: DiagnosticFaultType;

  isRunning: boolean;
  isStarting: boolean;
  onToggleStartStop: () => void;
  speedMultiplier: number;
  onSetSpeedMultiplier: (m: number) => void;
  rpm: number;
  rpmTarget: number | null;
  onSetRpmTarget: (rpm: number | null) => void;
  idleRpm: number;
  redlineRpm: number;
  throttle: number;
  onSetThrottle: (t: number) => void;
  bhp: number;

  viewMode: ViewMode;
  explodedProgress: number;
  onSetExplodedProgress: (p: number) => void;
  onToggleExploded: () => void;
  onToggleCutaway: () => void;
}

const STATUS_TONE = { ok: 'text-emerald-300', hot: 'text-amber-300', overheat: 'text-red-400' } as const;

/**
 * "Physics Engine Lab" control panel: every control a teacher needs for a live demo, numbered in the
 * order of a typical demonstration, with the headline results pinned at the top.
 */
export const LabSidebar: React.FC<LabSidebarProps> = (p) => {
  const summary = useMemo(
    () => getCycleSummary(p.throttle, p.activeFault, p.engineParams),
    [p.throttle, p.activeFault, p.engineParams]
  );
  const dispL = getTotalDisplacementL(p.engineParams);
  const manualRpm = p.rpmTarget !== null;
  const rpmDisabled = !p.isRunning || p.isStarting;
  const rpmValue = Math.min(p.redlineRpm, Math.max(p.idleRpm, p.rpmTarget ?? p.rpm));
  const exploded = p.viewMode === 'exploded';
  const cutaway = p.viewMode === 'cutaway';

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-slate-950 border-r border-slate-800 z-10">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-slate-800 shrink-0">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-300">Lab Controls</span>
        <div className="flex items-center gap-1">
          <button
            onClick={p.onResetLab}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Reset displacement, heat input, material and RPM to the defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset lab
          </button>
          <button
            onClick={p.onClose}
            className="p-1 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Hide lab controls (bigger 3D view)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Headline results, always visible while scrolling */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Live results</div>
          <div className="grid grid-cols-3 gap-1.5">
            <LabStat label="Power" value={`${p.bhp.toFixed(0)} BHP`} tone="text-emerald-300" />
            <LabStat label="Displacement" value={`${dispL.toFixed(2)} L`} tone="text-sky-300" />
            <LabStat label="Efficiency" value={`${(summary.etaIndicated * 100).toFixed(1)} %`} tone="text-emerald-300" />
            <LabStat label="Peak temp" value={`${summary.peakTempK.toFixed(0)} K`} tone="text-amber-300" />
            <LabStat label="Peak pressure" value={`${summary.peakPressureBar.toFixed(0)} bar`} tone="text-sky-300" />
            <LabStat
              label="Wall temp"
              value={`${(summary.wall.wallTempK - 273.15).toFixed(0)} °C`}
              tone={STATUS_TONE[summary.wall.status]}
            />
          </div>
        </div>

        {/* 1. Engine run */}
        <LabSection
          title="1 · Engine Run"
          icon={<Power className="w-4 h-4 text-emerald-400" />}
          badge={
            <span className={p.isRunning ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
              {p.isStarting ? 'CRANKING' : p.isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          }
        >
          <div className="flex gap-2">
            <button
              onClick={p.onToggleStartStop}
              disabled={p.isStarting}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-extrabold text-xs uppercase tracking-wider border transition ${
                p.isStarting
                  ? 'bg-amber-600 border-amber-400 text-white animate-pulse cursor-wait'
                  : p.isRunning
                    ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              {p.isStarting ? 'Cranking…' : p.isRunning ? 'Stop engine' : 'Start engine'}
            </button>
            <button
              onClick={() => p.onSetSpeedMultiplier(p.speedMultiplier === 0 ? 1 : 0)}
              className={`flex items-center justify-center gap-1.5 px-3 rounded-lg border text-xs font-bold transition ${
                p.speedMultiplier === 0
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-600 text-slate-200 hover:text-white'
              }`}
              title="Pause or resume the animation"
            >
              {p.speedMultiplier === 0 ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {p.speedMultiplier === 0 ? 'Play' : 'Pause'}
            </button>
          </div>

          <div>
            <LabSlider
              label={manualRpm ? 'RPM (manual)' : 'RPM'}
              valueText={`${(p.rpmTarget ?? p.rpm).toFixed(0)}`}
              min={p.idleRpm}
              max={p.redlineRpm}
              step={50}
              value={rpmValue}
              onChange={(v) => p.onSetRpmTarget(v)}
              accent="accent-rose-500"
              valueClass={manualRpm ? 'text-rose-300' : 'text-slate-100'}
              disabled={rpmDisabled}
              leftHint={`${p.idleRpm} idle`}
              rightHint={`${p.redlineRpm} redline`}
            />
            <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
              <span className="text-slate-500">
                {rpmDisabled ? 'Start the engine to set RPM' : manualRpm ? 'Holding the RPM you set' : 'Following throttle & gears'}
              </span>
              {manualRpm && (
                <button
                  onClick={() => p.onSetRpmTarget(null)}
                  className="px-2 py-0.5 rounded border border-rose-500/60 text-rose-300 hover:bg-rose-500/10 transition"
                >
                  Back to auto
                </button>
              )}
            </div>
          </div>

          <div>
            <LabSlider
              label="Throttle (engine load)"
              valueText={`${p.throttle.toFixed(0)}%`}
              min={0}
              max={100}
              step={1}
              value={p.throttle}
              onChange={p.onSetThrottle}
              accent="accent-amber-500"
              valueClass="text-amber-400"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[
                { label: 'Idle', v: 0 },
                { label: '35%', v: 35 },
                { label: '70%', v: 70 },
                { label: 'WOT', v: 100 },
              ].map((b) => (
                <button
                  key={b.label}
                  onClick={() => p.onSetThrottle(b.v)}
                  className={`flex-1 py-1 rounded-md border text-[10px] font-mono transition ${
                    Math.round(p.throttle) === b.v
                      ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </LabSection>

        <DisplacementControl params={p.engineParams} onChange={p.onChangeParams} />
        <HeatInputControl
          params={p.engineParams}
          throttle={p.throttle}
          activeFault={p.activeFault}
          onChange={p.onChangeParams}
        />
        <MaterialControl params={p.engineParams} throttle={p.throttle} onChange={p.onChangeParams} />

        {/* 5. View */}
        <LabSection title="5 · View" icon={<Gauge className="w-4 h-4 text-sky-400" />}>
          <div className="flex gap-2">
            <button
              onClick={p.onToggleExploded}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold transition ${
                exploded
                  ? 'bg-sky-950 border-sky-400 text-sky-300 shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Exploded view
            </button>
            <button
              onClick={p.onToggleCutaway}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold transition ${
                cutaway
                  ? 'bg-sky-950 border-sky-400 text-sky-300 shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              Cutaway view
            </button>
          </div>
          <LabSlider
            label="Explode amount"
            valueText={`${(p.explodedProgress * 100).toFixed(0)}%`}
            min={0}
            max={1}
            step={0.01}
            value={p.explodedProgress}
            onChange={p.onSetExplodedProgress}
            accent="accent-sky-400"
            valueClass="text-sky-300"
          />
        </LabSection>
      </div>
    </aside>
  );
};
