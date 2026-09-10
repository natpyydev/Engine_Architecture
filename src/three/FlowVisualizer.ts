import * as THREE from 'three';
import { EngineId, CylinderTelemetry } from '../engine/types';
import { getEngineConfig, CylinderSpecConfig } from '../engine/engineRegistry';
import { BOXER_CYL_Z } from './Boxer4Assembly';

export class FlowVisualizer {
  public root: THREE.Group;

  private sparkMeshes: THREE.Mesh[] = [];
  private exhaustPuffMeshes: THREE.Mesh[] = [];
  private forceVectorArrows: THREE.ArrowHelper[] = [];
  private flameCoreMeshes: THREE.Mesh[] = [];
  private flameOuterMeshes: THREE.Mesh[] = [];
  private chamberLights: THREE.PointLight[] = [];

  private currentEngineId: EngineId = 'v8_lexus';
  private cylinderConfigs: CylinderSpecConfig[] = [];

  private readonly scale: number = 0.05;
  private crankRadius: number = 44.75 * this.scale;
  private conRodLength: number = 151.0 * this.scale;
  private boreRadius: number = 47.0 * this.scale;
  private cylinderSpacingZ: number = 116.0 * this.scale;
  private zStart: number = 1.5 * this.cylinderSpacingZ;

  constructor(engineId: EngineId = 'v8_lexus') {
    this.root = new THREE.Group();
    this.root.name = 'FlowVisualizer_Root';
    this.setEngine(engineId);
  }

  public setEngine(engineId: EngineId) {
    this.currentEngineId = engineId;

    // Clear previous children
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      this.root.remove(child);
    }
    this.sparkMeshes = [];
    this.exhaustPuffMeshes = [];
    this.forceVectorArrows = [];
    this.flameCoreMeshes = [];
    this.flameOuterMeshes = [];
    this.chamberLights = [];

    const cfg = getEngineConfig(engineId);
    this.cylinderConfigs = cfg.cylinders;
    this.crankRadius = (cfg.strokeMm / 2) * this.scale;
    this.conRodLength = cfg.conRodLengthMm * this.scale;
    this.boreRadius = (cfg.boreMm / 2) * this.scale;

    if (engineId === 'i6_bmw') {
      this.cylinderSpacingZ = 91.0 * this.scale;
      this.zStart = 2.5 * this.cylinderSpacingZ;
    } else if (engineId === 'boxer4_subaru') {
      this.cylinderSpacingZ = 104.0 * this.scale;
      this.zStart = 0.5 * this.cylinderSpacingZ;
    } else {
      this.cylinderSpacingZ = 116.0 * this.scale;
      this.zStart = 1.5 * this.cylinderSpacingZ;
    }

    this.buildEffects();
  }

  private buildEffects() {
    const isBoxer = this.currentEngineId === 'boxer4_subaru';
    const isI6 = this.currentEngineId === 'i6_bmw';

    this.cylinderConfigs.forEach((cfg) => {
      let zPos = 0;
      let bankAngleRad = 0;
      let headX = 0;
      let headY = 0;

      if (isBoxer) {
        zPos = BOXER_CYL_Z[cfg.id] ?? (cfg.bankIndex === 0 ? this.zStart : -this.zStart);
        const bankSign = cfg.bank === 1 ? -1 : 1;
        bankAngleRad = bankSign * Math.PI * 0.5;
        headX = bankSign * (this.conRodLength + this.crankRadius + 2.2);
        headY = 0;
      } else if (isI6) {
        zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ;
        bankAngleRad = 0;
        headX = 0;
        headY = this.conRodLength + this.crankRadius + 1.8;
      } else {
        // V8
        const zStagger = cfg.bank === 1 ? 0.23 : -0.23;
        zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ + zStagger;
        bankAngleRad = (cfg.bankTiltDeg * Math.PI) / 180;
        const pistonCrownTopOffset = this.boreRadius * 1.35 * 0.475;
        const deckHeight = this.conRodLength + this.crankRadius + pistonCrownTopOffset;
        const headDist = deckHeight + 0.95;
        headX = Math.sin(bankAngleRad) * headDist;
        headY = Math.cos(bankAngleRad) * headDist;
      }

      // 1. Electric Spark Plasma Arc at spark plug
      const sparkGeo = new THREE.SphereGeometry(0.38, 12, 12);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xa5b4fc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      if (isBoxer) {
        sparkMesh.position.set(headX, 0, zPos);
      } else if (isI6) {
        sparkMesh.position.set(headX, headY, zPos);
      } else {
        sparkMesh.position.set(headX, headY + 0.3, zPos);
      }
      this.root.add(sparkMesh);
      this.sparkMeshes.push(sparkMesh);

      // 2. Combustion Chamber Flame (Core + Outer)
      const flameCoreGeo = new THREE.CylinderGeometry(
        this.boreRadius * 0.70,
        this.boreRadius * 0.82,
        1.0,
        18,
        1,
        false
      );
      const flameCoreMat = new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
      flameCore.rotation.z = -bankAngleRad;
      flameCore.visible = false;
      this.root.add(flameCore);
      this.flameCoreMeshes.push(flameCore);

      const flameOuterGeo = new THREE.CylinderGeometry(
        this.boreRadius * 0.94,
        this.boreRadius * 0.98,
        1.2,
        20,
        1,
        false
      );
      const flameOuterMat = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
      flameOuter.rotation.z = -bankAngleRad;
      flameOuter.visible = false;
      this.root.add(flameOuter);
      this.flameOuterMeshes.push(flameOuter);

      // 3. Dynamic Chamber Flash Light
      const chamberLight = new THREE.PointLight(0xff6a00, 0, 5.5);
      chamberLight.position.set(headX, headY, zPos);
      this.root.add(chamberLight);
      this.chamberLights.push(chamberLight);

      // 4. Exhaust Gas Flow Puff
      const exhaustGeo = new THREE.SphereGeometry(this.boreRadius * 0.52, 14, 14);
      const exhaustMat = new THREE.MeshBasicMaterial({
        color: 0xb91c1c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
      if (isBoxer) {
        exhaustMesh.position.set(headX * 0.75, -2.4, zPos);
      } else if (isI6) {
        exhaustMesh.position.set(2.4, 9.0, zPos);
      } else {
        const sgn = cfg.bank === 1 ? 1 : -1;
        exhaustMesh.position.set(sgn * 10.4, 6.4, zPos);
      }
      this.root.add(exhaustMesh);
      this.exhaustPuffMeshes.push(exhaustMesh);

      // 5. Kinetic Force Vector Arrow
      let arrowDir = new THREE.Vector3(
        -Math.sin(bankAngleRad),
        -Math.cos(bankAngleRad),
        0
      ).normalize();
      if (isBoxer) {
        const bankSign = cfg.bank === 1 ? -1 : 1;
        arrowDir = new THREE.Vector3(-bankSign, 0, 0);
      }
      const arrow = new THREE.ArrowHelper(
        arrowDir,
        new THREE.Vector3(headX, headY, zPos),
        2.5,
        0x00f0ff,
        0.8,
        0.5
      );
      arrow.visible = false;
      this.root.add(arrow);
      this.forceVectorArrows.push(arrow);
    });
  }

  public update(
    telemetryList: CylinderTelemetry[],
    showKineticVectors: boolean = false
  ) {
    const isBoxer = this.currentEngineId === 'boxer4_subaru';
    const isI6 = this.currentEngineId === 'i6_bmw';

    this.cylinderConfigs.forEach((cfg, idx) => {
      const telem = telemetryList[idx];
      if (!telem) return;

      let zPos = 0;
      let bankAngleRad = 0;
      let headX = 0;
      let headY = 0;
      let pistonX = 0;
      let pistonY = 0;

      if (isBoxer) {
        zPos = BOXER_CYL_Z[cfg.id] ?? (cfg.bankIndex === 0 ? this.zStart : -this.zStart);
        const bankSign = cfg.bank === 1 ? -1 : 1;
        bankAngleRad = bankSign * Math.PI * 0.5;
        headX = bankSign * (this.conRodLength + this.crankRadius + 2.2);
        headY = 0;
        const disp = (telem.pistonDisplacementMm / 79.0) * (this.crankRadius * 2);
        const pistonCrownDist = this.conRodLength + this.crankRadius + 1.2 - disp;
        pistonX = bankSign * pistonCrownDist;
        pistonY = 0;
      } else if (isI6) {
        zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ;
        bankAngleRad = 0;
        headX = 0;
        headY = this.conRodLength + this.crankRadius + 1.8;
        const deckHeight = this.conRodLength + this.crankRadius + 1.15;
        const disp = (telem.pistonDisplacementMm / 90.0) * (this.crankRadius * 2);
        pistonX = 0;
        pistonY = deckHeight - disp;
      } else {
        const zStagger = cfg.bank === 1 ? 0.23 : -0.23;
        zPos = this.zStart - cfg.bankIndex * this.cylinderSpacingZ + zStagger;
        bankAngleRad = (cfg.bankTiltDeg * Math.PI) / 180;
        const pistonCrownTopOffset = this.boreRadius * 1.35 * 0.475;
        const deckHeight = this.conRodLength + this.crankRadius + pistonCrownTopOffset;
        const dispThreeUnits = (telem.pistonDisplacementMm / 89.5) * (this.crankRadius * 2);
        const distFromCrankCenter = deckHeight - dispThreeUnits;
        pistonX = Math.sin(bankAngleRad) * distFromCrankCenter;
        pistonY = Math.cos(bankAngleRad) * distFromCrankCenter;
        const headDist = deckHeight + 0.95;
        headX = Math.sin(bankAngleRad) * headDist;
        headY = Math.cos(bankAngleRad) * headDist;
      }

      // 1. Spark Discharge Arc
      const spark = this.sparkMeshes[idx];
      if (spark) {
        if (telem.isSparking) {
          spark.visible = true;
          (spark.material as THREE.MeshBasicMaterial).opacity = 0.98;
          const sparkScale = 1.0 + Math.random() * 0.8;
          spark.scale.set(sparkScale, sparkScale, sparkScale);
        } else {
          spark.visible = false;
          (spark.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }

      // 2. Dynamic Combustion Flame Propagation
      const flameCore = this.flameCoreMeshes[idx];
      const flameOuter = this.flameOuterMeshes[idx];
      const chLight = this.chamberLights[idx];

      if (telem.stroke === 'Power' && telem.flameIntensity > 0.05) {
        const fi = telem.flameIntensity;
        const midX = (headX + pistonX) * 0.5;
        const midY = (headY + pistonY) * 0.5;
        const flameLength = Math.max(0.6, Math.hypot(headX - pistonX, headY - pistonY));

        if (flameCore) {
          flameCore.visible = true;
          flameCore.position.set(midX, midY, zPos);
          flameCore.scale.set(1.0 + Math.random() * 0.1, flameLength, 1.0 + Math.random() * 0.1);
          (flameCore.material as THREE.MeshBasicMaterial).opacity = fi * 0.92;
        }

        if (flameOuter) {
          flameOuter.visible = true;
          flameOuter.position.set(midX, midY, zPos);
          flameOuter.scale.set(1.05, flameLength * 1.15, 1.05);
          (flameOuter.material as THREE.MeshBasicMaterial).opacity = fi * 0.80;
        }

        if (chLight) {
          chLight.position.set(midX, midY, zPos);
          chLight.intensity = fi * 3.5;
        }
      } else {
        if (flameCore) {
          flameCore.visible = false;
          (flameCore.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        if (flameOuter) {
          flameOuter.visible = false;
          (flameOuter.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        if (chLight) {
          chLight.intensity = 0;
        }
      }

      // 3. Exhaust Gas Expulsion
      const exh = this.exhaustPuffMeshes[idx];
      if (exh) {
        const mat = exh.material as THREE.MeshBasicMaterial;
        if (telem.stroke === 'Exhaust' && telem.exhaustValveLiftMm > 0.5) {
          exh.visible = true;
          mat.opacity = 0.45 * (telem.exhaustValveLiftMm / 11.5);
          const exhScale = 0.6 + (telem.exhaustValveLiftMm / 11.5) * 0.4;
          exh.scale.set(exhScale, exhScale, exhScale);
        } else {
          exh.visible = false;
          mat.opacity = 0;
        }
      }

      // 4. Kinetic Energy Force Vector Arrows
      const arrow = this.forceVectorArrows[idx];
      if (arrow) {
        if (showKineticVectors && telem.pressureBar > 2.0) {
          arrow.visible = true;
          arrow.position.set(pistonX, pistonY, zPos);
          const forceLen = Math.min(4.8, (telem.pressureBar / 85.0) * 4.8);
          arrow.setLength(forceLen, Math.min(1.0, forceLen * 0.3), Math.min(0.6, forceLen * 0.2));

          if (telem.stroke === 'Power') {
            arrow.setColor(0xef4444);
          } else if (telem.stroke === 'Compression') {
            arrow.setColor(0xf59e0b);
          } else {
            arrow.setColor(0x0ea5e9);
          }
        } else {
          arrow.visible = false;
        }
      }
    });
  }
}
