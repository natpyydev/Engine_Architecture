import { DiagnosticFaultType } from './types';
import { ENGINE_SPECS } from './kinematics';

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

export function calculateThermodynamics(
  cylCycleDeg: number,
  volumeCc: number,
  rpm: number,
  throttle: number,
  activeFault: DiagnosticFaultType = 'none',
  cylinderId: number = 1
): ThermoResult {
  const normDeg = ((cylCycleDeg % 720) + 720) % 720;
  const V_c = ENGINE_SPECS.clearanceVolumeCc;
  const V_max = V_c + ENGINE_SPECS.displacementPerCylCc;
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
  const pIntake = 0.32 + 0.70 * Math.pow(throttleFrac, 1.15);

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
      let peakPress = (35 + 98 * throttleFrac);
      let peakTemp = 2700;

      if (isLeanMix) {
        peakPress *= 0.82;
        peakTemp = 2650;
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
        pressure = (pIntake * Math.pow(ENGINE_SPECS.compressionRatio, gamma)) + (peakPress - 22) * rise;
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

    if (isCyl3Misfire) {
      tempK = 340;
    }
  }

  const boreM = ENGINE_SPECS.boreMm / 1000;
  const pistonAreaM2 = Math.PI * Math.pow(boreM / 2, 2);
  const netPressurePa = (pressure - 1.013) * 1e5;
  const pistonForceN = netPressurePa * pistonAreaM2;

  const rM = ENGINE_SPECS.crankRadiusMm / 1000;
  const lambda = ENGINE_SPECS.rodToCrankRatio;
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
  activeFault: DiagnosticFaultType = 'none'
): CyclePoint[] {
  const points: CyclePoint[] = [];
  const V_c = ENGINE_SPECS.clearanceVolumeCc;

  for (let deg = 0; deg < 720; deg += 4) {
    const phiRad = (deg * Math.PI) / 180;
    const r = ENGINE_SPECS.crankRadiusMm;
    const l = ENGINE_SPECS.conRodLengthMm;
    const lambda = r / l;
    const sinPhi = Math.sin(phiRad);
    const underRad = Math.max(0, 1 - lambda * lambda * sinPhi * sinPhi);
    const dispMm = r * (1 - Math.cos(phiRad)) + l * (1 - Math.sqrt(underRad));
    const volCc = V_c + (dispMm / 10) * (Math.PI * Math.pow(ENGINE_SPECS.boreMm / 20, 2));

    const thermo = calculateThermodynamics(deg, volCc, 3000, throttle, activeFault, 1);

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
