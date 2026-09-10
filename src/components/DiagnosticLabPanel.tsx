import React, { useState } from 'react';
import { DiagnosticFaultType, DiagnosticFault } from '../engine/types';
import { AlertTriangle, Wrench, CheckCircle2 } from 'lucide-react';

export const DIAGNOSTIC_FAULTS: Record<DiagnosticFaultType, DiagnosticFault> = {
  none: {
    id: 'none',
    name: 'Normal Engine Operation (Nominal)',
    category: 'Mechanical',
    severity: 'Low',
    description: 'All 8 cylinders firing normally in 1-8-4-3-6-5-7-2 order with clean spark timing, optimal 10.5:1 compression, and balanced torque output.',
    symptoms: ['Smooth continuous idle at 800 RPM', 'Peak combustion pressure ~85 bar at WOT', 'Clean exhaust gas temperature (~720 K)'],
    thermodynamicImpact: 'Nominal indicated thermal efficiency (~56.2% ideal, 34% brake indicated).',
    fixAction: 'No repairs necessary. Engine operating within factory tolerances.',
  },
  misfire_cyl3: {
    id: 'misfire_cyl3',
    name: 'Cylinder #3 Ignition Misfire',
    category: 'Ignition',
    severity: 'Medium',
    description: 'Defective ignition coil / fouled spark plug in Cylinder #3 fails to produce an electric arc. Air-fuel charge enters but is expelled unburnt.',
    symptoms: [
      'Audible rhythmic engine stutter / cyclic lope',
      'Cylinder 3 peak pressure drops from 85 bar to ~2 bar',
      'Cylinder 3 exhaust temperature drops to ambient (~340 K)',
      '12.5% loss of engine total indicated torque',
    ],
    thermodynamicImpact: 'No chemical heat addition (Q_in = 0 in Cyl 3). Pure motoring re-expansion consumes net indicated work.',
    fixAction: 'Replace defective high-voltage ignition coil pack and swap fouled iridium spark plug.',
  },
  valve_float: {
    id: 'valve_float',
    name: 'High-RPM Valvetrain Valve Float',
    category: 'Valvetrain',
    severity: 'Critical',
    description: 'At engine speeds above 4,800 RPM, the inertia of valves exceeds valve spring seat tension. Valves bounce off seats and fail to close completely.',
    symptoms: [
      'Sudden loss of high-RPM engine acceleration',
      'Fluttering mechanical rattle in cylinder heads',
      'Compression pressure drops by 35–45%',
      'Severe risk of valve-to-piston mechanical collision',
    ],
    thermodynamicImpact: 'Breached combustion chamber seal allows working fluid to leak during compression and expansion, destroying thermal efficiency.',
    fixAction: 'Install high-rate dual titanium beehive valve springs with lightweight titanium retainers.',
  },
  pre_ignition: {
    id: 'pre_ignition',
    name: 'Pre-Ignition Detonation (Engine Knock)',
    category: 'Combustion',
    severity: 'Critical',
    description: 'Hot glowing carbon deposits / inadequate fuel octane cause fuel-air mix in Cylinder #1 to auto-ignite ~40° before TDC, long before the spark plug fires.',
    symptoms: [
      'Violent metallic pinging / rattling acoustic resonance',
      'Catastrophic pressure spike >140 bar while piston is still rising',
      'Chamber temperature exceeds 2,900 K',
      'Extreme negative torque impulse acting against crankshaft rotation',
    ],
    thermodynamicImpact: 'Super-sonic shockwave batters piston crown and ring lands, causing severe thermal runaway and mechanical fatigue.',
    fixAction: 'De-carbonize combustion chamber, use 93+ AKI premium high-octane gasoline, and retard ignition timing.',
  },
  lean_mix: {
    id: 'lean_mix',
    name: 'Excessively Lean Air-Fuel Mixture (λ = 1.32)',
    category: 'Fueling',
    severity: 'Medium',
    description: 'Intake vacuum leak or clogged fuel injectors introduce excess air relative to fuel mass (λ > 1.3).',
    symptoms: [
      'Sluggish, delayed flame front propagation velocity',
      'Scorching exhaust gas temperatures (EGT > 1,150 K)',
      'Engine RPM surging and hesitation on throttle tip-in',
      'Potential backfire through intake manifold plenum',
    ],
    thermodynamicImpact: 'Slow burn velocity leads to late combustion where heat is released too late to generate optimal expansion work.',
    fixAction: 'Seal intake manifold runner gasket leak and recalibrate mass airflow (MAF) sensor & injector pulse width.',
  },
  blown_gasket: {
    id: 'blown_gasket',
    name: 'Blown Cylinder Head Gasket',
    category: 'Mechanical',
    severity: 'Critical',
    description: 'Fire ring breach between adjacent cylinders #1 and #3. High pressure bleeds freely between chambers and into the cooling jacket.',
    symptoms: [
      'Severe compression loss in both Cylinder #1 and #3',
      'White steam exhaust plume (coolant vaporized in combustion chamber)',
      'Pressurization of engine coolant expansion tank',
      'Rough running and engine overheating',
    ],
    thermodynamicImpact: 'Loss of effective compression ratio (drops from 10.5:1 to 4.5:1), dissipating cylinder enthalpy.',
    fixAction: 'Remove cylinder head, deck block surface for flatness, and install multi-layer steel (MLS) head gasket with ARP studs.',
  },
};

interface DiagnosticLabPanelProps {
  activeFault: DiagnosticFaultType;
  onSetFault: (fault: DiagnosticFaultType) => void;
}

export const DiagnosticLabPanel: React.FC<DiagnosticLabPanelProps> = ({
  activeFault,
  onSetFault,
}) => {
  const [challengeMode, setChallengeMode] = useState(false);
  const [targetFault, setTargetFault] = useState<DiagnosticFaultType>('none');
  const [selectedGuess, setSelectedGuess] = useState<DiagnosticFaultType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const faultList: DiagnosticFaultType[] = [
    'none',
    'misfire_cyl3',
    'valve_float',
    'pre_ignition',
    'lean_mix',
    'blown_gasket',
  ];

  const handleStartChallenge = () => {
    const candidates: DiagnosticFaultType[] = [
      'misfire_cyl3',
      'valve_float',
      'pre_ignition',
      'lean_mix',
      'blown_gasket',
    ];
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setTargetFault(picked);
    onSetFault(picked);
    setChallengeMode(true);
    setSelectedGuess(null);
    setFeedback(null);
  };

  const handleDiagnose = () => {
    if (!selectedGuess) return;
    if (selectedGuess === targetFault) {
      setFeedback('CORRECT! You accurately identified the malfunction based on thermodynamic telemetry and acoustic symptoms. Applying repair procedure...');
      setTimeout(() => {
        onSetFault('none');
        setFeedback('Engine repaired! All cylinders nominal.');
      }, 1800);
    } else {
      setFeedback('INCORRECT DIAGNOSIS. Compare cylinder pressures, exhaust gas temperatures, and acoustic feedback to pinpoint the root cause.');
    }
  };

  const activeData = DIAGNOSTIC_FAULTS[activeFault];

  return (
    <div className="flex flex-col gap-3 text-xs font-sans text-slate-200">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950/80 border border-indigo-800/60 rounded-lg p-3 flex items-center justify-between">
        <div>
          <span className="font-bold text-white text-sm block">Diagnostic Fault Challenge</span>
          <span className="text-[11px] text-slate-300">
            {challengeMode
              ? 'Blind fault active! Diagnose symptoms using live engine data.'
              : 'Test your mechanical diagnostics skills against simulated real-world faults.'}
          </span>
        </div>
        <button
          onClick={handleStartChallenge}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition text-[11px] shrink-0"
        >
          {challengeMode ? 'New Challenge' : 'Start Diagnostic Quiz'}
        </button>
      </div>

      {challengeMode && (
        <div className="bg-slate-900/95 border border-indigo-600/80 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Mystery Fault Detected: Analyze Telemetry & Select Diagnosis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {faultList
              .filter((f) => f !== 'none')
              .map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedGuess(f)}
                  className={`p-2 rounded border text-left transition text-[11px] ${
                    selectedGuess === f
                      ? 'bg-indigo-950 border-indigo-400 text-white font-semibold'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {DIAGNOSTIC_FAULTS[f].name}
                </button>
              ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setChallengeMode(false);
                onSetFault('none');
              }}
              className="text-slate-400 hover:text-white"
            >
              Exit Challenge
            </button>
            <button
              onClick={handleDiagnose}
              disabled={!selectedGuess}
              className="px-4 py-1.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-40 transition"
            >
              Submit Diagnosis
            </button>
          </div>

          {feedback && (
            <div
              className={`p-2.5 rounded text-[11px] font-medium border ${
                feedback.startsWith('CORRECT')
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                  : 'bg-red-950/60 border-red-700 text-red-300'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>
      )}

      {!challengeMode && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Inject Simulated Engine Faults
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {faultList.map((f) => {
              const data = DIAGNOSTIC_FAULTS[f];
              const isActive = activeFault === f;
              return (
                <button
                  key={f}
                  onClick={() => onSetFault(f)}
                  className={`p-2 rounded border text-left transition flex flex-col justify-between ${
                    isActive
                      ? f === 'none'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white'
                        : 'bg-red-950/60 border-red-500 text-white shadow-lg shadow-red-900/30'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="font-bold text-[11px] leading-tight block mb-1">
                    {data.name}
                  </span>
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded self-start ${
                      data.severity === 'Critical'
                        ? 'bg-red-900/80 text-red-200'
                        : data.severity === 'Medium'
                        ? 'bg-amber-900/80 text-amber-200'
                        : 'bg-emerald-900/80 text-emerald-200'
                    }`}
                  >
                    {data.category}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-3 mt-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {activeFault === 'none' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-white text-sm">{activeData.name}</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  activeData.severity === 'Critical'
                    ? 'bg-red-900 text-red-200'
                    : activeData.severity === 'Medium'
                    ? 'bg-amber-900 text-amber-200'
                    : 'bg-emerald-900 text-emerald-200'
                }`}
              >
                {activeData.severity} Severity
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">{activeData.description}</p>

            <div>
              <span className="font-semibold text-slate-400 block mb-1 text-[11px]">
                Observed Physical Symptoms:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                {activeData.symptoms.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-[11px]">
              <span className="font-semibold text-sky-400 block mb-0.5">Thermodynamic Analysis:</span>
              <p className="text-slate-300">{activeData.thermodynamicImpact}</p>
            </div>

            <div className="bg-amber-950/30 p-2.5 rounded border border-amber-900/60 text-[11px] flex items-start gap-2">
              <Wrench className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 block">Prescribed Repair Action:</span>
                <p className="text-amber-200/90 mt-0.5">{activeData.fixAction}</p>
              </div>
            </div>

            {activeFault !== 'none' && (
              <button
                onClick={() => onSetFault('none')}
                className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-white transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Execute Mechanical Repair & Restore Engine Health</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
