import * as THREE from 'three';
import { EngineMaterialPalette } from './materials';
import { CylinderTelemetry, SeeThroughMode } from '../engine/types';
import { ENGINES } from '../engine/engineRegistry';

export interface I6AssemblyNodes {
  rootGroup: THREE.Group;
  blockGroup: THREE.Group;
  crankshaftGroup: THREE.Group;
  flywheelMesh: THREE.Mesh;
  damperMesh: THREE.Mesh;
  throttleBladeGroup: THREE.Group;
  camshaftsGroup: THREE.Group;
  intakeManifoldGroup: THREE.Group;
  turbosGroup: THREE.Group;
  pistons: THREE.Group[];
  connectingRods: THREE.Group[];
  intakeValves: THREE.Group[];
  exhaustValves: THREE.Group[];
  intakeSprings: THREE.Mesh[][];
  exhaustSprings: THREE.Mesh[][];
  sparkPlugs: THREE.Group[];
  cylinderLiners: THREE.Mesh[];
  cylinderHeadGroup: THREE.Group;
  valveCoverGroup: THREE.Group;
  oilPanGroup: THREE.Group;
  timingCoverGroup: THREE.Group;
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

function createAuthenticCounterweightShape(crankR: number): THREE.Shape {
  const shape = new THREE.Shape();
  const pinY = crankR;
  const pinWebR = 0.95;
  const waistR = 1.05;
  const outerR = crankR * 1.62; // 3.645

  const arcStart = (-140 * Math.PI) / 180;
  const arcEnd = (-40 * Math.PI) / 180;
  const xArcL = Math.cos(arcStart) * outerR;
  const yArcL = Math.sin(arcStart) * outerR;

  const xFacetL = -2.25;
  const yFacetL = -1.15;
  const xFacetR = 2.25;
  const yFacetR = -1.15;

  // 1. Arch over crankpin crown
  shape.moveTo(pinWebR, pinY * 0.75);
  shape.quadraticCurveTo(pinWebR * 0.92, pinY + 0.52, 0, pinY + 0.55);
  shape.quadraticCurveTo(-pinWebR * 0.92, pinY + 0.52, -pinWebR, pinY * 0.75);

  // 2. Taper down toward main journal waist
  shape.lineTo(-waistR, 0.35);

  // 3. Smooth concave flank extending outward to CNC chamfer shoulder
  shape.quadraticCurveTo(-1.50, -0.40, xFacetL, yFacetL);

  // 4. Straight angled chamfer shoulder
  shape.lineTo(xArcL, yArcL);

  // 5. Heavy circular counterweight perimeter arc
  shape.absarc(0, 0, outerR, arcStart, arcEnd, false);

  // 6. Straight angled chamfer shoulder on right
  shape.lineTo(xFacetR, yFacetR);

  // 7. Smooth concave flank returning to main journal waist
  shape.quadraticCurveTo(1.50, -0.40, waistR, 0.35);

  // 8. Return to crankpin crown
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

function createCamLobeShape(baseR: number = 0.38, noseOffset: number = 0.22, noseR: number = 0.16): THREE.Shape {
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

export class I6Assembly {
  public root: THREE.Group;
  public nodes: I6AssemblyNodes;
  public materials: EngineMaterialPalette;

  private intakeCamGroup!: THREE.Group;
  private exhaustCamGroup!: THREE.Group;

  private readonly scale: number = 0.05;
  private readonly crankRadius: number = 45.0 * this.scale; // 90.0 mm stroke / 2 = 2.25
  private readonly conRodLength: number = 144.0 * this.scale; // 144.0 mm rod = 7.20
  private readonly boreRadius: number = 42.0 * this.scale; // 84.0 mm bore / 2 = 2.10
  private readonly cylinderSpacingZ: number = 91.0 * this.scale; // 4.55
  private readonly zStart: number = 2.5 * 4.55; // Center 6 cylinders at Z = 0

  constructor(materials: EngineMaterialPalette) {
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'BMW_S58_I6_Root';

    this.nodes = this.buildAssembly();
    this.root.add(this.nodes.rootGroup);
  }

  private buildAssembly(): I6AssemblyNodes {
    const rootGroup = new THREE.Group();

    // 1. Engine Block, Oil Pan, Cylinder Head & Valve Cover
    const blockGroup = new THREE.Group();
    blockGroup.name = 'I6_BlockGroup';
    const { headGroup, coverGroup, oilPanGroup, timingCoverGroup } = this.buildBlock(blockGroup);
    rootGroup.add(blockGroup);

    // 2. 120° Symmetrical Crankshaft with 7 Main Bearings & 6 Throws
    const crankshaftGroup = new THREE.Group();
    crankshaftGroup.name = 'I6_CrankshaftGroup';
    const { flywheel, damper } = this.buildCrankshaft(crankshaftGroup);
    rootGroup.add(crankshaftGroup);

    // 3. Camshafts & Timing Chain
    const camshaftsGroup = new THREE.Group();
    camshaftsGroup.name = 'I6_CamshaftsGroup';
    this.buildCamshafts(camshaftsGroup);
    rootGroup.add(camshaftsGroup);

    // 4. Intake Manifold with Integrated Water-to-Air Intercooler Plenum
    const intakeManifoldGroup = new THREE.Group();
    intakeManifoldGroup.name = 'I6_IntakeManifoldGroup';
    const throttleBlade = this.buildIntakeManifold(intakeManifoldGroup);
    rootGroup.add(intakeManifoldGroup);

    // 5. Twin Monoscroll Turbochargers & Downpipes (Exhaust Side)
    const turbosGroup = new THREE.Group();
    turbosGroup.name = 'I6_TwinTurbosGroup';
    this.buildTwinTurbos(turbosGroup);
    rootGroup.add(turbosGroup);

    // 6. Cylinders Top & Reciprocating Components (Pistons, Rods, Valves, Liners)
    const pistons: THREE.Group[] = [];
    const connectingRods: THREE.Group[] = [];
    const intakeValves: THREE.Group[] = [];
    const exhaustValves: THREE.Group[] = [];
    const intakeSprings: THREE.Mesh[][] = [];
    const exhaustSprings: THREE.Mesh[][] = [];
    const sparkPlugs: THREE.Group[] = [];
    const cylinderLiners: THREE.Mesh[] = [];

    const cylConfigs = ENGINES.i6_bmw.cylinders;

    cylConfigs.forEach((cfg) => {
      const zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ;

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
        this.buildCylinderTopEnd(cfg.id, zPos);

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
      blockGroup,
      crankshaftGroup,
      flywheelMesh: flywheel,
      damperMesh: damper,
      throttleBladeGroup: throttleBlade,
      camshaftsGroup,
      intakeManifoldGroup,
      turbosGroup,
      pistons,
      connectingRods,
      intakeValves,
      exhaustValves,
      intakeSprings,
      exhaustSprings,
      sparkPlugs,
      cylinderLiners,
      cylinderHeadGroup: headGroup,
      valveCoverGroup: coverGroup,
      oilPanGroup,
      timingCoverGroup,
    };
  }

  private buildBlock(parent: THREE.Group) {
    const blockLen = this.cylinderSpacingZ * 6.2;

    // A. Main Closed-Deck Cast Aluminum Inline-6 Block
    const blockGeo = new THREE.BoxGeometry(this.boreRadius * 2.5, this.conRodLength * 1.15, blockLen);
    const blockMesh = new THREE.Mesh(blockGeo, this.materials.block);
    blockMesh.position.set(0, this.conRodLength * 0.52, 0);
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    blockMesh.userData = { componentId: 'engine_block' };
    parent.add(blockMesh);

    // Deep-skirt crankcase skirt arch
    const skirtGeo = new THREE.CylinderGeometry(
      this.boreRadius * 1.6,
      this.boreRadius * 1.6,
      blockLen,
      24,
      1,
      false,
      Math.PI * 0.7,
      Math.PI * 1.6
    );
    skirtGeo.rotateX(Math.PI / 2);
    const skirt = new THREE.Mesh(skirtGeo, this.materials.block);
    skirt.position.set(0, 0, 0);
    skirt.userData = { componentId: 'engine_block' };
    parent.add(skirt);

    // 7 Cross-Bolted Main Bearing Bulkheads
    for (let m = 0; m < 7; m++) {
      const mz = this.zStart + this.cylinderSpacingZ * 0.5 - m * this.cylinderSpacingZ;
      const webGeo = new THREE.BoxGeometry(this.boreRadius * 2.2, this.boreRadius * 1.4, 0.42);
      const web = new THREE.Mesh(webGeo, this.materials.block);
      web.position.set(0, -this.boreRadius * 0.65, mz);
      parent.add(web);

      const capGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 20, 1, false, 0, Math.PI);
      capGeo.rotateX(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, this.materials.mainCap);
      cap.position.set(0, 0, mz);
      cap.rotation.z = Math.PI;
      cap.userData = { componentId: 'engine_block' };
      parent.add(cap);

      // Main cap bolts
      [-0.75, 0.75].forEach((bx) => {
        const boltGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 12);
        const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
        bolt.position.set(bx, -0.85, mz);
        parent.add(bolt);
      });
    }

    // B. Oil Pan
    const oilPanGroup = new THREE.Group();
    oilPanGroup.name = 'I6_OilPan';
    const panGeo = new THREE.BoxGeometry(this.boreRadius * 2.3, this.boreRadius * 1.3, blockLen * 0.95);
    const pan = new THREE.Mesh(panGeo, this.materials.block);
    pan.position.set(0, -this.boreRadius * 2.2, 0);
    pan.castShadow = true;
    pan.userData = { componentId: 'engine_block' };
    oilPanGroup.add(pan);
    parent.add(oilPanGroup);

    // C. Cylinder Head Group
    const headGroup = new THREE.Group();
    headGroup.name = 'I6_CylinderHead';
    const headGeo = new THREE.BoxGeometry(this.boreRadius * 2.65, this.boreRadius * 1.3, blockLen * 1.02);
    const head = new THREE.Mesh(headGeo, this.materials.block);
    head.position.set(0, this.conRodLength + 1.65, 0);
    head.castShadow = true;
    head.userData = { componentId: 'engine_block' };
    headGroup.add(head);

    // Head Studs
    for (let s = 0; s < 7; s++) {
      const sz = this.zStart + this.cylinderSpacingZ * 0.5 - s * this.cylinderSpacingZ;
      [-this.boreRadius * 1.1, this.boreRadius * 1.1].forEach((hx) => {
        const studGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.6, 12);
        const stud = new THREE.Mesh(studGeo, this.materials.boltMetal);
        stud.position.set(hx, this.conRodLength + 2.3, sz);
        headGroup.add(stud);
      });
    }
    parent.add(headGroup);

    // D. Valve Cover with M Power Carbon Insert
    const coverGroup = new THREE.Group();
    coverGroup.name = 'I6_ValveCover';
    const coverGeo = new THREE.BoxGeometry(this.boreRadius * 2.4, this.boreRadius * 0.75, blockLen * 0.98);
    const cover = new THREE.Mesh(coverGeo, this.materials.block);
    cover.position.set(0, this.conRodLength + 2.7, 0);
    cover.castShadow = true;
    cover.userData = { componentId: 'engine_block' };
    coverGroup.add(cover);

    // Oil Filler Cap
    const capGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 16);
    const cap = new THREE.Mesh(capGeo, this.materials.oilFilter);
    cap.position.set(0.6, this.conRodLength + 3.25, this.zStart - 0.5);
    coverGroup.add(cap);

    parent.add(coverGroup);

    // E. Front Timing Cover
    const timingCoverGroup = new THREE.Group();
    timingCoverGroup.name = 'I6_TimingCover';
    const frontZ = this.zStart + this.cylinderSpacingZ * 0.5 + 1.2;
    const tcGeo = new THREE.BoxGeometry(this.boreRadius * 2.6, this.conRodLength * 1.5, 0.35);
    const tc = new THREE.Mesh(tcGeo, this.materials.block);
    tc.position.set(0, this.conRodLength * 0.65, frontZ);
    tc.castShadow = true;
    timingCoverGroup.add(tc);
    parent.add(timingCoverGroup);

    return { headGroup, coverGroup, oilPanGroup, timingCoverGroup };
  }

  private buildCrankshaft(parent: THREE.Group): { flywheel: THREE.Mesh; damper: THREE.Mesh } {
    const mainJournalRadius = 0.72;
    const rodJournalRadius = 0.68;
    const rodJournalLen = 1.05;
    const crankThrowAngles = [0, 120, 240, 240, 120, 0]; // 120° Symmetrical 6-Cylinder Crank

    // 1. Counterweight 3D Geometry (Forged steel with chamfered bevels)
    const cwShape = createAuthenticCounterweightShape(this.crankRadius);
    const cwGeo = new THREE.ExtrudeGeometry(cwShape, {
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    cwGeo.translate(0, 0, -0.22); // Center along Z

    // 2. 6 Crank Throws with 12 Authentic Forged Counterweights (Bridging main journals to crankpins)
    for (let i = 0; i < 6; i++) {
      const pinZ = this.zStart - i * this.cylinderSpacingZ;
      const angleRad = (crankThrowAngles[i] * Math.PI) / 180;
      const pinX = -Math.sin(angleRad) * this.crankRadius;
      const pinY = Math.cos(angleRad) * this.crankRadius;

      // Rod Journal (Crankpin)
      const pinGeo = new THREE.CylinderGeometry(rodJournalRadius, rodJournalRadius, rodJournalLen, 32);
      pinGeo.rotateX(Math.PI / 2);
      const pin = new THREE.Mesh(pinGeo, this.materials.crankshaft);
      pin.position.set(pinX, pinY, pinZ);
      pin.castShadow = true;
      pin.userData = { componentId: 'crankshaft' };
      parent.add(pin);

      // Twin Counterweights flanking each rod journal (12 counterweights total, 2 per throw)
      [-0.72, 0.72].forEach((zOffset) => {
        const cwZ = pinZ + zOffset;
        const cwMesh = new THREE.Mesh(cwGeo, this.materials.crankCounterweight);
        cwMesh.position.set(0, 0, cwZ);
        cwMesh.rotation.z = angleRad;
        cwMesh.castShadow = true;
        cwMesh.userData = { componentId: 'crankshaft' };
        parent.add(cwMesh);
      });
    }

    // 3. Seven Main Bearing Journals connecting adjacent crank throws
    // Intermediate main journals (1 to 5) span seamlessly between counterweight webs
    for (let m = 1; m <= 5; m++) {
      const mz = this.zStart + this.cylinderSpacingZ * 0.5 - m * this.cylinderSpacingZ;
      const mjLen = 2.68; // Bridges directly between rear web of cyl (m-1) and front web of cyl m
      const mjGeo = new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, mjLen, 28);
      mjGeo.rotateX(Math.PI / 2);
      const mj = new THREE.Mesh(mjGeo, this.materials.crankshaft);
      mj.position.set(0, 0, mz);
      mj.castShadow = true;
      mj.userData = { componentId: 'crankshaft' };
      parent.add(mj);
    }

    // Front Main Journal (m=0) & Front Snout leading to Harmonic Damper
    const frontMz = this.zStart + this.cylinderSpacingZ * 0.5; // 13.65
    const frontMjGeo = new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, 2.4, 28);
    frontMjGeo.rotateX(Math.PI / 2);
    const frontMj = new THREE.Mesh(frontMjGeo, this.materials.crankshaft);
    frontMj.position.set(0, 0, frontMz - 0.2);
    frontMj.castShadow = true;
    frontMj.userData = { componentId: 'crankshaft' };
    parent.add(frontMj);

    const frontSnoutGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 24);
    frontSnoutGeo.rotateX(Math.PI / 2);
    const frontSnout = new THREE.Mesh(frontSnoutGeo, this.materials.crankshaft);
    frontSnout.position.set(0, 0, frontMz + 1.3);
    parent.add(frontSnout);

    // Rear Main Journal (m=6) & Rear Seal Flange leading to Flywheel
    const rearMz = this.zStart + this.cylinderSpacingZ * 0.5 - 6 * this.cylinderSpacingZ; // -13.65
    const rearMjGeo = new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, 2.0, 28);
    rearMjGeo.rotateX(Math.PI / 2);
    const rearMj = new THREE.Mesh(rearMjGeo, this.materials.crankshaft);
    rearMj.position.set(0, 0, rearMz + 0.35);
    rearMj.castShadow = true;
    rearMj.userData = { componentId: 'crankshaft' };
    parent.add(rearMj);

    const rearFlangeGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.45, 32);
    rearFlangeGeo.rotateX(Math.PI / 2);
    const rearFlange = new THREE.Mesh(rearFlangeGeo, this.materials.crankshaft);
    rearFlange.position.set(0, 0, rearMz - 0.7);
    parent.add(rearFlange);

    // Rear Flywheel with 64-Tooth Starter Ring Gear (Image 1)
    const rearZ = this.zStart - 5 * this.cylinderSpacingZ - 2.8;
    const flywheelTeeth = 64;
    const flywheelTipR = 3.65;
    const flywheelRootR = 3.32;
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
    const frictionGeo = new THREE.CylinderGeometry(3.30, 3.30, flywheelDepth * 0.95, 48);
    frictionGeo.rotateX(Math.PI / 2);
    const frictionFace = new THREE.Mesh(frictionGeo, this.materials.crankshaft);
    flywheel.add(frictionFace);

    // Recessed Center Hub
    const hubGeo = new THREE.CylinderGeometry(1.50, 1.50, flywheelDepth * 1.02, 36);
    hubGeo.rotateX(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, this.materials.flywheel);
    flywheel.add(hubMesh);

    // Center Pilot Bearing Bore
    const pilotGeo = new THREE.CylinderGeometry(0.55, 0.55, flywheelDepth * 1.06, 24);
    pilotGeo.rotateX(Math.PI / 2);
    const pilotMesh = new THREE.Mesh(pilotGeo, this.materials.crankshaft);
    flywheel.add(pilotMesh);

    // 8 Perimeter Crankshaft Mounting Hex Bolts
    const boltCircleR = 1.05;
    for (let b = 0; b < 8; b++) {
      const bAngle = (b * Math.PI) / 4;
      const bGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 6);
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

    // Harmonic Damper Pulley at Front
    const frontZ = this.zStart + this.cylinderSpacingZ * 0.5 + 2.0;
    const damperGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.65, 32);
    damperGeo.rotateX(Math.PI / 2);
    const damper = new THREE.Mesh(damperGeo, this.materials.crankCounterweight);
    damper.position.set(0, 0, frontZ);
    damper.castShadow = true;
    damper.userData = { componentId: 'crankshaft', baseZ: frontZ };
    parent.add(damper);

    return { flywheel, damper };
  }

  private buildCamshafts(parent: THREE.Group) {
    const frontZ = this.zStart + this.cylinderSpacingZ * 0.5 + 0.6;
    const camRearZ = -12.80;
    const camFrontZ = frontZ - 0.02;
    const camLen = camFrontZ - camRearZ;
    const camCenterZ = (camRearZ + camFrontZ) / 2;

    const inCamY = this.conRodLength + this.crankRadius + 1.8 + 1.72;
    const inCamX = -0.95;

    const exCamX = 0.95;
    const exCamY = inCamY;

    const camTeeth = 28;
    const camTipR = 0.88;
    const camRootR = 0.74;
    const gearDepth = 0.22;
    const camGearShape = createGearShape(camTeeth, camRootR, camTipR, 0.35, 0.65);

    const buildSprocket = () => {
      const sprocketGroup = new THREE.Group();
      sprocketGroup.position.set(0, 0, frontZ);

      // 1. Toothed Outer Sprocket Rim
      const gearGeo = new THREE.ExtrudeGeometry(camGearShape, {
        depth: gearDepth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      });
      gearGeo.translate(0, 0, -gearDepth / 2);
      const gearMesh = new THREE.Mesh(gearGeo, this.materials.camshaft);
      gearMesh.castShadow = true;
      sprocketGroup.add(gearMesh);

      // 2. Machined Recessed Inner Web
      const webGeo = new THREE.CylinderGeometry(0.72, 0.72, gearDepth * 0.65, 32);
      webGeo.rotateX(Math.PI / 2);
      const web = new THREE.Mesh(webGeo, this.materials.crankshaft);
      sprocketGroup.add(web);

      // 3. 4 CNC Lightening Holes / Windows in the Sprocket Web
      for (let h = 0; h < 4; h++) {
        const hAngle = (h * Math.PI) / 2 + Math.PI / 4;
        const holeGeo = new THREE.CylinderGeometry(0.13, 0.13, gearDepth * 0.85, 16);
        holeGeo.rotateX(Math.PI / 2);
        const hole = new THREE.Mesh(holeGeo, this.materials.block);
        hole.position.set(Math.cos(hAngle) * 0.50, Math.sin(hAngle) * 0.50, 0);
        sprocketGroup.add(hole);
      }

      // 4. Center VANOS Variable Timing Phaser Hub
      const hubGeo = new THREE.CylinderGeometry(0.32, 0.32, gearDepth * 1.35, 24);
      hubGeo.rotateX(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, this.materials.sparkPlugMetal);
      sprocketGroup.add(hub);

      // 5. Center Retaining Hex Bolt
      const boltGeo = new THREE.CylinderGeometry(0.13, 0.13, gearDepth * 1.55, 6);
      boltGeo.rotateX(Math.PI / 2);
      const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
      sprocketGroup.add(bolt);

      // 6. 4 Perimeter VANOS Cover Fasteners
      for (let b = 0; b < 4; b++) {
        const bAngle = (b * Math.PI) / 2;
        const bGeo = new THREE.CylinderGeometry(0.042, 0.042, gearDepth * 1.45, 6);
        bGeo.rotateX(Math.PI / 2);
        const pb = new THREE.Mesh(bGeo, this.materials.boltMetal);
        pb.position.set(Math.cos(bAngle) * 0.23, Math.sin(bAngle) * 0.23, 0);
        sprocketGroup.add(pb);
      }

      return sprocketGroup;
    };

    const camLobeShape = createCamLobeShape(0.38, 0.22, 0.16);
    const lobeGeo = new THREE.ExtrudeGeometry(camLobeShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    lobeGeo.translate(0, 0, -0.14);

    // Intake Camshaft Assembly (Group centered at inCamX, inCamY, 0 for on-axis rotation)
    const inCamGroup = new THREE.Group();
    inCamGroup.position.set(inCamX, inCamY, 0);

    const inCamGeo = new THREE.CylinderGeometry(0.38, 0.38, camLen, 24);
    inCamGeo.rotateX(Math.PI / 2);
    const inCamMesh = new THREE.Mesh(inCamGeo, this.materials.camshaft);
    inCamMesh.position.set(0, 0, camCenterZ);
    inCamMesh.userData = { componentId: 'camshaft' };
    inCamGroup.add(inCamMesh);

    // Machined Camshaft Thrust Collar linking directly into the gear
    const collarGeo = new THREE.CylinderGeometry(0.50, 0.50, 0.20, 24);
    collarGeo.rotateX(Math.PI / 2);
    const inCollar = new THREE.Mesh(collarGeo, this.materials.crankshaft);
    inCollar.position.set(0, 0, frontZ - gearDepth / 2 - 0.10);
    inCamGroup.add(inCollar);

    // 7 Ground Camshaft Bearing Journals along head bearing bridges
    for (let j = 0; j <= 6; j++) {
      const jz = this.zStart + this.cylinderSpacingZ * 0.5 - j * this.cylinderSpacingZ;
      const jGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.40, 20);
      jGeo.rotateX(Math.PI / 2);
      const jMesh = new THREE.Mesh(jGeo, this.materials.crankshaft);
      jMesh.position.set(0, 0, jz);
      inCamGroup.add(jMesh);
    }

    // Intake Cam Lobes (Teardrop shaped lobes for each cylinder's intake valves)
    for (let c = 0; c < 6; c++) {
      const zPos = this.zStart - c * this.cylinderSpacingZ;
      [-0.35, 0.35].forEach((vz) => {
        const lobeMesh = new THREE.Mesh(lobeGeo, this.materials.crankshaft);
        lobeMesh.position.set(0, 0, zPos + vz);
        inCamGroup.add(lobeMesh);
      });
    }

    inCamGroup.add(buildSprocket());
    parent.add(inCamGroup);
    this.intakeCamGroup = inCamGroup;

    // Exhaust Camshaft Assembly (Group centered at exCamX, exCamY, 0 for on-axis rotation)
    const exCamGroup = new THREE.Group();
    exCamGroup.position.set(exCamX, exCamY, 0);

    const exCamGeo = new THREE.CylinderGeometry(0.38, 0.38, camLen, 24);
    exCamGeo.rotateX(Math.PI / 2);
    const exCamMesh = new THREE.Mesh(exCamGeo, this.materials.camshaft);
    exCamMesh.position.set(0, 0, camCenterZ);
    exCamMesh.userData = { componentId: 'camshaft' };
    exCamGroup.add(exCamMesh);

    // Machined Camshaft Thrust Collar linking directly into the gear
    const exCollar = new THREE.Mesh(collarGeo, this.materials.crankshaft);
    exCollar.position.set(0, 0, frontZ - gearDepth / 2 - 0.10);
    exCamGroup.add(exCollar);

    // 7 Ground Camshaft Bearing Journals
    for (let j = 0; j <= 6; j++) {
      const jz = this.zStart + this.cylinderSpacingZ * 0.5 - j * this.cylinderSpacingZ;
      const jGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.40, 20);
      jGeo.rotateX(Math.PI / 2);
      const jMesh = new THREE.Mesh(jGeo, this.materials.crankshaft);
      jMesh.position.set(0, 0, jz);
      exCamGroup.add(jMesh);
    }

    // Exhaust Cam Lobes
    for (let c = 0; c < 6; c++) {
      const zPos = this.zStart - c * this.cylinderSpacingZ;
      [-0.35, 0.35].forEach((vz) => {
        const lobeMesh = new THREE.Mesh(lobeGeo, this.materials.crankshaft);
        lobeMesh.position.set(0, 0, zPos + vz);
        exCamGroup.add(lobeMesh);
      });
    }

    exCamGroup.add(buildSprocket());
    parent.add(exCamGroup);
    this.exhaustCamGroup = exCamGroup;
  }

  private buildIntakeManifold(parent: THREE.Group): THREE.Group {
    const manifoldGroup = new THREE.Group();
    const manifoldLen = this.cylinderSpacingZ * 5.5;

    // Large water-to-air charge air cooler plenum on intake side (-X)
    const plenumGeo = new THREE.BoxGeometry(2.4, 2.8, manifoldLen);
    const plenum = new THREE.Mesh(plenumGeo, this.materials.intakeManifold);
    plenum.position.set(-4.2, this.conRodLength + 1.2, 0);
    plenum.castShadow = true;
    plenum.userData = { componentId: 'intake_manifold' };
    manifoldGroup.add(plenum);

    // 6 Individual Intake Runners connecting from plenum into cylinder head ports
    // Sized and positioned with clean engine clearance so runners terminate at head face and do not penetrate cylinder bore
    for (let i = 0; i < 6; i++) {
      const zPos = this.zStart - i * this.cylinderSpacingZ;
      const runnerLen = 1.05;
      const runnerGeo = new THREE.CylinderGeometry(0.46, 0.46, runnerLen, 20);
      runnerGeo.rotateZ(Math.PI / 3);
      const runner = new THREE.Mesh(runnerGeo, this.materials.intakeManifold);
      runner.position.set(-3.24, this.conRodLength + 1.45, zPos);
      runner.castShadow = true;
      runner.userData = { componentId: 'intake_manifold' };
      manifoldGroup.add(runner);
    }

    // Electronic Throttle Body
    const tbGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.2, 24);
    tbGeo.rotateX(Math.PI / 2);
    const tb = new THREE.Mesh(tbGeo, this.materials.sparkPlugMetal);
    tb.position.set(-4.2, this.conRodLength + 1.2, this.zStart + 1.2);
    manifoldGroup.add(tb);

    // Rotating Throttle Blade
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(-4.2, this.conRodLength + 1.2, this.zStart + 1.2);
    const bladeGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 20);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, this.materials.sparkPlugMetal);
    bladeGroup.add(blade);
    manifoldGroup.add(bladeGroup);

    parent.add(manifoldGroup);
    return bladeGroup;
  }

  private buildTwinTurbos(parent: THREE.Group) {
    // Turbo 1 (Front: Cylinders 1-3) & Turbo 2 (Rear: Cylinders 4-6)
    // Mounted authentically on the high cylinder head exhaust flank (+X), completely clear of crankcase
    const turboConfigs = [
      { id: 1, zPos: this.zStart - 1.0 * this.cylinderSpacingZ, cylIndices: [0, 1, 2], name: 'Turbo 1 (Cyl 1-3)' },
      { id: 2, zPos: this.zStart - 4.0 * this.cylinderSpacingZ, cylIndices: [3, 4, 5], name: 'Turbo 2 (Cyl 4-6)' },
    ];

    const turboMountY = this.conRodLength + 1.6;
    const turboMountX = 5.2;

    turboConfigs.forEach((tc) => {
      const turboSub = new THREE.Group();
      turboSub.position.set(turboMountX, turboMountY, tc.zPos);

      // 3 Tubular Exhaust Manifold Runners curving from Cylinder Head into Turbine housing
      tc.cylIndices.forEach((cIdx) => {
        const cylZ = this.zStart - cIdx * this.cylinderSpacingZ;
        const relZ = cylZ - tc.zPos;

        // Head exhaust port flange
        const flangeGeo = new THREE.BoxGeometry(0.22, 0.75, 0.95);
        const flange = new THREE.Mesh(flangeGeo, this.materials.exhaustHeaders);
        flange.position.set(-2.8, 0.2, relZ);
        turboSub.add(flange);

        // Curved tubular stainless runner
        const p0 = new THREE.Vector3(-2.7, 0.2, relZ);
        const p1 = new THREE.Vector3(-1.4, 0.1, relZ * 0.5);
        const p2 = new THREE.Vector3(-0.4, 0.0, 0);
        const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
        const tubeGeo = new THREE.TubeGeometry(curve, 18, 0.32, 12, false);
        const tube = new THREE.Mesh(tubeGeo, this.materials.exhaustHeaders);
        turboSub.add(tube);
      });

      // Turbine Scroll (Hot Exhaust Housing - Cast Stainless Steel)
      const turbineGeo = new THREE.TorusGeometry(0.95, 0.42, 16, 24, Math.PI * 1.6);
      turbineGeo.rotateY(Math.PI / 2);
      const turbine = new THREE.Mesh(turbineGeo, this.materials.exhaustHeaders);
      turbine.castShadow = true;
      turbine.userData = { componentId: 'exhaust_headers' };
      turboSub.add(turbine);

      // Compressor Scroll (Cold Aluminum Snout)
      const compGeo = new THREE.TorusGeometry(0.92, 0.38, 16, 24, Math.PI * 1.6);
      compGeo.rotateY(Math.PI / 2);
      const comp = new THREE.Mesh(compGeo, this.materials.crankshaft);
      comp.position.set(0.6, 0, 0);
      comp.castShadow = true;
      comp.userData = { componentId: 'intake_manifold' };
      turboSub.add(comp);

      // Wastegate Actuator Canister
      const wgGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.65, 14);
      const wg = new THREE.Mesh(wgGeo, this.materials.sparkPlugMetal);
      wg.position.set(0.4, 1.1, 0.3);
      turboSub.add(wg);

      // Stainless Downpipe (curving downwards and rearward alongside outer block)
      const dp0 = new THREE.Vector3(0.6, -0.4, -0.2);
      const dp1 = new THREE.Vector3(0.9, -1.8, -0.8);
      const dp2 = new THREE.Vector3(1.1, -3.2, -1.8);
      const dpCurve = new THREE.CatmullRomCurve3([dp0, dp1, dp2]);
      const dpGeo = new THREE.TubeGeometry(dpCurve, 20, 0.45, 14, false);
      const dp = new THREE.Mesh(dpGeo, this.materials.exhaustHeaders);
      dp.castShadow = true;
      turboSub.add(dp);

      parent.add(turboSub);
    });
  }

  private buildPiston(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `I6_Piston_${cylId}`;

    const crownGeo = new THREE.CylinderGeometry(this.boreRadius * 0.96, this.boreRadius * 0.96, 1.8, 32);
    const crown = new THREE.Mesh(crownGeo, this.materials.piston);
    crown.castShadow = true;
    crown.userData = { componentId: 'piston', cylId };
    group.add(crown);

    // Wrist Pin
    const pinGeo = new THREE.CylinderGeometry(0.38, 0.38, this.boreRadius * 1.7, 16);
    pinGeo.rotateX(Math.PI / 2);
    const pin = new THREE.Mesh(pinGeo, this.materials.crankshaft);
    pin.position.set(0, -0.25, 0);
    group.add(pin);

    return group;
  }

  private buildConnectingRod(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `I6_ConnectingRod_${cylId}`;

    // Big End
    const bigEndGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.85, 24, 1, false);
    bigEndGeo.rotateX(Math.PI / 2);
    const bigEnd = new THREE.Mesh(bigEndGeo, this.materials.conRod);
    bigEnd.castShadow = true;
    bigEnd.userData = { componentId: 'connecting_rod', cylId };
    group.add(bigEnd);

    // I-Beam Rod Beam
    const beamGeo = new THREE.BoxGeometry(0.48, this.conRodLength, 0.36);
    const beam = new THREE.Mesh(beamGeo, this.materials.conRod);
    beam.position.set(0, this.conRodLength * 0.5, 0);
    beam.castShadow = true;
    beam.userData = { componentId: 'connecting_rod', cylId };
    group.add(beam);

    // Small End
    const smallEndGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.75, 20);
    smallEndGeo.rotateX(Math.PI / 2);
    const smallEnd = new THREE.Mesh(smallEndGeo, this.materials.conRod);
    smallEnd.position.set(0, this.conRodLength, 0);
    smallEnd.castShadow = true;
    group.add(smallEnd);

    return group;
  }

  private buildCylinderTopEnd(cylId: number, zPos: number) {
    const headY = this.conRodLength + this.crankRadius + 1.8;

    // Intake Valve Pair (-X side, inclined outward by +14 deg in pent-roof V-shape)
    const inValve = new THREE.Group();
    inValve.name = `I6_InValve_${cylId}`;
    const inSpringPair: THREE.Mesh[] = [];
    const inValveAngle = (14 * Math.PI) / 180;

    [-0.35, 0.35].forEach((vz) => {
      // 1. Valve Stem
      const vGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12);
      const vStem = new THREE.Mesh(vGeo, this.materials.valveIntake);
      vStem.position.set(0, 0.9, vz);
      vStem.castShadow = true;
      inValve.add(vStem);

      // 2. Poppet Valve Head (Flat circular face facing down into cylinder)
      const vHeadGeo = new THREE.CylinderGeometry(0.12, 0.42, 0.22, 16);
      const vHead = new THREE.Mesh(vHeadGeo, this.materials.valveIntake);
      vHead.position.set(0, 0, vz);
      vHead.castShadow = true;
      inValve.add(vHead);

      // 3. Authentic 3D Helical Coil Spring
      const inHelix = new HelixCurve(0.24, 1.15, 6.0);
      const inSpringGeo = new THREE.TubeGeometry(inHelix, 48, 0.040, 8, false);
      const sp = new THREE.Mesh(inSpringGeo, this.materials.valveSpring);
      sp.position.set(0, 0.20, vz);
      sp.castShadow = true;
      inValve.add(sp);
      inSpringPair.push(sp);

      // 4. Valve Spring Retainer Washer
      const retGeo = new THREE.CylinderGeometry(0.36, 0.26, 0.12, 16);
      const ret = new THREE.Mesh(retGeo, this.materials.sparkPlugMetal);
      ret.position.set(0, 1.40, vz);
      inValve.add(ret);

      // 5. Cam Follower Tappet Bucket directly under camshaft lobe
      const tappetGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(0, 1.62, vz);
      inValve.add(tappet);
    });
    inValve.position.set(-0.52, headY, zPos);
    inValve.rotation.z = inValveAngle;

    // Exhaust Valve Pair (+X side, inclined outward by -14 deg in pent-roof V-shape)
    const exValve = new THREE.Group();
    exValve.name = `I6_ExValve_${cylId}`;
    const exSpringPair: THREE.Mesh[] = [];
    const exValveAngle = (-14 * Math.PI) / 180;

    [-0.35, 0.35].forEach((vz) => {
      // 1. Valve Stem
      const vGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12);
      const vStem = new THREE.Mesh(vGeo, this.materials.valveExhaust);
      vStem.position.set(0, 0.9, vz);
      vStem.castShadow = true;
      exValve.add(vStem);

      // 2. Poppet Valve Head (Flat circular face facing down into cylinder)
      const vHeadGeo = new THREE.CylinderGeometry(0.12, 0.38, 0.22, 16);
      const vHead = new THREE.Mesh(vHeadGeo, this.materials.valveExhaust);
      vHead.position.set(0, 0, vz);
      vHead.castShadow = true;
      exValve.add(vHead);

      // 3. Authentic 3D Helical Coil Spring
      const exHelix = new HelixCurve(0.24, 1.15, 6.0);
      const exSpringGeo = new THREE.TubeGeometry(exHelix, 48, 0.040, 8, false);
      const sp = new THREE.Mesh(exSpringGeo, this.materials.valveSpring);
      sp.position.set(0, 0.20, vz);
      sp.castShadow = true;
      exValve.add(sp);
      exSpringPair.push(sp);

      // 4. Valve Spring Retainer Washer
      const retGeo = new THREE.CylinderGeometry(0.36, 0.26, 0.12, 16);
      const ret = new THREE.Mesh(retGeo, this.materials.sparkPlugMetal);
      ret.position.set(0, 1.40, vz);
      exValve.add(ret);

      // 5. Cam Follower Tappet Bucket directly under camshaft lobe
      const tappetGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(0, 1.62, vz);
      exValve.add(tappet);
    });
    exValve.position.set(0.52, headY, zPos);
    exValve.rotation.z = exValveAngle;

    // High-Detail Central Spark Plug
    const sparkPlug = new THREE.Group();
    sparkPlug.name = `I6_SparkPlug_${cylId}`;

    // Threaded Steel Shell
    const plugThreadGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16);
    const plugThread = new THREE.Mesh(plugThreadGeo, this.materials.sparkPlugMetal);
    plugThread.position.set(0, -0.4, 0);
    sparkPlug.add(plugThread);

    // Seating Washer / Crush Gasket
    const washerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16);
    const washer = new THREE.Mesh(washerGeo, this.materials.sparkPlugMetal);
    washer.position.set(0, -0.04, 0);
    sparkPlug.add(washer);

    // Hexagonal Wrench Nut (6-sided)
    const plugHexGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.55, 6);
    const plugHex = new THREE.Mesh(plugHexGeo, this.materials.sparkPlugMetal);
    plugHex.position.set(0, 0.25, 0);
    sparkPlug.add(plugHex);

    // White Glazed Ceramic Insulator
    const plugCeramicGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.15, 16);
    const plugCeramic = new THREE.Mesh(plugCeramicGeo, this.materials.sparkPlugCeramic);
    plugCeramic.position.set(0, 0.95, 0);
    sparkPlug.add(plugCeramic);

    // 4 Ceramic Anti-Flashover Ribs
    for (let rib = 0; rib < 4; rib++) {
      const ribGeo = new THREE.TorusGeometry(0.25, 0.035, 6, 16);
      ribGeo.rotateX(Math.PI / 2);
      const ribMesh = new THREE.Mesh(ribGeo, this.materials.sparkPlugCeramic);
      ribMesh.position.set(0, 0.75 + rib * 0.16, 0);
      sparkPlug.add(ribMesh);
    }

    // Top Electrical Terminal Stud
    const terminalGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.26, 12);
    const terminal = new THREE.Mesh(terminalGeo, this.materials.boltMetal);
    terminal.position.set(0, 1.55, 0);
    sparkPlug.add(terminal);

    // Center Electrode Tip (Iridium)
    const tipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10);
    const tip = new THREE.Mesh(tipGeo, this.materials.sparkArc);
    tip.position.set(0, -0.75, 0);
    sparkPlug.add(tip);

    // Ground Electrode (L-shaped bent strap with spark gap)
    const groundGeo = new THREE.BoxGeometry(0.06, 0.25, 0.10);
    const ground = new THREE.Mesh(groundGeo, this.materials.sparkPlugMetal);
    ground.position.set(0.12, -0.78, 0);
    sparkPlug.add(ground);

    const groundTipGeo = new THREE.BoxGeometry(0.14, 0.06, 0.10);
    const groundTip = new THREE.Mesh(groundTipGeo, this.materials.sparkPlugMetal);
    groundTip.position.set(0.06, -0.88, 0);
    sparkPlug.add(groundTip);

    sparkPlug.userData = { componentId: 'spark_plug', cylId };
    sparkPlug.position.set(0, headY + 0.45, zPos);

    // Cylinder Liner
    const linerGeo = new THREE.CylinderGeometry(this.boreRadius, this.boreRadius, 7.8, 32, 1, true);
    const liner = new THREE.Mesh(linerGeo, this.materials.cylinderLiner);
    liner.position.set(0, this.conRodLength * 0.55, zPos);

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

    // 4-Stroke Camshaft & Timing Gear Rotation (1:2 ratio relative to crankshaft)
    const camAngleRad = masterAngleRad * 0.5;
    if (this.intakeCamGroup) {
      this.intakeCamGroup.rotation.z = camAngleRad;
    }
    if (this.exhaustCamGroup) {
      this.exhaustCamGroup.rotation.z = camAngleRad;
    }

    // 1. Transparency / See-Through Modes
    if (seeThroughMode === 'ghost') {
      this.materials.block.visible = false;
      this.materials.cylinderLiner.visible = false;
      this.nodes.blockGroup.visible = false;
      this.nodes.cylinderHeadGroup.visible = false;
      this.nodes.valveCoverGroup.visible = false;
    } else if (seeThroughMode === 'translucent' || isCutaway) {
      this.nodes.blockGroup.visible = true;
      this.materials.block.visible = true;
      this.materials.block.opacity = 0.16;
      this.materials.block.transparent = true;
      this.materials.block.depthWrite = false;

      this.materials.cylinderLiner.visible = true;
      this.materials.cylinderLiner.opacity = 0.28;
      this.materials.cylinderLiner.transparent = true;
      this.materials.cylinderLiner.depthWrite = false;

      // In cutaway or translucent mode, hide the top valve cover so the DOHC valvetrain, valves, and plugs are uncrowded!
      this.nodes.valveCoverGroup.visible = !isCutaway && seeThroughMode !== 'translucent';
    } else {
      this.nodes.blockGroup.visible = true;
      this.nodes.valveCoverGroup.visible = true;
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
    const ep = p * p * (3 - 2 * p); // Smooth cubic ease-in-out

    // Intake Plenum moves Left (-X) & Up (+Y)
    this.nodes.intakeManifoldGroup.position.set(-ep * 5.8, ep * 3.5, 0);

    // Twin Turbos move Right (+X) outward along exhaust flank
    this.nodes.turbosGroup.position.set(ep * 6.5, 0, 0);

    // Cylinder Head moves Up (+Y)
    this.nodes.cylinderHeadGroup.position.set(0, ep * 3.5, 0);
    this.nodes.valveCoverGroup.position.set(0, ep * 6.5, 0);
    this.nodes.camshaftsGroup.position.set(0, ep * 3.5, 0);

    // Oil Pan drops Down (-Y)
    this.nodes.oilPanGroup.position.set(0, -ep * 5.0, 0);

    // Front Timing Cover forward (+Z)
    this.nodes.timingCoverGroup.position.set(0, 0, ep * 4.5);
    const baseDamperZ = this.nodes.damperMesh.userData?.baseZ ?? (this.zStart + this.cylinderSpacingZ * 0.5 + 2.0);
    this.nodes.damperMesh.position.set(0, 0, baseDamperZ + ep * 5.0);

    // Rear Flywheel backward (-Z)
    const baseFwZ = this.nodes.flywheelMesh.userData?.baseZ ?? (this.zStart - 5 * this.cylinderSpacingZ - 2.8);
    this.nodes.flywheelMesh.position.set(0, 0, baseFwZ - ep * 4.5);

    // 3. Cylinder Kinematics (6 Inline Pistons, Connecting Rods, Valves)
    const cylConfigs = ENGINES.i6_bmw.cylinders;

    cylConfigs.forEach((cfg, idx) => {
      const telem = telemetryList[idx];
      if (!telem) return;

      const zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ;

      // Crankpin coordinates: angle in radians (Vertical cylinder line with TDC at angle 0)
      const pinOffsetRad = (cfg.crankpinAngleDeg * Math.PI) / 180;
      const pinAngleRad = pinOffsetRad + masterAngleRad;
      const cX = -Math.sin(pinAngleRad) * this.crankRadius;
      const cY = Math.cos(pinAngleRad) * this.crankRadius;

      // Vertical piston distance (0° tilt)
      // s = cY + sqrt(l^2 - cX^2)
      const underRad = Math.max(0, this.conRodLength * this.conRodLength - cX * cX);
      const s = cY + Math.sqrt(underRad);

      const pistonY = s + ep * 1.5;

      // Piston (wrist pin is at local -0.25, so +0.25 aligns wrist pin with rod smallEnd at pistonY)
      const pistonMesh = this.nodes.pistons[idx];
      if (pistonMesh) {
        pistonMesh.position.set(0, pistonY + 0.25, zPos);
      }

      // Connecting Rod (big end at (cX, cY), small end at (0, pistonY))
      const rodMesh = this.nodes.connectingRods[idx];
      if (rodMesh) {
        rodMesh.position.set(cX, cY, zPos);
        const dx = -cX;
        const dy = pistonY - cY;
        const rodAngle = Math.atan2(dx, dy);
        rodMesh.rotation.z = -rodAngle; // Accurate sign: small end is mathematically locked to wrist pin!
      }

      // Valves
      const inValve = this.nodes.intakeValves[idx];
      const exValve = this.nodes.exhaustValves[idx];
      const inSpringPair = this.nodes.intakeSprings[idx];
      const exSpringPair = this.nodes.exhaustSprings[idx];
      const headBaseY = this.conRodLength + this.crankRadius + 1.8 + ep * 3.5;

      const inAngle = (14 * Math.PI) / 180;
      const exAngle = (-14 * Math.PI) / 180;

      if (inValve) {
        const lift = (telem.intakeValveLiftMm / 11.5) * 0.55;
        inValve.position.set(
          -0.52 + lift * Math.sin(inAngle),
          headBaseY - lift * Math.cos(inAngle),
          zPos
        );
        if (inSpringPair) {
          const comp = Math.max(0.65, 1 - lift / 1.35);
          inSpringPair.forEach((sp) => sp.scale.set(1, comp, 1));
        }
      }

      if (exValve) {
        const lift = (telem.exhaustValveLiftMm / 11.5) * 0.55;
        exValve.position.set(
          0.52 + lift * Math.sin(exAngle),
          headBaseY - lift * Math.cos(exAngle),
          zPos
        );
        if (exSpringPair) {
          const comp = Math.max(0.65, 1 - lift / 1.35);
          exSpringPair.forEach((sp) => sp.scale.set(1, comp, 1));
        }
      }

      // Spark Plug
      const plug = this.nodes.sparkPlugs[idx];
      if (plug) {
        plug.position.set(0, headBaseY + 0.45, zPos);
      }

      // Liner
      const liner = this.nodes.cylinderLiners[idx];
      if (liner) {
        liner.position.set(0, this.conRodLength * 0.55, zPos);
      }
    });
  }
}
