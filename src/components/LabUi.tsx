import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** Collapsible, clearly numbered section used throughout the Physics Engine Lab sidebar. */
export const LabSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-800/90">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-slate-100 hover:bg-slate-900/70 transition"
        title={open ? 'Collapse section' : 'Expand section'}
      >
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-2 text-[11px] font-mono">
          {badge}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </span>
      </button>
      {open && <div className="px-3 pb-3.5 pt-0.5 space-y-3">{children}</div>}
    </section>
  );
};

/** Labelled slider: name on the left, live value on the right, slider underneath. */
export const LabSlider: React.FC<{
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  /** Full tailwind accent class, e.g. "accent-sky-500" (must be a literal so Tailwind keeps it) */
  accent: string;
  valueClass?: string;
  disabled?: boolean;
  leftHint?: string;
  rightHint?: string;
}> = ({ label, valueText, min, max, step, value, onChange, accent, valueClass = 'text-slate-100', disabled, leftHint, rightHint }) => (
  <div className={disabled ? 'opacity-50' : ''}>
    <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
      <span className="text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`${valueClass} font-bold`}>{valueText}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer ${accent} disabled:cursor-not-allowed`}
    />
    {(leftHint || rightHint) && (
      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
        <span>{leftHint}</span>
        <span>{rightHint}</span>
      </div>
    )}
  </div>
);

/** Small read-only result tile. */
export const LabStat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1.5 min-w-0">
    <div className="text-[9px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
    <div className={`text-[13px] font-extrabold font-mono truncate ${tone}`}>{value}</div>
  </div>
);

/** Thin "label ........ value" row for secondary readouts. */
export const LabRow: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-200' }) => (
  <div className="flex items-center justify-between text-[10px] font-mono">
    <span className="text-slate-500">{label}</span>
    <span className={tone}>{value}</span>
  </div>
);
