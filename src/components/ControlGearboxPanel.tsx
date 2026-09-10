import React, { useState, useEffect } from 'react';
import {
  GearPosition,
  DriveMode,
  getShiftUpGear,
  getShiftDownGear,
} from '../engine/powertrain';
import { EngineId } from '../engine/types';
import { getEngineConfig } from '../engine/engineRegistry';
import { engineAudio } from '../engine/audioSynthesizer';
import {
  Power,
  Gauge,
  Sliders,
  Zap,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
} from 'lucide-react';

interface ControlGearboxPanelProps {
  engineId?: EngineId;
  isRunning: boolean;
  isStarting: boolean;
  onToggleStartStop: () => void;
  rpm: number;
  throttle: number;
  speedKmh: number;
  speedMph: number;
  gear: GearPosition;
  wheelTorqueNm: number;
  bhp: number;
  driveMode: DriveMode;
  onSetThrottle: (val: number) => void;
  onSetBrake: (val: number) => void;
  onSelectGear: (gear: GearPosition) => void;
  onSetDriveMode: (mode: DriveMode) => void;
}

export const ControlGearboxPanel: React.FC<ControlGearboxPanelProps> = ({
  engineId = 'v8_lexus',
  isRunning,
  isStarting,
  onToggleStartStop,
  rpm,
  throttle,
  speedKmh,
  speedMph,
  gear,
  wheelTorqueNm,
  bhp,
  driveMode,
  onSetThrottle,
  onSetBrake,
  onSelectGear,
  onSetDriveMode,
}) => {
  const engineCfg = getEngineConfig(engineId);
  const [speedUnit, setSpeedUnit] = useState<'kmh' | 'mph'>('kmh');
  const [isPedalPressed, setIsPedalPressed] = useState<boolean>(false);
  const [isBrakePressed, setIsBrakePressed] = useState<boolean>(false);
  const [pedalLock, setPedalLock] = useState<boolean>(false);

  // Optimized pedal mouse down / touch hold handling
  useEffect(() => {
    if (!isPedalPressed && !isBrakePressed && (pedalLock || throttle === 0)) return;

    const timer = setInterval(() => {
      if (isPedalPressed && !pedalLock) {
        onSetThrottle(Math.min(100, throttle + 3.5));
      } else if (!isPedalPressed && !pedalLock && throttle > 0) {
        onSetThrottle(Math.max(0, throttle - 4.5));
      }

      if (isBrakePressed) {
        onSetBrake(100);
      } else {
        onSetBrake(0);
      }
    }, 25);

    return () => clearInterval(timer);
  }, [isPedalPressed, isBrakePressed, pedalLock, throttle, onSetThrottle, onSetBrake]);

  // Handle Gear Shift with Sound Bark
  const handleShift = (newGear: GearPosition) => {
    if (newGear !== gear) {
      engineAudio.triggerShiftBark();
      onSelectGear(newGear);
    }
  };

  const handleShiftUp = () => {
    const next = getShiftUpGear(gear, engineCfg.gearCount);
    handleShift(next);
  };

  const handleShiftDown = () => {
    const next = getShiftDownGear(gear);
    handleShift(next);
  };

  // Shift light calculation
  const isRedline = rpm >= engineCfg.redlineRpm - 150;

  // Active gear ratio
  const currentRatio = engineCfg.gearRatios[gear] ?? 0;

  // Compute odd and even gear arrays for the gated shifter
  const oddGears: number[] = [];
  const evenGears: number[] = [];
  for (let g = 1; g <= engineCfg.gearCount; g++) {
    if (g % 2 === 1) oddGears.push(g);
    else evenGears.push(g);
  }

  return (
    <div className="space-y-4 text-slate-100 font-sans pb-2">
      {/* Cockpit Engine Push-Button Start / Stop */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${isStarting ? 'bg-amber-400 animate-ping' : isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <div>
            <span className="text-xs font-bold text-white block">
              {isStarting ? 'STARTER CRANKING...' : isRunning ? `ENGINE RUNNING (${engineCfg.name})` : 'ENGINE OFF'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">
              {isStarting
                ? `Electric Starter Motor Cranking (~${engineCfg.starterRpm} RPM)`
                : isRunning
                ? 'Press to Shut Down Engine'
                : `Press to Crank Starter & Fire ${engineCfg.architecture}`}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleStartStop}
          disabled={isStarting}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold font-mono text-xs uppercase transition shadow-lg shrink-0 border-2 select-none ${
            isStarting
              ? 'bg-amber-600 border-amber-400 text-white animate-pulse shadow-amber-600/40 cursor-wait'
              : isRunning
              ? 'bg-rose-700 hover:bg-rose-600 border-rose-500 text-white shadow-rose-700/40 active:scale-95'
              : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-emerald-600/40 active:scale-95 animate-pulse'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>
            {isStarting
              ? 'CRANKING...'
              : isRunning
              ? 'STOP ENGINE'
              : engineId === 'i6_bmw'
              ? 'START I-6'
              : engineId === 'boxer4_subaru'
              ? 'START BOXER-4'
              : 'START V8'}
          </span>
        </button>
      </div>

      {/* Top Shift Light Bar */}
      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 shadow-inner">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5 px-1">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="uppercase">{engineCfg.transmissionName} SHIFT INDICATOR</span>
          </span>
          <span className="font-bold text-slate-300">
            {rpm >= engineCfg.redlineRpm ? (
              <span className="text-red-400 animate-pulse flex items-center gap-1">
                <Flame className="w-3 h-3" /> REV LIMITER ({engineCfg.redlineRpm.toLocaleString()} RPM)
              </span>
            ) : (
              `${rpm.toFixed(0)} RPM`
            )}
          </span>
        </div>

        {/* Multi-segment F1 style shift LED lights */}
        <div className="grid grid-cols-12 gap-1 h-2.5">
          {Array.from({ length: 12 }).map((_, i) => {
            const startThreshold = engineCfg.redlineRpm * 0.55;
            const threshold = startThreshold + i * ((engineCfg.redlineRpm - startThreshold) / 11);
            const lit = rpm >= threshold;
            let color = 'bg-slate-800';
            if (lit) {
              if (i < 5) color = 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
              else if (i < 9) color = 'bg-amber-400 shadow-sm shadow-amber-400/50';
              else color = 'bg-red-500 animate-pulse shadow-md shadow-red-500/80';
            }
            return <div key={i} className={`rounded-sm transition-colors duration-75 ${color}`} />;
          })}
        </div>
      </div>

      {/* Main Dual Gauge Cluster & Hero Gear Display */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-xl">
        {/* Left: Speedometer */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">
            Vehicle Speed
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {speedUnit === 'kmh' ? Math.abs(speedKmh).toFixed(0) : Math.abs(speedMph).toFixed(0)}
            </span>
            <button
              onClick={() => setSpeedUnit(speedUnit === 'kmh' ? 'mph' : 'kmh')}
              className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 hover:text-white transition"
              title="Click to toggle km/h and mph"
            >
              {speedUnit.toUpperCase()}
            </button>
          </div>
          <span className="text-[9px] text-slate-400 font-mono mt-1">
            {gear === 'R' ? 'REVERSE GEAR' : `FINAL DRIVE: ${engineCfg.finalDrive}:1`}
          </span>
        </div>

        {/* Center: Hero Gear Indicator */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 shadow-lg relative overflow-hidden">
          <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mb-0.5">
            CURRENT GEAR
          </span>
          <div
            className={`text-4xl font-black font-mono my-0.5 ${
              gear === 'N'
                ? 'text-emerald-400'
                : gear === 'R'
                ? 'text-rose-400'
                : isRedline
                ? 'text-red-500 animate-bounce'
                : 'text-amber-400'
            }`}
          >
            {gear}
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-slate-300">
            {gear === 'N' ? 'NEUTRAL' : `RATIO: ${Math.abs(currentRatio).toFixed(2)}:1`}
          </span>
        </div>

        {/* Right: Engine Power & Output */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">
            Power & Torque
          </span>
          <div className="text-2xl font-black font-mono tracking-tight text-emerald-400">
            {bhp.toFixed(0)} <span className="text-xs text-slate-400 font-bold">BHP</span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono mt-1">
            {wheelTorqueNm.toLocaleString()} Nm ({Math.round(wheelTorqueNm * 0.737562)} lb-ft)
          </span>
        </div>
      </div>

      {/* Dynamic Transmission Shifter Section (10-Speed / 8-Speed / 6-Speed) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            {engineCfg.transmissionName} Controls
          </span>
          {/* Sequential Paddle Shifter Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleShiftDown}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-slate-200 transition active:scale-95"
              title="Sequential Shift Down (Key: Q)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              DOWN (Q)
            </button>
            <button
              onClick={handleShiftUp}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-slate-200 transition active:scale-95"
              title="Sequential Shift Up (Key: E)"
            >
              UP (E)
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Gated Shifter Graphic */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/90 flex flex-col items-center overflow-x-auto">
          <div className="text-[10px] font-mono text-slate-400 mb-2">
            CLICK ANY GATE SLOT OR USE KEYBOARD (1-{engineCfg.gearCount}, N, R)
          </div>

          <div className="relative w-full max-w-md bg-slate-900/90 rounded-2xl border-2 border-slate-700 shadow-inner flex flex-col justify-between p-3 gap-2">
            {/* Top Gate Row: R, odd gears (1, 3, 5, 7, 9) */}
            <div className="flex justify-between items-center w-full px-2 gap-1.5">
              <button
                onClick={() => handleShift('R')}
                className={`flex-1 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center transition-all shadow-md ${
                  gear === 'R'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 scale-105 shadow-rose-600/50'
                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                }`}
              >
                R
              </button>
              {oddGears.map((g) => (
                <button
                  key={g}
                  onClick={() => handleShift(g as GearPosition)}
                  className={`flex-1 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center transition-all shadow-md ${
                    gear === g
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300 scale-105 shadow-amber-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Horizontal Neutral Gate Channel */}
            <div className="relative w-full h-4 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center">
              <button
                onClick={() => handleShift('N')}
                className={`px-5 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all shadow-md z-10 ${
                  gear === 'N'
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 shadow-emerald-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                }`}
              >
                [ NEUTRAL ]
              </button>
            </div>

            {/* Bottom Gate Row: spacer under R, even gears (2, 4, 6, 8, 10) */}
            <div className="flex justify-between items-center w-full px-2 gap-1.5">
              <div className="flex-1 h-9 opacity-0 pointer-events-none" />
              {evenGears.map((g) => (
                <button
                  key={g}
                  onClick={() => handleShift(g as GearPosition)}
                  className={`flex-1 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center transition-all shadow-md ${
                    gear === g
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300 scale-105 shadow-amber-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Throttle & Brake Pedals Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 text-slate-200">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            Throttle & Brake Pedal Interface
          </span>
          <button
            onClick={() => setPedalLock(!pedalLock)}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition ${
              pedalLock
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Slider Lock vs Spring-Return Pedal"
          >
            {pedalLock ? 'SLIDER LOCKED' : 'SPRING RETURN'}
          </button>
        </div>

        {/* Dual Pedals UI */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Brake Pedal */}
          <div className="flex flex-col items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-rose-400 font-bold mb-1">
              Brake Pedal (S / ↓)
            </span>
            <button
              onMouseDown={() => setIsBrakePressed(true)}
              onMouseUp={() => setIsBrakePressed(false)}
              onMouseLeave={() => setIsBrakePressed(false)}
              onTouchStart={() => setIsBrakePressed(true)}
              onTouchEnd={() => setIsBrakePressed(false)}
              className={`w-28 h-20 rounded-xl font-bold font-mono text-xs uppercase flex flex-col items-center justify-center transition-all border-2 select-none shadow-lg active:scale-95 ${
                isBrakePressed
                  ? 'bg-rose-600 border-rose-400 text-white shadow-rose-600/50 translate-y-1 ring-2 ring-rose-500'
                  : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span>HOLD BRAKE</span>
              <span className="text-[9px] opacity-75 font-normal mt-0.5">Hydraulic Disc</span>
            </button>
          </div>

          {/* Gas Pedal */}
          <div className="flex flex-col items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-amber-400 font-bold mb-1">
              Throttle Pedal (W / ↑)
            </span>
            <button
              onMouseDown={() => setIsPedalPressed(true)}
              onMouseUp={() => setIsPedalPressed(false)}
              onMouseLeave={() => setIsPedalPressed(false)}
              onTouchStart={() => setIsPedalPressed(true)}
              onTouchEnd={() => setIsPedalPressed(false)}
              className={`w-28 h-20 rounded-xl font-bold font-mono text-xs uppercase flex flex-col items-center justify-center transition-all border-2 select-none shadow-lg active:scale-95 ${
                isPedalPressed || throttle > 10
                  ? 'bg-amber-600 border-amber-400 text-white shadow-amber-600/50 translate-y-1 ring-2 ring-amber-500'
                  : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span>GAS PEDAL</span>
              <span className="text-[10px] font-mono font-extrabold text-amber-300 mt-0.5">
                {throttle.toFixed(0)}%
              </span>
            </button>
          </div>
        </div>

        {/* Continuous Throttle Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">THROTTLE POSITION</span>
            <span className="font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/80">
              {throttle.toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={throttle}
            onChange={(e) => onSetThrottle(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Quick Throttle Presets */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
          <button
            onClick={() => onSetThrottle(0)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            Idle (0%)
          </button>
          <button
            onClick={() => onSetThrottle(25)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            City (25%)
          </button>
          <button
            onClick={() => onSetThrottle(50)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            Cruise (50%)
          </button>
          <button
            onClick={() => onSetThrottle(75)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            Pass (75%)
          </button>
          <button
            onClick={() => onSetThrottle(100)}
            className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold transition shadow-sm shadow-amber-600/50"
          >
            WOT (100%)
          </button>
        </div>
      </div>

      {/* Drive Mode Selector & Keyboard Guide */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
            Powertrain Drive Mode
          </span>
          <div className="flex items-center gap-1">
            {(['normal', 'sport', 'sport_plus'] as DriveMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetDriveMode(mode)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                  driveMode === mode
                    ? mode === 'sport_plus'
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/40 border border-rose-400'
                      : 'bg-amber-500 text-white shadow-sm shadow-amber-500/40 border border-amber-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'sport_plus' ? 'SPORT S+' : mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcut reference bar */}
        <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-300">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            KEYBOARD SHORTCUTS:
          </span>
          <span>
            <strong className="text-amber-400">W/↑</strong> Gas · <strong className="text-rose-400">S/↓</strong> Brake · <strong className="text-sky-400">Q/E</strong> Shift · <strong className="text-white">1-{engineCfg.gearCount}</strong> Gears
          </span>
        </div>
      </div>
    </div>
  );
};
