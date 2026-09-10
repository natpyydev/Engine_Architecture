import React, { useState } from 'react';
import { ViewMode } from '../engine/types';
import { ChevronRight, ChevronLeft, Eye, Sparkles } from 'lucide-react';

interface LessonStep {
  id: number;
  title: string;
  subtitle: string;
  cameraPreset: string;
  viewMode: ViewMode;
  targetComponent: string | null;
  targetCylinder: number;
  content: string[];
  keyTakeaway: string;
}

const LESSONS: LessonStep[] = [
  {
    id: 1,
    title: 'Anatomy of the 90° Flat-Plane European V8',
    subtitle: 'V-Architecture, High-Revving Symmetrical Layout & Supercar Engineering',
    cameraPreset: 'isometric',
    viewMode: 'normal',
    targetComponent: 'engine_block',
    targetCylinder: 1,
    content: [
      'A 90-degree V8 supercar engine arranges 8 combustion cylinders into two opposing banks of 4 cylinders each, angled at 90 degrees.',
      'Bank 1 (Left bank) contains cylinders 1, 3, 5, and 7. Bank 2 (Right bank) contains cylinders 2, 4, 6, and 8.',
      'Equipped with a lightweight 180-degree flat-plane crankshaft and short 82.0 mm stroke, this engine is engineered for low rotational inertia and screams all the way to 8,500+ RPM, generating 720 BHP!',
    ],
    keyTakeaway: 'The 180° single-plane layout combined with knife-edged counterweights minimizes rotational inertia, enabling lightning-quick throttle response.',
  },
  {
    id: 2,
    title: 'The Four-Stroke Otto Thermodynamic Cycle',
    subtitle: 'Intake, Compression, Power, and Exhaust (720° Total Rotation)',
    cameraPreset: 'cyl1',
    viewMode: 'cutaway',
    targetComponent: 'piston',
    targetCylinder: 1,
    content: [
      'Every cylinder completes one full operational thermodynamic cycle every two complete crankshaft rotations (720° of crank angle θ).',
      '1. Intake (0°–180°): Piston retreats toward BDC while the intake valve opens, drawing boosted twin-turbo charge into the cylinder.',
      '2. Compression (180°–360°): Both valves seal tightly. Piston rises toward TDC, compressing the trapped volume by a ratio of 9.6:1 and raising gas temperature to ~800 K.',
      '3. Power (360°–540°): Spark plug ignites charge ~15° BTDC. Violent chemical deflagration creates peak pressure up to 135 bar (1,960 psi), driving the piston down.',
      '4. Exhaust (540°–720°): Exhaust valve opens. Rising piston purges spent combustion gases into the header runners.',
    ],
    keyTakeaway: 'Only one of the four strokes (the Power stroke) generates positive mechanical work; the other three strokes consume stored flywheel inertia.',
  },
  {
    id: 3,
    title: '180° Flat-Plane Crankshaft Dynamics',
    subtitle: 'Why European Supercar V8s Scream with High-Pitched Acoustic Fury',
    cameraPreset: 'crankshaft',
    viewMode: 'cutaway',
    targetComponent: 'crankshaft',
    targetCylinder: 1,
    content: [
      'In a 180° flat-plane crankshaft, all four crankpins lie in a single plane: Throws 1 & 4 at 0°, Throws 2 & 3 at 180°.',
      'Cylinders fire every 90° in the firing sequence 1-8-5-4-7-2-3-6. Notice the bank alternation: Left - Right - Left - Right - Left - Right - Left - Right.',
      'Because exhaust pulses alternate banks with perfect 180° separation per bank, there is zero pulse interference in the headers. This permits optimal acoustic scavenging and produces the spine-tingling high-pitched scream of Ferrari and McLaren supercars!',
      'The single-plane design requires much smaller counterweights than crossplane cranks, dramatically reducing rotational inertia for razor-sharp rev response all the way to 8,500+ RPM and 720 BHP.',
    ],
    keyTakeaway: 'The 180° single-plane layout creates strictly alternating bank pulses and minimal inertia, delivering 720 BHP and an unmistakable high-frequency scream.',
  },
  {
    id: 4,
    title: 'Valvetrain & Gas Exchange Dynamics',
    subtitle: 'Camshaft Timing, Valve Lift, and Volumetric Efficiency',
    cameraPreset: 'top',
    viewMode: 'cutaway',
    targetComponent: 'camshaft',
    targetCylinder: 1,
    content: [
      'The Double Overhead Camshafts (DOHC) spin at exactly half the crankshaft speed (ω_cam = ω_crank / 2) because a four-stroke cycle takes two crank revolutions.',
      'Intake and exhaust valve lift follows smooth cam lobe profiles with up to 11.5 mm gross lift. Springs provide over 300 lbf of seat force to snap valves closed.',
      'Valve Overlap: Near TDC between exhaust and intake strokes (around 350°–370°), both valves are open simultaneously. The escaping exhaust pulse creates a low-pressure wave that draws fresh intake charge into the cylinder (acoustic scavenging).',
    ],
    keyTakeaway: 'Optimal valve timing and overlap maximize volumetric efficiency (VE), allowing the engine to ingest more air-fuel mass than its static displacement at high RPM.',
  },
  {
    id: 5,
    title: 'Combustion Physics & Flame Propagation',
    subtitle: 'Spark Timing, Turbulent Flame Kernel, and Pressure Rise',
    cameraPreset: 'cyl1',
    viewMode: 'kinetic',
    targetComponent: 'spark_plug',
    targetCylinder: 1,
    content: [
      'Combustion in a gasoline engine is not an instant explosion; it is a controlled turbulent deflagration flame front advancing at 20–35 meters per second.',
      'Ignition Timing Advance: Because the flame front takes approximately 1.5 milliseconds to sweep across the 92 mm bore, spark must occur 15°–25° before TDC so peak cylinder pressure occurs at ~15° after TDC (where mechanical leverage on the crank is highest).',
      'Stoichiometric Fuel Ratio: The ideal chemical ratio is λ = 1.0 (14.7 kg of air per 1.0 kg of gasoline). Rich mixtures (λ = 0.88) increase flame speed for max power; lean mixtures (λ > 1.1) cause slower burns and excessive exhaust heat.',
    ],
    keyTakeaway: 'Spark advance ensures peak combustion pressure (70–95 bar) coincides with optimal crankshaft moment arm leverage (~15° ATDC).',
  },
  {
    id: 6,
    title: 'Kinetic Energy Transfer & Flywheel Inertia',
    subtitle: 'Converting Reciprocating Gas Force into Smooth Rotational Torque',
    cameraPreset: 'side_bank1',
    viewMode: 'kinetic',
    targetComponent: 'flywheel',
    targetCylinder: 1,
    content: [
      'Force path: High-pressure combustion gas (P) acts on the piston crown area (A), creating downward thrust F_piston = P × A (up to 63 kN or 14,000 lbf!).',
      'The wrist pin transfers force into the connecting rod. Because the rod tilts at angle β, it creates both a downward compressive force along the rod and a lateral side-thrust against the cylinder wall.',
      'At the crankpin, the rod force resolves into a tangential component perpendicular to the crank throw radius r, generating instantaneous torque: τ(θ) = F_tangential × r.',
      'The massive steel flywheel stores surplus kinetic energy during power pulses and smoothly releases it during compression strokes, ensuring seamless continuous vehicle propulsion.',
    ],
    keyTakeaway: 'The flywheel moment of inertia (J) smooths the eight discrete cyclic power impulses into silky continuous rotational torque.',
  },
];

interface GuidedLessonsPanelProps {
  onApplyLessonState: (
    cameraPreset: string,
    viewMode: ViewMode,
    componentId: string | null,
    cylinderId: number
  ) => void;
}

export const GuidedLessonsPanel: React.FC<GuidedLessonsPanelProps> = ({
  onApplyLessonState,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const lesson = LESSONS[currentIdx];

  const handleSelectLesson = (idx: number) => {
    setCurrentIdx(idx);
    const target = LESSONS[idx];
    onApplyLessonState(
      target.cameraPreset,
      target.viewMode,
      target.targetComponent,
      target.targetCylinder
    );
  };

  const handleNext = () => {
    if (currentIdx < LESSONS.length - 1) {
      handleSelectLesson(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      handleSelectLesson(currentIdx - 1);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-xs font-sans text-slate-200">
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {LESSONS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => handleSelectLesson(i)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition shrink-0 ${
              i === currentIdx
                ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-500/20'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            Ch {l.id}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-3">
        <div>
          <div className="flex items-center justify-between text-sky-400 font-mono text-[10px]">
            <span>CHAPTER {lesson.id} OF {LESSONS.length}</span>
            <span className="bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
              Interactive Viewport Synced
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-1">{lesson.title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{lesson.subtitle}</p>
        </div>

        <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
          {lesson.content.map((p, pIdx) => (
            <p key={pIdx} className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
              {p}
            </p>
          ))}
        </div>

        <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300 block text-[11px]">Engineering Key Takeaway</span>
            <p className="text-[10px] text-amber-200/90 mt-0.5">{lesson.keyTakeaway}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            onClick={() =>
              onApplyLessonState(
                lesson.cameraPreset,
                lesson.viewMode,
                lesson.targetComponent,
                lesson.targetCylinder
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-950 border border-sky-700 text-sky-300 hover:bg-sky-900 transition font-semibold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Align Camera & View</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentIdx === LESSONS.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 border border-sky-500 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold transition"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
