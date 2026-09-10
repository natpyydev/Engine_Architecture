import * as THREE from 'three';
import { EngineMaterialPalette } from './materials';
import { CylinderTelemetry, SeeThroughMode } from '../engine/types';
import { ENGINES } from '../engine/engineRegistry';

export interface Boxer4AssemblyNodes {
  rootGroup: THREE.Group;
  crankcaseGroup: THREE.Group;
  crankshaftGroup: THREE.Group;
  flywheelMesh: THREE.Mesh;
  damperMesh: THREE.Mesh;
  throttleBladeGroup: THREE.Group;
  camshaftsGroup: THREE.Group;
  tmicGroup: THREE.Group; // Top-Mount Intercooler
  uelHeadersGroup: THREE.Group; // Unequal Length Headers
  turboGroup: THREE.Group;
  pistons: THREE.Group[];
  connectingRods: THREE.Group[];
  intakeValves: THREE.Group[];
  exhaustValves: THREE.Group[];
  intakeSprings: THREE.Mesh[][];
  exhaustSprings: THREE.Mesh[][];
  sparkPlugs: THREE.Group[];
  cylinderLiners: THREE.Mesh[];
  bank1HeadGroup: THREE.Group;
  bank2HeadGroup: THREE.Group;
  bank1CoverGroup: THREE.Group;
  bank2CoverGroup: THREE.Group;
  oilPanGroup: THREE.Group;
  timingBeltCoverGroup: THREE.Group;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  private radius: number;
  private height: number;
  private turns: number;

  constructor(radius: number, height: number, turns: number) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = 2 * Math.PI * this.turns * t;
    const x = this.radius * Math.cos(angle);
    const z = this.radius * Math.sin(angle);
    const y = this.height * t;
    return optionalTarget.set(x, y, z);
  }
}

function createAuthenticBoxerCounterweightShape(crankR: number): THREE.Shape {
  const shape = new THREE.Shape();
  const pinY = crankR;
  const pinWebR = 0.90;
  const waistR = 1.00;
  const outerR = crankR * 1.60;

  const arcStart = (-140 * Math.PI) / 180;
  const arcEnd = (-40 * Math.PI) / 180;
  const xArcL = Math.cos(arcStart) * outerR;
  const yArcL = Math.sin(arcStart) * outerR;

  const xFacetL = -2.10;
  const yFacetL = -1.10;
  const xFacetR = 2.10;
  const yFacetR = -1.10;

  shape.moveTo(pinWebR, pinY * 0.75);
  shape.quadraticCurveTo(pinWebR * 0.92, pinY + 0.50, 0, pinY + 0.52);
  shape.quadraticCurveTo(-pinWebR * 0.92, pinY + 0.50, -pinWebR, pinY * 0.75);
  shape.lineTo(-waistR, 0.35);
  shape.quadraticCurveTo(-1.45, -0.40, xFacetL, yFacetL);
  shape.lineTo(xArcL, yArcL);
  shape.absarc(0, 0, outerR, arcStart, arcEnd, false);
  shape.lineTo(xFacetR, yFacetR);
  shape.quadraticCurveTo(1.45, -0.40, waistR, 0.35);
  shape.lineTo(pinWebR, pinY * 0.75);
  shape.closePath();
  return shape;
}

function createGearShape(
  numTeeth: number,
  rootRadius: number,
  tipRadius: number,
  toothTipFraction: number = 0.35,
  toothRootFraction: number = 0.65
): THREE.Shape {
  const shape = new THREE.Shape();
  const dTheta = (2 * Math.PI) / numTeeth;
  const halfTipAngle = (dTheta * toothTipFraction) / 2;
  const halfRootAngle = (dTheta * toothRootFraction) / 2;

  for (let i = 0; i < numTeeth; i++) {
    const centerAngle = i * dTheta;
    const angleFlankStart = centerAngle - halfRootAngle;
    const angleTipStart = centerAngle - halfTipAngle;
    const angleTipEnd = centerAngle + halfTipAngle;
    const angleFlankEnd = centerAngle + halfRootAngle;

    if (i === 0) {
      const x0 = Math.cos(angleFlankStart) * rootRadius;
      const y0 = Math.sin(angleFlankStart) * rootRadius;
      shape.moveTo(x0, y0);
    } else {
      shape.lineTo(Math.cos(angleFlankStart) * rootRadius, Math.sin(angleFlankStart) * rootRadius);
    }

    // Flank rising to tooth tip
    shape.lineTo(Math.cos(angleTipStart) * tipRadius, Math.sin(angleTipStart) * tipRadius);
    // Across flat tooth crest
    shape.lineTo(Math.cos(angleTipEnd) * tipRadius, Math.sin(angleTipEnd) * tipRadius);
    // Flank falling back to root land
    shape.lineTo(Math.cos(angleFlankEnd) * rootRadius, Math.sin(angleFlankEnd) * rootRadius);
  }

  shape.closePath();
  return shape;
}

function createCamLobeShape(baseR: number = 0.36, noseOffset: number = 0.20, noseR: number = 0.16): THREE.Shape {
  const shape = new THREE.Shape();
  const a1 = (30 * Math.PI) / 180;
  const a2 = (150 * Math.PI) / 180;
  shape.absarc(0, 0, baseR, a1, a2, false);
  shape.lineTo(-noseR, -noseOffset);
  shape.absarc(0, -noseOffset, noseR, Math.PI, 0, false);
  shape.lineTo(baseR * Math.cos(a1), baseR * Math.sin(a1));
  shape.closePath();
  return shape;
}

export const BOXER_CYL_Z: Record<number, number> = {
  1: 4.20,   // Bank 1 Left Front
  2: 1.46,   // Bank 2 Right Front
  3: -1.46,  // Bank 1 Left Rear
  4: -4.20,  // Bank 2 Right Rear
};

export class Boxer4Assembly {
  public root: THREE.Group;
  public nodes: Boxer4AssemblyNodes;
  public materials: EngineMaterialPalette;

  private rotatingCamshafts: THREE.Group[] = [];

  private readonly scale: number = 0.05;
  private readonly crankRadius: number = 39.5 * this.scale; // 79.0 mm stroke / 2 = 1.975
  private readonly conRodLength: number = 130.5 * this.scale; // 130.5 mm rod = 6.525
  private readonly boreRadius: number = 49.75 * this.scale; // 99.5 mm bore / 2 = 2.4875
  private readonly cylinderSpacingZ: number = 104.0 * this.scale; // 5.20
  private readonly zStart: number = 0.5 * 5.20; // 2.60

  constructor(materials: EngineMaterialPalette) {
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'Subaru_EJ257_Boxer4_Root';

    this.nodes = this.buildAssembly();
    this.root.add(this.nodes.rootGroup);
  }

  private buildAssembly(): Boxer4AssemblyNodes {
    const rootGroup = new THREE.Group();

    // 1. Horizontally-Opposed Split Aluminum Crankcase
    const crankcaseGroup = new THREE.Group();
    crankcaseGroup.name = 'Boxer_CrankcaseGroup';
    const {
      bank1HeadGroup,
      bank2HeadGroup,
      bank1CoverGroup,
      bank2CoverGroup,
      oilPanGroup,
      timingBeltCoverGroup,
    } = this.buildCrankcase(crankcaseGroup);
    rootGroup.add(crankcaseGroup);

    // 2. 180° Boxer 4-Throw Crankshaft with 5 Main Bearings
    const crankshaftGroup = new THREE.Group();
    crankshaftGroup.name = 'Boxer_CrankshaftGroup';
    const { flywheel, damper } = this.buildCrankshaft(crankshaftGroup);
    rootGroup.add(crankshaftGroup);

    // 3. Camshafts & Timing Belt Pulleys
    const camshaftsGroup = new THREE.Group();
    camshaftsGroup.name = 'Boxer_CamshaftsGroup';
    this.buildCamshafts(camshaftsGroup);
    rootGroup.add(camshaftsGroup);

    // 4. Iconic Subaru Top-Mount Intercooler (TMIC) & Intake Manifold
    const tmicGroup = new THREE.Group();
    tmicGroup.name = 'Boxer_TMIC_Group';
    const throttleBlade = this.buildTopMountIntercooler(tmicGroup);
    rootGroup.add(tmicGroup);

    // 5. Unequal Length (UEL) Exhaust Headers & Turbocharger
    const uelHeadersGroup = new THREE.Group();
    uelHeadersGroup.name = 'Boxer_UEL_HeadersGroup';
    const turboGroup = this.buildUelHeadersAndTurbo(uelHeadersGroup);
    rootGroup.add(uelHeadersGroup);
    rootGroup.add(turboGroup);

    // 6. Cylinders (4 Horizontally Opposed Pistons, Connecting Rods, Valves, Liners)
    const pistons: THREE.Group[] = [];
    const connectingRods: THREE.Group[] = [];
    const intakeValves: THREE.Group[] = [];
    const exhaustValves: THREE.Group[] = [];
    const intakeSprings: THREE.Mesh[][] = [];
    const exhaustSprings: THREE.Mesh[][] = [];
    const sparkPlugs: THREE.Group[] = [];
    const cylinderLiners: THREE.Mesh[] = [];

    const cylConfigs = ENGINES.boxer4_subaru.cylinders;

    cylConfigs.forEach((cfg) => {
      const cylZ = BOXER_CYL_Z[cfg.id] ?? (cfg.bankIndex === 0 ? this.zStart : -this.zStart);
      const bankSign = cfg.bank === 1 ? -1 : 1; // Bank 1 is Left (-X), Bank 2 is Right (+X)

      // Piston
      const piston = this.buildPiston(cfg.id);
      rootGroup.add(piston);
      pistons.push(piston);

      // Connecting Rod
      const rod = this.buildConnectingRod(cfg.id);
      rootGroup.add(rod);
      connectingRods.push(rod);

      // Top End: Valves, Springs, Spark Plug, Liner
      const { inValve, exValve, inSpringPair, exSpringPair, sparkPlug, liner } =
        this.buildCylinderTopEnd(cfg.id, cylZ, bankSign);

      rootGroup.add(inValve);
      intakeValves.push(inValve);
      intakeSprings.push(inSpringPair);

      rootGroup.add(exValve);
      exhaustValves.push(exValve);
      exhaustSprings.push(exSpringPair);

      rootGroup.add(sparkPlug);
      sparkPlugs.push(sparkPlug);

      rootGroup.add(liner);
      cylinderLiners.push(liner);
    });

    return {
      rootGroup,
      crankcaseGroup,
      crankshaftGroup,
      flywheelMesh: flywheel,
      damperMesh: damper,
      throttleBladeGroup: throttleBlade,
      camshaftsGroup,
      tmicGroup,
      uelHeadersGroup,
      turboGroup,
      pistons,
      connectingRods,
      intakeValves,
      exhaustValves,
      intakeSprings,
      exhaustSprings,
      sparkPlugs,
      cylinderLiners,
      bank1HeadGroup,
      bank2HeadGroup,
      bank1CoverGroup,
      bank2CoverGroup,
      oilPanGroup,
      timingBeltCoverGroup,
    };
  }

  private buildCrankcase(parent: THREE.Group) {
    const caseLen = this.cylinderSpacingZ * 2.8;

    // Central Split Crankcase Housing
    const caseGeo = new THREE.BoxGeometry(this.boreRadius * 2.8, this.boreRadius * 2.2, caseLen);
    const caseMesh = new THREE.Mesh(caseGeo, this.materials.block);
    caseMesh.castShadow = true;
    caseMesh.receiveShadow = true;
    caseMesh.userData = { componentId: 'engine_block' };
    parent.add(caseMesh);

    // Left Half Cylinder Barrels (Bank 1: Cyl 1, 3)
    const b1BarrelsGeo = new THREE.BoxGeometry(this.conRodLength * 0.75, this.boreRadius * 2.1, caseLen * 0.95);
    const b1Barrels = new THREE.Mesh(b1BarrelsGeo, this.materials.block);
    b1Barrels.position.set(-this.boreRadius * 1.4 - this.conRodLength * 0.35, 0, 0);
    b1Barrels.castShadow = true;
    parent.add(b1Barrels);

    // Right Half Cylinder Barrels (Bank 2: Cyl 2, 4)
    const b2BarrelsGeo = new THREE.BoxGeometry(this.conRodLength * 0.75, this.boreRadius * 2.1, caseLen * 0.95);
    const b2Barrels = new THREE.Mesh(b2BarrelsGeo, this.materials.block);
    b2Barrels.position.set(this.boreRadius * 1.4 + this.conRodLength * 0.35, 0, 0);
    b2Barrels.castShadow = true;
    parent.add(b2Barrels);

    // 5 Main Bearing Bulkheads inside split case
    const mainBulkheads = [
      { z: 5.50, len: 0.60 },
      { z: 2.83, len: 0.60 },
      { z: 0.00, len: 1.00 },
      { z: -2.83, len: 0.60 },
      { z: -5.50, len: 0.60 },
    ];
    mainBulkheads.forEach((bh) => {
      const capGeo = new THREE.CylinderGeometry(1.15, 1.15, bh.len, 20);
      capGeo.rotateX(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, this.materials.mainCap);
      cap.position.set(0, 0, bh.z);
      parent.add(cap);
    });

    // Bank 1 Head Group (Left, -X)
    const bank1HeadGroup = new THREE.Group();
    bank1HeadGroup.name = 'Boxer_B1_Head';
    const head1Geo = new THREE.BoxGeometry(2.8, this.boreRadius * 2.2, caseLen * 0.96);
    const head1 = new THREE.Mesh(head1Geo, this.materials.block);
    head1.position.set(-10.55, 0, 0);
    head1.castShadow = true;
    head1.userData = { componentId: 'engine_block' };
    bank1HeadGroup.add(head1);
    parent.add(bank1HeadGroup);

    // Bank 2 Head Group (Right, +X)
    const bank2HeadGroup = new THREE.Group();
    bank2HeadGroup.name = 'Boxer_B2_Head';
    const head2Geo = new THREE.BoxGeometry(2.8, this.boreRadius * 2.2, caseLen * 0.96);
    const head2 = new THREE.Mesh(head2Geo, this.materials.block);
    head2.position.set(10.55, 0, 0);
    head2.castShadow = true;
    head2.userData = { componentId: 'engine_block' };
    bank2HeadGroup.add(head2);
    parent.add(bank2HeadGroup);

    // Bank 1 Valve Cover (Red STI wrinkle finish)
    const bank1CoverGroup = new THREE.Group();
    bank1CoverGroup.name = 'Boxer_B1_Cover';
    const cover1Geo = new THREE.BoxGeometry(0.8, this.boreRadius * 2.0, caseLen * 0.9);
    const cover1 = new THREE.Mesh(cover1Geo, this.materials.block);
    cover1.position.set(-12.10, 0, 0);
    cover1.castShadow = true;
    cover1.userData = { componentId: 'engine_block' };
    bank1CoverGroup.add(cover1);
    parent.add(bank1CoverGroup);

    // Bank 2 Valve Cover
    const bank2CoverGroup = new THREE.Group();
    bank2CoverGroup.name = 'Boxer_B2_Cover';
    const cover2Geo = new THREE.BoxGeometry(0.8, this.boreRadius * 2.0, caseLen * 0.9);
    const cover2 = new THREE.Mesh(cover2Geo, this.materials.block);
    cover2.position.set(12.10, 0, 0);
    cover2.castShadow = true;
    cover2.userData = { componentId: 'engine_block' };
    bank2CoverGroup.add(cover2);
    parent.add(bank2CoverGroup);

    // Oil Pan (Bottom -Y)
    const oilPanGroup = new THREE.Group();
    oilPanGroup.name = 'Boxer_OilPan';
    const panGeo = new THREE.BoxGeometry(this.boreRadius * 2.2, 1.8, caseLen * 0.85);
    const pan = new THREE.Mesh(panGeo, this.materials.block);
    pan.position.set(0, -this.boreRadius * 1.8, 0);
    pan.castShadow = true;
    pan.userData = { componentId: 'engine_block' };
    oilPanGroup.add(pan);
    parent.add(oilPanGroup);

    // Front Timing Belt Cover
    const timingBeltCoverGroup = new THREE.Group();
    timingBeltCoverGroup.name = 'Boxer_TimingBeltCover';
    const frontZ = caseLen * 0.5 + 0.6;
    const tcGeo = new THREE.BoxGeometry(25.5, this.boreRadius * 2.4, 0.45);
    const tc = new THREE.Mesh(tcGeo, this.materials.block);
    tc.position.set(0, 0, frontZ);
    tc.castShadow = true;
    timingBeltCoverGroup.add(tc);
    parent.add(timingBeltCoverGroup);

    return {
      bank1HeadGroup,
      bank2HeadGroup,
      bank1CoverGroup,
      bank2CoverGroup,
      oilPanGroup,
      timingBeltCoverGroup,
    };
  }

  private buildCrankshaft(parent: THREE.Group): { flywheel: THREE.Mesh; damper: THREE.Mesh } {
    const mainJournalRadius = 0.72;
    const rodJournalRadius = 0.66;
    const rodJournalLen = 0.84;

    // 1. Counterweight 3D Geometry (Forged steel with precision chamfered bevels)
    const cwShape = createAuthenticBoxerCounterweightShape(this.crankRadius);
    const cwGeo = new THREE.ExtrudeGeometry(cwShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    cwGeo.translate(0, 0, -0.17);

    // 2. 5 Continuous Main Bearing Journals
    // Seamlessly bridging counterweight webs with 0.00 penetration into counterweight cheeks
    const mainJournals = [
      { z: 6.13, len: 2.34 },   // J1 (Front): spans 4.96 to 7.30 leading to front damper snout
      { z: 2.83, len: 1.22 },   // J2 (Intermediate front): spans 2.22 to 3.44 bridging Cyl 2 and Cyl 1
      { z: 0.00, len: 1.40 },   // J3 (CENTER MAIN JOURNAL): spans -0.70 to 0.70 solidly joining front and rear throws
      { z: -2.83, len: 1.22 },  // J4 (Intermediate rear): spans -3.44 to -2.22 bridging Cyl 3 and Cyl 4
      { z: -6.13, len: 2.34 },  // J5 (Rear): spans -7.30 to -4.96 leading to flywheel flange
    ];

    mainJournals.forEach((j) => {
      const mjGeo = new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, j.len, 28);
      mjGeo.rotateX(Math.PI / 2);
      const mj = new THREE.Mesh(mjGeo, this.materials.crankshaft);
      mj.position.set(0, 0, j.z);
      mj.castShadow = true;
      mj.userData = { componentId: 'crankshaft' };
      parent.add(mj);
    });

    // 3. 4 Boxer Crank Throws
    const pinConfigs = [
      { id: 1, angleDeg: 0,   z: BOXER_CYL_Z[1] },
      { id: 2, angleDeg: 180, z: BOXER_CYL_Z[2] },
      { id: 3, angleDeg: 180, z: BOXER_CYL_Z[3] },
      { id: 4, angleDeg: 0,   z: BOXER_CYL_Z[4] },
    ];

    pinConfigs.forEach((pc) => {
      const angleRad = (pc.angleDeg * Math.PI) / 180;
      const pinX = Math.cos(angleRad) * this.crankRadius;
      const pinY = Math.sin(angleRad) * this.crankRadius;

      // Crankpin Journal
      const pinGeo = new THREE.CylinderGeometry(rodJournalRadius, rodJournalRadius, rodJournalLen, 24);
      pinGeo.rotateX(Math.PI / 2);
      const pin = new THREE.Mesh(pinGeo, this.materials.crankshaft);
      pin.position.set(pinX, pinY, pc.z);
      pin.castShadow = true;
      pin.userData = { componentId: 'crankshaft' };
      parent.add(pin);

      // Flanking Counterweight Webs (Clean forged slabs without protruding extra rods)
      [-0.59, 0.59].forEach((oz) => {
        const cwMesh = new THREE.Mesh(cwGeo, this.materials.crankCounterweight);
        cwMesh.position.set(0, 0, pc.z + oz);
        cwMesh.rotation.z = angleRad - Math.PI / 2;
        cwMesh.castShadow = true;
        cwMesh.userData = { componentId: 'crankshaft' };
        parent.add(cwMesh);
      });
    });

    // Rear Flywheel with 64-Tooth Starter Ring Gear
    const rearZ = -7.45;
    const flywheelTeeth = 64;
    const flywheelTipR = 3.55;
    const flywheelRootR = 3.25;
    const flywheelDepth = 0.70;
    const flywheelShape = createGearShape(flywheelTeeth, flywheelRootR, flywheelTipR, 0.36, 0.65);

    const flywheelGeo = new THREE.ExtrudeGeometry(flywheelShape, {
      depth: flywheelDepth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    flywheelGeo.translate(0, 0, -flywheelDepth / 2);

    const flywheel = new THREE.Mesh(flywheelGeo, this.materials.flywheel);
    flywheel.position.set(0, 0, rearZ);
    flywheel.castShadow = true;
    flywheel.userData = { componentId: 'flywheel', baseZ: rearZ };

    // Machined Inner Friction Face (Clutch contact disc)
    const frictionGeo = new THREE.CylinderGeometry(3.22, 3.22, flywheelDepth * 0.95, 48);
    frictionGeo.rotateX(Math.PI / 2);
    const frictionFace = new THREE.Mesh(frictionGeo, this.materials.crankshaft);
    flywheel.add(frictionFace);

    // Recessed Center Hub
    const hubGeo = new THREE.CylinderGeometry(1.45, 1.45, flywheelDepth * 1.02, 36);
    hubGeo.rotateX(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, this.materials.flywheel);
    flywheel.add(hubMesh);

    // Center Pilot Bearing Bore
    const pilotGeo = new THREE.CylinderGeometry(0.52, 0.52, flywheelDepth * 1.06, 24);
    pilotGeo.rotateX(Math.PI / 2);
    const pilotMesh = new THREE.Mesh(pilotGeo, this.materials.crankshaft);
    flywheel.add(pilotMesh);

    // 8 Perimeter Crankshaft Mounting Hex Bolts
    const boltCircleR = 1.00;
    for (let b = 0; b < 8; b++) {
      const bAngle = (b * Math.PI) / 4;
      const bGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 6);
      bGeo.rotateX(Math.PI / 2);
      const boltMesh = new THREE.Mesh(bGeo, this.materials.sparkPlugMetal);
      boltMesh.position.set(
        Math.cos(bAngle) * boltCircleR,
        Math.sin(bAngle) * boltCircleR,
        -flywheelDepth / 2 - 0.06
      );
      flywheel.add(boltMesh);
    }

    parent.add(flywheel);

    // Front Crankshaft Damper Pulley (+Z)
    const frontZ = 7.45;
    const damperGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.65, 28);
    damperGeo.rotateX(Math.PI / 2);
    const damper = new THREE.Mesh(damperGeo, this.materials.crankCounterweight);
    damper.position.set(0, 0, frontZ);
    damper.castShadow = true;
    damper.userData = { componentId: 'crankshaft', baseZ: frontZ };
    parent.add(damper);

    return { flywheel, damper };
  }

  private buildCamshafts(parent: THREE.Group) {
    // 4 Camshafts total (2 on Bank 1 Left, 2 on Bank 2 Right)
    const frontZ = this.cylinderSpacingZ * 1.4;
    const camRearZ = -6.0;
    const camFrontZ = frontZ - 0.02;
    const camLen = camFrontZ - camRearZ;
    const camCenterZ = (camRearZ + camFrontZ) / 2;

    const pulleyTeeth = 32;
    const pulleyTipR = 0.95;
    const pulleyRootR = 0.82;
    const pulleyDepth = 0.25;
    const pulleyShape = createGearShape(pulleyTeeth, pulleyRootR, pulleyTipR, 0.35, 0.65);

    const buildPulley = () => {
      const pulleyGroup = new THREE.Group();
      pulleyGroup.position.set(0, 0, frontZ);

      // Toothed Belt Rim
      const pGeo = new THREE.ExtrudeGeometry(pulleyShape, {
        depth: pulleyDepth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      });
      pGeo.translate(0, 0, -pulleyDepth / 2);
      const pulleyMesh = new THREE.Mesh(pGeo, this.materials.camshaft);
      pulleyGroup.add(pulleyMesh);

      // Recessed Center Web
      const webGeo = new THREE.CylinderGeometry(0.80, 0.80, pulleyDepth * 0.65, 32);
      webGeo.rotateX(Math.PI / 2);
      const web = new THREE.Mesh(webGeo, this.materials.crankshaft);
      pulleyGroup.add(web);

      // Center Hex Retaining Bolt
      const boltGeo = new THREE.CylinderGeometry(0.14, 0.14, pulleyDepth * 1.4, 6);
      boltGeo.rotateX(Math.PI / 2);
      const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
      pulleyGroup.add(bolt);

      return pulleyGroup;
    };

    const camLobeShape = createCamLobeShape(0.36, 0.20, 0.16);
    const lobeGeo = new THREE.ExtrudeGeometry(camLobeShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    lobeGeo.translate(0, 0, -0.14);

    [-1, 1].forEach((bankSign) => {
      const camX = bankSign * 11.60;
      const bankCylZs = bankSign === -1 ? [BOXER_CYL_Z[1], BOXER_CYL_Z[3]] : [BOXER_CYL_Z[2], BOXER_CYL_Z[4]];

      // Intake Cam Assembly (Top Y = +1.10)
      const inCamGroup = new THREE.Group();
      inCamGroup.position.set(camX, 1.10, 0);
      inCamGroup.userData = { baseX: camX };

      const inCamGeo = new THREE.CylinderGeometry(0.35, 0.35, camLen, 24);
      inCamGeo.rotateX(Math.PI / 2);
      const inCam = new THREE.Mesh(inCamGeo, this.materials.camshaft);
      inCam.position.set(0, 0, camCenterZ);
      inCam.userData = { componentId: 'camshaft' };
      inCamGroup.add(inCam);

      // Machined Camshaft Thrust Collar linking directly into the gear
      const collarGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.20, 24);
      collarGeo.rotateX(Math.PI / 2);
      const inCollar = new THREE.Mesh(collarGeo, this.materials.crankshaft);
      inCollar.position.set(0, 0, frontZ - pulleyDepth / 2 - 0.10);
      inCamGroup.add(inCollar);

      // Ground Camshaft Bearing Journals
      [5.6, 0.0, -5.2].forEach((jz) => {
        const jGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.45, 20);
        jGeo.rotateX(Math.PI / 2);
        const jMesh = new THREE.Mesh(jGeo, this.materials.crankshaft);
        jMesh.position.set(0, 0, jz);
        inCamGroup.add(jMesh);
      });

      // Intake Cam Lobes (Teardrop profiles positioned above intake valves)
      bankCylZs.forEach((cylZ) => {
        [-0.45, 0.45].forEach((vz) => {
          const lobeMesh = new THREE.Mesh(lobeGeo, this.materials.crankshaft);
          lobeMesh.position.set(0, 0, cylZ + vz);
          inCamGroup.add(lobeMesh);
        });
      });

      inCamGroup.add(buildPulley());
      parent.add(inCamGroup);
      this.rotatingCamshafts.push(inCamGroup);

      // Exhaust Cam Assembly (Bottom Y = -1.10)
      const exCamGroup = new THREE.Group();
      exCamGroup.position.set(camX, -1.10, 0);
      exCamGroup.userData = { baseX: camX };

      const exCamGeo = new THREE.CylinderGeometry(0.35, 0.35, camLen, 24);
      exCamGeo.rotateX(Math.PI / 2);
      const exCam = new THREE.Mesh(exCamGeo, this.materials.camshaft);
      exCam.position.set(0, 0, camCenterZ);
      exCam.userData = { componentId: 'camshaft' };
      exCamGroup.add(exCam);

      // Machined Camshaft Thrust Collar linking directly into the gear
      const exCollar = new THREE.Mesh(collarGeo, this.materials.crankshaft);
      exCollar.position.set(0, 0, frontZ - pulleyDepth / 2 - 0.10);
      exCamGroup.add(exCollar);

      // Ground Camshaft Bearing Journals
      [5.6, 0.0, -5.2].forEach((jz) => {
        const jGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.45, 20);
        jGeo.rotateX(Math.PI / 2);
        const jMesh = new THREE.Mesh(jGeo, this.materials.crankshaft);
        jMesh.position.set(0, 0, jz);
        exCamGroup.add(jMesh);
      });

      // Exhaust Cam Lobes (Teardrop profiles inverted so nose points toward exhaust valves)
      bankCylZs.forEach((cylZ) => {
        [-0.45, 0.45].forEach((vz) => {
          const lobeMesh = new THREE.Mesh(lobeGeo, this.materials.crankshaft);
          lobeMesh.rotation.z = Math.PI;
          lobeMesh.position.set(0, 0, cylZ + vz);
          exCamGroup.add(lobeMesh);
        });
      });

      exCamGroup.add(buildPulley());
      parent.add(exCamGroup);
      this.rotatingCamshafts.push(exCamGroup);
    });
  }

  private buildTopMountIntercooler(parent: THREE.Group): THREE.Group {
    const group = new THREE.Group();

    // Iconic Subaru WRX STI Top-Mount Intercooler Core
    const coreGeo = new THREE.BoxGeometry(6.4, 1.2, 5.0);
    const core = new THREE.Mesh(coreGeo, this.materials.intakeManifold);
    core.position.set(0, this.boreRadius * 1.9, -0.4);
    core.castShadow = true;
    core.userData = { componentId: 'intake_manifold' };
    group.add(core);

    // Red STI Logo Plate across the intercooler fins
    const plateGeo = new THREE.BoxGeometry(4.8, 0.08, 0.9);
    const plate = new THREE.Mesh(plateGeo, this.materials.sparkPlugMetal);
    plate.position.set(0, this.boreRadius * 1.9 + 0.65, -0.4);
    group.add(plate);

    // Cast Intake Manifold (curving down from intercooler into left and right heads)
    const manifoldGeo = new THREE.BoxGeometry(5.8, 0.8, 3.8);
    const manifold = new THREE.Mesh(manifoldGeo, this.materials.intakeManifold);
    manifold.position.set(0, this.boreRadius * 1.3, 0);
    group.add(manifold);

    // Electronic Throttle Body on Passenger Side Rear
    const tbGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.1, 20);
    tbGeo.rotateX(Math.PI / 2);
    const tb = new THREE.Mesh(tbGeo, this.materials.sparkPlugMetal);
    tb.position.set(2.4, this.boreRadius * 1.3, -2.2);
    group.add(tb);

    // Rotating Throttle Blade
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(2.4, this.boreRadius * 1.3, -2.2);
    const bladeGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 20);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, this.materials.sparkPlugMetal);
    bladeGroup.add(blade);
    group.add(bladeGroup);

    parent.add(group);
    return bladeGroup;
  }

  private buildUelHeadersAndTurbo(parent: THREE.Group): THREE.Group {
    const turboGroup = new THREE.Group();
    turboGroup.name = 'Boxer_Turbo_Group';

    // 1. Four Exhaust Port Flanges underneath Cylinder Heads (facing -Y)
    const portFlanges = [
      { cyl: 1, x: -7.8, y: -2.3, z: BOXER_CYL_Z[1] },
      { cyl: 3, x: -7.8, y: -2.3, z: BOXER_CYL_Z[3] },
      { cyl: 2, x: 7.8,  y: -2.3, z: BOXER_CYL_Z[2] },
      { cyl: 4, x: 7.8,  y: -2.3, z: BOXER_CYL_Z[4] },
    ];

    portFlanges.forEach((pf) => {
      const flGeo = new THREE.BoxGeometry(0.35, 0.22, 0.85);
      const fl = new THREE.Mesh(flGeo, this.materials.exhaustHeaders);
      fl.position.set(pf.x, pf.y, pf.z);
      parent.add(fl);
    });

    // 2. Bank 1 (Left Side, Cyl 1 & 3) Independent Flank Exhaust Runners & Rear Downpipe:
    // (NO CENTER CROSSOVER EXHAUST - all Bank 1 exhaust remains completely on the left flank X <= -5.6)
    const c1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.8, -2.3, BOXER_CYL_Z[1]),
      new THREE.Vector3(-7.2, -4.0, 3.2),
      new THREE.Vector3(-6.2, -5.0, 1.5),
      new THREE.Vector3(-5.6, -5.0, 0.0),
    ]);
    const c1Tube = new THREE.Mesh(new THREE.TubeGeometry(c1Curve, 20, 0.32, 12, false), this.materials.exhaustHeaders);
    c1Tube.castShadow = true;
    parent.add(c1Tube);

    const c3Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.8, -2.3, BOXER_CYL_Z[3]),
      new THREE.Vector3(-7.2, -4.0, -1.8),
      new THREE.Vector3(-6.2, -5.0, -0.8),
      new THREE.Vector3(-5.6, -5.0, 0.0),
    ]);
    const c3Tube = new THREE.Mesh(new THREE.TubeGeometry(c3Curve, 20, 0.32, 12, false), this.materials.exhaustHeaders);
    c3Tube.castShadow = true;
    parent.add(c3Tube);

    // Bank 1 Dual-Exit Performance Downpipe (running along left outer skirt to rear)
    const b1DownpipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.6, -5.0, 0.0),
      new THREE.Vector3(-5.6, -5.0, -3.0),
      new THREE.Vector3(-5.6, -4.8, -6.0),
      new THREE.Vector3(-5.6, -4.5, -8.0),
    ]);
    const b1DpTube = new THREE.Mesh(new THREE.TubeGeometry(b1DownpipeCurve, 24, 0.36, 12, false), this.materials.exhaustHeaders);
    b1DpTube.castShadow = true;
    parent.add(b1DpTube);

    // 3. Bank 2 (Right Side, Cyl 2 & 4) Independent Flank Exhaust Runners & Rear Downpipe:
    // (All Bank 2 exhaust remains completely on the right flank X >= 5.6, Y <= -4.0, zero central/top clipping)
    const c2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(7.8, -2.3, BOXER_CYL_Z[2]),
      new THREE.Vector3(7.2, -4.0, 0.5),
      new THREE.Vector3(6.2, -5.0, -0.8),
      new THREE.Vector3(5.6, -5.0, -2.0),
    ]);
    const c2Tube = new THREE.Mesh(new THREE.TubeGeometry(c2Curve, 20, 0.32, 12, false), this.materials.exhaustHeaders);
    c2Tube.castShadow = true;
    parent.add(c2Tube);

    const c4Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(7.8, -2.3, BOXER_CYL_Z[4]),
      new THREE.Vector3(7.2, -4.0, -3.5),
      new THREE.Vector3(6.2, -5.0, -2.8),
      new THREE.Vector3(5.6, -5.0, -2.0),
    ]);
    const c4Tube = new THREE.Mesh(new THREE.TubeGeometry(c4Curve, 20, 0.32, 12, false), this.materials.exhaustHeaders);
    c4Tube.castShadow = true;
    parent.add(c4Tube);

    // Bank 2 Performance Downpipe (running along right outer skirt to rear)
    const b2DownpipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.6, -5.0, -2.0),
      new THREE.Vector3(5.6, -5.0, -4.0),
      new THREE.Vector3(5.6, -4.8, -6.0),
      new THREE.Vector3(5.6, -4.5, -8.0),
    ]);
    const b2DpTube = new THREE.Mesh(new THREE.TubeGeometry(b2DownpipeCurve, 24, 0.36, 12, false), this.materials.exhaustHeaders);
    b2DpTube.castShadow = true;
    parent.add(b2DpTube);

    return turboGroup;
  }

  private buildPiston(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `Boxer_Piston_${cylId}`;

    // Large 99.5 mm Oversquare Piston Crown
    const crownGeo = new THREE.CylinderGeometry(this.boreRadius * 0.96, this.boreRadius * 0.96, 1.7, 32);
    crownGeo.rotateZ(Math.PI / 2);
    const crown = new THREE.Mesh(crownGeo, this.materials.piston);
    crown.castShadow = true;
    crown.userData = { componentId: 'piston', cylId };
    group.add(crown);

    // Wrist pin
    const pinGeo = new THREE.CylinderGeometry(0.40, 0.40, this.boreRadius * 1.7, 16);
    pinGeo.rotateX(Math.PI / 2);
    const pin = new THREE.Mesh(pinGeo, this.materials.crankshaft);
    group.add(pin);

    return group;
  }

  private buildConnectingRod(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `Boxer_Rod_${cylId}`;

    // Big End
    const bigEndGeo = new THREE.CylinderGeometry(0.98, 0.98, 0.68, 24);
    bigEndGeo.rotateX(Math.PI / 2);
    const bigEnd = new THREE.Mesh(bigEndGeo, this.materials.conRod);
    bigEnd.castShadow = true;
    bigEnd.userData = { componentId: 'connecting_rod', cylId };
    group.add(bigEnd);

    // Rod Beam
    const beamGeo = new THREE.BoxGeometry(this.conRodLength, 0.48, 0.36);
    const beam = new THREE.Mesh(beamGeo, this.materials.conRod);
    beam.position.set(this.conRodLength * 0.5, 0, 0);
    beam.castShadow = true;
    beam.userData = { componentId: 'connecting_rod', cylId };
    group.add(beam);

    // Small End
    const smallEndGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.75, 18);
    smallEndGeo.rotateX(Math.PI / 2);
    const smallEnd = new THREE.Mesh(smallEndGeo, this.materials.conRod);
    smallEnd.position.set(this.conRodLength, 0, 0);
    smallEnd.castShadow = true;
    group.add(smallEnd);

    return group;
  }

  private buildCylinderTopEnd(cylId: number, zPos: number, bankSign: number) {
    const headX = bankSign * 9.55;
    const theta = (16 * Math.PI) / 180;

    // Intake Valves (Top, inclined upward in pent-roof V-shape)
    const inValve = new THREE.Group();
    inValve.name = `Boxer_InValve_${cylId}`;
    const inSpringPair: THREE.Mesh[] = [];

    [-0.45, 0.45].forEach((vz) => {
      // 1. Valve Head: Poppet mushroom with wide flat face facing INWARD (-bankSign) into cylinder
      const vHeadGeo = new THREE.CylinderGeometry(0.12, 0.48, 0.22, 16);
      vHeadGeo.rotateZ(-bankSign * Math.PI / 2);
      const vHead = new THREE.Mesh(vHeadGeo, this.materials.valveIntake);
      vHead.position.set(bankSign * 0.11, 0, vz);
      vHead.castShadow = true;
      inValve.add(vHead);

      // 2. Valve Stem: Slender rod extending OUTWARD (+bankSign) towards camshaft
      const vGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12);
      vGeo.rotateZ(Math.PI / 2);
      const vStem = new THREE.Mesh(vGeo, this.materials.valveIntake);
      vStem.position.set(bankSign * 1.10, 0, vz);
      vStem.castShadow = true;
      inValve.add(vStem);

      // 3. Authentic 3D Helical Coil Spring
      const inHelix = new HelixCurve(0.24, 1.15, 6.0);
      const inSpringGeo = new THREE.TubeGeometry(inHelix, 48, 0.040, 8, false);
      inSpringGeo.rotateZ(-bankSign * Math.PI / 2);
      const sp = new THREE.Mesh(inSpringGeo, this.materials.valveSpring);
      sp.position.set(bankSign * 0.20, 0, vz);
      sp.castShadow = true;
      inValve.add(sp);
      inSpringPair.push(sp);

      // 4. Valve Spring Retainer Washer
      const retGeo = new THREE.CylinderGeometry(0.36, 0.26, 0.12, 16);
      retGeo.rotateZ(-bankSign * Math.PI / 2);
      const ret = new THREE.Mesh(retGeo, this.materials.sparkPlugMetal);
      ret.position.set(bankSign * 1.40, 0, vz);
      inValve.add(ret);

      // 5. Cam Follower Tappet Bucket under cam lobe
      const tappetGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18);
      tappetGeo.rotateZ(Math.PI / 2);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(bankSign * 1.62, 0, vz);
      inValve.add(tappet);
    });
    inValve.position.set(headX, 0.55, zPos);
    inValve.rotation.z = bankSign * theta;

    // Exhaust Valves (Bottom, inclined downward in pent-roof V-shape)
    const exValve = new THREE.Group();
    exValve.name = `Boxer_ExValve_${cylId}`;
    const exSpringPair: THREE.Mesh[] = [];

    [-0.45, 0.45].forEach((vz) => {
      // 1. Valve Head: Poppet mushroom with wide flat face facing INWARD (-bankSign) into cylinder
      const vHeadGeo = new THREE.CylinderGeometry(0.12, 0.42, 0.22, 16);
      vHeadGeo.rotateZ(-bankSign * Math.PI / 2);
      const vHead = new THREE.Mesh(vHeadGeo, this.materials.valveExhaust);
      vHead.position.set(bankSign * 0.11, 0, vz);
      vHead.castShadow = true;
      exValve.add(vHead);

      // 2. Valve Stem: Slender rod extending OUTWARD (+bankSign) towards camshaft
      const vGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12);
      vGeo.rotateZ(Math.PI / 2);
      const vStem = new THREE.Mesh(vGeo, this.materials.valveExhaust);
      vStem.position.set(bankSign * 1.10, 0, vz);
      vStem.castShadow = true;
      exValve.add(vStem);

      // 3. Authentic 3D Helical Coil Spring
      const exHelix = new HelixCurve(0.24, 1.15, 6.0);
      const exSpringGeo = new THREE.TubeGeometry(exHelix, 48, 0.040, 8, false);
      exSpringGeo.rotateZ(-bankSign * Math.PI / 2);
      const sp = new THREE.Mesh(exSpringGeo, this.materials.valveSpring);
      sp.position.set(bankSign * 0.20, 0, vz);
      sp.castShadow = true;
      exValve.add(sp);
      exSpringPair.push(sp);

      // 4. Valve Spring Retainer Washer
      const retGeo = new THREE.CylinderGeometry(0.36, 0.26, 0.12, 16);
      retGeo.rotateZ(-bankSign * Math.PI / 2);
      const ret = new THREE.Mesh(retGeo, this.materials.sparkPlugMetal);
      ret.position.set(bankSign * 1.40, 0, vz);
      exValve.add(ret);

      // 5. Cam Follower Tappet Bucket under cam lobe
      const tappetGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18);
      tappetGeo.rotateZ(Math.PI / 2);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(bankSign * 1.62, 0, vz);
      exValve.add(tappet);
    });
    exValve.position.set(headX, -0.55, zPos);
    exValve.rotation.z = -bankSign * theta;

    // High-Detail Central Spark Plug (Horizontally mounted in combustion chamber)
    const sparkPlug = new THREE.Group();
    sparkPlug.name = `Boxer_SparkPlug_${cylId}`;

    // Threaded Steel Shell
    const plugThreadGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16);
    plugThreadGeo.rotateZ(-bankSign * Math.PI / 2);
    const plugThread = new THREE.Mesh(plugThreadGeo, this.materials.sparkPlugMetal);
    plugThread.position.set(bankSign * -0.4, 0, 0);
    sparkPlug.add(plugThread);

    // Seating Washer / Crush Gasket
    const washerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16);
    washerGeo.rotateZ(-bankSign * Math.PI / 2);
    const washer = new THREE.Mesh(washerGeo, this.materials.sparkPlugMetal);
    washer.position.set(bankSign * -0.04, 0, 0);
    sparkPlug.add(washer);

    // Hexagonal Wrench Nut (6-sided)
    const plugHexGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.55, 6);
    plugHexGeo.rotateZ(-bankSign * Math.PI / 2);
    const plugHex = new THREE.Mesh(plugHexGeo, this.materials.sparkPlugMetal);
    plugHex.position.set(bankSign * 0.25, 0, 0);
    sparkPlug.add(plugHex);

    // White Glazed Ceramic Insulator
    const plugCeramicGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.15, 16);
    plugCeramicGeo.rotateZ(-bankSign * Math.PI / 2);
    const plugCeramic = new THREE.Mesh(plugCeramicGeo, this.materials.sparkPlugCeramic);
    plugCeramic.position.set(bankSign * 0.95, 0, 0);
    sparkPlug.add(plugCeramic);

    // 4 Ceramic Anti-Flashover Ribs
    for (let rib = 0; rib < 4; rib++) {
      const ribGeo = new THREE.TorusGeometry(0.25, 0.035, 6, 16);
      ribGeo.rotateY(Math.PI / 2);
      const ribMesh = new THREE.Mesh(ribGeo, this.materials.sparkPlugCeramic);
      ribMesh.position.set(bankSign * (0.75 + rib * 0.16), 0, 0);
      sparkPlug.add(ribMesh);
    }

    // Top Electrical Terminal Stud
    const terminalGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.26, 12);
    terminalGeo.rotateZ(-bankSign * Math.PI / 2);
    const terminal = new THREE.Mesh(terminalGeo, this.materials.boltMetal);
    terminal.position.set(bankSign * 1.55, 0, 0);
    sparkPlug.add(terminal);

    // Center Electrode Tip (Iridium)
    const tipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10);
    tipGeo.rotateZ(-bankSign * Math.PI / 2);
    const tip = new THREE.Mesh(tipGeo, this.materials.sparkArc);
    tip.position.set(bankSign * -0.75, 0, 0);
    sparkPlug.add(tip);

    // Ground Electrode (L-shaped bent strap with spark gap)
    const groundGeo = new THREE.BoxGeometry(0.25, 0.06, 0.10);
    const ground = new THREE.Mesh(groundGeo, this.materials.sparkPlugMetal);
    ground.position.set(bankSign * -0.78, 0.12, 0);
    sparkPlug.add(ground);

    const groundTipGeo = new THREE.BoxGeometry(0.06, 0.14, 0.10);
    const groundTip = new THREE.Mesh(groundTipGeo, this.materials.sparkPlugMetal);
    groundTip.position.set(bankSign * -0.88, 0.06, 0);
    sparkPlug.add(groundTip);

    sparkPlug.userData = { componentId: 'spark_plug', cylId };
    sparkPlug.position.set(bankSign * 9.85, 0, zPos);

    // Cylinder Liner (Horizontal sleeve enclosing piston stroke)
    const linerGeo = new THREE.CylinderGeometry(this.boreRadius, this.boreRadius, 8.2, 32, 1, true);
    linerGeo.rotateZ(Math.PI / 2);
    const liner = new THREE.Mesh(linerGeo, this.materials.cylinderLiner);
    liner.position.set(bankSign * 5.0, 0, zPos);

    return { inValve, exValve, inSpringPair, exSpringPair, sparkPlug, liner };
  }

  public updateKinematics(
    telemetryList: CylinderTelemetry[],
    throttlePercent: number,
    explodedProgress: number = 0,
    seeThroughMode: SeeThroughMode = 'translucent',
    isCutaway: boolean = false,
    _selectedComponentId: string | null = null,
    _selectedCylinderId: number | null = null,
    masterCrankAngleDeg?: number
  ) {
    const throttleAngle = (throttlePercent / 100) * (Math.PI * 0.45);
    this.nodes.throttleBladeGroup.rotation.x = throttleAngle;

    // Master Engine Crankshaft Rotation (Continuous 3D Spin)
    const masterAngleDeg = masterCrankAngleDeg !== undefined ? masterCrankAngleDeg : (telemetryList[0]?.crankAngle ?? 0);
    const masterAngleRad = (masterAngleDeg * Math.PI) / 180;
    this.nodes.crankshaftGroup.rotation.z = masterAngleRad;

    // 4-Stroke Camshaft & Timing Pulley Rotation (1:2 ratio relative to crankshaft)
    const camAngleRad = masterAngleRad * 0.5;
    this.rotatingCamshafts.forEach((cam) => {
      cam.rotation.z = camAngleRad;
    });

    // 1. Transparency / See-Through Modes
    if (seeThroughMode === 'ghost') {
      this.materials.block.visible = false;
      this.materials.cylinderLiner.visible = false;
      this.nodes.crankcaseGroup.visible = false;
    } else if (seeThroughMode === 'translucent' || isCutaway) {
      this.nodes.crankcaseGroup.visible = true;
      this.materials.block.visible = true;
      this.materials.block.opacity = 0.16;
      this.materials.block.transparent = true;
      this.materials.block.depthWrite = false;

      this.materials.cylinderLiner.visible = true;
      this.materials.cylinderLiner.opacity = 0.28;
      this.materials.cylinderLiner.transparent = true;
      this.materials.cylinderLiner.depthWrite = false;
    } else {
      this.nodes.crankcaseGroup.visible = true;
      this.materials.block.visible = true;
      this.materials.block.opacity = 1.0;
      this.materials.block.transparent = false;
      this.materials.block.depthWrite = true;

      this.materials.cylinderLiner.visible = true;
      this.materials.cylinderLiner.opacity = 1.0;
      this.materials.cylinderLiner.transparent = false;
      this.materials.cylinderLiner.depthWrite = true;
    }

    // 2. Coordinated Radial Exploded View
    const p = explodedProgress;
    const ep = p * p * (3 - 2 * p);

    // Top-Mount Intercooler elevates Up (+Y)
    this.nodes.tmicGroup.position.set(0, ep * 6.5, 0);

    // Oil Pan & Headers drop Down (-Y)
    this.nodes.oilPanGroup.position.set(0, -ep * 4.5, 0);
    this.nodes.uelHeadersGroup.position.set(0, -ep * 5.0, 0);
    this.nodes.turboGroup.position.set(0, 0, 0);

    // Bank 1 (Left Heads & Covers) moves Left (-X)
    this.nodes.bank1HeadGroup.position.set(-ep * 3.8, 0, 0);
    this.nodes.bank1CoverGroup.position.set(-ep * 6.5, 0, 0);

    // Bank 2 (Right Heads & Covers) moves Right (+X)
    this.nodes.bank2HeadGroup.position.set(ep * 3.8, 0, 0);
    this.nodes.bank2CoverGroup.position.set(ep * 6.5, 0, 0);

    // Camshafts move radially with cylinder heads
    this.rotatingCamshafts.forEach((cam) => {
      const baseCamX = cam.userData.baseX ?? cam.position.x;
      if (cam.userData.baseX === undefined) cam.userData.baseX = baseCamX;
      const bankSign = baseCamX < 0 ? -1 : 1;
      cam.position.x = baseCamX + bankSign * ep * 3.8;
    });

    // Timing Belt Cover forward (+Z)
    this.nodes.timingBeltCoverGroup.position.set(0, 0, ep * 4.5);
    const baseDamperZ = this.nodes.damperMesh.userData?.baseZ ?? 7.45;
    this.nodes.damperMesh.position.set(0, 0, baseDamperZ + ep * 5.0);

    // Flywheel backward (-Z)
    const baseFwZ = this.nodes.flywheelMesh.userData?.baseZ ?? -7.45;
    this.nodes.flywheelMesh.position.set(0, 0, baseFwZ - ep * 4.5);

    // 3. Cylinder Kinematics (4 Horizontally Opposed Pistons)
    const cylConfigs = ENGINES.boxer4_subaru.cylinders;

    cylConfigs.forEach((cfg, idx) => {
      const telem = telemetryList[idx];
      if (!telem) return;

      const cylZ = BOXER_CYL_Z[cfg.id] ?? (cfg.bankIndex === 0 ? this.zStart : -this.zStart);
      const bankSign = cfg.bank === 1 ? -1 : 1; // -1 for Left, +1 for Right

      // Crankpin coordinates
      const pinOffsetRad = (cfg.crankpinAngleDeg * Math.PI) / 180;
      const pinAngleRad = pinOffsetRad + masterAngleRad;
      const cX = Math.cos(pinAngleRad) * this.crankRadius;
      const cY = Math.sin(pinAngleRad) * this.crankRadius;

      // Horizontal piston distance
      // Distance along X axis: s = bankSign * cX + sqrt(l^2 - cY^2)
      const underRad = Math.max(0, this.conRodLength * this.conRodLength - cY * cY);
      const s = Math.sqrt(underRad);
      const pistonX = cX + bankSign * s + bankSign * ep * 1.5;

      // Piston
      const pistonMesh = this.nodes.pistons[idx];
      if (pistonMesh) {
        pistonMesh.position.set(pistonX, 0, cylZ);
      }

      // Connecting Rod
      const rodMesh = this.nodes.connectingRods[idx];
      if (rodMesh) {
        rodMesh.position.set(cX, cY, cylZ);
        const dx = pistonX - cX;
        const dy = -cY;
        const rodAngle = Math.atan2(dy, dx);
        rodMesh.rotation.z = rodAngle;
      }

      // Valves
      const inValve = this.nodes.intakeValves[idx];
      const exValve = this.nodes.exhaustValves[idx];
      const inSpringPair = this.nodes.intakeSprings[idx];
      const exSpringPair = this.nodes.exhaustSprings[idx];
      const headBaseX = bankSign * (9.55 + ep * 3.8);
      const theta = (16 * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      if (inValve) {
        const lift = (telem.intakeValveLiftMm / 11.5) * 0.55;
        inValve.position.set(
          headBaseX - bankSign * lift * cosTheta,
          0.55 - lift * sinTheta,
          cylZ
        );
        if (inSpringPair) {
          const comp = Math.max(0.65, 1 - lift / 1.35);
          inSpringPair.forEach((sp) => sp.scale.set(comp, 1, 1));
        }
      }

      if (exValve) {
        const lift = (telem.exhaustValveLiftMm / 11.5) * 0.55;
        exValve.position.set(
          headBaseX - bankSign * lift * cosTheta,
          -0.55 + lift * sinTheta,
          cylZ
        );
        if (exSpringPair) {
          const comp = Math.max(0.65, 1 - lift / 1.35);
          exSpringPair.forEach((sp) => sp.scale.set(comp, 1, 1));
        }
      }

      // Spark Plug
      const plug = this.nodes.sparkPlugs[idx];
      if (plug) {
        plug.position.set(headBaseX + bankSign * 0.30, 0, cylZ);
      }

      // Liner
      const liner = this.nodes.cylinderLiners[idx];
      if (liner) {
        liner.position.set(bankSign * 5.0, 0, cylZ);
      }
    });
  }
}
