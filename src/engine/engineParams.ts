/**
 * Shared, user-adjustable engine parameters for the Physics Engine Lab.
 *
 * One source of truth: the UI (sliders / dropdown) edits these values, and the
 * kinematics + thermodynamics code reads them. Defaults reproduce the original
 * hard-coded 2UR-GSE V8 numbers exactly, so nothing changes until a control
 * actually modifies a value.
 */

export type CylinderMaterialId = 'cast_iron' | 'aluminum_alloy' | 'forged_steel' | 'titanium';

export interface EngineParams {
  /** Cylinder bore (diameter), mm */
  boreMm: number;
  /** Piston stroke, mm. Crank throw radius = stroke / 2 */
  strokeMm: number;
  /** Heat input Q_in as a percentage of the baseline combustion energy (100 = original behaviour) */
  heatInputPct: number;
  /** Cylinder / block / piston material */
  material: CylinderMaterialId;
}

/** Fixed V8 constants that are NOT user-adjustable. */
export const V8_FIXED = {
  conRodLengthMm: 151.0,
  compressionRatio: 12.3,
  numCylinders: 8,
} as const;

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  boreMm: 94.0,
  strokeMm: 89.5,
  heatInputPct: 100,
  material: 'aluminum_alloy',
};

/** Slider limits, shared so the UI and the sanitiser agree. */
export const ENGINE_PARAM_LIMITS = {
  boreMm: { min: 80, max: 105, step: 0.5 },
  strokeMm: { min: 70, max: 105, step: 0.5 },
  heatInputPct: { min: 20, max: 150, step: 1 },
  /** Total engine displacement slider, litres (8 cylinders) */
  displacementL: { min: 3.5, max: 6.5, step: 0.05 },
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamp numeric params into their legal range (protects the physics from NaN / extreme values). */
export function sanitizeEngineParams(p: EngineParams): EngineParams {
  const L = ENGINE_PARAM_LIMITS;
  return {
    boreMm: Number.isFinite(p.boreMm) ? clamp(p.boreMm, L.boreMm.min, L.boreMm.max) : DEFAULT_ENGINE_PARAMS.boreMm,
    strokeMm: Number.isFinite(p.strokeMm)
      ? clamp(p.strokeMm, L.strokeMm.min, L.strokeMm.max)
      : DEFAULT_ENGINE_PARAMS.strokeMm,
    heatInputPct: Number.isFinite(p.heatInputPct)
      ? clamp(p.heatInputPct, L.heatInputPct.min, L.heatInputPct.max)
      : DEFAULT_ENGINE_PARAMS.heatInputPct,
    material: p.material,
  };
}

export interface DerivedGeometry {
  boreMm: number;
  strokeMm: number;
  crankRadiusMm: number;
  conRodLengthMm: number;
  /** lambda = r / l */
  rodToCrankRatio: number;
  compressionRatio: number;
  numCylinders: number;
  pistonAreaCm2: number;
  displacementPerCylCc: number;
  totalDisplacementCc: number;
  clearanceVolumeCc: number;
}

/** Everything that follows from bore + stroke (compression ratio and rod length stay fixed). */
export function getDerivedGeometry(params: EngineParams = DEFAULT_ENGINE_PARAMS): DerivedGeometry {
  const { boreMm, strokeMm } = params;
  const crankRadiusMm = strokeMm / 2;
  // Deck height is fixed by the block, so rod length + crank throw stays constant
  // (like a real stroker kit with a different rod / piston compression height).
  // At the default stroke this is exactly 151 mm.
  const conRodLengthMm = V8_FIXED.conRodLengthMm + DEFAULT_ENGINE_PARAMS.strokeMm / 2 - crankRadiusMm;
  const pistonAreaCm2 = Math.PI * Math.pow(boreMm / 20, 2);
  const displacementPerCylCc = pistonAreaCm2 * (strokeMm / 10);
  return {
    boreMm,
    strokeMm,
    crankRadiusMm,
    conRodLengthMm,
    rodToCrankRatio: crankRadiusMm / conRodLengthMm,
    compressionRatio: V8_FIXED.compressionRatio,
    numCylinders: V8_FIXED.numCylinders,
    pistonAreaCm2,
    displacementPerCylCc,
    totalDisplacementCc: displacementPerCylCc * V8_FIXED.numCylinders,
    clearanceVolumeCc: displacementPerCylCc / (V8_FIXED.compressionRatio - 1),
  };
}

/** Total engine displacement in litres for the given params. */
export function getTotalDisplacementL(params: EngineParams): number {
  return getDerivedGeometry(params).totalDisplacementCc / 1000;
}

/**
 * Returns new bore + stroke that give the requested total displacement while keeping the
 * current bore/stroke ratio (both scale by the same factor). Result is clamped to legal limits.
 */
export function withDisplacement(params: EngineParams, litres: number): Pick<EngineParams, 'boreMm' | 'strokeMm'> {
  const current = getTotalDisplacementL(params);
  const k = Math.cbrt(litres / current);
  const next = sanitizeEngineParams({ ...params, boreMm: params.boreMm * k, strokeMm: params.strokeMm * k });
  return { boreMm: next.boreMm, strokeMm: next.strokeMm };
}
