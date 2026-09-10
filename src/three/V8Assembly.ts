import * as THREE from 'three';
import { EngineMaterialPalette } from './materials';
import { CYLINDERS, CylinderConfig } from '../engine/firingOrder';
import { CylinderTelemetry, SeeThroughMode } from '../engine/types';

export interface V8AssemblyNodes {
  rootGroup: THREE.Group;
  blockGroup: THREE.Group;
  crankshaftGroup: THREE.Group;
  flywheelMesh: THREE.Mesh;
  damperMesh: THREE.Mesh;
  throttleBladeGroup: THREE.Group;
  camshaftsGroup: THREE.Group;
  intakeManifoldGroup: THREE.Group;
  exhaustHeadersGroup: THREE.Group;
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
  const outerR = crankR * 1.76;

  const arcStart = (-140 * Math.PI) / 180;
  const arcEnd = (-40 * Math.PI) / 180;
  const xArcL = Math.cos(arcStart) * outerR;
  const yArcL = Math.sin(arcStart) * outerR;

  const xFacetL = -2.35;
  const yFacetL = -1.25;
  const xFacetR = 2.35;
  const yFacetR = -1.25;

  // 1. Arch over crankpin crown
  shape.moveTo(pinWebR, pinY * 0.75);
  shape.quadraticCurveTo(pinWebR * 0.92, pinY + 0.55, 0, pinY + 0.58);
  shape.quadraticCurveTo(-pinWebR * 0.92, pinY + 0.55, -pinWebR, pinY * 0.75);

  // 2. Taper down toward main journal waist
  shape.lineTo(-waistR, 0.35);

  // 3. Smooth concave flank extending outward to chamfer shoulder
  shape.quadraticCurveTo(-1.55, -0.45, xFacetL, yFacetL);

  // 4. Straight angled chamfer shoulder (CNC beveled flat visible in user photo)
  shape.lineTo(xArcL, yArcL);

  // 5. Heavy circular counterweight perimeter arc
  shape.absarc(0, 0, outerR, arcStart, arcEnd, false);

  // 6. Straight angled chamfer shoulder on right
  shape.lineTo(xFacetR, yFacetR);

  // 7. Smooth concave flank returning to main journal waist
  shape.quadraticCurveTo(1.55, -0.45, waistR, 0.35);

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


export class V8Assembly {
  public root: THREE.Group;
  public nodes: V8AssemblyNodes;
  public materials: EngineMaterialPalette;

  private b1IntakeCamGroup!: THREE.Group;
  private b1ExhaustCamGroup!: THREE.Group;
  private b2IntakeCamGroup!: THREE.Group;
  private b2ExhaustCamGroup!: THREE.Group;

  private readonly scale: number = 0.05;
  private readonly crankRadius: number = 44.75 * this.scale; // 89.5 mm stroke / 2
  private readonly conRodLength: number = 151.0 * this.scale; // 151.0 mm rod
  private readonly boreRadius: number = 47.0 * this.scale; // 94.0 mm bore / 2
  private readonly cylinderSpacingZ: number = 116.0 * this.scale; // 116.0 mm bore spacing (positive clearance between adjacent cylinders & flanges)
  private readonly zStart: number = 1.5 * this.cylinderSpacingZ; // Centered at Z = 0

  constructor(materials: EngineMaterialPalette) {
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'V8_Engine_Root';

    this.nodes = this.buildAssembly();
    this.root.add(this.nodes.rootGroup);
  }

  private buildAssembly(): V8AssemblyNodes {
    const rootGroup = new THREE.Group();

    const blockGroup = new THREE.Group();
    blockGroup.name = 'BlockGroup';
    const {
      bank1HeadGroup,
      bank2HeadGroup,
      bank1CoverGroup,
      bank2CoverGroup,
      oilPanGroup,
      timingCoverGroup,
    } = this.buildEngineBlock(blockGroup);
    rootGroup.add(blockGroup);

    const crankshaftGroup = new THREE.Group();
    crankshaftGroup.name = 'CrankshaftGroup';
    const { flywheel, damper } = this.buildCrankshaft(crankshaftGroup);
    rootGroup.add(crankshaftGroup);

    const camshaftsGroup = new THREE.Group();
    camshaftsGroup.name = 'CamshaftsGroup';
    this.buildCamshaftsAndTiming(camshaftsGroup);
    rootGroup.add(camshaftsGroup);

    const intakeManifoldGroup = new THREE.Group();
    intakeManifoldGroup.name = 'IntakeManifoldGroup';
    const throttleBlade = this.buildIntakeManifold(intakeManifoldGroup);
    rootGroup.add(intakeManifoldGroup);

    const exhaustHeadersGroup = new THREE.Group();
    exhaustHeadersGroup.name = 'ExhaustHeadersGroup';
    this.buildExhaustHeaders(exhaustHeadersGroup);
    rootGroup.add(exhaustHeadersGroup);

    const pistons: THREE.Group[] = [];
    const connectingRods: THREE.Group[] = [];
    const intakeValves: THREE.Group[] = [];
    const exhaustValves: THREE.Group[] = [];
    const intakeSprings: THREE.Mesh[][] = [];
    const exhaustSprings: THREE.Mesh[][] = [];
    const sparkPlugs: THREE.Group[] = [];
    const cylinderLiners: THREE.Mesh[] = [];

    CYLINDERS.forEach((cfg) => {
      const zStagger = cfg.bank === 1 ? 0.23 : -0.23;
      const zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ + zStagger;
      const bankAngleRad = (cfg.bankTiltDeg * Math.PI) / 180;

      const piston = this.buildPiston(cfg.id);
      rootGroup.add(piston);
      pistons.push(piston);

      const rod = this.buildConnectingRod(cfg.id);
      rootGroup.add(rod);
      connectingRods.push(rod);

      const { inValve, exValve, inSpringPair, exSpringPair, sparkPlug, liner } =
        this.buildCylinderTopEnd(cfg, zPos, bankAngleRad);

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
      exhaustHeadersGroup,
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
      timingCoverGroup,
    };
  }

  private buildEngineBlock(parent: THREE.Group) {
    // 1. Deep-Skirt Crankcase Housing
    const crankcaseGeo = new THREE.CylinderGeometry(
      this.boreRadius * 1.82,
      this.boreRadius * 1.82,
      this.cylinderSpacingZ * 4.2,
      32,
      1,
      false,
      Math.PI * 0.75,
      Math.PI * 1.5
    );
    crankcaseGeo.rotateX(Math.PI / 2);
    const crankcase = new THREE.Mesh(crankcaseGeo, this.materials.block);
    crankcase.castShadow = true;
    crankcase.receiveShadow = true;
    crankcase.userData = { componentId: 'engine_block' };
    parent.add(crankcase);

    // 2. Five Cross-Bolted Main Bearing Bulkheads & 6-Bolt Main Caps
    const frontMainZ = this.zStart + 1.55;
    const rearMainZ = this.zStart - 3 * this.cylinderSpacingZ - 1.55;
    const mainPositions = [
      frontMainZ,
      this.zStart - this.cylinderSpacingZ * 0.5,
      this.zStart - this.cylinderSpacingZ * 1.5,
      this.zStart - this.cylinderSpacingZ * 2.5,
      rearMainZ,
    ];

    mainPositions.forEach((mz) => {
      // Bulkhead web
      const webGeo = new THREE.BoxGeometry(this.boreRadius * 2.5, this.boreRadius * 1.5, 0.45);
      const web = new THREE.Mesh(webGeo, this.materials.block);
      web.position.set(0, -this.boreRadius * 0.7, mz);
      web.userData = { componentId: 'engine_block' };
      parent.add(web);

      // Heavy nodular iron main bearing cap
      const capArchGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.55, 20, 1, false, 0, Math.PI);
      capArchGeo.rotateX(Math.PI / 2);
      const capArch = new THREE.Mesh(capArchGeo, this.materials.mainCap);
      capArch.position.set(0, 0, mz);
      capArch.rotation.z = Math.PI;
      capArch.castShadow = true;
      capArch.userData = { componentId: 'engine_block' };
      parent.add(capArch);

      // Bi-metal main bearing shell insert
      const shellGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.52, 20, 1, true, 0, Math.PI);
      shellGeo.rotateX(Math.PI / 2);
      const shell = new THREE.Mesh(shellGeo, this.materials.crankshaft);
      shell.position.set(0, 0, mz);
      shell.rotation.z = Math.PI;
      parent.add(shell);

      // 4 Vertical Main Cap Studs with 12-point nuts
      [-0.85, -0.45, 0.45, 0.85].forEach((vx) => {
        const studGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 12);
        const stud = new THREE.Mesh(studGeo, this.materials.boltMetal);
        stud.position.set(vx, -0.85, mz);
        parent.add(stud);

        const nutGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 6);
        const nut = new THREE.Mesh(nutGeo, this.materials.boltMetal);
        nut.position.set(vx, -1.25, mz);
        parent.add(nut);
      });

      // 2 Horizontal Cross-Bolts
      [-1.4, 1.4].forEach((hx) => {
        const crossBoltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12);
        crossBoltGeo.rotateZ(Math.PI / 2);
        const crossBolt = new THREE.Mesh(crossBoltGeo, this.materials.boltMetal);
        crossBolt.position.set(hx, -0.65, mz);
        parent.add(crossBolt);
      });
    });

    // 3. Deep-Sump Wet Oil Pan Group
    const oilPanGroup = new THREE.Group();
    oilPanGroup.name = 'OilPanGroup';

    const panRailGeo = new THREE.BoxGeometry(
      this.boreRadius * 2.9,
      0.2,
      this.cylinderSpacingZ * 4.2
    );
    const panRail = new THREE.Mesh(panRailGeo, this.materials.block);
    panRail.position.set(0, -this.boreRadius * 1.82, 0);
    panRail.userData = { componentId: 'engine_block' };
    oilPanGroup.add(panRail);

    // 18 Perimeter Oil Pan Hex Bolts
    for (let b = -4; b <= 4; b++) {
      [-this.boreRadius * 1.38, this.boreRadius * 1.38].forEach((bx) => {
        const panBoltGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.15, 6);
        const panBolt = new THREE.Mesh(panBoltGeo, this.materials.boltMetal);
        panBolt.position.set(bx, -this.boreRadius * 1.72, b * (this.cylinderSpacingZ * 0.48));
        oilPanGroup.add(panBolt);
      });
    }

    const sumpGeo = new THREE.BoxGeometry(
      this.boreRadius * 2.6,
      this.boreRadius * 1.45,
      this.cylinderSpacingZ * 3.8
    );
    const sump = new THREE.Mesh(sumpGeo, this.materials.block);
    sump.position.set(0, -this.boreRadius * 2.5, -0.2);
    sump.castShadow = true;
    sump.receiveShadow = true;
    sump.userData = { componentId: 'engine_block' };
    oilPanGroup.add(sump);

    // Stamped Sump Cooling Fins
    for (let f = -3; f <= 3; f++) {
      const finGeo = new THREE.BoxGeometry(this.boreRadius * 2.55, 0.09, 0.12);
      const fin = new THREE.Mesh(finGeo, this.materials.block);
      fin.position.set(0, -this.boreRadius * 3.22, f * (this.cylinderSpacingZ * 0.45) - 0.2);
      oilPanGroup.add(fin);
    }

    // Magnetic Oil Drain Plug with Copper Washer
    const drainPlugGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6);
    drainPlugGeo.rotateX(Math.PI / 2);
    const drainPlug = new THREE.Mesh(drainPlugGeo, this.materials.boltMetal);
    drainPlug.position.set(0, -this.boreRadius * 3.0, -this.cylinderSpacingZ * 1.8);
    oilPanGroup.add(drainPlug);

    // Spin-on Oil Filter Canister
    const filterBossGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.45, 16);
    filterBossGeo.rotateZ(Math.PI / 3);
    const filterBoss = new THREE.Mesh(filterBossGeo, this.materials.block);
    filterBoss.position.set(-this.boreRadius * 1.6, -this.boreRadius * 1.4, -this.cylinderSpacingZ * 0.5);
    parent.add(filterBoss);

    const filterCanisterGeo = new THREE.CylinderGeometry(0.68, 0.68, 1.6, 24);
    filterCanisterGeo.rotateZ(Math.PI / 3);
    const filterCanister = new THREE.Mesh(filterCanisterGeo, this.materials.oilFilter);
    filterCanister.position.set(-this.boreRadius * 1.95, -this.boreRadius * 1.6, -this.cylinderSpacingZ * 0.5);
    filterCanister.castShadow = true;
    parent.add(filterCanister);

    parent.add(oilPanGroup);

    // 4. Cylinder Bank Castings (Heads & Valve Covers)
    const { headGroup: bank1Head, coverGroup: bank1Cover } = this.createBankCasting(1, parent);
    const { headGroup: bank2Head, coverGroup: bank2Cover } = this.createBankCasting(2, parent);

    // 5. Lifter Valley Cover Plate & Knock Sensor Towers
    const valleyGeo = new THREE.BoxGeometry(
      this.boreRadius * 1.65,
      0.18,
      this.cylinderSpacingZ * 4.2
    );
    const valley = new THREE.Mesh(valleyGeo, this.materials.block);
    valley.position.set(0, this.boreRadius * 2.2, 0);
    valley.userData = { componentId: 'engine_block' };
    parent.add(valley);

    for (let v = -3; v <= 3; v++) {
      [-this.boreRadius * 0.72, this.boreRadius * 0.72].forEach((vx) => {
        const vBoltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6);
        const vBolt = new THREE.Mesh(vBoltGeo, this.materials.boltMetal);
        vBolt.position.set(vx, this.boreRadius * 2.3, v * (this.cylinderSpacingZ * 0.55));
        parent.add(vBolt);
      });
    }

    [-this.cylinderSpacingZ * 0.75, this.cylinderSpacingZ * 0.75].forEach((kz) => {
      const knockTowerGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.45, 16);
      const knockTower = new THREE.Mesh(knockTowerGeo, this.materials.boltMetal);
      knockTower.position.set(0, this.boreRadius * 2.4, kz);
      parent.add(knockTower);

      const knockNutGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 6);
      const knockNut = new THREE.Mesh(knockNutGeo, this.materials.sparkPlugMetal);
      knockNut.position.set(0, this.boreRadius * 2.65, kz);
      parent.add(knockNut);
    });

    const sensorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.75, 16);
    sensorGeo.rotateX(Math.PI / 2);
    const sensor = new THREE.Mesh(sensorGeo, this.materials.sparkPlugMetal);
    sensor.position.set(0, this.boreRadius * 2.2, -this.cylinderSpacingZ * 1.8);
    parent.add(sensor);

    // 6. Front Timing Cover & Water Pump Housing
    const timingCoverGroup = new THREE.Group();
    timingCoverGroup.name = 'TimingCoverGroup';
    const frontZ = frontMainZ + 1.25;

    const timingCoverGeo = new THREE.BoxGeometry(
      this.boreRadius * 2.9,
      this.boreRadius * 2.5,
      0.35
    );
    const timingCover = new THREE.Mesh(timingCoverGeo, this.materials.block);
    timingCover.position.set(0, this.boreRadius * 0.9, frontZ);
    timingCover.castShadow = true;
    timingCoverGroup.add(timingCover);

    const waterPumpGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.65, 24);
    waterPumpGeo.rotateX(Math.PI / 2);
    const waterPump = new THREE.Mesh(waterPumpGeo, this.materials.block);
    waterPump.position.set(0, this.boreRadius * 1.3, frontZ + 0.4);
    waterPump.castShadow = true;
    timingCoverGroup.add(waterPump);

    const snout1Geo = new THREE.CylinderGeometry(0.42, 0.42, 0.85, 16);
    snout1Geo.rotateX(Math.PI / 2);
    const snout1 = new THREE.Mesh(snout1Geo, this.materials.sparkPlugMetal);
    snout1.position.set(-1.2, this.boreRadius * 1.5, frontZ + 0.75);
    timingCoverGroup.add(snout1);

    const snout2Geo = new THREE.CylinderGeometry(0.48, 0.48, 0.95, 16);
    snout2Geo.rotateX(Math.PI / 2);
    const snout2 = new THREE.Mesh(snout2Geo, this.materials.sparkPlugMetal);
    snout2.position.set(1.1, this.boreRadius * 0.9, frontZ + 0.75);
    timingCoverGroup.add(snout2);

    parent.add(timingCoverGroup);

    // 7. Starter Motor Assembly
    const starterGroup = new THREE.Group();
    starterGroup.position.set(this.boreRadius * 1.9, -this.boreRadius * 1.1, rearMainZ - 1.2);
    starterGroup.rotation.x = Math.PI / 2;

    const starterBodyGeo = new THREE.CylinderGeometry(0.85, 0.85, 2.2, 20);
    const starterBody = new THREE.Mesh(starterBodyGeo, this.materials.starterMotor);
    starterGroup.add(starterBody);

    const solenoidGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16);
    const solenoid = new THREE.Mesh(solenoidGeo, this.materials.sparkPlugMetal);
    solenoid.position.set(0.9, 0.2, 0);
    starterGroup.add(solenoid);

    const bTerminalGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.45, 10);
    const bTerminal = new THREE.Mesh(bTerminalGeo, this.materials.gasket);
    bTerminal.position.set(0.9, 1.1, 0);
    starterGroup.add(bTerminal);

    starterGroup.userData = { componentId: 'engine_block' };
    parent.add(starterGroup);

    return {
      bank1HeadGroup: bank1Head,
      bank2HeadGroup: bank2Head,
      bank1CoverGroup: bank1Cover,
      bank2CoverGroup: bank2Cover,
      oilPanGroup,
      timingCoverGroup,
    };
  }

  private createBankCasting(bank: 1 | 2, parent: THREE.Group): { headGroup: THREE.Group; coverGroup: THREE.Group } {
    const group = new THREE.Group();
    const sign = bank === 1 ? -1 : 1;
    const angle = (sign * 45 * Math.PI) / 180;
    const deckLen = this.cylinderSpacingZ * 4.2;

    // A. Main Cylinder Bank Deck Casting (stationary on block)
    const bankGeo = new THREE.BoxGeometry(this.boreRadius * 2.55, this.conRodLength * 0.92, deckLen);
    const bankMesh = new THREE.Mesh(bankGeo, this.materials.block);
    bankMesh.position.set(0, this.conRodLength * 0.7, 0);
    bankMesh.castShadow = true;
    bankMesh.receiveShadow = true;
    bankMesh.userData = { componentId: 'engine_block' };
    group.add(bankMesh);

    // Outer Structural Truss Ribs
    for (let r = -3; r <= 3; r++) {
      const ribGeo = new THREE.BoxGeometry(0.15, this.conRodLength * 0.85, 0.25);
      const rib = new THREE.Mesh(ribGeo, this.materials.block);
      rib.position.set(sign * this.boreRadius * 1.28, this.conRodLength * 0.7, r * (this.cylinderSpacingZ * 0.55));
      group.add(rib);
    }

    // Brass Expansion Freeze Plugs
    [-this.cylinderSpacingZ * 1.0, 0, this.cylinderSpacingZ * 1.0].forEach((fz) => {
      const plugGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.15, 18);
      plugGeo.rotateZ(Math.PI / 2);
      const plug = new THREE.Mesh(plugGeo, this.materials.brassPlug);
      plug.position.set(sign * this.boreRadius * 1.29, this.conRodLength * 0.65, fz);
      group.add(plug);
    });

    // Motor Mount Pad
    const mountPadGeo = new THREE.BoxGeometry(0.35, 1.4, 1.8);
    const mountPad = new THREE.Mesh(mountPadGeo, this.materials.block);
    mountPad.position.set(sign * this.boreRadius * 1.32, this.conRodLength * 0.35, 0);
    group.add(mountPad);

    [-0.5, 0.5].forEach((my) => {
      [-0.6, 0.6].forEach((mz) => {
        const holeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10);
        holeGeo.rotateZ(Math.PI / 2);
        const hole = new THREE.Mesh(holeGeo, this.materials.starterMotor);
        hole.position.set(sign * this.boreRadius * 1.42, this.conRodLength * 0.35 + my, mz);
        group.add(hole);
      });
    });

    group.rotation.z = angle;
    parent.add(group);

    // B. Cylinder Head Group (explodes smoothly outward along bank vector)
    const headGroup = new THREE.Group();
    headGroup.name = 'HeadGroup_Bank' + bank;

    const headGeo = new THREE.BoxGeometry(this.boreRadius * 2.75, this.boreRadius * 1.25, deckLen * 1.02);
    const headMesh = new THREE.Mesh(headGeo, this.materials.block);
    headMesh.position.set(0, this.conRodLength * 1.28, 0);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headMesh.userData = { componentId: 'engine_block' };
    headGroup.add(headMesh);

    // 10 Heavy-Duty Chromoly Head Studs with 12-point nuts
    const studPositions = [
      this.cylinderSpacingZ * 1.9,
      this.cylinderSpacingZ * 1.0,
      0,
      -this.cylinderSpacingZ * 1.0,
      -this.cylinderSpacingZ * 1.9,
    ];
    studPositions.forEach((hz) => {
      [-this.boreRadius * 1.05, this.boreRadius * 1.05].forEach((hx) => {
        const studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
        const stud = new THREE.Mesh(studGeo, this.materials.boltMetal);
        stud.position.set(hx, this.conRodLength * 1.38, hz);
        headGroup.add(stud);

        const nutGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12);
        const nut = new THREE.Mesh(nutGeo, this.materials.boltMetal);
        nut.position.set(hx, this.conRodLength * 1.45, hz);
        headGroup.add(nut);
      });
    });

    headGroup.rotation.z = angle;
    parent.add(headGroup);

    // C. Valve Cover Group (explodes smoothly outward beyond heads)
    const coverGroup = new THREE.Group();
    coverGroup.name = 'CoverGroup_Bank' + bank;

    const coverGeo = new THREE.CylinderGeometry(
      this.boreRadius * 1.25,
      this.boreRadius * 1.35,
      deckLen * 1.01,
      24,
      1,
      false,
      0,
      Math.PI
    );
    coverGeo.rotateX(Math.PI / 2);
    const coverMesh = new THREE.Mesh(coverGeo, this.materials.block);
    coverMesh.position.set(0, this.conRodLength * 1.52, 0);
    coverMesh.castShadow = true;
    coverMesh.userData = { componentId: 'engine_block' };
    coverGroup.add(coverMesh);

    [-0.5, 0, 0.5].forEach((rx) => {
      const vRibGeo = new THREE.BoxGeometry(0.12, 0.15, deckLen * 0.95);
      const vRib = new THREE.Mesh(vRibGeo, this.materials.block);
      vRib.position.set(rx, this.conRodLength * 1.62, 0);
      coverGroup.add(vRib);
    });

    for (let c = -4; c <= 4; c += 2) {
      [-this.boreRadius * 1.2, this.boreRadius * 1.2].forEach((cx) => {
        const cBoltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6);
        const cBolt = new THREE.Mesh(cBoltGeo, this.materials.boltMetal);
        cBolt.position.set(cx, this.conRodLength * 1.54, c * (this.cylinderSpacingZ * 0.48));
        coverGroup.add(cBolt);
      });
    }

    if (bank === 1) {
      const neckGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 18);
      const neck = new THREE.Mesh(neckGeo, this.materials.sparkPlugMetal);
      neck.position.set(0.4, this.conRodLength * 1.66, this.cylinderSpacingZ * 1.3);
      coverGroup.add(neck);

      const capGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.22, 18);
      const cap = new THREE.Mesh(capGeo, this.materials.boltMetal);
      cap.position.set(0.4, this.conRodLength * 1.82, this.cylinderSpacingZ * 1.3);
      coverGroup.add(cap);
    }

    coverGroup.rotation.z = angle;
    parent.add(coverGroup);

    return { headGroup, coverGroup };
  }

  private buildCrankshaft(parent: THREE.Group): { flywheel: THREE.Mesh; damper: THREE.Mesh } {
    const rodJournalRadius = 0.70;
    const rodJournalLen = 1.04;
    const mainJournalRadius = 0.74;
    const pinOffsets = [0, 90, 270, 180];

    const frontMainZ = this.zStart + 1.55;
    const rearMainZ = this.zStart - 3 * this.cylinderSpacingZ - 1.55;

    const mainPositions = [
      frontMainZ,
      this.zStart - this.cylinderSpacingZ * 0.5,
      this.zStart - this.cylinderSpacingZ * 1.5,
      this.zStart - this.cylinderSpacingZ * 2.5,
      rearMainZ,
    ];

    // 1. Five Mirror-Polished Main Bearing Journals between adjacent throws only
    // NOTE: There is NO central shaft inside the throws between the twin counterweights!
    mainPositions.forEach((mz, mIdx) => {
      const isIntermediate = mIdx >= 1 && mIdx <= 3;
      const mjLen = isIntermediate ? (this.cylinderSpacingZ - 1.70) : 1.40;
      const mjGeo = new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, mjLen, 28);
      mjGeo.rotateX(Math.PI / 2);
      const mjMesh = new THREE.Mesh(mjGeo, this.materials.crankshaft);
      mjMesh.position.set(0, 0, mz);
      mjMesh.castShadow = true;
      mjMesh.userData = { componentId: 'crankshaft' };
      parent.add(mjMesh);
    });

    // 3. Counterweight 3D Geometry (Forged steel with chamfered bevels matching user photo)
    const cwShape = createAuthenticCounterweightShape(this.crankRadius);
    const cwGeo = new THREE.ExtrudeGeometry(cwShape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
    cwGeo.translate(0, 0, -0.19);

    // 4. 4 Crank Throws with 8 Authentic Counterweights (Twin counterweights per throw, matching user photo!)
    for (let i = 0; i < 4; i++) {
      const pinZ = this.zStart - i * this.cylinderSpacingZ;
      const angleRad = (pinOffsets[i] * Math.PI) / 180;
      const rotZ = angleRad - Math.PI / 2;

      // Mirror-Polished Crankpin Rod Journal (holds 2 rods side-by-side)
      const pinGeo = new THREE.CylinderGeometry(rodJournalRadius, rodJournalRadius, rodJournalLen, 32);
      pinGeo.rotateX(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, this.materials.crankshaft);
      pinMesh.position.set(
        Math.cos(angleRad) * this.crankRadius,
        Math.sin(angleRad) * this.crankRadius,
        pinZ
      );
      pinMesh.castShadow = true;
      pinMesh.userData = { componentId: 'crankshaft' };
      parent.add(pinMesh);

      // Twin Counterweights flanking each rod journal (8 counterweights total, 2 per throw)
      [-0.68, 0.68].forEach((zOffset) => {
        const cwZ = pinZ + zOffset;
        const cwMesh = new THREE.Mesh(cwGeo, this.materials.crankCounterweight);
        cwMesh.position.set(0, 0, cwZ);
        cwMesh.rotation.z = rotZ;
        cwMesh.castShadow = true;
        cwMesh.userData = { componentId: 'crankshaft' };
        parent.add(cwMesh);
      });
    }

    // 5. Polished Rear Main Seal Journal & Stepped Flywheel Mounting Flange (Matching user photo left end)
    const rearSealLen = 1.80;
    const rearSealGeo = new THREE.CylinderGeometry(0.92, 0.92, rearSealLen, 28);
    rearSealGeo.rotateX(Math.PI / 2);
    const rearSealMesh = new THREE.Mesh(rearSealGeo, this.materials.crankshaft);
    rearSealMesh.position.set(0, 0, rearMainZ - 1.55);
    rearSealMesh.castShadow = true;
    rearSealMesh.userData = { componentId: 'crankshaft' };
    parent.add(rearSealMesh);

    const flangeZ = rearMainZ - 2.50;
    const flangeGeo = new THREE.CylinderGeometry(1.32, 1.32, 0.30, 32);
    flangeGeo.rotateX(Math.PI / 2);
    const flangeMesh = new THREE.Mesh(flangeGeo, this.materials.crankshaft);
    flangeMesh.position.set(0, 0, flangeZ);
    flangeMesh.castShadow = true;
    flangeMesh.userData = { componentId: 'crankshaft' };
    parent.add(flangeMesh);

    // Pilot Bearing Cup & 8 Perimeter Flywheel Bolts
    const pilotGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.32, 20);
    pilotGeo.rotateX(Math.PI / 2);
    const pilotMesh = new THREE.Mesh(pilotGeo, this.materials.mainCap);
    pilotMesh.position.set(0, 0, flangeZ - 0.02);
    parent.add(pilotMesh);

    for (let fb = 0; fb < 8; fb++) {
      const fbRad = (fb * Math.PI) / 4;
      const fbBoltGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12);
      fbBoltGeo.rotateX(Math.PI / 2);
      const fbBolt = new THREE.Mesh(fbBoltGeo, this.materials.boltMetal);
      fbBolt.position.set(Math.cos(fbRad) * 0.96, Math.sin(fbRad) * 0.96, flangeZ - 0.16);
      parent.add(fbBolt);
    }

    // 6. Polished Front Snout Extension (Matching user photo right end)
    const snoutShaftLen = 2.40;
    const snoutShaftGeo = new THREE.CylinderGeometry(0.56, 0.56, snoutShaftLen, 24);
    snoutShaftGeo.rotateX(Math.PI / 2);
    const snoutShaft = new THREE.Mesh(snoutShaftGeo, this.materials.crankshaft);
    snoutShaft.position.set(0, 0, frontMainZ + 1.85);
    snoutShaft.castShadow = true;
    snoutShaft.userData = { componentId: 'crankshaft' };
    parent.add(snoutShaft);

    // Rear Flywheel & Starter Ring Gear (64-tooth precision starter gear ring - User Image 2)
    const flywheelZ = flangeZ - 0.45;
    const flywheelTeeth = 64;
    const flywheelRootR = this.boreRadius * 2.34;
    const flywheelTipR = this.boreRadius * 2.50;
    const flywheelDepth = 0.65;
    const flywheelShape = createGearShape(flywheelTeeth, flywheelRootR, flywheelTipR, 0.38, 0.68);

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
    flywheel.position.set(0, 0, flywheelZ);
    flywheel.castShadow = true;
    flywheel.userData = { componentId: 'flywheel', baseZ: flywheelZ };
    parent.add(flywheel);

    // Inner Recessed Friction Disc / Flexplate Face (machined steel contrast)
    const innerFaceGeo = new THREE.CylinderGeometry(
      this.boreRadius * 2.15,
      this.boreRadius * 2.15,
      flywheelDepth * 0.94,
      36
    );
    innerFaceGeo.rotateX(Math.PI / 2);
    const innerFace = new THREE.Mesh(innerFaceGeo, this.materials.crankshaft);
    innerFace.position.set(0, 0, flywheelZ);
    parent.add(innerFace);

    // Front Harmonic Damper & Timing Trigger Wheel Gear (Image 1)
    const damperFrontZ = frontMainZ + 2.45;
    const damperGroup = new THREE.Group();
    damperGroup.position.set(0, 0, damperFrontZ);

    // Stepped Crank Snout
    const snoutGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.85, 24);
    snoutGeo.rotateX(Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeo, this.materials.crankshaft);
    damperGroup.add(snout);

    // Toothed Outer Gear Rim (36-tooth precision crank timing wheel)
    const damperTeeth = 36;
    const damperRootR = this.boreRadius * 1.38;
    const damperTipR = this.boreRadius * 1.54;
    const damperDepth = 0.68;
    const damperShape = createGearShape(damperTeeth, damperRootR, damperTipR, 0.36, 0.68);

    const damperGeo = new THREE.ExtrudeGeometry(damperShape, {
      depth: damperDepth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    damperGeo.translate(0, 0, -damperDepth / 2);

    const damper = new THREE.Mesh(damperGeo, this.materials.flywheel);
    damper.castShadow = true;
    damper.userData = { componentId: 'crankshaft' };
    damperGroup.add(damper);

    // Recessed Front Hub Well
    const hubWellGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.32, 24);
    hubWellGeo.rotateX(Math.PI / 2);
    const hubWell = new THREE.Mesh(hubWellGeo, this.materials.starterMotor);
    hubWell.position.set(0, 0, 0.22);
    damperGroup.add(hubWell);

    // Heavy Central Crank Snout Hex Bolt
    const centerBoltGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.42, 6);
    centerBoltGeo.rotateX(Math.PI / 2);
    const centerBolt = new THREE.Mesh(centerBoltGeo, this.materials.boltMetal);
    centerBolt.position.set(0, 0, 0.38);
    damperGroup.add(centerBolt);

    // 6 Perimeter Socket-Head Pulley Retaining Bolts
    for (let b = 0; b < 6; b++) {
      const bRad = (b * Math.PI) / 3;
      const bRadius = 0.95;
      const boltGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.22, 12);
      boltGeo.rotateX(Math.PI / 2);
      const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
      bolt.position.set(Math.cos(bRad) * bRadius, Math.sin(bRad) * bRadius, 0.25);
      damperGroup.add(bolt);
    }

    parent.add(damperGroup);



    return { flywheel, damper };
  }

  private buildPiston(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Piston_' + cylId;

    const pistonHeight = this.boreRadius * 1.35;

    // 1. Piston Crown with Four CNC Valve Relief Pockets (Matching 4-Valve Pent-Roof Image 2)
    const crownGeo = new THREE.CylinderGeometry(
      this.boreRadius * 0.98,
      this.boreRadius * 0.98,
      pistonHeight * 0.45,
      32
    );
    const crown = new THREE.Mesh(crownGeo, this.materials.piston);
    crown.position.set(0, pistonHeight * 0.25, 0);
    crown.castShadow = true;
    crown.userData = { componentId: 'piston', cylId };
    group.add(crown);

    // 2. Molybdenum-Coated Slipper Skirt with Relieved Pin Boss Windows
    const skirtGeo = new THREE.CylinderGeometry(
      this.boreRadius * 0.975,
      this.boreRadius * 0.975,
      pistonHeight * 0.55,
      32
    );
    const skirt = new THREE.Mesh(skirtGeo, this.materials.pistonSkirt);
    skirt.position.set(0, -pistonHeight * 0.25, 0);
    skirt.castShadow = true;
    skirt.userData = { componentId: 'piston', cylId };
    group.add(skirt);

    // Slipper skirt window cutouts
    [-this.boreRadius * 0.96, this.boreRadius * 0.96].forEach((wx) => {
      const windowCutoutGeo = new THREE.BoxGeometry(0.35, pistonHeight * 0.4, this.boreRadius * 0.85);
      const windowCutout = new THREE.Mesh(windowCutoutGeo, this.materials.piston);
      windowCutout.position.set(wx, -pistonHeight * 0.28, 0);
      group.add(windowCutout);
    });

    // 3. Three-Piece Piston Ring Pack
    const ringSpecs = [
      { yOffset: pistonHeight * 0.42, thick: 0.04, mat: this.materials.sparkPlugMetal },
      { yOffset: pistonHeight * 0.28, thick: 0.04, mat: this.materials.pistonSkirt },
      { yOffset: pistonHeight * 0.14, thick: 0.06, mat: this.materials.sparkPlugMetal },
    ];

    ringSpecs.forEach((rs) => {
      const ringGeo = new THREE.TorusGeometry(this.boreRadius * 0.985, rs.thick, 8, 32);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, rs.mat);
      ring.position.set(0, rs.yOffset, 0);
      group.add(ring);
    });

    // 4. Hardened Wrist Pin & Spirolox Retainers
    const pinLen = this.boreRadius * 1.86;
    const pinGeo = new THREE.CylinderGeometry(0.36, 0.36, pinLen, 20);
    pinGeo.rotateX(Math.PI / 2);
    const wristPin = new THREE.Mesh(pinGeo, this.materials.wristPin);
    wristPin.position.set(0, -pistonHeight * 0.1, 0);
    wristPin.castShadow = true;
    wristPin.userData = { componentId: 'piston', cylId };
    group.add(wristPin);

    [-pinLen * 0.51, pinLen * 0.51].forEach((pz) => {
      const circlipGeo = new THREE.TorusGeometry(0.38, 0.03, 6, 16);
      const circlip = new THREE.Mesh(circlipGeo, this.materials.boltMetal);
      circlip.position.set(0, -pistonHeight * 0.1, pz);
      group.add(circlip);
    });

    return group;
  }

  private buildConnectingRod(cylId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ConRod_' + cylId;

    const rodLength = this.conRodLength;
    const rodThickness = 0.44; // Fits 2 rods on 1.04 length journal side-by-side
    const journalR = 0.70;

    // 1. Small End (Wrist Pin Eyelet)
    const smallOuterR = 0.58;
    const smallInnerR = 0.38;
    const smallEyeGeo = new THREE.CylinderGeometry(smallOuterR, smallOuterR, rodThickness, 24);
    smallEyeGeo.rotateX(Math.PI / 2);
    const smallEye = new THREE.Mesh(smallEyeGeo, this.materials.conRod);
    smallEye.position.set(0, rodLength, 0);
    smallEye.castShadow = true;
    smallEye.userData = { componentId: 'connecting_rod', cylId };
    group.add(smallEye);

    // Bronze Wrist Pin Bushing
    const bushingGeo = new THREE.CylinderGeometry(smallInnerR, smallInnerR, rodThickness * 1.02, 20);
    bushingGeo.rotateX(Math.PI / 2);
    const bushing = new THREE.Mesh(bushingGeo, this.materials.gasket);
    bushing.position.set(0, rodLength, 0);
    group.add(bushing);

    // 2. Forged H-Beam Shank with Deep Fluted Recesses (Image 2)
    const wTop = 0.28;
    const wBottom = 0.46;
    const shankBottomY = 1.35;
    const shankTopY = rodLength - 0.55;

    // Left outer structural flange
    const leftFlangeShape = new THREE.Shape();
    leftFlangeShape.moveTo(-wTop, shankTopY);
    leftFlangeShape.lineTo(-wBottom, shankBottomY);
    leftFlangeShape.lineTo(-wBottom + 0.13, shankBottomY);
    leftFlangeShape.lineTo(-wTop + 0.11, shankTopY);
    leftFlangeShape.closePath();

    const leftFlangeGeo = new THREE.ExtrudeGeometry(leftFlangeShape, {
      depth: rodThickness,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    leftFlangeGeo.translate(0, 0, -rodThickness * 0.5);
    const leftFlange = new THREE.Mesh(leftFlangeGeo, this.materials.conRod);
    leftFlange.castShadow = true;
    leftFlange.userData = { componentId: 'connecting_rod', cylId };
    group.add(leftFlange);

    // Right outer structural flange
    const rightFlangeShape = new THREE.Shape();
    rightFlangeShape.moveTo(wTop, shankTopY);
    rightFlangeShape.lineTo(wBottom, shankBottomY);
    rightFlangeShape.lineTo(wBottom - 0.13, shankBottomY);
    rightFlangeShape.lineTo(wTop - 0.11, shankTopY);
    rightFlangeShape.closePath();

    const rightFlangeGeo = new THREE.ExtrudeGeometry(rightFlangeShape, {
      depth: rodThickness,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    rightFlangeGeo.translate(0, 0, -rodThickness * 0.5);
    const rightFlange = new THREE.Mesh(rightFlangeGeo, this.materials.conRod);
    rightFlange.castShadow = true;
    rightFlange.userData = { componentId: 'connecting_rod', cylId };
    group.add(rightFlange);

    // Central Recessed Web (Creates the iconic H-beam flutes on front and back)
    const webShape = new THREE.Shape();
    webShape.moveTo(-wTop + 0.10, shankTopY);
    webShape.lineTo(-wBottom + 0.12, shankBottomY);
    webShape.lineTo(wBottom - 0.12, shankBottomY);
    webShape.lineTo(wTop - 0.10, shankTopY);
    webShape.closePath();

    const webGeo = new THREE.ExtrudeGeometry(webShape, {
      depth: rodThickness * 0.32,
      bevelEnabled: false,
    });
    webGeo.translate(0, 0, -rodThickness * 0.16);
    const webMesh = new THREE.Mesh(webGeo, this.materials.conRod);
    webMesh.castShadow = true;
    webMesh.userData = { componentId: 'connecting_rod', cylId };
    group.add(webMesh);

    // 3. Big End Upper Rod Saddle (Forged upper rod half with flared bolt wings)
    const upperBigEndShape = new THREE.Shape();
    upperBigEndShape.moveTo(-1.28, 0.0);
    upperBigEndShape.lineTo(-1.28, 0.55);
    upperBigEndShape.quadraticCurveTo(-1.18, 1.1, -wBottom, shankBottomY);
    upperBigEndShape.lineTo(wBottom, shankBottomY);
    upperBigEndShape.quadraticCurveTo(1.18, 1.1, 1.28, 0.55);
    upperBigEndShape.lineTo(1.28, 0.0);
    upperBigEndShape.absarc(0, 0, journalR, 0, Math.PI, false);
    upperBigEndShape.closePath();

    const upperBigEndGeo = new THREE.ExtrudeGeometry(upperBigEndShape, {
      depth: rodThickness,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    upperBigEndGeo.translate(0, 0, -rodThickness * 0.5);
    const upperBigEnd = new THREE.Mesh(upperBigEndGeo, this.materials.conRod);
    upperBigEnd.castShadow = true;
    upperBigEnd.userData = { componentId: 'connecting_rod', cylId };
    group.add(upperBigEnd);

    // 4. Removable Lower Rod Cap with Thick Bolt Ears (Image 2)
    const capShape = new THREE.Shape();
    capShape.moveTo(-1.28, -0.02); // Hairline parting line
    capShape.absarc(0, 0, journalR, Math.PI, 0, true);
    capShape.lineTo(1.28, -0.02);
    capShape.lineTo(1.28, -0.65);
    capShape.quadraticCurveTo(0.95, -1.35, 0.0, -1.38);
    capShape.quadraticCurveTo(-0.95, -1.35, -1.28, -0.65);
    capShape.closePath();

    const capGeo = new THREE.ExtrudeGeometry(capShape, {
      depth: rodThickness,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    capGeo.translate(0, 0, -rodThickness * 0.5);
    const capMesh = new THREE.Mesh(capGeo, this.materials.conRodCap);
    capMesh.castShadow = true;
    capMesh.userData = { componentId: 'connecting_rod', cylId };
    group.add(capMesh);

    // 5. Bi-Metal Bearing Shell visible in the crankpin bore
    const bearingGeo = new THREE.CylinderGeometry(journalR + 0.005, journalR + 0.005, rodThickness * 0.94, 28, 1, true);
    bearingGeo.rotateX(Math.PI / 2);
    const bearingMesh = new THREE.Mesh(bearingGeo, this.materials.sparkPlugMetal);
    group.add(bearingMesh);

    // 6. High-Strength ARP-Style 12-Point Rod Bolts & Ground Washers (Image 2)
    [-0.96, 0.96].forEach((bx) => {
      // Bolt Stud Shank
      const boltShankGeo = new THREE.CylinderGeometry(0.10, 0.10, 1.45, 12);
      const boltShank = new THREE.Mesh(boltShankGeo, this.materials.boltMetal);
      boltShank.position.set(bx, -0.15, 0);
      group.add(boltShank);

      // Hardened Ground Steel Washer under bolt head
      const washerGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16);
      const washer = new THREE.Mesh(washerGeo, this.materials.sparkPlugMetal);
      washer.position.set(bx, -0.72, 0);
      group.add(washer);

      // ARP 12-Point Flanged Bolt Head (pointing downward from cap spot-face)
      const boltHeadGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 12);
      const boltHead = new THREE.Mesh(boltHeadGeo, this.materials.boltMetal);
      boltHead.position.set(bx, -0.88, 0);
      boltHead.castShadow = true;
      group.add(boltHead);
    });

    return group;
  }

  // Build 4-Valve Pent-Roof Cylinder Top End (2 Intake + 2 Exhaust Angled Inward - Image 2)
  private buildCylinderTopEnd(
    cfg: CylinderConfig,
    zPos: number,
    bankAngleRad: number
  ) {
    // 1. Heavy-Wall Machined Ductile Iron Cylinder Sleeve
    const pistonCrownTopOffset = this.boreRadius * 1.35 * 0.475;
    const deckHeight = this.conRodLength + this.crankRadius + pistonCrownTopOffset;
    const linerLen = 7.8;
    const sleeveGeo = new THREE.CylinderGeometry(
      this.boreRadius * 1.07,
      this.boreRadius * 1.07,
      linerLen,
      32,
      1,
      true
    );
    const liner = new THREE.Mesh(sleeveGeo, this.materials.cylinderLiner);
    const linerCenterDist = deckHeight - linerLen * 0.5;
    liner.position.set(
      Math.sin(bankAngleRad) * linerCenterDist,
      Math.cos(bankAngleRad) * linerCenterDist,
      zPos
    );
    liner.rotation.z = -bankAngleRad;
    liner.userData = { componentId: 'engine_block', cylId: cfg.id };

    // 2. Dual Intake Valves (Pent-Roof Angled Inward towards intake camshaft - Image 2)
    const inValve = new THREE.Group();
    inValve.name = 'IntakeValves_' + cfg.id;
    const inSpringPair: THREE.Mesh[] = [];

    // Inclination angle (18 deg inward toward cylinder axis)
    const inInclineAngle = (cfg.bank === 1 ? -1 : 1) * (18 * Math.PI / 180);

    [-0.36, 0.36].forEach((zOff) => {
      const vUnit = new THREE.Group();

      const inStemGeo = new THREE.CylinderGeometry(0.11, 0.11, 2.3, 16);
      const inStem = new THREE.Mesh(inStemGeo, this.materials.valveIntake);
      inStem.position.set(0, 1.15, 0);
      inStem.castShadow = true;
      vUnit.add(inStem);

      const inHeadGeo = new THREE.CylinderGeometry(0.22, 0.68, 0.26, 20);
      const inHead = new THREE.Mesh(inHeadGeo, this.materials.valveIntake);
      inHead.castShadow = true;
      vUnit.add(inHead);

      const inHelixCurve = new HelixCurve(0.36, 1.35, 6.5);
      const inSpringGeo = new THREE.TubeGeometry(inHelixCurve, 52, 0.048, 8, false);
      const inSpring = new THREE.Mesh(inSpringGeo, this.materials.valveSpring);
      inSpring.position.set(0, 0.45, 0);
      inSpring.castShadow = true;
      vUnit.add(inSpring);
      inSpringPair.push(inSpring);

      const inRetainerGeo = new THREE.CylinderGeometry(0.48, 0.36, 0.16, 16);
      const inRetainer = new THREE.Mesh(inRetainerGeo, this.materials.sparkPlugMetal);
      inRetainer.position.set(0, 1.82, 0);
      vUnit.add(inRetainer);

      // Cam Follower Tappet Bucket directly under cam lobe (Image 2)
      const tappetGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 18);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(0, 2.05, 0);
      vUnit.add(tappet);

      vUnit.position.set(cfg.bank === 1 ? 0.48 : -0.48, 0, zOff);
      vUnit.rotation.z = inInclineAngle;
      inValve.add(vUnit);
    });
    inValve.userData = { componentId: 'valves', cylId: cfg.id };

    // 3. Dual Exhaust Valves (Pent-Roof Angled Inward towards exhaust camshaft - Image 2)
    const exValve = new THREE.Group();
    exValve.name = 'ExhaustValves_' + cfg.id;
    const exSpringPair: THREE.Mesh[] = [];

    // Inclination angle (-18 deg outward toward exhaust cam)
    const exInclineAngle = (cfg.bank === 1 ? 1 : -1) * (18 * Math.PI / 180);

    [-0.36, 0.36].forEach((zOff) => {
      const vUnit = new THREE.Group();

      const exStemGeo = new THREE.CylinderGeometry(0.11, 0.11, 2.3, 16);
      const exStem = new THREE.Mesh(exStemGeo, this.materials.valveExhaust);
      exStem.position.set(0, 1.15, 0);
      exStem.castShadow = true;
      vUnit.add(exStem);

      const exHeadGeo = new THREE.CylinderGeometry(0.20, 0.58, 0.24, 20);
      const exHead = new THREE.Mesh(exHeadGeo, this.materials.valveExhaust);
      exHead.castShadow = true;
      vUnit.add(exHead);

      const exHelixCurve = new HelixCurve(0.36, 1.35, 6.5);
      const exSpringGeo = new THREE.TubeGeometry(exHelixCurve, 52, 0.048, 8, false);
      const exSpring = new THREE.Mesh(exSpringGeo, this.materials.valveSpring);
      exSpring.position.set(0, 0.45, 0);
      exSpring.castShadow = true;
      vUnit.add(exSpring);
      exSpringPair.push(exSpring);

      const exRetainerGeo = new THREE.CylinderGeometry(0.48, 0.36, 0.16, 16);
      const exRetainer = new THREE.Mesh(exRetainerGeo, this.materials.sparkPlugMetal);
      exRetainer.position.set(0, 1.82, 0);
      vUnit.add(exRetainer);

      // Cam Follower Tappet Bucket (Image 2)
      const tappetGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 18);
      const tappet = new THREE.Mesh(tappetGeo, this.materials.crankshaft);
      tappet.position.set(0, 2.05, 0);
      vUnit.add(tappet);

      vUnit.position.set(cfg.bank === 1 ? -0.48 : 0.48, 0, zOff);
      vUnit.rotation.z = exInclineAngle;
      exValve.add(vUnit);
    });
    exValve.userData = { componentId: 'valves', cylId: cfg.id };

    // 4. Central Spark Plug (Right in center between the 4 valves)
    const sparkPlug = new THREE.Group();
    sparkPlug.name = 'SparkPlug_' + cfg.id;

    const plugHexGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.55, 6);
    const plugHex = new THREE.Mesh(plugHexGeo, this.materials.sparkPlugMetal);
    sparkPlug.add(plugHex);

    const plugThreadGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16);
    const plugThread = new THREE.Mesh(plugThreadGeo, this.materials.sparkPlugMetal);
    plugThread.position.set(0, -0.4, 0);
    sparkPlug.add(plugThread);

    const plugCeramicGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.1, 16);
    const plugCeramic = new THREE.Mesh(plugCeramicGeo, this.materials.sparkPlugCeramic);
    plugCeramic.position.set(0, 0.75, 0);
    sparkPlug.add(plugCeramic);

    for (let rib = 0; rib < 4; rib++) {
      const ribGeo = new THREE.TorusGeometry(0.25, 0.03, 6, 16);
      ribGeo.rotateX(Math.PI / 2);
      const ribMesh = new THREE.Mesh(ribGeo, this.materials.sparkPlugCeramic);
      ribMesh.position.set(0, 0.55 + rib * 0.16, 0);
      sparkPlug.add(ribMesh);
    }

    const terminalGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12);
    const terminal = new THREE.Mesh(terminalGeo, this.materials.boltMetal);
    terminal.position.set(0, 1.35, 0);
    sparkPlug.add(terminal);

    const tipGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10);
    const tip = new THREE.Mesh(tipGeo, this.materials.sparkArc);
    tip.position.set(0, -0.75, 0);
    sparkPlug.add(tip);
    sparkPlug.userData = { componentId: 'spark_plug', cylId: cfg.id };

    return { inValve, exValve, inSpringPair, exSpringPair, sparkPlug, liner };
  }

  private buildCamshaftsAndTiming(parent: THREE.Group) {
    const frontZ = 12.0;
    const camRearZ = -10.50;
    const camLen = frontZ - camRearZ;
    const camCenterZ = (frontZ + camRearZ) / 2;

    // Centerline coordinates for all 4 DOHC camshafts directly atop the intake/exhaust tappet buckets
    // Bank 1 (+45° bank): Intake at (11.16, 9.42), Exhaust at (9.42, 11.16)
    // Bank 2 (-45° bank): Intake at (-11.16, 9.42), Exhaust at (-9.42, 11.16)
    type CamSpec = {
      x: number;
      y: number;
      baseAngle: number;
      bank: 1 | 2;
      type: 'intake' | 'exhaust';
    };

    const camPositions: Record<'b1In' | 'b1Ex' | 'b2In' | 'b2Ex', CamSpec> = {
      b1In: { x: 11.16, y: 9.42, baseAngle: -63 * (Math.PI / 180), bank: 1, type: 'intake' },
      b1Ex: { x: 9.42, y: 11.16, baseAngle: -27 * (Math.PI / 180), bank: 1, type: 'exhaust' },
      b2In: { x: -11.16, y: 9.42, baseAngle: 63 * (Math.PI / 180), bank: 2, type: 'intake' },
      b2Ex: { x: -9.42, y: 11.16, baseAngle: 27 * (Math.PI / 180), bank: 2, type: 'exhaust' },
    };

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

      // 3. 4 CNC Lightening Holes / Windows in Sprocket Web
      for (let h = 0; h < 4; h++) {
        const hAngle = (h * Math.PI) / 2 + Math.PI / 4;
        const holeGeo = new THREE.CylinderGeometry(0.13, 0.13, gearDepth * 0.85, 16);
        holeGeo.rotateX(Math.PI / 2);
        const hole = new THREE.Mesh(holeGeo, this.materials.block);
        hole.position.set(Math.cos(hAngle) * 0.50, Math.sin(hAngle) * 0.50, 0);
        sprocketGroup.add(hole);
      }

      // 4. Center VVT-iE / Variable Timing Phaser Actuator Hub
      const hubGeo = new THREE.CylinderGeometry(0.32, 0.32, gearDepth * 1.35, 24);
      hubGeo.rotateX(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, this.materials.sparkPlugMetal);
      sprocketGroup.add(hub);

      // 5. Center Retaining Hex Bolt
      const boltGeo = new THREE.CylinderGeometry(0.13, 0.13, gearDepth * 1.55, 6);
      boltGeo.rotateX(Math.PI / 2);
      const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
      sprocketGroup.add(bolt);

      // 6. 4 Perimeter Phaser Cover Fasteners
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

    const collarGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.20, 24);
    collarGeo.rotateX(Math.PI / 2);

    const jGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.40, 20);
    jGeo.rotateX(Math.PI / 2);

    const camShaftGeo = new THREE.CylinderGeometry(0.36, 0.36, camLen, 24);
    camShaftGeo.rotateX(Math.PI / 2);

    // Bank 1 Cylinders: 1, 3, 5, 7. Bank 2 Cylinders: 2, 4, 6, 8.
    const b1Cyls = CYLINDERS.filter((c) => c.bank === 1);
    const b2Cyls = CYLINDERS.filter((c) => c.bank === 2);

    const buildCam = (cfg: CamSpec) => {
      const group = new THREE.Group();
      group.name = `Camshaft_Bank${cfg.bank}_${cfg.type}`;
      group.position.set(cfg.x, cfg.y, 0);

      // Main Camshaft Tube / Shaft
      const camMesh = new THREE.Mesh(camShaftGeo, this.materials.camshaft);
      camMesh.position.set(0, 0, camCenterZ);
      camMesh.castShadow = true;
      camMesh.userData = { componentId: 'camshaft' };
      group.add(camMesh);

      // Machined Thrust Collar
      const collar = new THREE.Mesh(collarGeo, this.materials.crankshaft);
      collar.position.set(0, 0, frontZ - gearDepth / 2 - 0.10);
      group.add(collar);

      // Ground Bearing Journals
      const journalZs = cfg.bank === 1
        ? [11.0, 6.03, 0.23, -5.57, -9.80]
        : [11.0, 5.57, -0.23, -6.03, -10.20];

      journalZs.forEach((jz) => {
        const jMesh = new THREE.Mesh(jGeo, this.materials.crankshaft);
        jMesh.position.set(0, 0, jz);
        group.add(jMesh);
      });

      // Teardrop Cam Lobes (2 lobes per cylinder, directly contacting valve tappets)
      const cyls = cfg.bank === 1 ? b1Cyls : b2Cyls;
      cyls.forEach((cyl) => {
        const zStagger = cyl.bank === 1 ? 0.23 : -0.23;
        const zPos = this.zStart - cyl.bankIndex * this.cylinderSpacingZ + zStagger;
        const lobeRotZ = cfg.baseAngle + (cyl.firingCycleDeg * 0.5) * (Math.PI / 180);

        [-0.36, 0.36].forEach((vz) => {
          const lobeMesh = new THREE.Mesh(lobeGeo, this.materials.crankshaft);
          lobeMesh.position.set(0, 0, zPos + vz);
          lobeMesh.rotation.z = lobeRotZ;
          lobeMesh.castShadow = true;
          lobeMesh.userData = { componentId: 'camshaft', cylId: cyl.id };
          group.add(lobeMesh);
        });
      });

      // Front 28-Tooth Timing Sprocket with VVT-iE Phaser
      group.add(buildSprocket());

      parent.add(group);
      return group;
    };

    this.b1IntakeCamGroup = buildCam(camPositions.b1In);
    this.b1ExhaustCamGroup = buildCam(camPositions.b1Ex);
    this.b2IntakeCamGroup = buildCam(camPositions.b2In);
    this.b2ExhaustCamGroup = buildCam(camPositions.b2Ex);
  }

  private buildIntakeManifold(parent: THREE.Group): THREE.Group {
    // 1. Intake Plenum Chamber Body
    const plenumLength = this.cylinderSpacingZ * 3.8;
    const plenumGeo = new THREE.BoxGeometry(
      this.boreRadius * 2.0,
      this.boreRadius * 1.2,
      plenumLength
    );
    const plenum = new THREE.Mesh(plenumGeo, this.materials.intakeManifold);
    plenum.position.set(0, 7.8, 0);
    plenum.castShadow = true;
    plenum.userData = { componentId: 'intake_manifold' };
    parent.add(plenum);

    // Front plenum wall
    const plenumFrontZ = plenumLength * 0.5;
    const tbLength = 1.4;
    const tbRadius = 1.55;
    const tbCenterZ = plenumFrontZ + tbLength * 0.5;
    const tbInletZ = plenumFrontZ + tbLength;

    // 2. 4-Bolt Throttle Body Mounting Flange at junction to plenum
    const flangeGeo = new THREE.BoxGeometry(3.8, 3.8, 0.22);
    const flange = new THREE.Mesh(flangeGeo, this.materials.sparkPlugMetal);
    flange.position.set(0, 7.8, plenumFrontZ + 0.11);
    flange.castShadow = true;
    flange.userData = { componentId: 'intake_manifold' };
    parent.add(flange);

    // 4 Perimeter Flange Hex Bolts
    [[-1.45, -1.45], [-1.45, 1.45], [1.45, -1.45], [1.45, 1.45]].forEach(([bx, by]) => {
      const boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12);
      boltGeo.rotateX(Math.PI / 2);
      const bolt = new THREE.Mesh(boltGeo, this.materials.boltMetal);
      bolt.position.set(bx, 7.8 + by, plenumFrontZ + 0.22);
      parent.add(bolt);
    });

    // 3. Deep Dark Interior Plenum Cavity (hollow depth seen behind throttle blade)
    const cavityGeo = new THREE.CylinderGeometry(tbRadius * 0.95, tbRadius * 0.45, 1.8, 28, 1, false);
    cavityGeo.rotateX(Math.PI / 2);
    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x050811 });
    const cavity = new THREE.Mesh(cavityGeo, cavityMat);
    cavity.position.set(0, 7.8, plenumFrontZ - 0.8);
    parent.add(cavity);

    // 4. Hollow Open-Ended Throttle Barrel (Inner polished machined bore - openEnded: true)
    const innerBoreGeo = new THREE.CylinderGeometry(tbRadius, tbRadius, tbLength, 32, 1, true);
    innerBoreGeo.rotateX(Math.PI / 2);
    const innerBoreMat = new THREE.MeshStandardMaterial({
      color: 0xdde3ea,
      metalness: 0.92,
      roughness: 0.12,
      side: THREE.DoubleSide,
      envMapIntensity: 2.0,
    });
    const innerBore = new THREE.Mesh(innerBoreGeo, innerBoreMat);
    innerBore.position.set(0, 7.8, tbCenterZ);
    innerBore.userData = { componentId: 'intake_manifold' };
    parent.add(innerBore);

    // Outer Throttle Body Machined Housing Sleeve (openEnded: true)
    const outerTbGeo = new THREE.CylinderGeometry(tbRadius * 1.15, tbRadius * 1.15, tbLength * 0.96, 32, 1, true);
    outerTbGeo.rotateX(Math.PI / 2);
    const outerTb = new THREE.Mesh(outerTbGeo, this.materials.sparkPlugMetal);
    outerTb.position.set(0, 7.8, tbCenterZ - 0.02);
    outerTb.castShadow = true;
    outerTb.userData = { componentId: 'intake_manifold' };
    parent.add(outerTb);

    // 5. Aerodynamic Machined Inlet Bellmouth / Air Horn Flared Lip
    const bellmouthGeo = new THREE.TorusGeometry(tbRadius * 1.07, 0.15, 16, 36);
    const bellmouth = new THREE.Mesh(bellmouthGeo, this.materials.sparkPlugMetal);
    bellmouth.position.set(0, 7.8, tbInletZ);
    bellmouth.castShadow = true;
    parent.add(bellmouth);

    // Electronic Throttle Actuator (TPS / Drive-by-wire servo module on side)
    const tpsGeo = new THREE.BoxGeometry(0.85, 1.25, 0.95);
    const tps = new THREE.Mesh(tpsGeo, this.materials.starterMotor);
    tps.position.set(1.98, 7.8, tbCenterZ);
    tps.castShadow = true;
    parent.add(tps);

    // 6. Rotating Throttle Butterfly Valve Assembly
    const bladeGroup = new THREE.Group();
    bladeGroup.name = 'ThrottleBlade';
    bladeGroup.position.set(0, 7.8, tbCenterZ);

    // Precision Stainless Steel Throttle Shaft (spans bore horizontally across X)
    const shaftGeo = new THREE.CylinderGeometry(0.1, 0.1, tbRadius * 2.25, 16);
    shaftGeo.rotateZ(Math.PI / 2);
    const shaft = new THREE.Mesh(shaftGeo, this.materials.sparkPlugMetal);
    shaft.castShadow = true;
    bladeGroup.add(shaft);

    // Billet Brass / Gold Anodized Throttle Butterfly Disc
    const bladeGeo = new THREE.CylinderGeometry(tbRadius * 0.96, tbRadius * 0.96, 0.05, 36);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, this.materials.gasket);
    blade.castShadow = true;
    bladeGroup.add(blade);

    // Twin Torx Fastening Screws securing plate to shaft
    [-0.55, 0.55].forEach((sx) => {
      const screwGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10);
      screwGeo.rotateX(Math.PI / 2);
      const screw = new THREE.Mesh(screwGeo, this.materials.boltMetal);
      screw.position.set(sx, 0, 0.035);
      bladeGroup.add(screw);
    });

    parent.add(bladeGroup);

    // 7. Individual Intake Runners to Each Cylinder
    CYLINDERS.forEach((cfg) => {
      const zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ;
      const sign = cfg.bank === 1 ? -1 : 1;
      const runnerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 7.5, zPos),
        new THREE.Vector3(sign * 1.5, 7.2, zPos),
        new THREE.Vector3(sign * 3.2, 5.8, zPos),
      ]);
      const runnerGeo = new THREE.TubeGeometry(runnerCurve, 16, 0.45, 14, false);
      const runner = new THREE.Mesh(runnerGeo, this.materials.intakeManifold);
      runner.castShadow = true;
      runner.userData = { componentId: 'intake_manifold' };
      parent.add(runner);
    });

    return bladeGroup;
  }

  private buildExhaustHeaders(parent: THREE.Group) {
    [1, 2].forEach((bank) => {
      const headerBankGroup = new THREE.Group();
      headerBankGroup.name = 'HeaderBank_' + bank;
      headerBankGroup.userData = { componentId: 'exhaust_headers', bank };

      const sgn = bank === 1 ? 1 : -1;
      const zStagger = bank === 1 ? 0.23 : -0.23;
      const collectorZ = -this.cylinderSpacingZ * 0.75;

      for (let i = 0; i < 4; i++) {
        const zPos = this.zStart - i * this.cylinderSpacingZ + zStagger;

        // 1. CNC Exhaust Port Flange on Cylinder Head Outer Flank
        const flangeGeo = new THREE.BoxGeometry(0.25, 1.1, 1.3);
        const flange = new THREE.Mesh(flangeGeo, this.materials.exhaustHeaders);
        flange.position.set(sgn * 10.35, 6.4, zPos);
        flange.rotation.z = sgn * (45 * Math.PI / 180);
        headerBankGroup.add(flange);

        // 2. Tuned Equal-Length Primary Exhaust Runner
        const p0 = new THREE.Vector3(sgn * 10.4, 6.4, zPos);
        const p1 = new THREE.Vector3(sgn * (11.2 - i * 0.2), 5.0 - i * 0.2, zPos * 0.75 + collectorZ * 0.25);
        const p2 = new THREE.Vector3(sgn * 8.8, 1.8, zPos * 0.3 + collectorZ * 0.7);
        const p3 = new THREE.Vector3(sgn * 6.8, -0.4, collectorZ + (i - 1.5) * 0.35);

        const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
        const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.38, 14, false);
        const tube = new THREE.Mesh(tubeGeo, this.materials.exhaustHeaders);
        tube.castShadow = true;
        tube.userData = { componentId: 'exhaust_headers' };
        headerBankGroup.add(tube);
      }

      // 3. 4-into-1 Merged Collector Cone
      const collGeo = new THREE.CylinderGeometry(0.85, 1.5, 2.2, 20);
      collGeo.rotateX(Math.PI / 2);
      const coll = new THREE.Mesh(collGeo, this.materials.exhaustHeaders);
      coll.position.set(sgn * 6.8, -0.4, collectorZ - 1.2);
      coll.castShadow = true;
      coll.userData = { componentId: 'exhaust_headers' };
      headerBankGroup.add(coll);

      parent.add(headerBankGroup);
    });
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

    // Master Engine Crankshaft Rotation (Continuous 3D Spin synchronized with engine cycle)
    const masterAngleDeg = masterCrankAngleDeg !== undefined ? masterCrankAngleDeg : (telemetryList[0]?.crankAngle ?? 0);
    const masterAngleRad = (masterAngleDeg * Math.PI) / 180;
    this.nodes.crankshaftGroup.rotation.z = masterAngleRad;

    // 4-Stroke Camshaft & Timing Gear Continuous Rotation (1:2 ratio relative to crankshaft)
    const camAngleRad = masterAngleRad * 0.5;
    if (this.b1IntakeCamGroup) this.b1IntakeCamGroup.rotation.z = camAngleRad;
    if (this.b1ExhaustCamGroup) this.b1ExhaustCamGroup.rotation.z = camAngleRad;
    if (this.b2IntakeCamGroup) this.b2IntakeCamGroup.rotation.z = camAngleRad;
    if (this.b2ExhaustCamGroup) this.b2ExhaustCamGroup.rotation.z = camAngleRad;

    // 1. Transparency / See-Through Control (Matching Image 2 Pure Mechanical View)
    if (seeThroughMode === 'ghost') {
      // 100% Invisible block - Pure floating chrome/steel rotating internals (Image 2!)
      this.materials.block.visible = false;
      this.materials.cylinderLiner.visible = false;
      this.materials.gasket.visible = false;
      this.nodes.blockGroup.visible = false;
      this.nodes.bank1CoverGroup.visible = false;
      this.nodes.bank2CoverGroup.visible = false;
    } else if (seeThroughMode === 'translucent' || isCutaway) {
      // Frosted Glassmorphic Translucent Engine
      this.nodes.blockGroup.visible = true;
      this.materials.block.visible = true;
      this.materials.block.opacity = 0.16;
      this.materials.block.transparent = true;
      this.materials.block.depthWrite = false;

      this.materials.cylinderLiner.visible = true;
      this.materials.cylinderLiner.opacity = 0.28;
      this.materials.cylinderLiner.transparent = true;
      this.materials.cylinderLiner.depthWrite = false;

      this.materials.gasket.visible = true;
      this.materials.gasket.opacity = 0.7;

      // In cutaway or translucent mode, hide the top valve covers so the DOHC camshafts and valvetrain are uncrowded
      this.nodes.bank1CoverGroup.visible = !isCutaway && seeThroughMode !== 'translucent';
      this.nodes.bank2CoverGroup.visible = !isCutaway && seeThroughMode !== 'translucent';
    } else {
      // Solid Factory Cast Metallic Engine
      this.nodes.blockGroup.visible = true;
      this.nodes.bank1CoverGroup.visible = true;
      this.nodes.bank2CoverGroup.visible = true;
      this.materials.block.visible = true;
      this.materials.block.opacity = 1.0;
      this.materials.block.transparent = false;
      this.materials.block.depthWrite = true;

      this.materials.cylinderLiner.visible = true;
      this.materials.cylinderLiner.opacity = 1.0;
      this.materials.cylinderLiner.transparent = false;
      this.materials.cylinderLiner.depthWrite = true;

      this.materials.gasket.visible = true;
      this.materials.gasket.opacity = 1.0;
    }

    // 2. Coordinated Radial Exploded View Kinematics
    const p = explodedProgress;
    const ep = p * p * (3 - 2 * p); // Smooth cubic ease-in-out

    // Top: Intake Manifold elevates straight UP
    this.nodes.intakeManifoldGroup.position.set(0, ep * 9.0, 0);

    // Bottom: Oil Pan drops straight DOWN
    this.nodes.oilPanGroup.position.set(0, -ep * 5.5, 0);

    // Front: Timing Cover, Water Pump, Damper slide FORWARD (+Z)
    this.nodes.timingCoverGroup.position.set(0, 0, ep * 5.0);
    this.nodes.damperMesh.position.set(0, 0, ep * 5.5);

    // Rear: Flywheel slides BACK (-Z)
    const flywheelBaseZ = this.nodes.flywheelMesh.userData?.baseZ ?? (this.zStart - 3 * this.cylinderSpacingZ - 4.5);
    this.nodes.flywheelMesh.position.set(0, 0, flywheelBaseZ - ep * 5.0);

    // Bank 1 (Right Bank, +45 deg) Radial Offsets
    const b1DirX = 0.7071;
    const b1DirY = 0.7071;

    // Bank 1 Heads, Covers
    this.nodes.bank1HeadGroup.position.set(b1DirX * ep * 3.2, b1DirY * ep * 3.2, 0);
    this.nodes.bank1CoverGroup.position.set(b1DirX * ep * 6.5, b1DirY * ep * 6.5, 0);

    // Bank 2 (Left Bank, -45 deg) Radial Offsets
    const b2DirX = -0.7071;
    const b2DirY = 0.7071;

    this.nodes.bank2HeadGroup.position.set(b2DirX * ep * 3.2, b2DirY * ep * 3.2, 0);
    this.nodes.bank2CoverGroup.position.set(b2DirX * ep * 6.5, b2DirY * ep * 6.5, 0);

    // Camshafts: separate radially along bank angles
    const b1DispX = b1DirX * ep * 4.2;
    const b1DispY = b1DirY * ep * 4.2;
    const b2DispX = b2DirX * ep * 4.2;
    const b2DispY = b2DirY * ep * 4.2;

    if (this.b1IntakeCamGroup) {
      this.b1IntakeCamGroup.position.set(11.16 + b1DispX, 9.42 + b1DispY, 0);
    }
    if (this.b1ExhaustCamGroup) {
      this.b1ExhaustCamGroup.position.set(9.42 + b1DispX, 11.16 + b1DispY, 0);
    }
    if (this.b2IntakeCamGroup) {
      this.b2IntakeCamGroup.position.set(-11.16 + b2DispX, 9.42 + b2DispY, 0);
    }
    if (this.b2ExhaustCamGroup) {
      this.b2ExhaustCamGroup.position.set(-9.42 + b2DispX, 11.16 + b2DispY, 0);
    }

    // Exhaust Headers: push outward horizontally on explode
    this.nodes.exhaustHeadersGroup.children.forEach((headerChild) => {
      const isBank1 = headerChild.userData.bank === 1;
      const pushDir = isBank1 ? 1 : -1;
      if (!headerChild.userData.baseX) {
        headerChild.userData.baseX = headerChild.position.x;
      }
      headerChild.position.x = headerChild.userData.baseX + pushDir * ep * 6.5;
    });

    // 3. Cylinder-by-Cylinder Kinematics (Pistons, Con-Rods, 32 Valves, Springs, Spark Plugs)
    CYLINDERS.forEach((cfg, idx) => {
      const telem = telemetryList[idx];
      if (!telem) return;

      const zStagger = cfg.bank === 1 ? 0.23 : -0.23;
      const zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ + zStagger;
      const bankAngleRad = (cfg.bankTiltDeg * Math.PI) / 180;
      const isBank1 = cfg.bank === 1;
      const cDirX = isBank1 ? b1DirX : b2DirX;
      const cDirY = isBank1 ? b1DirY : b2DirY;

      // 1. Exact Crankpin Center in 3D World Space (Locked to the spinning crankshaft)
      const pinOffsetRad = (cfg.crankpinAngleDeg * Math.PI) / 180;
      const pinAngleRad = pinOffsetRad + masterAngleRad;
      const cX = Math.cos(pinAngleRad) * this.crankRadius;
      const cY = Math.sin(pinAngleRad) * this.crankRadius;

      // 2. Exact Slider-Crank Piston Distance along the Cylinder Bore Line
      const uX = Math.sin(bankAngleRad);
      const uY = Math.cos(bankAngleRad);
      const b = cX * uX + cY * uY;
      const s = b + Math.sqrt(this.conRodLength * this.conRodLength - this.crankRadius * this.crankRadius + b * b);

      // Piston coordinates along cylinder bore (plus radial exploded separation if any)
      const sExploded = s + ep * 1.5;
      const pistonX = sExploded * uX;
      const pistonY = sExploded * uY;

      // 3. Position and Orient Piston
      const pistonMesh = this.nodes.pistons[idx];
      if (pistonMesh) {
        pistonMesh.position.set(pistonX, pistonY, zPos);
        pistonMesh.rotation.z = -bankAngleRad;
      }

      // 4. Position and Orient Connecting Rod (Locked to Crankpin and Piston Wrist-Pin)
      const rodMesh = this.nodes.connectingRods[idx];
      if (rodMesh) {
        // Big end sits directly on the spinning crankpin!
        rodMesh.position.set(cX, cY, zPos);
        // Rod points from crankpin (cX, cY) to piston wrist pin (pistonX, pistonY)
        const dx = pistonX - cX;
        const dy = pistonY - cY;
        const rodAngle = Math.atan2(dx, dy);
        rodMesh.rotation.z = -rodAngle;
      }

      // 32 Pent-Roof Valves & Compression Springs
      const inValve = this.nodes.intakeValves[idx];
      const exValve = this.nodes.exhaustValves[idx];
      const inSpringPair = this.nodes.intakeSprings[idx];
      const exSpringPair = this.nodes.exhaustSprings[idx];
      const pistonCrownTopOffset = this.boreRadius * 1.35 * 0.475;
      const deckHeight = this.conRodLength + this.crankRadius + pistonCrownTopOffset;
      const headDist = deckHeight + 0.95;

      const baseHeadX = Math.sin(bankAngleRad) * headDist;
      const baseHeadY = Math.cos(bankAngleRad) * headDist;

      // Exploded head position offset
      const headX = baseHeadX + cDirX * ep * 4.2;
      const headY = baseHeadY + cDirY * ep * 4.2;

      if (inValve) {
        const liftThree = (telem.intakeValveLiftMm / 11.5) * 0.55;
        // Incline displacement along angled intake valve stem
        inValve.position.set(
          headX - Math.sin(bankAngleRad) * liftThree,
          headY - Math.cos(bankAngleRad) * liftThree,
          zPos
        );
        inValve.rotation.z = -bankAngleRad;

        if (inSpringPair) {
          const compFactor = Math.max(0.65, 1 - liftThree / 1.35);
          inSpringPair.forEach((spring) => spring.scale.set(1, compFactor, 1));
        }
      }

      if (exValve) {
        const liftThree = (telem.exhaustValveLiftMm / 11.5) * 0.55;
        exValve.position.set(
          headX - Math.sin(bankAngleRad) * liftThree,
          headY - Math.cos(bankAngleRad) * liftThree,
          zPos
        );
        exValve.rotation.z = -bankAngleRad;

        if (exSpringPair) {
          const compFactor = Math.max(0.65, 1 - liftThree / 1.35);
          exSpringPair.forEach((spring) => spring.scale.set(1, compFactor, 1));
        }
      }

      const sparkPlug = this.nodes.sparkPlugs[idx];
      if (sparkPlug) {
        sparkPlug.position.set(
          headX + Math.sin(bankAngleRad) * 0.35,
          headY + Math.cos(bankAngleRad) * 0.35,
          zPos
        );
        sparkPlug.rotation.z = -bankAngleRad;
      }

      const liner = this.nodes.cylinderLiners[idx];
      if (liner) {
        const linerCenterDist = deckHeight - 7.8 * 0.5;
        liner.position.set(
          Math.sin(bankAngleRad) * linerCenterDist + cDirX * ep * 0.5,
          Math.cos(bankAngleRad) * linerCenterDist + cDirY * ep * 0.5,
          zPos
        );
        liner.rotation.z = -bankAngleRad;
      }
    });
  }
}
