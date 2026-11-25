import { DiagnosticFaultType } from './types';
import { EngineParams, DEFAULT_ENGINE_PARAMS, getDerivedGeometry } from './engineParams';
import { getCylinderMaterial, CYLINDER_MATERIALS } from './cylinderMaterials';

export interface ThermoResult {
  pressureBar: number;
  tempKelvin: number;
  torqueNm: number;
  faultNote?: string;
}

export interface CyclePoint {
  crankDeg: number;
  volumeCc: number;
  pressureBar: number;
  tempKelvin: number;
  entropy: number;
}

/**
 * Combustion / heat-input model constants.
 * Heat input is expressed as a % of the baseline fuel energy (100 % = original behaviour).
 * Constant-volume heat release raises gas temperature in proportion to Q_in:
 *   T_peak = T_start + (T_peak,base - T_start) * (Q_in / Q_in,base)
 * and, at (nearly) constant volume, peak pressure follows the temperature ratio.
 */
export const COMBUSTION = {
  startTempK: 800, // gas temperature when heat release starts (end of compression)
  baselinePeakTempK: 2700, // peak gas temperature at 100 % heat input
  gasConstant: 287, // J/(kg*K), air
  afrStoich: 14.7,
  fuelLhvJPerKg: 44e6, // gasoline lower heating value
  combustionEfficiency: 0.95,
  wallTempK: 450, // mean cylinder wall temperature (material-dependent in Step 5)
  lossFixed: 0.2, // fraction of ideal work lost regardless of load (crevices, exhaust blowdown ...)
  lossVariable: 0.15, // extra wall heat-loss fraction at baseline peak temperature
} as const;

/** Peak gas temperature (K) for a heat input given in percent of baseline. */
export function getPeakCombustionTempK(heatInputPct: number): number {
  const h = heatInputPct / 100;
  return COMBUSTION.startTempK + (COMBUSTION.baselinePeakTempK - COMBUSTION.startTempK) * h;
}

/** Intake manifold pressure (bar) for a throttle fraction 0.05..1 (0.32 bar idle vacuum up to 1.02 bar WOT). */
export function getIntakePressureBar(throttleFrac: number): number {
  return 0.32 + 0.70 * Math.pow(throttleFrac, 1.15);
}

/**
 * Steady-state wall heat transfer (gas -> wall -> coolant), series thermal resistances:
 *   q'' = (T_gas,eff - T_coolant) / (1/h_g + t/k + 1/h_c)
 *   T_wall (gas side) = T_gas,eff - q''/h_g
 * The wall material only enters through its conductivity k.
 */
export const WALL_MODEL = {
  gasEffectiveFactor: 0.45, // cycle-averaged effective gas temperature / peak combustion temperature (full load)
  gasSideH: 800, // W/(m^2*K), gas-side effective heat-transfer coefficient
  wallThicknessM: 0.008,
  coolantH: 4000, // W/(m^2*K)
  coolantTempK: 363,
  hotMarginK: 30, // within this many K of the limit -> "hot" warning
} as const;

export type WallThermalStatus = 'ok' | 'hot' | 'overheat';

export interface WallThermalState {
  conductivityWmK: number;
  maxServiceTempK: number;
  gasEffectiveTempK: number;
  heatFluxKWm2: number;
  wallTempK: number;
  /** maxServiceTempK - wallTempK (negative = over the limit) */
  marginK: number;
  status: WallThermalStatus;
  /** Wall-loss multiplier relative to the aluminum reference (series-resistance ratio) */
  lossScale: number;
}

function wallResistance(conductivityWmK: number): number {
  return 1 / WALL_MODEL.gasSideH + WALL_MODEL.wallThicknessM / conductivityWmK + 1 / WALL_MODEL.coolantH;
}

export function getWallThermalState(
  throttle: number,
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): WallThermalState {
  const mat = getCylinderMaterial(params.material);
  const throttleFrac = Math.max(0.05, Math.min(1.0, throttle / 100));
  const gasEff =
    WALL_MODEL.gasEffectiveFactor * getPeakCombustionTempK(params.heatInputPct) * (0.7 + 0.3 * throttleFrac);
  const R = wallResistance(mat.conductivityWmK);
  const flux = Math.max(0, (gasEff - WALL_MODEL.coolantTempK) / R); // W/m^2
  const wallTempK = gasEff - flux / WALL_MODEL.gasSideH;
  const marginK = mat.maxServiceTempK - wallTempK;
  const status: WallThermalStatus =
    marginK < 0 ? 'overheat' : marginK < WALL_MODEL.hotMarginK ? 'hot' : 'ok';
  return {
    conductivityWmK: mat.conductivityWmK,
    maxServiceTempK: mat.maxServiceTempK,
    gasEffectiveTempK: gasEff,
    heatFluxKWm2: flux / 1000,
    wallTempK,
    marginK,
    status,
    lossScale: wallResistance(CYLINDER_MATERIALS.aluminum_alloy.conductivityWmK) / R,
  };
}

export interface CycleSummary {
  /** Fuel energy released per cylinder per cycle, J */
  qInJ: number;
  peakPressureBar: number;
  peakTempK: number;
  /** Air-standard Otto efficiency 1 - r^(1-gamma) */
  etaOtto: number;
  /** Fraction of ideal work lost to heat transfer and other losses */
  lossFraction: number;
  /** Indicated thermal efficiency = eta_Otto * (1 - loss) */
  etaIndicated: number;
  /** Indicated net work per cylinder per cycle, J */
  netWorkJ: number;
  /** Cylinder-wall heat transfer / material limits for the selected material */
  wall: WallThermalState;
}

/** One-number-per-quantity summary of the current cycle (what the Heat Input slider changes). */
export function getCycleSummary(
  throttle: number,
  activeFault: DiagnosticFaultType = 'none',
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): CycleSummary {
  const geo = getDerivedGeometry(params);
  const throttleFrac = Math.max(0.05, Math.min(1.0, throttle / 100));
  const gamma = 1.35;
  const h = params.heatInputPct / 100;

  // Charge mass at BDC (ideal gas), fuel mass at stoichiometric AFR, then fuel energy.
  const pIntakePa = getIntakePressureBar(throttleFrac) * 1e5;
  const tIntakeK = 310 + 20 * (1 - throttleFrac);
  const vMaxM3 = (geo.clearanceVolumeCc + geo.displacementPerCylCc) * 1e-6;
  const mAirKg = (pIntakePa * vMaxM3) / (COMBUSTION.gasConstant * tIntakeK);
  const qInJ =
    (mAirKg / COMBUSTION.afrStoich) * COMBUSTION.fuelLhvJPerKg * COMBUSTION.combustionEfficiency * h;

  // Peak pressure / temperature straight from the modelled cycle (same data as the P-V diagram).
  let peakPressureBar = 0;
  let peakTempK = 0;
  for (const pt of generateReferenceOttoCycle(throttle, activeFault, params, 1)) {
    if (pt.pressureBar > peakPressureBar) peakPressureBar = pt.pressureBar;
    if (pt.tempKelvin > peakTempK) peakTempK = pt.tempKelvin;
  }

  const etaOtto = 1 - Math.pow(geo.compressionRatio, 1 - gamma);
  const wall = getWallThermalState(throttle, params);
  // Heat-loss scaling with temperature (as before) times the wall material's conductance vs aluminum.
  const theta =
    ((getPeakCombustionTempK(params.heatInputPct) - COMBUSTION.wallTempK) /
      (COMBUSTION.baselinePeakTempK - COMBUSTION.wallTempK)) *
    wall.lossScale;
  const lossFraction = Math.min(0.9, Math.max(0, COMBUSTION.lossFixed + COMBUSTION.lossVariable * theta));
  const etaIndicated = etaOtto * (1 - lossFraction);

  return { qInJ, peakPressureBar, peakTempK, etaOtto, lossFraction, etaIndicated, netWorkJ: etaIndicated * qInJ, wall };
}

export function calculateThermodynamics(
  cylCycleDeg: number,
  volumeCc: number,
  rpm: number,
  throttle: number,
  activeFault: DiagnosticFaultType = 'none',
  cylinderId: number = 1,
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): ThermoResult {
  const geo = getDerivedGeometry(params);
  const normDeg = ((cylCycleDeg % 720) + 720) % 720;
  const V_c = geo.clearanceVolumeCc;
  const V_max = V_c + geo.displacementPerCylCc;
  const gamma = 1.35;

  // Engine is OFF: ambient atmospheric equilibrium (1.01 bar, 25°C, 0 Nm)
  if (rpm < 50) {
    return {
      pressureBar: 1.01,
      tempKelvin: 298.15,
      torqueNm: 0,
      faultNote: undefined,
    };
  }

  const throttleFrac = Math.max(0.05, Math.min(1.0, throttle / 100));
  // Naturally Aspirated 5.0L Induction: 0.32 bar idle vacuum up to 1.02 bar at WOT with acoustic ram-air filling
  const pIntake = getIntakePressureBar(throttleFrac);

  let pressure = 1.0;
  let tempK = 300;
  let faultNote: string | undefined;

  const isCyl3Misfire = activeFault === 'misfire_cyl3' && cylinderId === 3;
  const isBlownGasket = activeFault === 'blown_gasket' && (cylinderId === 1 || cylinderId === 3);
  const isPreIgnition = activeFault === 'pre_ignition' && cylinderId === 1;
  const isValveFloat = activeFault === 'valve_float' && rpm > 4800;
  const isLeanMix = activeFault === 'lean_mix';

  if (normDeg < 180) {
    pressure = pIntake;
    tempK = 310 + 20 * (1 - throttleFrac);

    if (isBlownGasket) {
      pressure = 0.85;
      faultNote = 'Gasket leak: Intake manifold pressure diluted';
    }
  } else if (normDeg < 360) {
    const volRatio = V_max / Math.max(V_c, volumeCc);
    let compPress = pIntake * Math.pow(volRatio, gamma);
    let compTemp = 310 * Math.pow(volRatio, gamma - 1);

    if (isBlownGasket) {
      compPress *= 0.45;
      compTemp *= 0.75;
      faultNote = 'Blown Head Gasket: Severe compression loss (leak to Cyl 3)';
    }

    if (isValveFloat) {
      compPress *= 0.65;
      faultNote = 'Valve Float: Springs resonating; valves fail to seat';
    }

    if (isPreIgnition && normDeg >= 320) {
      const detProgress = (normDeg - 320) / 40;
      compPress = compPress + 120 * Math.sin(detProgress * Math.PI);
      compTemp = compTemp + 1800 * detProgress;
      faultNote = 'CRITICAL: Severe Pre-Ignition Detonation (Knock) before TDC!';
    }

    pressure = compPress;
    tempK = compTemp;
  } else if (normDeg < 540) {
    if (isCyl3Misfire) {
      const volRatio = V_max / Math.max(V_c, volumeCc);
      pressure = pIntake * Math.pow(volRatio, gamma) * 0.85;
      tempK = 380;
      faultNote = 'Misfire: No spark event. Unburnt fuel discharged into exhaust.';
    } else {
      // Heat input scales the peak temperature; peak pressure follows the temperature ratio.
      const heatPeakTemp = getPeakCombustionTempK(params.heatInputPct);
      let peakPress = (35 + 98 * throttleFrac) * (heatPeakTemp / COMBUSTION.baselinePeakTempK);
      // Combustion can never leave the gas below its compressed-charge pressure.
      peakPress = Math.max(peakPress, pIntake * Math.pow(geo.compressionRatio, gamma) * 1.1);
      let peakTemp = heatPeakTemp;

      if (isLeanMix) {
        peakPress *= 0.82;
        peakTemp =
          COMBUSTION.startTempK +
          ((heatPeakTemp - COMBUSTION.startTempK) * (2650 - COMBUSTION.startTempK)) /
            (COMBUSTION.baselinePeakTempK - COMBUSTION.startTempK);
        faultNote = 'Lean Mixture (λ = 1.32): Slow flame velocity, scorching EGT';
      }

      if (isBlownGasket) {
        peakPress *= 0.35;
        faultNote = 'Blown Gasket: Combustion pressure escaping into coolant jacket';
      }

      if (isValveFloat) {
        peakPress *= 0.6;
      }

      if (normDeg <= 375) {
        const rise = (normDeg - 360) / 15;
        pressure = (pIntake * Math.pow(geo.compressionRatio, gamma)) + Math.max(0, peakPress - 22) * rise;
        tempK = 800 + (peakTemp - 800) * rise;
      } else {
        const expVolRatio = Math.max(V_c, volumeCc) / V_c;
        pressure = peakPress * Math.pow(1 / expVolRatio, gamma);
        tempK = peakTemp * Math.pow(1 / expVolRatio, gamma - 1);
      }
    }
  } else {
    const exhProgress = (normDeg - 540) / 180;
    if (exhProgress < 0.2) {
      pressure = 3.5 - 2.2 * (exhProgress / 0.2);
      tempK = 950 - 200 * (exhProgress / 0.2);
    } else {
      pressure = 1.15;
      tempK = isLeanMix ? 1100 : 720;
    }

    // Exhaust gas temperature scales with how hot the combustion was.
    const exhaustHeatScale =
      (getPeakCombustionTempK(params.heatInputPct) - 300) / (COMBUSTION.baselinePeakTempK - 300);
    tempK = 300 + (tempK - 300) * exhaustHeatScale;

    if (isCyl3Misfire) {
      tempK = 340;
    }
  }

  const boreM = geo.boreMm / 1000;
  const pistonAreaM2 = Math.PI * Math.pow(boreM / 2, 2);
  const netPressurePa = (pressure - 1.013) * 1e5;
  const pistonForceN = netPressurePa * pistonAreaM2;

  const rM = geo.crankRadiusMm / 1000;
  const lambda = geo.rodToCrankRatio;
  const phiRad = (normDeg * Math.PI) / 180;

  const underRad = Math.max(0.01, 1 - lambda * lambda * Math.sin(phiRad) * Math.sin(phiRad));
  const armFactor = Math.sin(phiRad) + (lambda * Math.sin(2 * phiRad)) / (2 * Math.sqrt(underRad));
  let torqueNm = pistonForceN * rM * armFactor;

  if (isPreIgnition && normDeg >= 320 && normDeg < 360) {
    torqueNm = -Math.abs(pistonForceN * rM * armFactor) * 2.5;
  }

  return {
    pressureBar: Math.max(0.1, pressure),
    tempKelvin: Math.max(280, tempK),
    torqueNm,
    faultNote,
  };
}

export function generateReferenceOttoCycle(
  throttle: number = 80,
  activeFault: DiagnosticFaultType = 'none',
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  stepDeg: number = 4
): CyclePoint[] {
  const points: CyclePoint[] = [];
  const geo = getDerivedGeometry(params);
  const V_c = geo.clearanceVolumeCc;

  for (let deg = 0; deg < 720; deg += stepDeg) {
    const phiRad = (deg * Math.PI) / 180;
    const r = geo.crankRadiusMm;
    const l = geo.conRodLengthMm;
    const lambda = r / l;
    const sinPhi = Math.sin(phiRad);
    const underRad = Math.max(0, 1 - lambda * lambda * sinPhi * sinPhi);
    const dispMm = r * (1 - Math.cos(phiRad)) + l * (1 - Math.sqrt(underRad));
    const volCc = V_c + (dispMm / 10) * geo.pistonAreaCm2;

    const thermo = calculateThermodynamics(deg, volCc, 3000, throttle, activeFault, 1, params);

    const T = thermo.tempKelvin;
    const v = volCc;
    const s = 1.0 * Math.log(T / 300) + 0.287 * Math.log(v / V_c);

    points.push({
      crankDeg: deg,
      volumeCc: volCc,
      pressureBar: thermo.pressureBar,
      tempKelvin: thermo.tempKelvin,
      entropy: s,
    });
  }

  return points;
}
