import { DiagnosticFaultType } from './types';

export const ENGINE_SPECS = {
  name: '5.0L Naturally Aspirated 2UR-GSE Crossplane V8',
  boreMm: 94.0,
  strokeMm: 89.5,
  crankRadiusMm: 44.75, // r = stroke / 2
  conRodLengthMm: 151.0, // l
  compressionRatio: 12.3,
  bankAngleDeg: 90.0, // 90-degree V
  halfBankAngleDeg: 45.0,
  numCylinders: 8,
  idleRpm: 750,
  redlineRpm: 7300,
  maxRpm: 7500,
  peakPowerHp: 471,
  peakPowerRpm: 7100,
  peakTorqueNm: 540,
  peakTorqueRpm: 4800,
  // Single cylinder displacement (~621.1 cc)
  get displacementPerCylCc(): number {
    const r = this.boreMm / 20; // in cm
    const h = this.strokeMm / 10; // in cm
    return Math.PI * r * r * h;
  },
  // Total engine displacement (~4,969 cc / 5.0L)
  get totalDisplacementCc(): number {
    return this.displacementPerCylCc * this.numCylinders;
  },
  // Clearance volume at TDC
  get clearanceVolumeCc(): number {
    return this.displacementPerCylCc / (this.compressionRatio - 1);
  },
  rodToCrankRatio: 44.75 / 151.0, // lambda = r / l ~ 0.296
};

/**
 * Calculates piston displacement from TDC in millimeters
 * @param phiRad Crank angle relative to cylinder TDC in radians (0 = TDC)
 */
export function calculatePistonDisplacement(phiRad: number): number {
  const r = ENGINE_SPECS.crankRadiusMm;
  const l = ENGINE_SPECS.conRodLengthMm;
  const lambda = r / l;
  const sinPhi = Math.sin(phiRad);
  const cosPhi = Math.cos(phiRad);

  // Exact slider-crank formula:
  // s = r*(1 - cos(phi)) + l*(1 - sqrt(1 - lambda^2 * sin^2(phi)))
  const underRadical = Math.max(0, 1 - lambda * lambda * sinPhi * sinPhi);
  const disp = r * (1 - cosPhi) + l * (1 - Math.sqrt(underRadical));
  return disp;
}

/**
 * Calculates connecting rod angular tilt beta in radians
 * @param phiRad Crank angle relative to cylinder TDC in radians
 */
export function calculateConRodAngle(phiRad: number): number {
  const lambda = ENGINE_SPECS.rodToCrankRatio;
  return Math.asin(lambda * Math.sin(phiRad));
}

/**
 * Calculates normalized instantaneous cylinder volume V(theta) / V_max
 */
export function calculateCylinderVolume(phiRad: number): number {
  const dispMm = calculatePistonDisplacement(phiRad);
  const areaCm2 = Math.PI * Math.pow(ENGINE_SPECS.boreMm / 20, 2);
  const sweptVolumeCc = (dispMm / 10) * areaCm2;
  return ENGINE_SPECS.clearanceVolumeCc + sweptVolumeCc;
}

/**
 * Calculates intake valve lift (0 to 1) for a cylinder at a given 720-degree crank angle
 * Intake opens at 705 deg (-15 deg BTDC) and closes at 235 deg (55 deg ABDC) -> total duration 250 deg
 */
export function calculateIntakeValveLift(
  cycleDeg: number,
  rpm: number,
  activeFault: DiagnosticFaultType = 'none'
): number {
  // Normalize cycleDeg to [0, 720)
  const deg = ((cycleDeg % 720) + 720) % 720;
  
  // Intake valve open window: [705, 720) and [0, 235]
  let activeWindowDeg = -1;
  if (deg >= 705) {
    activeWindowDeg = deg - 705; // 0 to 15
  } else if (deg <= 235) {
    activeWindowDeg = deg + 15; // 15 to 250
  }

  if (activeWindowDeg >= 0 && activeWindowDeg <= 250) {
    // Cam lobe sinusoidal lift profile
    const progress = activeWindowDeg / 250;
    let lift = Math.sin(progress * Math.PI);

    // Valve float condition at high RPM
    if (activeFault === 'valve_float' && rpm > 4500) {
      const floatFactor = Math.min(0.4, (rpm - 4500) / 5000);
      lift = Math.max(lift, floatFactor * (1 - progress * 0.5));
    }
    return Math.min(1, Math.max(0, lift));
  }

  if (activeFault === 'valve_float' && rpm > 5200) {
    return 0.15; // Valve fails to seat completely due to spring harmonic surge
  }

  return 0;
}

/**
 * Calculates exhaust valve lift (0 to 1) for a cylinder at a given 720-degree crank angle
 * Exhaust opens at 485 deg (55 deg BBDC) and closes at 15 deg (15 deg ATDC) -> total duration 250 deg
 */
export function calculateExhaustValveLift(
  cycleDeg: number,
  rpm: number,
  activeFault: DiagnosticFaultType = 'none'
): number {
  const deg = ((cycleDeg % 720) + 720) % 720;

  // Exhaust valve open window: [485, 720) and [0, 15]
  let activeWindowDeg = -1;
  if (deg >= 485) {
    activeWindowDeg = deg - 485; // 0 to 235
  } else if (deg <= 15) {
    activeWindowDeg = deg + (720 - 485); // 235 to 250
  }

  if (activeWindowDeg >= 0 && activeWindowDeg <= 250) {
    const progress = activeWindowDeg / 250;
    let lift = Math.sin(progress * Math.PI);

    if (activeFault === 'valve_float' && rpm > 4500) {
      const floatFactor = Math.min(0.35, (rpm - 4500) / 5000);
      lift = Math.max(lift, floatFactor);
    }
    return Math.min(1, Math.max(0, lift));
  }

  return 0;
}
