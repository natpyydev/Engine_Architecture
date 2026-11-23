import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EngineCanvas } from './three/EngineCanvas';
import { HeaderNav, ActivePanelType } from './components/HeaderNav';
import { ControlDock } from './components/ControlDock';
import { ControlGearboxPanel } from './components/ControlGearboxPanel';
import { ThermodynamicPanel } from './components/ThermodynamicPanel';
import { CylinderMatrixPanel } from './components/CylinderMatrixPanel';
import { GuidedLessonsPanel } from './components/GuidedLessonsPanel';
import { DiagnosticLabPanel } from './components/DiagnosticLabPanel';
import { ComponentInspector } from './components/ComponentInspector';
import { TachometerGauge } from './components/TachometerGauge';
import { DisplacementControl } from './components/DisplacementControl';
import { X } from 'lucide-react';
import {
  CylinderTelemetry,
  DiagnosticFaultType,
  StrokeStage,
  ViewMode,
  SeeThroughMode,
  EngineId,
} from './engine/types';
import {
  GearPosition,
  DriveMode,
  PowertrainState,
  stepPowertrain,
  getShiftUpGear,
  getShiftDownGear,
} from './engine/powertrain';
import { computeAllCylindersTelemetry, getEngineCylinders } from './engine/firingOrder';
import { getEngineConfig } from './engine/engineRegistry';
import { engineAudio } from './engine/audioSynthesizer';
import { EngineParams, DEFAULT_ENGINE_PARAMS, sanitizeEngineParams } from './engine/engineParams';

export const App: React.FC = () => {
  // This lab is focused on the Lexus 2UR-GSE V8 only (I6 / Boxer assemblies remain in the repo but are unused).
  // (asserted to the full EngineId type so the existing per-engine branches below still type-check)
  const currentEngineId = 'v8_lexus' as EngineId;
  const engineCfg = getEngineConfig(currentEngineId);

  // Shared, user-adjustable physics parameters (bore, stroke, heat input, material).
  // Read by the kinematics / thermodynamics code; the Lab controls will edit it in later steps.
  const [engineParams, setEngineParams] = useState<EngineParams>(DEFAULT_ENGINE_PARAMS);
  const handleSetEngineParams = useCallback((patch: Partial<EngineParams>) => {
    setEngineParams((prev) => sanitizeEngineParams({ ...prev, ...patch }));
  }, []);

  // Engine State: Defaults to OFF on page launch (requires explicit starter ignition)
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const flareTimerRef = useRef<number>(0);
  const [rpm, setRpm] = useState<number>(0);
  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(0);
  const [crankAngle, setCrankAngle] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('cutaway');
  const [seeThroughMode, setSeeThroughMode] = useState<SeeThroughMode>('translucent');
  const [explodedProgress, setExplodedProgress] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<string>('isometric');

  // Powertrain & Gearbox State (Lexus LC 500 6-Speed Setup)
  const [gear, setGear] = useState<GearPosition>('N');
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [speedMph, setSpeedMph] = useState<number>(0);
  const [wheelTorqueNm, setWheelTorqueNm] = useState<number>(0);
  const [driveMode, setDriveMode] = useState<DriveMode>('sport');

  // Interactive Selection
  const [selectedCylinderId, setSelectedCylinderId] = useState<number>(1);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>('crankshaft');
  const [activeFault, setActiveFault] = useState<DiagnosticFaultType>('none');
  // Default to null for full-bleed, uncrowded 3D canvas on load!
  const [activePanel, setActivePanel] = useState<ActivePanelType>(null);

  // Real-time Telemetry state: Initialized to resting state (0 RPM, 0% throttle)
  const [telemetryList, setTelemetryList] = useState<CylinderTelemetry[]>(() =>
    computeAllCylindersTelemetry(0, 0, 0, 'none', 'v8_lexus')
  );

  // Computed Engine Output: 0 BHP / 0 lb-ft when shut down
  const [bhp, setBhp] = useState<number>(0);
  const [totalTorqueLbFt, setTotalTorqueLbFt] = useState<number>(0);

  // Powertrain state reference for simulation loop
  const ptRef = useRef<PowertrainState>({
    gear: 'N',
    speedMps: 0,
    speedKmh: 0,
    speedMph: 0,
    engineRpm: 0,
    throttle: 0,
    brake: 0,
    isAutoClutch: true,
    clutchEngaged: true,
    driveMode: 'sport',
    isShifting: false,
    wheelTorqueNm: 0,
    gearRatio: 0,
    shiftLight: 'off',
  });

  // Animation Loop References
  const stateRef = useRef({
    isRunning,
    isStarting,
    rpm,
    throttle,
    brake,
    gear,
    crankAngle,
    speedMultiplier,
    activeFault,
    driveMode,
    currentEngineId,
    engineParams,
  });
  stateRef.current = {
    isRunning,
    isStarting,
    rpm,
    throttle,
    brake,
    gear,
    crankAngle,
    speedMultiplier,
    activeFault,
    driveMode,
    currentEngineId,
    engineParams,
  };

  // Sound Toggle Handler
  const handleToggleSound = useCallback(() => {
    const active = engineAudio.toggleMute();
    setSoundEnabled(active);
  }, []);

  // Engine Start/Stop Handler with Authentic Starter Sequence
  const handleToggleStartStop = useCallback(() => {
    if (isStarting) return;
    if (!isRunning) {
      setIsStarting(true);
      setSoundEnabled(true);
      engineAudio.unmute();
      engineAudio.playStarterSequence(() => {
        setIsRunning(true);
        setIsStarting(false);
        flareTimerRef.current = 2.0; // authentic cold-start flare & mellow transition
      });
    } else {
      setIsRunning(false);
      setIsStarting(false);
      flareTimerRef.current = 0;
      engineAudio.stop();
    }
  }, [isRunning, isStarting]);

  // Gear Selection Handler with Audio Shift Bark
  const handleSelectGear = useCallback((newGear: GearPosition) => {
    setGear((prev) => {
      if (prev !== newGear) {
        engineAudio.triggerShiftBark();
      }
      return newGear;
    });
    ptRef.current.gear = newGear;
  }, []);

  // Jump to specific stroke for selected cylinder
  const handleJumpToStroke = useCallback((stroke: StrokeStage) => {
    const cylinders = getEngineCylinders(currentEngineId);
    const targetCyl = cylinders.find((c) => c.id === selectedCylinderId) || cylinders[0];
    let offsetDeg = 0;
    switch (stroke) {
      case 'Intake':
        offsetDeg = 0;
        break;
      case 'Compression':
        offsetDeg = 180;
        break;
      case 'Power':
        offsetDeg = 360;
        break;
      case 'Exhaust':
        offsetDeg = 540;
        break;
    }
    const targetMaster = ((targetCyl.firingCycleDeg - 360 + offsetDeg) % 720 + 720) % 720;
    setCrankAngle(targetMaster);
  }, [currentEngineId, selectedCylinderId]);

  // Guided Lesson sync handler
  const handleApplyLessonState = useCallback(
    (preset: string, mode: ViewMode, compId: string | null, cylId: number) => {
      setCameraPreset(preset);
      setViewMode(mode);
      setSelectedComponentId(compId);
      setSelectedCylinderId(cylId);
      if (mode === 'exploded' && explodedProgress === 0) {
        setExplodedProgress(0.65);
      }
    },
    [explodedProgress]
  );

  // Keyboard Driving Controls Listener (W/S, Q/E, 0-9, N, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const curEng = stateRef.current.currentEngineId;
      const maxGears = getEngineConfig(curEng).gearCount;

      if (key === 'w' || e.key === 'ArrowUp') {
        setThrottle((prev) => Math.min(100, prev + 12));
      } else if (key === 's' || e.key === 'ArrowDown') {
        setBrake(100);
      } else if (key === 'q') {
        const next = getShiftDownGear(ptRef.current.gear);
        handleSelectGear(next);
      } else if (key === 'e') {
        const next = getShiftUpGear(ptRef.current.gear, maxGears);
        handleSelectGear(next);
      } else if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        if (num <= maxGears) {
          handleSelectGear(num as GearPosition);
        }
      } else if (e.key === '0') {
        if (maxGears >= 10) {
          handleSelectGear(10);
        }
      } else if (key === 'n') {
        handleSelectGear('N');
      } else if (key === 'r') {
        handleSelectGear('R');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 's' || e.key === 'ArrowDown') {
        setBrake(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSelectGear]);

  // Main Simulation Physics Loop (60 FPS)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      const s = stateRef.current;
      const curEng = s.currentEngineId;
      const cfg = getEngineConfig(curEng);
      let currentRpm = s.rpm;

      // 1. Calculate Engine Torque & Brake Horsepower dynamically per engine
      let engineTorqueNm = 0;
      if (curEng === 'v8_lexus') {
        // Lexus LC 500 5.0L Naturally Aspirated V8 (540 Nm @ 4,800 RPM, 471 BHP @ 7,100 RPM)
        let rpmTorqueFactor = 1.0;
        if (currentRpm < 2200) {
          rpmTorqueFactor = 0.60 + 0.40 * (currentRpm / 2200);
        } else if (currentRpm <= 5200) {
          rpmTorqueFactor = 0.94 + 0.06 * ((currentRpm - 2200) / 3000);
        } else {
          rpmTorqueFactor = 1.0 - 0.12 * Math.min(1.2, (currentRpm - 5200) / 2100);
        }
        const throttleNorm = Math.max(0.08, s.throttle / 100);
        engineTorqueNm = 540 * rpmTorqueFactor * (0.10 + 0.90 * throttleNorm);
      } else if (curEng === 'i6_bmw') {
        // BMW M3 S58 3.0L Twin-Turbo (650 Nm plateau 2,750-5,500 RPM, 503 BHP @ 6,250 RPM)
        let rpmTorqueFactor = 1.0;
        if (currentRpm < 2000) {
          rpmTorqueFactor = 0.45 + 0.55 * (currentRpm / 2000);
        } else if (currentRpm <= 5600) {
          rpmTorqueFactor = 1.0;
        } else {
          rpmTorqueFactor = 1.0 - 0.15 * Math.min(1.2, (currentRpm - 5600) / 1600);
        }
        const throttleNorm = Math.max(0.08, s.throttle / 100);
        engineTorqueNm = 650 * rpmTorqueFactor * (0.08 + 0.92 * Math.pow(throttleNorm, 1.2));
      } else {
        // Subaru WRX STI EJ257 2.5L Turbo Boxer (407 Nm @ 4,000 RPM, 310 BHP @ 6,000 RPM)
        let rpmTorqueFactor = 1.0;
        if (currentRpm < 2500) {
          rpmTorqueFactor = 0.40 + 0.35 * (currentRpm / 2500);
        } else if (currentRpm < 4200) {
          rpmTorqueFactor = 0.75 + 0.25 * ((currentRpm - 2500) / 1700);
        } else {
          rpmTorqueFactor = 1.0 - 0.22 * Math.min(1.2, (currentRpm - 4200) / 2500);
        }
        const throttleNorm = Math.max(0.08, s.throttle / 100);
        engineTorqueNm = 407 * rpmTorqueFactor * (0.08 + 0.92 * throttleNorm);
      }

      if (s.activeFault === 'misfire_cyl3') engineTorqueNm *= 0.82;
      if (s.activeFault === 'blown_gasket') engineTorqueNm *= 0.70;
      if (s.activeFault === 'pre_ignition') engineTorqueNm *= 0.65;
      if (s.activeFault === 'valve_float' && currentRpm > 5500) engineTorqueNm *= 0.75;
      if (s.activeFault === 'lean_mix') engineTorqueNm *= 0.88;

      const torqueLbFt = s.isRunning ? engineTorqueNm * 0.737562 : 0;
      const calculatedBhp = s.isRunning ? Math.max(0, (torqueLbFt * currentRpm) / 5252) : 0;

      // 2. Step Powertrain: Cranking vs Running vs Cold-Start Flare vs Stopped
      if (s.isStarting) {
        const crankWobble = Math.sin(time * 0.001 * cfg.starterCadenceHz * Math.PI * 2) * 25;
        const crankingRpm = cfg.starterRpm + crankWobble;
        currentRpm = crankingRpm;
        ptRef.current.engineRpm = crankingRpm;
      } else if (s.isRunning) {
        if (flareTimerRef.current > 0) {
          flareTimerRef.current = Math.max(0, flareTimerRef.current - dt);
          const elapsed = 2.0 - flareTimerRef.current;
          let flareRpm = cfg.idleRpm;
          if (elapsed < 0.30) {
            const p = elapsed / 0.30;
            flareRpm = cfg.starterRpm + (cfg.coldStartRoarRpm - cfg.starterRpm) * Math.sin(p * (Math.PI / 2));
          } else {
            const p = Math.min(1.0, (elapsed - 0.30) / 1.70);
            flareRpm = cfg.idleRpm + (cfg.coldStartRoarRpm - cfg.idleRpm) * Math.pow(1.0 - p, 2.4);
          }
          currentRpm = flareRpm;
          ptRef.current.engineRpm = flareRpm;
        } else {
          ptRef.current.gear = s.gear;
          ptRef.current = stepPowertrain(dt, ptRef.current, engineTorqueNm, s.throttle, s.brake, curEng);
          currentRpm = ptRef.current.engineRpm;
        }
      } else {
        // Coast down to 0
        currentRpm = Math.max(0, currentRpm - currentRpm * 3.5 * dt);
        ptRef.current.engineRpm = currentRpm;
        ptRef.current.speedMps = Math.max(0, (ptRef.current.speedMps ?? 0) - (15 / 3.6) * dt);
        ptRef.current.speedKmh = Number(((ptRef.current.speedMps ?? 0) * 3.6).toFixed(1));
        ptRef.current.speedMph = Number((ptRef.current.speedKmh * 0.621371).toFixed(1));
        ptRef.current.wheelTorqueNm = 0;
      }

      // 3. Crankshaft Rotation Kinematics: dθ = (RPM * 360 / 60) * dt * speedMultiplier * 0.5
      // Calibrated so baseline 1x multiplier renders at authentic observable motion (former 0.5x)
      let newAngle = s.crankAngle;
      if ((s.isRunning || s.isStarting) && s.speedMultiplier > 0) {
        const degPerSec = ((currentRpm * 360) / 60) * 0.5;
        newAngle = (newAngle + degPerSec * dt * s.speedMultiplier) % 720;
      }

      // 4. Compute live telemetry across all cylinders for current engine
      const telemetry = computeAllCylindersTelemetry(
        newAngle,
        currentRpm,
        s.throttle,
        s.activeFault,
        curEng,
        s.engineParams
      );

      // 5. Update Post-Exhaust Audio Engine
      engineAudio.update(s.isRunning, currentRpm, s.throttle, s.activeFault, s.isStarting);

      // Sync to React state
      setRpm(currentRpm);
      setCrankAngle(newAngle);
      setTelemetryList(telemetry);
      setTotalTorqueLbFt(torqueLbFt);
      setBhp(calculatedBhp);
      setSpeedKmh(ptRef.current.speedKmh);
      setSpeedMph(ptRef.current.speedMph);
      setWheelTorqueNm(ptRef.current.wheelTorqueNm);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const selectedCylinderTelemetry =
    telemetryList.find((c) => c.id === selectedCylinderId) || telemetryList[0];

  return (
    <div className="relative w-full h-full bg-[#07090e] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Header Navigation */}
      <HeaderNav
        engineId={currentEngineId}
        activePanel={activePanel}
        onSelectPanel={setActivePanel}
        rpm={rpm}
        bhp={bhp}
        activeFault={activeFault}
      />

      {/* Main Center Stage: 3D Viewport with Collapsible Floating HUD Drawer */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* Three.js Engine Canvas */}
        <EngineCanvas
          engineId={currentEngineId}
          telemetryList={telemetryList}
          throttlePercent={throttle}
          crankAngle={crankAngle}
          viewMode={viewMode}
          seeThroughMode={seeThroughMode}
          explodedProgress={explodedProgress}
          selectedComponentId={selectedComponentId}
          selectedCylinderId={selectedCylinderId}
          cameraPreset={cameraPreset}
          engineParams={engineParams}
          onSelectComponent={(id) => {
            setSelectedComponentId(id);
          }}
          onSelectCylinder={setSelectedCylinderId}
        />

        {/* Displacement Lab control (bore / stroke / total displacement) */}
        <DisplacementControl params={engineParams} onChange={handleSetEngineParams} />

        {/* Prominent High-Performance Tachometer Gauge Cluster */}
        <div className="absolute bottom-4 left-4 z-10 pointer-events-auto animate-in fade-in duration-300 flex flex-col gap-2 items-start">
          <div className="bg-slate-950/85 hover:bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-2 shadow-2xl transition-all flex flex-col items-center">
            <TachometerGauge
              rpm={rpm}
              size={196}
              maxRpm={engineCfg.tachMaxRpm}
              redlineRpm={engineCfg.redlineRpm}
              warningRpm={engineCfg.tachWarningRpm}
              gear={gear}
            />
            {/* Live Telemetry Speed & Drive Mode Sub-Bar */}
            <div className="w-full flex items-center justify-between px-2 pt-1 border-t border-slate-800/80 text-[10px] font-mono mt-0.5">
              <span className="text-slate-400">SPEED</span>
              <span className="text-sky-400 font-bold">{speedKmh.toFixed(0)} <span className="text-[9px] text-slate-500">KM/H</span></span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 uppercase font-semibold">{driveMode}</span>
            </div>
          </div>
        </div>

        {/* Modernized Floating Mini-HUD (Always visible when side drawers are closed) */}
        {!activePanel && (
          <div className="absolute top-3 right-3 z-10 animate-in fade-in duration-300 pointer-events-auto">
            <div className="bg-slate-900/85 hover:bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 shadow-2xl transition-all w-64 sm:w-72">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    Live Telemetry HUD
                  </span>
                </div>
                <span className="text-[9px] font-mono text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                  {gear === 'N' ? 'NEUTRAL' : gear === 'R' ? 'REVERSE' : `GEAR ${gear}`}
                </span>
              </div>

              {/* Digital Speed & RPM */}
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-400 block">RPM</span>
                  <span className="text-base font-bold font-mono text-white block mt-0.5">
                    {rpm.toFixed(0)}
                  </span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-400 block">ROAD SPEED</span>
                  <span className="text-base font-bold font-mono text-sky-400 block mt-0.5">
                    {speedKmh.toFixed(0)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                  </span>
                </div>
              </div>

              {/* Live Firing Cylinder & Pressure */}
              <div className="space-y-1 text-[11px] font-mono mb-2.5 bg-slate-950/50 p-2 rounded-lg border border-slate-800/40">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Selected Cyl:</span>
                  <span className="font-bold text-amber-300">Cyl #{selectedCylinderId}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Stroke:</span>
                  <span className="font-bold text-sky-400">{selectedCylinderTelemetry.stroke}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Pressure:</span>
                  <span className="font-bold text-emerald-400">{selectedCylinderTelemetry.pressureBar.toFixed(1)} bar</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Chamber Temp:</span>
                  <span className="font-bold text-orange-400">{(selectedCylinderTelemetry.tempKelvin - 273.15).toFixed(0)} °C</span>
                </div>
              </div>

              {/* Quick Drawer Expand Shortcuts */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => setActivePanel('control')}
                  className="flex-1 py-1 px-1.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-800/60 text-amber-300 hover:text-white text-[10px] font-bold transition text-center"
                >
                  Cockpit
                </button>
                <button
                  onClick={() => setActivePanel('thermo')}
                  className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold transition text-center"
                >
                  P-V
                </button>
                <button
                  onClick={() => setActivePanel('cylinders')}
                  className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold transition text-center"
                >
                  Matrix
                </button>
                <button
                  onClick={() => setActivePanel('inspector')}
                  className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold transition text-center"
                >
                  Specs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Mutually Exclusive Floating Panel (Right Side) */}
        {activePanel && (
          <aside className="absolute top-3 right-3 bottom-3 w-full max-w-md sm:max-w-lg bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl p-4 overflow-hidden z-20 animate-in fade-in slide-in-from-right-4 duration-200 flex flex-col">
            {/* Unified Drawer Header with Clear Close Button */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                {activePanel === 'control' && `Cockpit & ${engineCfg.gearCount}-Speed Gearbox`}
                {activePanel === 'thermo' && 'Thermodynamic P-V & T-S Analysis'}
                {activePanel === 'cylinders' && `${engineCfg.cylinderCount}-Cylinder Firing Radar`}
                {activePanel === 'lessons' && 'Guided Engineering Lessons'}
                {activePanel === 'diagnostics' && 'Engine Diagnostic Lab'}
                {activePanel === 'inspector' && 'Component Metallurgy & Specs'}
              </span>
              <button
                onClick={() => setActivePanel(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1 text-xs font-mono"
                title="Close Drawer (Uncrowd 3D Canvas)"
              >
                <X className="w-4 h-4" />
                <span className="text-[10px]">CLOSE</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {activePanel === 'control' && (
                <ControlGearboxPanel
                  engineId={currentEngineId}
                  isRunning={isRunning}
                  isStarting={isStarting}
                  onToggleStartStop={handleToggleStartStop}
                  rpm={rpm}
                  throttle={throttle}
                  speedKmh={speedKmh}
                  speedMph={speedMph}
                  gear={gear}
                  wheelTorqueNm={wheelTorqueNm}
                  bhp={bhp}
                  driveMode={driveMode}
                  onSetThrottle={setThrottle}
                  onSetBrake={setBrake}
                  onSelectGear={handleSelectGear}
                  onSetDriveMode={setDriveMode}
                />
              )}

              {activePanel === 'thermo' && (
                <ThermodynamicPanel
                  cylinder={selectedCylinderTelemetry}
                  rpm={rpm}
                  throttle={throttle}
                  activeFault={activeFault}
                  bhp={bhp}
                  totalTorqueLbFt={totalTorqueLbFt}
                  engineParams={engineParams}
                />
              )}

              {activePanel === 'cylinders' && (
                <CylinderMatrixPanel
                  engineId={currentEngineId}
                  cylinders={telemetryList}
                  selectedCylinderId={selectedCylinderId}
                  onSelectCylinder={setSelectedCylinderId}
                  onJumpToStroke={handleJumpToStroke}
                />
              )}

              {activePanel === 'lessons' && (
                <GuidedLessonsPanel onApplyLessonState={handleApplyLessonState} />
              )}

              {activePanel === 'diagnostics' && (
                <DiagnosticLabPanel
                  activeFault={activeFault}
                  onSetFault={setActiveFault}
                />
              )}

              {activePanel === 'inspector' && (
                <ComponentInspector
                  engineId={currentEngineId}
                  selectedComponentId={selectedComponentId}
                  onSelectComponent={setSelectedComponentId}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Docked Cockpit Control Center */}
      <ControlDock
        engineId={currentEngineId}
        isRunning={isRunning}
        isStarting={isStarting}
        rpm={rpm}
        throttle={throttle}
        crankAngle={crankAngle}
        speedMultiplier={speedMultiplier}
        viewMode={viewMode}
        seeThroughMode={seeThroughMode}
        explodedProgress={explodedProgress}
        soundEnabled={soundEnabled}
        cameraPreset={cameraPreset}
        onToggleStartStop={handleToggleStartStop}
        onSetThrottle={setThrottle}
        onSetCrankAngle={setCrankAngle}
        onSetSpeedMultiplier={setSpeedMultiplier}
        onSetViewMode={setViewMode}
        onSetSeeThroughMode={setSeeThroughMode}
        onSetExplodedProgress={setExplodedProgress}
        onToggleSound={handleToggleSound}
        onSelectCameraPreset={setCameraPreset}
      />
    </div>
  );
};

export default App;
