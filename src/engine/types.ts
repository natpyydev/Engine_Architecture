export type EngineId = 'v8_lexus' | 'i6_bmw' | 'boxer4_subaru';

export type GearPosition = 'R' | 'N' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StrokeStage = 'Intake' | 'Compression' | 'Power' | 'Exhaust';

export type DiagnosticFaultType =
  | 'none'
  | 'misfire_cyl3'
  | 'valve_float'
  | 'pre_ignition'
  | 'lean_mix'
  | 'blown_gasket';

export interface DiagnosticFault {
  id: DiagnosticFaultType;
  name: string;
  category: 'Ignition' | 'Valvetrain' | 'Combustion' | 'Fueling' | 'Mechanical';
  severity: 'Low' | 'Medium' | 'Critical';
  description: string;
  symptoms: string[];
  thermodynamicImpact: string;
  fixAction: string;
}

export interface CylinderTelemetry {
  id: number; // 1 to 8 (or 1 to 6 / 1 to 4)
  bank: 1 | 2; // 1 = Left/Inline, 2 = Right
  bankName: string; // "Bank 1 (Left)", "Bank 2 (Right)", "Inline Bank"
  bankPos: number; // 0, 1, 2... along bank
  crankAngle: number; // 0 to 720 degrees
  stroke: StrokeStage;
  pistonDisplacementMm: number; // 0 at TDC, strokeLength at BDC
  normalizedPistonPos: number; // 0 at TDC, 1 at BDC
  cylinderVolumeCc: number;
  pressureBar: number;
  tempKelvin: number;
  torqueNm: number;
  intakeValveLiftMm: number;
  exhaustValveLiftMm: number;
  isSparking: boolean;
  flameIntensity: number; // 0 to 1
  isFaulty: boolean;
  faultMessage?: string;
}

export interface EngineTelemetry {
  rpm: number;
  throttlePercent: number;
  crankAngle: number; // 0 to 720
  brakeHorsepower: number;
  torqueLbFt: number;
  torqueNm: number;
  bmepBar: number;
  indicatedThermalEfficiency: number;
  activeFiringCylinder: number;
  firingOrderIndex: number;
  cylinders: CylinderTelemetry[];
}

export interface ComponentInspectionData {
  id: string;
  name: string;
  category: 'Reciprocating' | 'Rotating' | 'Valvetrain' | 'Structural' | 'Induction & Exhaust';
  material: string;
  massGrams: number;
  criticalTolerance: string;
  kinematicRole: string;
  thermodynamicFunction: string;
  keySpecs: { label: string; value: string }[];
}

export type ViewMode = 'normal' | 'cutaway' | 'exploded' | 'kinetic';

export type SeeThroughMode = 'solid' | 'translucent' | 'ghost';
