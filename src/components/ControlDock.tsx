import React, { useState } from 'react';
import { ViewMode, SeeThroughMode } from '../engine/types';
import { Play, Pause, Volume2, VolumeX, ArrowRightCircle, Eye, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Bottom dock = timeline & view tools only. Engine run, RPM, throttle, exploded and cutaway
 * controls live in the Physics Engine Lab sidebar.
 */
interface ControlDockProps {
  isRunning: boolean;
  rpm: number;
  crankAngle: number;
  speedMultiplier: number;
  viewMode: ViewMode;
  seeThroughMode: SeeThroughMode;
  soundEnabled: boolean;
  cameraPreset: string;
  onSetCrankAngle: (angle: number) => void;
  onSetSpeedMultiplier: (mult: number) => void;
  onSetViewMode: (mode: ViewMode) => void;
  onSetSeeThroughMode: (mode: SeeThroughMode) => void;
  onToggleSound: () => void;
  onSelectCameraPreset: (preset: string) => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  isRunning,
  rpm,
  crankAngle,
  speedMultiplier,
  viewMode,
  seeThroughMode,
  soundEnabled,
  cameraPreset,
  onSetCrankAngle,
  onSetSpeedMultiplier,
  onSetViewMode,
  onSetSeeThroughMode,
  onToggleSound,
  onSelectCameraPreset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Determine current master stroke stage name based on 0-720° angle
  const getCycleStrokeName = (angle: number) => {
    const a = ((angle % 720) + 720) % 720;
    if (a < 180) return 'Intake';
    if (a < 360) return 'Compression';
    if (a < 540) return 'Power';
    return 'Exhaust';
  };

  const currentStroke = getCycleStrokeName(crankAngle);

  if (isCollapsed) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-4 h-12 flex items-center text-slate-200 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-white font-bold inline-block w-20 text-left">{rpm.toFixed(0)} RPM</span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-400 font-semibold inline-block w-24 text-center">{currentStroke}</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 inline-block w-16 text-right">{crankAngle.toFixed(0)}°</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleSound}
              className={`p-1 px-2 rounded border text-[11px] flex items-center gap-1 transition shrink-0 ${
                soundEnabled
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1 px-2.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 text-sky-300 hover:text-white flex items-center gap-1 transition text-[11px] shrink-0 whitespace-nowrap"
              title="Expand Controls"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Expand Controls</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-4 py-2.5 text-slate-200 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 lg:gap-4">
        {/* Center Section: 720° Four-Stroke Scrub Bar with Cycle Indicator */}
        <div className="flex-1 w-full max-w-2xl space-y-1.5 px-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium shrink-0">Four-Stroke Kinematic Cycle:</span>
            <div className="flex items-center gap-1.5 font-mono shrink-0">
              <span
                className={`w-28 text-center py-0.2 rounded text-[10px] font-bold shrink-0 ${
                  currentStroke === 'Power'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : currentStroke === 'Compression'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : currentStroke === 'Intake'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {currentStroke}
              </span>
              <span className="text-sky-400 font-bold w-20 text-right shrink-0">{crankAngle.toFixed(0)}° / 720°</span>
            </div>
          </div>

          <div className="relative">
            <input
              type="range"
              min="0"
              max="720"
              value={crankAngle}
              onChange={(e) => onSetCrankAngle(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 relative z-10"
            />
            {/* Color-Coded Four-Stroke Segment Track Indicator */}
            <div className="grid grid-cols-4 h-1 w-full rounded-full overflow-hidden mt-1 text-[8px] font-mono text-center">
              <div className="bg-sky-500/40 text-sky-300">Intake</div>
              <div className="bg-amber-500/40 text-amber-300">Comp</div>
              <div className="bg-red-500/40 text-red-300">Power</div>
              <div className="bg-slate-600/40 text-slate-300">Exhaust</div>
            </div>
          </div>

          {/* Playback Controls & Speed Multipliers */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800 p-0.5 text-[10px] font-mono shrink-0">
              {[
                { label: '0.1x', val: 0.1 },
                { label: '0.25x', val: 0.25 },
                { label: '0.5x', val: 0.5 },
                { label: '1x', val: 1 },
              ].map((s) => (
                <button
                  key={s.val}
                  onClick={() => onSetSpeedMultiplier(s.val)}
                  className={`px-2 py-0.5 rounded transition shrink-0 ${
                    speedMultiplier === s.val && isRunning
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => onSetSpeedMultiplier(speedMultiplier === 0 ? 1 : 0)}
                className="p-1 px-1.5 text-slate-400 hover:text-white border-l border-slate-800 ml-0.5 shrink-0"
                title="Pause / Resume Motion"
              >
                {speedMultiplier === 0 ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              className={`p-1 px-2 rounded-lg border transition text-xs flex items-center gap-1.5 shrink-0 ${
                soundEnabled
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={soundEnabled ? 'Engine Audio Synthesizer ON' : 'Engine Audio Muted'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[10px] font-mono">
                {soundEnabled ? 'AUDIO ON' : 'MUTED'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Section: View Modes, Exploded Slider, & Quick Minimize */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          {/* See-Through / Transparency Button */}
          <button
            onClick={() => {
              if (seeThroughMode === 'solid') onSetSeeThroughMode('translucent');
              else if (seeThroughMode === 'translucent') onSetSeeThroughMode('ghost');
              else onSetSeeThroughMode('solid');
            }}
            className={`p-1.5 px-2 rounded-lg border transition text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              seeThroughMode === 'ghost'
                ? 'bg-purple-950 border-purple-400 text-purple-300 shadow-md shadow-purple-500/20'
                : seeThroughMode === 'translucent'
                ? 'bg-sky-950 border-sky-400 text-sky-300 shadow-md shadow-sky-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Toggle Transparency: Solid -> Glass (20%) -> Ghost (100% See-Through Pure Internals)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {seeThroughMode === 'ghost'
                ? 'Ghost (100%)'
                : seeThroughMode === 'translucent'
                ? 'Glass (20%)'
                : 'See-Through'}
            </span>
          </button>

          {/* Kinetic Force Vectors Button */}
          <button
            onClick={() => onSetViewMode(viewMode === 'kinetic' ? 'normal' : 'kinetic')}
            className={`p-1.5 px-2 rounded-lg border transition text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              viewMode === 'kinetic'
                ? 'bg-red-950 border-red-400 text-red-300 shadow-md shadow-red-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Toggle Kinetic Force Vectors & Flame Propagation"
          >
            <ArrowRightCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Kinetic</span>
          </button>

          {/* Camera Angles Selector */}
          <div className="relative shrink-0">
            <select
              value={cameraPreset}
              onChange={(e) => onSelectCameraPreset(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 cursor-pointer outline-none hover:border-slate-500 transition shadow-inner font-sans shrink-0"
            >
              <option value="isometric">Isometric View</option>
              <option value="front">Front (Pulleys & Chain)</option>
              <option value="side_bank1">Side Bank 1 (Left)</option>
              <option value="side_bank2">Side Bank 2 (Right)</option>
              <option value="top">Top Deck View</option>
              <option value="crankshaft">Crankshaft & Rods</option>
              <option value="cyl1">Cylinder 1 Close-up</option>
            </select>
          </div>

          {/* Quick Minimize Dock Button */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition flex items-center gap-1 text-xs shrink-0 whitespace-nowrap"
            title="Minimize Dock to Uncrowd Canvas"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[10px] font-mono">Minimize</span>
          </button>
        </div>
      </div>
    </div>
  );
};