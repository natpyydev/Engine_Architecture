import { EngineId, GearPosition } from './types';

export interface CylinderSpecConfig {
  id: number;
  bank: 1 | 2;
  bankName: string;
  bankIndex: number;
  crankpinIndex: number;
  crankpinAngleDeg: number;
  bankTiltDeg: number;
  firingCycleDeg: number;
}

export interface EngineSpecConfig {
  id: EngineId;
  name: string;
  modelName: string;
  engineCode: string;
  architecture: string;
  subtitle: string;
  badge: string;
  badgeGradient: string;
  badgeBorder: string;
  badgeText: string;
  tagColor: string;
  cylinderCount: number;
  displacementCc: number;
  boreMm: number;
  strokeMm: number;
  conRodLengthMm: number;
  compressionRatio: number;
  isTurbo: boolean;
  maxBoostBar: number;
  peakHp: number;
  peakHpRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  redlineRpm: number;
  maxRpm: number;
  idleRpm: number;
  tachMaxRpm: number;
  tachWarningRpm: number;
  firingOrder: number[];
  firingIntervalDeg: number;
  transmissionName: string;
  gearCount: number;
  gearRatios: Record<GearPosition, number>;
  finalDrive: number;
  starterCadenceHz: number;
  starterRpm: number;
  coldStartRoarRpm: number;
  soundProfile: 'crossplane_v8' | 'inline6_turbo' | 'boxer4_uel';
  cylinders: CylinderSpecConfig[];
  specs: {
    label: string;
    value: string;
  }[];
}

export const ENGINES: Record<EngineId, EngineSpecConfig> = {
  v8_lexus: {
    id: 'v8_lexus',
    name: 'Lexus LC 500',
    modelName: 'LC 500 Coupe (URZ100)',
    engineCode: '2UR-GSE',
    architecture: '90° Crossplane V8',
    subtitle: 'Naturally Aspirated 5.0L Crossplane V8 · DirectShift 10-Speed',
    badge: 'V8',
    badgeGradient: 'from-amber-600 to-rose-600',
    badgeBorder: 'border-amber-800',
    badgeText: 'text-amber-400',
    tagColor: 'bg-amber-950 text-amber-400 border-amber-800',
    cylinderCount: 8,
    displacementCc: 4969,
    boreMm: 94.0,
    strokeMm: 89.5,
    conRodLengthMm: 151.0,
    compressionRatio: 12.3,
    isTurbo: false,
    maxBoostBar: 0,
    peakHp: 471,
    peakHpRpm: 7100,
    peakTorqueNm: 540,
    peakTorqueRpm: 4800,
    redlineRpm: 7300,
    maxRpm: 7500,
    idleRpm: 750,
    tachMaxRpm: 9000,
    tachWarningRpm: 6800,
    firingOrder: [1, 5, 6, 3, 4, 2, 7, 8],
    firingIntervalDeg: 90,
    transmissionName: 'DirectShift-10AT (10-Speed)',
    gearCount: 10,
    gearRatios: {
      R: -3.832,
      N: 0,
      1: 4.596,
      2: 2.964,
      3: 2.176,
      4: 1.661,
      5: 1.281,
      6: 1.000,
      7: 0.813,
      8: 0.686,
      9: 0.588,
      10: 0.485,
    },
    finalDrive: 3.133,
    starterCadenceHz: 22,
    starterRpm: 330,
    coldStartRoarRpm: 2250,
    soundProfile: 'crossplane_v8',
    cylinders: [
      { id: 1, bank: 1, bankName: 'Bank 1 (Left)', bankIndex: 0, crankpinIndex: 0, crankpinAngleDeg: 0, bankTiltDeg: 45, firingCycleDeg: 45 },
      { id: 3, bank: 1, bankName: 'Bank 1 (Left)', bankIndex: 1, crankpinIndex: 1, crankpinAngleDeg: 90, bankTiltDeg: 45, firingCycleDeg: 315 },
      { id: 5, bank: 1, bankName: 'Bank 1 (Left)', bankIndex: 2, crankpinIndex: 2, crankpinAngleDeg: 270, bankTiltDeg: 45, firingCycleDeg: 135 },
      { id: 7, bank: 1, bankName: 'Bank 1 (Left)', bankIndex: 3, crankpinIndex: 3, crankpinAngleDeg: 180, bankTiltDeg: 45, firingCycleDeg: 585 },
      { id: 2, bank: 2, bankName: 'Bank 2 (Right)', bankIndex: 0, crankpinIndex: 0, crankpinAngleDeg: 0, bankTiltDeg: -45, firingCycleDeg: 495 },
      { id: 4, bank: 2, bankName: 'Bank 2 (Right)', bankIndex: 1, crankpinIndex: 1, crankpinAngleDeg: 90, bankTiltDeg: -45, firingCycleDeg: 405 },
      { id: 6, bank: 2, bankName: 'Bank 2 (Right)', bankIndex: 2, crankpinIndex: 2, crankpinAngleDeg: 270, bankTiltDeg: -45, firingCycleDeg: 225 },
      { id: 8, bank: 2, bankName: 'Bank 2 (Right)', bankIndex: 3, crankpinIndex: 3, crankpinAngleDeg: 180, bankTiltDeg: -45, firingCycleDeg: 675 },
    ],
    specs: [
      { label: 'Configuration', value: '90° V8 naturally aspirated' },
      { label: 'Displacement', value: '4,969 cc (5.0L)' },
      { label: 'Bore x Stroke', value: '94.0 mm x 89.5 mm' },
      { label: 'Compression Ratio', value: '12.3:1' },
      { label: 'Valvetrain', value: 'DOHC 32V Dual VVT-i with VVT-iE electric intake' },
      { label: 'Induction', value: 'Dual-length acoustic intake manifold' },
      { label: 'Fuel System', value: 'D-4S direct and port injection' },
      { label: 'Peak Power', value: '471 BHP @ 7,100 RPM' },
      { label: 'Peak Torque', value: '540 Nm @ 4,800 RPM' },
      { label: 'Redline', value: '7,300 RPM (Limiter 7,500 RPM)' },
      { label: 'Transmission', value: 'DirectShift-10AT 10-speed torque-converter automatic' },
    ],
  },

  i6_bmw: {
    id: 'i6_bmw',
    name: 'BMW M3 (G80)',
    modelName: 'M3 Competition (G80)',
    engineCode: 'S58B30T0',
    architecture: 'Straight-6 (Inline-6)',
    subtitle: 'Twin-Turbo 3.0L Inline-6 · M Steptronic 8-Speed',
    badge: 'I-6',
    badgeGradient: 'from-sky-500 via-blue-600 to-indigo-600',
    badgeBorder: 'border-sky-800',
    badgeText: 'text-sky-300',
    tagColor: 'bg-sky-950 text-sky-400 border-sky-800',
    cylinderCount: 6,
    displacementCc: 2993,
    boreMm: 84.0,
    strokeMm: 90.0,
    conRodLengthMm: 144.0,
    compressionRatio: 9.3,
    isTurbo: true,
    maxBoostBar: 1.3,
    peakHp: 503,
    peakHpRpm: 6250,
    peakTorqueNm: 650,
    peakTorqueRpm: 2750,
    redlineRpm: 7200,
    maxRpm: 7400,
    idleRpm: 700,
    tachMaxRpm: 8500,
    tachWarningRpm: 6700,
    firingOrder: [1, 5, 3, 6, 2, 4],
    firingIntervalDeg: 120,
    transmissionName: 'M Steptronic (ZF 8HP76 8-Speed)',
    gearCount: 8,
    gearRatios: {
      R: -3.456,
      N: 0,
      1: 5.000,
      2: 3.200,
      3: 2.143,
      4: 1.720,
      5: 1.314,
      6: 1.000,
      7: 0.822,
      8: 0.640,
      9: 0.500,
      10: 0.400,
    },
    finalDrive: 3.154,
    starterCadenceHz: 20,
    starterRpm: 310,
    coldStartRoarRpm: 2100,
    soundProfile: 'inline6_turbo',
    cylinders: [
      { id: 1, bank: 1, bankName: 'Inline Bank', bankIndex: 0, crankpinIndex: 0, crankpinAngleDeg: 0,   bankTiltDeg: 0, firingCycleDeg: 0 },
      { id: 2, bank: 1, bankName: 'Inline Bank', bankIndex: 1, crankpinIndex: 1, crankpinAngleDeg: 120, bankTiltDeg: 0, firingCycleDeg: 480 },
      { id: 3, bank: 1, bankName: 'Inline Bank', bankIndex: 2, crankpinIndex: 2, crankpinAngleDeg: 240, bankTiltDeg: 0, firingCycleDeg: 240 },
      { id: 4, bank: 1, bankName: 'Inline Bank', bankIndex: 3, crankpinIndex: 3, crankpinAngleDeg: 240, bankTiltDeg: 0, firingCycleDeg: 600 },
      { id: 5, bank: 1, bankName: 'Inline Bank', bankIndex: 4, crankpinIndex: 4, crankpinAngleDeg: 120, bankTiltDeg: 0, firingCycleDeg: 120 },
      { id: 6, bank: 1, bankName: 'Inline Bank', bankIndex: 5, crankpinIndex: 5, crankpinAngleDeg: 0,   bankTiltDeg: 0, firingCycleDeg: 360 },
    ],
    specs: [
      { label: 'Configuration', value: 'Inline-6 twin-turbocharged closed-deck' },
      { label: 'Displacement', value: '2,993 cc (3.0L)' },
      { label: 'Bore x Stroke', value: '84.0 mm x 90.0 mm (undersquare)' },
      { label: 'Compression Ratio', value: '9.3:1' },
      { label: 'Turbochargers', value: 'Twin monoscroll turbos with electronic wastegates (1.3 bar peak)' },
      { label: 'Crankshaft', value: '120° forged lightweight steel with 7 main bearing bulkheads' },
      { label: 'Valvetrain', value: 'DOHC 24V Double-VANOS variable camshafts & Valvetronic' },
      { label: 'Intercooling', value: 'Water-to-air charge air cooler integrated into intake plenum' },
      { label: 'Peak Power', value: '503 BHP @ 6,250 RPM' },
      { label: 'Peak Torque', value: '650 Nm @ 2,750–5,500 RPM' },
      { label: 'Redline', value: '7,200 RPM' },
      { label: 'Transmission', value: '8-speed M Steptronic with Drivelogic (ZF 8HP76)' },
    ],
  },

  boxer4_subaru: {
    id: 'boxer4_subaru',
    name: 'Subaru WRX STI',
    modelName: 'WRX STI 2.5L (VAB)',
    engineCode: 'EJ257',
    architecture: '180° Horizontally-Opposed Boxer-4',
    subtitle: 'Turbocharged 2.5L Flat-4 · Close-Ratio 6-Speed Manual',
    badge: 'BOXER',
    badgeGradient: 'from-blue-600 via-rose-600 to-amber-500',
    badgeBorder: 'border-blue-700',
    badgeText: 'text-blue-300',
    tagColor: 'bg-blue-950 text-blue-300 border-blue-800',
    cylinderCount: 4,
    displacementCc: 2457,
    boreMm: 99.5,
    strokeMm: 79.0,
    conRodLengthMm: 130.5,
    compressionRatio: 8.2,
    isTurbo: true,
    maxBoostBar: 1.0,
    peakHp: 310,
    peakHpRpm: 6000,
    peakTorqueNm: 393,
    peakTorqueRpm: 4000,
    redlineRpm: 6700,
    maxRpm: 7000,
    idleRpm: 800,
    tachMaxRpm: 8000,
    tachWarningRpm: 6200,
    firingOrder: [1, 3, 2, 4],
    firingIntervalDeg: 180,
    transmissionName: 'TY85 Close-Ratio 6-Speed Manual',
    gearCount: 6,
    gearRatios: {
      R: -3.545,
      N: 0,
      1: 3.636,
      2: 2.235,
      3: 1.521,
      4: 1.137,
      5: 0.971,
      6: 0.756,
      7: 0.600,
      8: 0.500,
      9: 0.400,
      10: 0.350,
    },
    finalDrive: 3.900,
    starterCadenceHz: 18,
    starterRpm: 280,
    coldStartRoarRpm: 1850,
    soundProfile: 'boxer4_uel',
    cylinders: [
      { id: 1, bank: 1, bankName: 'Bank 1 (Left Front)', bankIndex: 0, crankpinIndex: 0, crankpinAngleDeg: 0,   bankTiltDeg: -90, firingCycleDeg: 0 },
      { id: 3, bank: 1, bankName: 'Bank 1 (Left Rear)',  bankIndex: 1, crankpinIndex: 1, crankpinAngleDeg: 180, bankTiltDeg: -90, firingCycleDeg: 180 },
      { id: 2, bank: 2, bankName: 'Bank 2 (Right Front)', bankIndex: 0, crankpinIndex: 2, crankpinAngleDeg: 180, bankTiltDeg: 90,  firingCycleDeg: 360 },
      { id: 4, bank: 2, bankName: 'Bank 2 (Right Rear)',  bankIndex: 1, crankpinIndex: 3, crankpinAngleDeg: 0,   bankTiltDeg: 90,  firingCycleDeg: 540 },
    ],
    specs: [
      { label: 'Configuration', value: '180° horizontally-opposed flat-4 semi-closed deck' },
      { label: 'Displacement', value: '2,457 cc (2.5L)' },
      { label: 'Bore x Stroke', value: '99.5 mm x 79.0 mm (oversquare)' },
      { label: 'Compression Ratio', value: '8.2:1' },
      { label: 'Turbocharger', value: 'Single twin-scroll turbocharger with top-mount intercooler (1.0 bar)' },
      { label: 'Exhaust Design', value: 'Unequal Length (UEL) header manifold producing iconic boxer thrum' },
      { label: 'Valvetrain', value: 'DOHC 16V Dual AVCS (Active Valve Control System)' },
      { label: 'Piston / Rods', value: 'Hypereutectic aluminum pistons with reinforced connecting rods' },
      { label: 'Peak Power', value: '310 BHP @ 6,000 RPM' },
      { label: 'Peak Torque', value: '393 Nm @ 4,000 RPM' },
      { label: 'Redline', value: '6,700 RPM' },
      { label: 'Transmission', value: 'Subaru TY85 6-speed manual with Driver Controlled Center Differential (DCCD)' },
    ],
  },
};

export function getEngineConfig(id: EngineId): EngineSpecConfig {
  return ENGINES[id] || ENGINES.v8_lexus;
}
