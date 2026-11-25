import React, { useEffect, useMemo, useRef } from 'react';
import { CylinderTelemetry, DiagnosticFaultType } from '../engine/types';
import { generateReferenceOttoCycle, getCycleSummary } from '../engine/thermodynamics';
import { getCylinderMaterial } from '../engine/cylinderMaterials';
import { EngineParams, DEFAULT_ENGINE_PARAMS, getDerivedGeometry } from '../engine/engineParams';
import { Activity, Gauge, Flame, Zap, HelpCircle } from 'lucide-react';
import katex from 'katex';

interface ThermodynamicPanelProps {
  cylinder: CylinderTelemetry;
  rpm: number;
  throttle: number;
  activeFault: DiagnosticFaultType;
  bhp: number;
  totalTorqueLbFt: number;
  engineParams?: EngineParams;
}

export const ThermodynamicPanel: React.FC<ThermodynamicPanelProps> = ({
  cylinder,
  rpm,
  throttle,
  activeFault,
  bhp,
  totalTorqueLbFt,
  engineParams = DEFAULT_ENGINE_PARAMS,
}) => {
  const pvCanvasRef = useRef<HTMLCanvasElement>(null);
  const summary = useMemo(
    () => getCycleSummary(throttle, activeFault, engineParams),
    [throttle, activeFault, engineParams]
  );
  const tsCanvasRef = useRef<HTMLCanvasElement>(null);

  const formulaEtaRef = useRef<HTMLDivElement>(null);
  const formulaWorkRef = useRef<HTMLDivElement>(null);
  const formulaBhpRef = useRef<HTMLDivElement>(null);
  const formulaTorqueRef = useRef<HTMLDivElement>(null);
  const formulaQinRef = useRef<HTMLDivElement>(null);
  const formulaWallRef = useRef<HTMLDivElement>(null);

  const geoNow = getDerivedGeometry(engineParams);

  // Render KaTeX Math
  useEffect(() => {
    if (formulaEtaRef.current) {
      katex.render(
        `\\eta_{th} = 1 - \\frac{1}{r_c^{\\gamma - 1}} = 1 - \\frac{1}{${geoNow.compressionRatio.toFixed(1)}^{0.35}} \\approx ${(summary.etaOtto * 100).toFixed(1)}\\%`,
        formulaEtaRef.current,
        { throwOnError: false }
      );
    }
    if (formulaWorkRef.current) {
      katex.render(
        `W_{net} = \\oint P \\, dv = Q_{in} - Q_{out}`,
        formulaWorkRef.current,
        { throwOnError: false }
      );
    }
    if (formulaBhpRef.current) {
      katex.render(
        `\\text{BHP} = \\frac{\\tau \\times \\text{RPM}}{5252} = \\frac{${totalTorqueLbFt.toFixed(0)} \\times ${rpm.toFixed(0)}}{5252} = ${bhp.toFixed(1)} \\text{ hp}`,
        formulaBhpRef.current,
        { throwOnError: false }
      );
    }
    if (formulaWallRef.current) {
      const w = summary.wall;
      katex.render(
        `q'' = \\frac{T_{g} - T_{c}}{\\frac{1}{h_g} + \\frac{t}{k} + \\frac{1}{h_c}} = ${w.heatFluxKWm2.toFixed(0)}\\,\\text{kW/m}^2 \\qquad T_{wall} = T_g - \\frac{q''}{h_g} = ${w.wallTempK.toFixed(0)}\\,\\text{K} \\;(k = ${w.conductivityWmK}\\,\\text{W/m·K})`,
        formulaWallRef.current,
        { throwOnError: false }
      );
    }
    if (formulaQinRef.current) {
      katex.render(
        `\\eta_{ind} = \\eta_{th}(1 - f_{loss}) = ${summary.etaOtto.toFixed(3)} \\times (1 - ${summary.lossFraction.toFixed(3)}) = ${(summary.etaIndicated * 100).toFixed(1)}\\% \\qquad W_{net} = \\eta_{ind} Q_{in} = ${summary.netWorkJ.toFixed(0)}\\,\\text{J}`,
        formulaQinRef.current,
        { throwOnError: false }
      );
    }
    if (formulaTorqueRef.current) {
      katex.render(
        `\\tau(\\theta) = F_{gas}(\\theta) \\cdot r \\left( \\sin\\theta + \\frac{\\lambda \\sin 2\\theta}{2\\sqrt{1-\\lambda^2\\sin^2\\theta}} \\right)`,
        formulaTorqueRef.current,
        { throwOnError: false }
      );
    }
  }, [rpm, bhp, totalTorqueLbFt, summary, geoNow.compressionRatio]);

  // Render P-v and T-s Diagrams with enhanced graphics
  useEffect(() => {
    const pvCanvas = pvCanvasRef.current;
    const tsCanvas = tsCanvasRef.current;
    if (!pvCanvas || !tsCanvas) return;

    const pvCtx = pvCanvas.getContext('2d');
    const tsCtx = tsCanvas.getContext('2d');
    if (!pvCtx || !tsCtx) return;

    const w = pvCanvas.width;
    const h = pvCanvas.height;
    const margin = { top: 22, right: 24, bottom: 28, left: 42 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    const refCycle = generateReferenceOttoCycle(throttle, activeFault, engineParams);

    // ==========================================
    // 1. DRAW ENHANCED P-v DIAGRAM
    // ==========================================
    pvCtx.clearRect(0, 0, w, h);

    // High-tech dark oscilloscope background grid
    pvCtx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
    pvCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (plotH * i) / 4;
      pvCtx.beginPath();
      pvCtx.moveTo(margin.left, y);
      pvCtx.lineTo(margin.left + plotW, y);
      pvCtx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = margin.left + (plotW * i) / 4;
      pvCtx.beginPath();
      pvCtx.moveTo(x, margin.top);
      pvCtx.lineTo(x, margin.top + plotH);
      pvCtx.stroke();
    }

    // Axes
    pvCtx.strokeStyle = '#475569';
    pvCtx.lineWidth = 1.5;
    pvCtx.beginPath();
    pvCtx.moveTo(margin.left, margin.top - 4);
    pvCtx.lineTo(margin.left, margin.top + plotH);
    pvCtx.lineTo(margin.left + plotW + 6, margin.top + plotH);
    pvCtx.stroke();

    // Axis Labels
    pvCtx.fillStyle = '#94a3b8';
    pvCtx.font = '10px ui-monospace, monospace';
    pvCtx.textAlign = 'right';
    pvCtx.fillText('P (bar)', margin.left - 6, margin.top + 8);
    pvCtx.textAlign = 'center';
    pvCtx.fillText('Volume V (cc)', margin.left + plotW / 2, h - 8);

    const geo = getDerivedGeometry(engineParams);
    const minV = geo.clearanceVolumeCc;
    const maxV = minV + geo.displacementPerCylCc;
    const maxP = Math.max(90, cylinder.pressureBar * 1.15);

    const mapX = (v: number) => margin.left + ((v - minV) / (maxV - minV)) * plotW;
    const mapY = (p: number) => margin.top + plotH - (p / maxP) * plotH;

    // P-v Otto Curve Path
    pvCtx.beginPath();
    refCycle.forEach((pt, i) => {
      const x = mapX(pt.volumeCc);
      const y = mapY(pt.pressureBar);
      if (i === 0) pvCtx.moveTo(x, y);
      else pvCtx.lineTo(x, y);
    });
    pvCtx.closePath();

    // Luminous Area Gradient Fill
    const pvGrad = pvCtx.createLinearGradient(0, margin.top, 0, margin.top + plotH);
    pvGrad.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
    pvGrad.addColorStop(1, 'rgba(14, 165, 233, 0.02)');
    pvCtx.fillStyle = pvGrad;
    pvCtx.fill();

    // Luminous Stroke
    pvCtx.strokeStyle = '#38bdf8';
    pvCtx.lineWidth = 2.5;
    pvCtx.shadowColor = '#0284c7';
    pvCtx.shadowBlur = 8;
    pvCtx.stroke();
    pvCtx.shadowBlur = 0;

    // Numbered Otto Stage Milestone Badges on P-v curve
    const milestoneIndices = [
      { num: '1', label: 'BDC', idx: 0, align: 'left' },
      { num: '2', label: 'TDC Comp', idx: 5, align: 'right' },
      { num: '3', label: 'Spark Peak', idx: 6, align: 'right' },
      { num: '4', label: 'Blowdown', idx: 11, align: 'left' },
    ];

    milestoneIndices.forEach((m) => {
      if (refCycle[m.idx]) {
        const mx = mapX(refCycle[m.idx].volumeCc);
        const my = mapY(refCycle[m.idx].pressureBar);
        pvCtx.fillStyle = '#0f172a';
        pvCtx.beginPath();
        pvCtx.arc(mx, my, 6, 0, Math.PI * 2);
        pvCtx.fill();
        pvCtx.strokeStyle = '#38bdf8';
        pvCtx.lineWidth = 1.5;
        pvCtx.stroke();
        pvCtx.fillStyle = '#38bdf8';
        pvCtx.font = 'bold 8px sans-serif';
        pvCtx.textAlign = 'center';
        pvCtx.fillText(m.num, mx, my + 3);
      }
    });

    // Current Operating Point Tracer with pulsating halo
    const curX = mapX(cylinder.cylinderVolumeCc);
    const curY = mapY(cylinder.pressureBar);

    pvCtx.beginPath();
    pvCtx.arc(curX, curY, 8, 0, Math.PI * 2);
    pvCtx.fillStyle =
      cylinder.stroke === 'Power'
        ? 'rgba(239, 68, 68, 0.4)'
        : cylinder.stroke === 'Compression'
        ? 'rgba(245, 158, 11, 0.4)'
        : 'rgba(56, 189, 248, 0.4)';
    pvCtx.fill();

    pvCtx.beginPath();
    pvCtx.arc(curX, curY, 4.5, 0, Math.PI * 2);
    pvCtx.fillStyle =
      cylinder.stroke === 'Power'
        ? '#ef4444'
        : cylinder.stroke === 'Compression'
        ? '#f59e0b'
        : '#38bdf8';
    pvCtx.shadowColor = pvCtx.fillStyle;
    pvCtx.shadowBlur = 14;
    pvCtx.fill();
    pvCtx.shadowBlur = 0;

    // ==========================================
    // 2. DRAW ENHANCED T-s DIAGRAM
    // ==========================================
    tsCtx.clearRect(0, 0, w, h);

    // Oscilloscope grid
    tsCtx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
    tsCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (plotH * i) / 4;
      tsCtx.beginPath();
      tsCtx.moveTo(margin.left, y);
      tsCtx.lineTo(margin.left + plotW, y);
      tsCtx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = margin.left + (plotW * i) / 4;
      tsCtx.beginPath();
      tsCtx.moveTo(x, margin.top);
      tsCtx.lineTo(x, margin.top + plotH);
      tsCtx.stroke();
    }

    // Axes
    tsCtx.strokeStyle = '#475569';
    tsCtx.lineWidth = 1.5;
    tsCtx.beginPath();
    tsCtx.moveTo(margin.left, margin.top - 4);
    tsCtx.lineTo(margin.left, margin.top + plotH);
    tsCtx.lineTo(margin.left + plotW + 6, margin.top + plotH);
    tsCtx.stroke();

    // Axis Labels
    tsCtx.fillStyle = '#94a3b8';
    tsCtx.font = '10px ui-monospace, monospace';
    tsCtx.textAlign = 'right';
    tsCtx.fillText('T (K)', margin.left - 6, margin.top + 8);
    tsCtx.textAlign = 'center';
    tsCtx.fillText('Entropy s (kJ/kg·K)', margin.left + plotW / 2, h - 8);

    const maxS = 3.5;
    const maxT = 2900;

    const mapSX = (s: number) => margin.left + (s / maxS) * plotW;
    const mapTY = (t: number) => margin.top + plotH - (t / maxT) * plotH;

    // T-s Otto Curve Path
    tsCtx.beginPath();
    refCycle.forEach((pt, i) => {
      const x = mapSX(pt.entropy);
      const y = mapTY(pt.tempKelvin);
      if (i === 0) tsCtx.moveTo(x, y);
      else tsCtx.lineTo(x, y);
    });
    tsCtx.closePath();

    // Luminous Amber Gradient Area Fill
    const tsGrad = tsCtx.createLinearGradient(0, margin.top, 0, margin.top + plotH);
    tsGrad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    tsGrad.addColorStop(1, 'rgba(245, 158, 11, 0.02)');
    tsCtx.fillStyle = tsGrad;
    tsCtx.fill();

    // Luminous Stroke
    tsCtx.strokeStyle = '#f59e0b';
    tsCtx.lineWidth = 2.5;
    tsCtx.shadowColor = '#d97706';
    tsCtx.shadowBlur = 8;
    tsCtx.stroke();
    tsCtx.shadowBlur = 0;

    // Numbered Otto Stage Milestone Badges on T-s curve
    milestoneIndices.forEach((m) => {
      if (refCycle[m.idx]) {
        const mx = mapSX(refCycle[m.idx].entropy);
        const my = mapTY(refCycle[m.idx].tempKelvin);
        tsCtx.fillStyle = '#0f172a';
        tsCtx.beginPath();
        tsCtx.arc(mx, my, 6, 0, Math.PI * 2);
        tsCtx.fill();
        tsCtx.strokeStyle = '#f59e0b';
        tsCtx.lineWidth = 1.5;
        tsCtx.stroke();
        tsCtx.fillStyle = '#f59e0b';
        tsCtx.font = 'bold 8px sans-serif';
        tsCtx.textAlign = 'center';
        tsCtx.fillText(m.num, mx, my + 3);
      }
    });

    // Current Operating Point Tracer on T-s
    const curS =
      1.0 * Math.log(cylinder.tempKelvin / 300) +
      0.287 * Math.log(cylinder.cylinderVolumeCc / minV);
    const curTsX = mapSX(curS);
    const curTsY = mapTY(cylinder.tempKelvin);

    tsCtx.beginPath();
    tsCtx.arc(curTsX, curTsY, 8, 0, Math.PI * 2);
    tsCtx.fillStyle = cylinder.stroke === 'Power' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)';
    tsCtx.fill();

    tsCtx.beginPath();
    tsCtx.arc(curTsX, curTsY, 4.5, 0, Math.PI * 2);
    tsCtx.fillStyle = cylinder.stroke === 'Power' ? '#ef4444' : '#f59e0b';
    tsCtx.shadowColor = tsCtx.fillStyle;
    tsCtx.shadowBlur = 14;
    tsCtx.fill();
    tsCtx.shadowBlur = 0;
  }, [cylinder, throttle, activeFault, engineParams]);

  return (
    <div className="flex flex-col gap-4 text-xs font-sans text-slate-200">
      {/* Real-time Dynamic Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Chamber Pressure */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-medium text-[11px]">Cyl #{cylinder.id} Press</span>
            <Gauge className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
              {cylinder.pressureBar.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">bar</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{(cylinder.pressureBar * 14.5038).toFixed(0)} psi</span>
            <span className="text-sky-400 font-semibold">{cylinder.pressureBar > 50 ? 'PEAK' : 'NOM'}</span>
          </div>
        </div>

        {/* Chamber Temperature */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-medium text-[11px]">Chamber Temp</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-amber-300 tracking-tight">
              {cylinder.tempKelvin.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">K</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            {(cylinder.tempKelvin - 273.15).toFixed(0)} °C
          </div>
        </div>

        {/* Engine Brake Output */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-medium text-[11px]">Brake Power</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-emerald-300 tracking-tight">
              {bhp.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">BHP</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            {totalTorqueLbFt.toFixed(0)} lb-ft Torque
          </div>
        </div>

        {/* Cycle Phase & Volume */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-medium text-[11px]">Cycle Stage</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-1">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block border ${
                cylinder.stroke === 'Power'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : cylinder.stroke === 'Compression'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : cylinder.stroke === 'Intake'
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {cylinder.stroke}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            θ = {cylinder.crankAngle.toFixed(0)}° ({cylinder.cylinderVolumeCc.toFixed(0)} cc)
          </div>
        </div>
      </div>

      {/* Luminous P-v and T-s Diagrams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* P-v Canvas Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sky-300 flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400" />
              P–v Indicator Diagram
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              V: {cylinder.cylinderVolumeCc.toFixed(0)} cc
            </span>
          </div>
          <canvas
            ref={pvCanvasRef}
            width={300}
            height={170}
            className="w-full h-44 rounded-lg bg-[#070b14] border border-slate-800"
          />
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1.5 px-1">
            <span>① BDC Intake</span>
            <span>② TDC Comp</span>
            <span>③ Spark Peak</span>
            <span>④ Blowdown</span>
          </div>
        </div>

        {/* T-s Canvas Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400" />
              T–s Thermodynamic Diagram
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              T: {cylinder.tempKelvin.toFixed(0)} K
            </span>
          </div>
          <canvas
            ref={tsCanvasRef}
            width={300}
            height={170}
            className="w-full h-44 rounded-lg bg-[#070b14] border border-slate-800"
          />
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1.5 px-1">
            <span>① 300 K</span>
            <span>② 820 K (s=c)</span>
            <span>③ 2650 K</span>
            <span>④ 1350 K (s=c)</span>
          </div>
        </div>
      </div>

      {/* Heat Input & Cycle Efficiency (driven by the Heat Input slider) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between text-slate-200 font-bold border-b border-slate-800 pb-2 mb-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            Heat Input &amp; Cycle Efficiency
          </span>
          <span className="font-mono text-[10px] text-amber-300">Q_in = {engineParams.heatInputPct.toFixed(0)}% of baseline</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
          {[
            { label: 'Q_in / cyl / cycle', value: `${summary.qInJ.toFixed(0)} J`, tone: 'text-slate-100' },
            { label: 'Peak temperature', value: `${summary.peakTempK.toFixed(0)} K`, tone: 'text-amber-300' },
            { label: 'Peak pressure', value: `${summary.peakPressureBar.toFixed(0)} bar`, tone: 'text-sky-300' },
            { label: 'Thermal efficiency', value: `${(summary.etaIndicated * 100).toFixed(1)} %`, tone: 'text-emerald-300' },
            { label: 'Net work / cycle', value: `${summary.netWorkJ.toFixed(0)} J`, tone: 'text-slate-100' },
          ].map((m) => (
            <div key={m.label} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">{m.label}</div>
              <div className={`text-sm font-extrabold ${m.tone}`}>{m.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono mt-2">
          {[
            { label: 'Cylinder material', value: getCylinderMaterial(engineParams.material).label, tone: 'text-violet-300' },
            { label: 'Conductivity k', value: `${summary.wall.conductivityWmK} W/m·K`, tone: 'text-slate-100' },
            {
              label: 'Wall temperature',
              value: `${summary.wall.wallTempK.toFixed(0)} K`,
              tone:
                summary.wall.status === 'overheat'
                  ? 'text-red-400'
                  : summary.wall.status === 'hot'
                    ? 'text-amber-300'
                    : 'text-emerald-300',
            },
            {
              label: `Margin to ${summary.wall.maxServiceTempK} K limit`,
              value: `${summary.wall.marginK >= 0 ? '+' : ''}${summary.wall.marginK.toFixed(0)} K`,
              tone:
                summary.wall.status === 'overheat'
                  ? 'text-red-400'
                  : summary.wall.status === 'hot'
                    ? 'text-amber-300'
                    : 'text-emerald-300',
            },
          ].map((m) => (
            <div key={m.label} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">{m.label}</div>
              <div className={`text-sm font-extrabold ${m.tone}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KaTeX Mathematical Formulations Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-lg">
        <div className="flex items-center gap-1.5 text-slate-200 font-bold border-b border-slate-800 pb-2 text-xs">
          <HelpCircle className="w-4 h-4 text-sky-400" />
          <span>Thermodynamic & Kinematic Mathematical Formulations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
          <div className="sm:col-span-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Cylinder Wall Heat Conduction (Fourier)</span>
              <span className="text-[9px] font-mono text-violet-400">material sets k</span>
            </div>
            <div ref={formulaWallRef} className="text-violet-300 overflow-x-auto py-1" />
          </div>

          <div className="sm:col-span-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Indicated Efficiency with Heat Loss</span>
              <span className="text-[9px] font-mono text-amber-400">hotter gas → more wall loss</span>
            </div>
            <div ref={formulaQinRef} className="text-amber-300 overflow-x-auto py-1" />
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Thermal Efficiency (η_th)</span>
              <span className="text-[9px] font-mono text-sky-400">r_c = {geoNow.compressionRatio.toFixed(1)}</span>
            </div>
            <div ref={formulaEtaRef} className="text-sky-300 overflow-x-auto py-1" />
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Enclosed Net Work (W_net)</span>
              <span className="text-[9px] font-mono text-emerald-400">Area \oint P dv</span>
            </div>
            <div ref={formulaWorkRef} className="text-emerald-300 overflow-x-auto py-1" />
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Brake Horsepower Equation</span>
              <span className="text-[9px] font-mono text-indigo-400">Imperial 5252 const</span>
            </div>
            <div ref={formulaBhpRef} className="text-indigo-300 overflow-x-auto py-1" />
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-medium">Slider-Crank Torque Function</span>
              <span className="text-[9px] font-mono text-amber-400">λ = r/l = {geoNow.rodToCrankRatio.toFixed(3)}</span>
            </div>
            <div ref={formulaTorqueRef} className="text-amber-300 overflow-x-auto py-1" />
          </div>
        </div>
      </div>
    </div>
  );
};