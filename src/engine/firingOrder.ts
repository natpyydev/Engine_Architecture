import { StrokeStage, CylinderTelemetry, DiagnosticFaultType, EngineId } from './types';
import {
  calculatePistonDisplacement,
  calculateCylinderVolume,
  calculateIntakeValveLift,
  calculateExhaustValveLift,
} from './kinematics';
import { calculateThermodynamics } from './thermodynamics';
import { EngineParams, DEFAULT_ENGINE_PARAMS } from './engineParams';
import { ENGINES, getEngineConfig } from './engineRegistry';

export interface CylinderConfig {
  id: number;
  bank: 1 | 2; // 1: Left (+45 deg), 2: Right (-45 deg)
  bankName?: string;
  bankIndex: number; // 0 (front), 1, 2, 3 (rear)
  crankpinIndex: number; // 0, 1, 2, 3
  crankpinAngleDeg: number; // 0, 90, 270, 180
  bankTiltDeg: number; // +45 for bank 1, -45 for bank 2
  firingCycleDeg: number;
}

export const CYLINDERS: CylinderConfig[] = ENGINES.v8_lexus.cylinders;

export const FIRING_ORDER = ENGINES.v8_lexus.firingOrder;

export function getEngineCylinders(engineId: EngineId): CylinderConfig[] {
  return getEngineConfig(engineId).cylinders;
}

export function getEngineFiringOrder(engineId: EngineId): number[] {
  return getEngineConfig(engineId).firingOrder;
}

export function getStrokeStage(cycleDeg: number): StrokeStage {
  const norm = ((cycleDeg % 720) + 720) % 720;
  if (norm < 180) return 'Intake';
  if (norm < 360) return 'Compression';
  if (norm < 540) return 'Power';
  return 'Exhaust';
}

export function computeAllCylindersTelemetry(
  masterCrankAngleDeg: number,
  rpm: number,
  throttle: number,
  activeFault: DiagnosticFaultType = 'none',
  engineId: EngineId = 'v8_lexus',
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): CylinderTelemetry[] {
  const normMaster = ((masterCrankAngleDeg % 720) + 720) % 720;
  const config = getEngineConfig(engineId);
  const strokeMm = params.strokeMm;

  return config.cylinders.map((cfg) => {
    const cylCycleDeg = ((normMaster - cfg.firingCycleDeg + 360) % 720 + 720) % 720;
    const stroke = getStrokeStage(cylCycleDeg);

    const phiRad = (cylCycleDeg * Math.PI) / 180;
    const dispMm = calculatePistonDisplacement(phiRad, params);
    const normPistonPos = Math.min(1, Math.max(0, dispMm / strokeMm));
    const volumeCc = calculateCylinderVolume(phiRad, params);

    const isFaultyThisCyl =
      (activeFault === 'misfire_cyl3' && cfg.id === 3) ||
      (activeFault === 'blown_gasket' && (cfg.id === 1 || cfg.id === 3)) ||
      (activeFault === 'pre_ignition' && cfg.id === 1);

    const intakeValveLift = calculateIntakeValveLift(cylCycleDeg, rpm, activeFault);
    const exhaustValveLift = calculateExhaustValveLift(cylCycleDeg, rpm, activeFault);

    let isSparking = rpm > 50 && cylCycleDeg >= 345 && cylCycleDeg <= 365;
    if (activeFault === 'misfire_cyl3' && cfg.id === 3) {
      isSparking = false;
    }
    if (activeFault === 'pre_ignition' && cfg.id === 1) {
      if (cylCycleDeg >= 315 && cylCycleDeg <= 335) {
        isSparking = true;
      }
    }

    let flameIntensity = 0;
    if (rpm > 50 && stroke === 'Power' && !isFaultyThisCyl) {
      const powerProgress = (cylCycleDeg - 360) / 180;
      if (powerProgress < 0.3) {
        flameIntensity = Math.sin((powerProgress / 0.3) * (Math.PI / 2));
      } else {
        flameIntensity = Math.max(0, 1 - (powerProgress - 0.3) / 0.7);
      }
    } else if (rpm > 50 && stroke === 'Power' && activeFault === 'pre_ignition' && cfg.id === 1) {
      flameIntensity = 1.0;
    } else if (rpm > 50 && stroke === 'Power' && activeFault === 'lean_mix') {
      flameIntensity = 0.55;
    }

    const thermo = calculateThermodynamics(
      cylCycleDeg,
      volumeCc,
      rpm,
      throttle,
      activeFault,
      cfg.id,
      params
    );

    return {
      id: cfg.id,
      bank: cfg.bank,
      bankName: cfg.bankName || (cfg.bank === 1 ? 'Bank 1' : 'Bank 2'),
      bankPos: cfg.bankIndex,
      crankAngle: cylCycleDeg,
      stroke,
      pistonDisplacementMm: dispMm,
      normalizedPistonPos: normPistonPos,
      cylinderVolumeCc: volumeCc,
      pressureBar: thermo.pressureBar,
      tempKelvin: thermo.tempKelvin,
      torqueNm: thermo.torqueNm,
      intakeValveLiftMm: intakeValveLift * 11.5,
      exhaustValveLiftMm: exhaustValveLift * 11.5,
      isSparking,
      flameIntensity,
      isFaulty: isFaultyThisCyl,
      faultMessage: isFaultyThisCyl ? thermo.faultNote : undefined,
    };
  });
}
