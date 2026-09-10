import { EngineId, GearPosition } from './types';
import { ENGINES, getEngineConfig } from './engineRegistry';

export type { GearPosition };
export type DriveMode = 'normal' | 'sport' | 'sport_plus';

// Default Lexus LC 500 DirectShift-10AT ratios
export const GEAR_RATIOS: Record<GearPosition, number> = ENGINES.v8_lexus.gearRatios;
export const FINAL_DRIVE = ENGINES.v8_lexus.finalDrive;

export const TIRE_RADIUS_M = 0.34; // 275/35R21 rear sports tire
export const TIRE_CIRC_M = 2 * Math.PI * TIRE_RADIUS_M; // ~2.136 m
export const VEHICLE_MASS_KG = 1750; // kg
export const CD = 0.30;
export const FRONTAL_AREA_M2 = 2.2;
export const AIR_DENSITY = 1.225; // kg/m^3
export const CRR = 0.015; // Rolling resistance coefficient
export const GRAVITY = 9.81;

export const IDLE_RPM = 750;
export const REDLINE_RPM = 7300;
export const MAX_RPM = 7500;

export interface PowertrainState {
  gear: GearPosition;
  speedMps: number; // Continuous double-precision speed in m/s (prevents discretization stalls)
  speedKmh: number;
  speedMph: number;
  engineRpm: number;
  throttle: number; // 0 - 100
  brake: number; // 0 - 100
  isAutoClutch: boolean;
  clutchEngaged: boolean;
  driveMode: DriveMode;
  isShifting: boolean;
  wheelTorqueNm: number;
  gearRatio: number;
  shiftLight: 'off' | 'green' | 'yellow' | 'red';
}

/**
 * Given vehicle speed in km/h and gear, calculate the corresponding mechanical engine RPM
 */
export function calculateRpmFromSpeed(
  speedKmh: number,
  gear: GearPosition,
  engineId: EngineId = 'v8_lexus'
): number {
  const cfg = getEngineConfig(engineId);
  const ratio = cfg.gearRatios[gear] ?? 0;
  if (ratio === 0) return cfg.idleRpm;
  const speedMps = Math.abs(speedKmh) / 3.6;
  const wheelRps = speedMps / TIRE_CIRC_M;
  const engineRps = wheelRps * Math.abs(ratio) * cfg.finalDrive;
  return Math.max(cfg.idleRpm, Math.round(engineRps * 60));
}

/**
 * Given engine RPM and gear, calculate maximum road speed in km/h
 */
export function calculateSpeedFromRpm(
  rpm: number,
  gear: GearPosition,
  engineId: EngineId = 'v8_lexus'
): number {
  const cfg = getEngineConfig(engineId);
  const ratio = cfg.gearRatios[gear] ?? 0;
  if (ratio === 0) return 0;
  const engineRps = rpm / 60;
  const wheelRps = engineRps / (Math.abs(ratio) * cfg.finalDrive);
  const speedMps = wheelRps * TIRE_CIRC_M;
  return Number((speedMps * 3.6).toFixed(1));
}

/**
 * Get the next higher gear (sequential upshift) capped at maxGear
 */
export function getShiftUpGear(current: GearPosition, maxGear: number = 10): GearPosition {
  if (current === 'R') return 'N';
  if (current === 'N') return 1;
  if (typeof current === 'number') {
    if (current < maxGear) return (current + 1) as GearPosition;
    return maxGear as GearPosition;
  }
  return 1;
}

/**
 * Get the next lower gear (sequential downshift)
 */
export function getShiftDownGear(current: GearPosition): GearPosition {
  if (current === 'R') return 'R';
  if (current === 'N') return 'R';
  if (current === 1) return 'N';
  if (typeof current === 'number' && current > 1) {
    return (current - 1) as GearPosition;
  }
  return 'R';
}

/**
 * Core dynamic step for vehicle road speed and engine RPM coupling
 */
export function stepPowertrain(
  dt: number,
  state: PowertrainState,
  engineTorqueNm: number,
  targetThrottle: number,
  targetBrake: number,
  engineId: EngineId = 'v8_lexus'
): PowertrainState {
  const cfg = getEngineConfig(engineId);
  const idleRpm = cfg.idleRpm;
  const redlineRpm = cfg.redlineRpm;
  const finalDrive = cfg.finalDrive;

  const next = { ...state };
  next.throttle = targetThrottle;
  next.brake = targetBrake;

  const ratio = cfg.gearRatios[next.gear] ?? 0;
  next.gearRatio = Math.abs(ratio);

  // 1. Shift light indicator calibrated to engine redline
  if (next.engineRpm >= redlineRpm - 150) {
    next.shiftLight = 'red';
  } else if (next.engineRpm >= redlineRpm - 800) {
    next.shiftLight = 'yellow';
  } else if (next.engineRpm >= redlineRpm - 1800) {
    next.shiftLight = 'green';
  } else {
    next.shiftLight = 'off';
  }

  // 2. In Neutral: Engine is decoupled from wheels
  if (next.gear === 'N' || !next.clutchEngaged) {
    // Free revving with flywheel inertia
    const targetRevRpm = idleRpm + (next.throttle / 100) * (redlineRpm - idleRpm);
    const revRate = targetRevRpm > next.engineRpm ? 8.5 : 4.0;
    next.engineRpm += (targetRevRpm - next.engineRpm) * Math.min(1, revRate * dt);

    // Vehicle coasts down with friction & aerodynamic drag
    const currentSpeedMps = state.speedMps ?? (Math.abs(next.speedKmh) / 3.6);
    const fAero = 0.5 * AIR_DENSITY * CD * FRONTAL_AREA_M2 * currentSpeedMps * currentSpeedMps;
    const fRoll = CRR * VEHICLE_MASS_KG * GRAVITY;
    const fBrake = (next.brake / 100) * 8500; // Hydraulic brake force
    const totalDecelForce = fAero + fRoll + fBrake;

    const decel = totalDecelForce / VEHICLE_MASS_KG;
    const newSpeedMps = Math.max(0, currentSpeedMps - decel * dt);
    next.speedMps = newSpeedMps;
    next.speedKmh = Number((newSpeedMps * 3.6).toFixed(1));
    next.speedMph = Number((next.speedKmh * 0.621371).toFixed(1));
    next.wheelTorqueNm = 0;
    return next;
  }

  // 3. In Gear (Forward or Reverse)
  const isReverse = next.gear === 'R';
  const totalRatio = Math.abs(ratio) * finalDrive;
  const wheelTorque = engineTorqueNm * totalRatio * (next.throttle > 2 ? 0.94 : 0); // 94% driveline efficiency
  next.wheelTorqueNm = Math.round(wheelTorque);

  const driveForce = wheelTorque / TIRE_RADIUS_M; // Drive thrust in Newtons

  const currentSpeedMps = state.speedMps ?? (Math.abs(next.speedKmh) / 3.6);
  const fAero = 0.5 * AIR_DENSITY * CD * FRONTAL_AREA_M2 * currentSpeedMps * currentSpeedMps;
  const fRoll = CRR * VEHICLE_MASS_KG * GRAVITY;
  const fBrake = (next.brake / 100) * 9500;

  let totalResist = fAero + fRoll;

  // In high gears (7th-10th overdrive) and high speeds, prevent aerodynamic drag from choking
  // the engine when the user applies heavy throttle. Provide dyno powerband headroom so the
  // engine pulls cleanly and smoothly through the entire rev range all the way to redline.
  if (driveForce > 0 && next.throttle > 20) {
    const throttleFactor = Math.min(1.0, (next.throttle - 20) / 80);
    const maxResistFraction = 0.96 - 0.14 * throttleFactor; // 0.96 at 20% throttle down to 0.82 at 100% throttle
    totalResist = Math.min(totalResist, driveForce * maxResistFraction);
  }

  // Net longitudinal force
  const netForce = driveForce - totalResist - fBrake;
  const acceleration = netForce / VEHICLE_MASS_KG;

  let newSpeedMps = currentSpeedMps + acceleration * dt;
  if (next.brake > 0 && newSpeedMps < 0.1 && next.throttle === 0) {
    newSpeedMps = 0;
  }
  newSpeedMps = Math.max(0, newSpeedMps);

  next.speedMps = newSpeedMps;
  next.speedKmh = Number(((isReverse ? -1 : 1) * newSpeedMps * 3.6).toFixed(1));
  next.speedMph = Number((Math.abs(next.speedKmh) * 0.621371).toFixed(1));

  // Compute Engine RPM locked to wheels
  const wheelRps = newSpeedMps / TIRE_CIRC_M;
  const targetLockedRpm = Math.max(idleRpm, Math.round(wheelRps * totalRatio * 60));

  // Hard redline limiter bounce
  if (targetLockedRpm >= redlineRpm) {
    next.engineRpm = redlineRpm + Math.sin(Date.now() * 0.05) * 45;
  } else {
    next.engineRpm = targetLockedRpm;
  }

  return next;
}
