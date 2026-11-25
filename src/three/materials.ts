import * as THREE from 'three';
import { CylinderMaterialId } from '../engine/engineParams';
import { getCylinderMaterial, PartLook } from '../engine/cylinderMaterials';

export interface EngineMaterialPalette {
  block: THREE.MeshStandardMaterial;
  blockCutaway: THREE.MeshStandardMaterial;
  crankshaft: THREE.MeshStandardMaterial;
  crankCounterweight: THREE.MeshStandardMaterial;
  flywheel: THREE.MeshStandardMaterial;
  piston: THREE.MeshStandardMaterial;
  pistonSkirt: THREE.MeshStandardMaterial;
  wristPin: THREE.MeshStandardMaterial;
  conRod: THREE.MeshStandardMaterial;
  conRodCap: THREE.MeshStandardMaterial;
  camshaft: THREE.MeshStandardMaterial;
  valveIntake: THREE.MeshStandardMaterial;
  valveExhaust: THREE.MeshStandardMaterial;
  valveSpring: THREE.MeshStandardMaterial;
  cylinderLiner: THREE.MeshStandardMaterial;
  intakeManifold: THREE.MeshStandardMaterial;
  exhaustHeaders: THREE.MeshStandardMaterial;
  sparkPlugCeramic: THREE.MeshStandardMaterial;
  sparkPlugMetal: THREE.MeshStandardMaterial;
  timingChain: THREE.MeshStandardMaterial;
  starterMotor: THREE.MeshStandardMaterial;
  mainCap: THREE.MeshStandardMaterial;
  gasket: THREE.MeshStandardMaterial;
  oilFilter: THREE.MeshStandardMaterial;
  boltMetal: THREE.MeshStandardMaterial;
  brassPlug: THREE.MeshStandardMaterial;
  highlighted: THREE.MeshStandardMaterial;
  combustionFlameCore: THREE.MeshBasicMaterial;
  combustionFlameOuter: THREE.MeshBasicMaterial;
  sparkArc: THREE.MeshBasicMaterial;
}

export function createEngineMaterials(): EngineMaterialPalette {
  return {
    block: new THREE.MeshStandardMaterial({
      color: 0x334155, // Automotive die-cast aluminum block
      metalness: 0.72,
      roughness: 0.36,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    }),
    blockCutaway: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.20,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide,
    }),
    crankshaft: new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Mirror-polished induction-hardened steel
      metalness: 0.98,
      roughness: 0.05,
      envMapIntensity: 3.2,
    }),
    crankCounterweight: new THREE.MeshStandardMaterial({
      color: 0x475569, // Forged micro-alloy steel with machined chamfers
      metalness: 0.88,
      roughness: 0.32,
      envMapIntensity: 1.8,
    }),
    flywheel: new THREE.MeshStandardMaterial({
      color: 0x64748b, // Forged 1045 high-carbon steel
      metalness: 0.92,
      roughness: 0.20,
      envMapIntensity: 1.8,
    }),
    piston: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Precision CNC machined forged aluminum crown
      metalness: 0.94,
      roughness: 0.12,
      envMapIntensity: 2.4,
    }),
    pistonSkirt: new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Low-friction MoS2 / resin skirt coating
      metalness: 0.50,
      roughness: 0.55,
      envMapIntensity: 0.9,
    }),
    wristPin: new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // DLC-coated mirror steel wrist pin
      metalness: 0.98,
      roughness: 0.04,
      envMapIntensity: 3.0,
    }),
    conRod: new THREE.MeshStandardMaterial({
      color: 0xc4d1de, // Sinter-forged H-beam alloy steel
      metalness: 0.95,
      roughness: 0.16,
      envMapIntensity: 2.4,
    }),
    conRodCap: new THREE.MeshStandardMaterial({
      color: 0xa9bac9,
      metalness: 0.95,
      roughness: 0.18,
      envMapIntensity: 2.2,
    }),
    camshaft: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.14,
      envMapIntensity: 2.2,
    }),
    valveIntake: new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Lightweight aerospace titanium alloy (cyan anodized badge)
      metalness: 0.88,
      roughness: 0.15,
      envMapIntensity: 2.2,
    }),
    valveExhaust: new THREE.MeshStandardMaterial({
      color: 0xf97316, // Heat-treated sodium-cooled Inconel 751
      metalness: 0.90,
      roughness: 0.20,
      envMapIntensity: 2.0,
    }),
    valveSpring: new THREE.MeshStandardMaterial({
      color: 0x0f172a, // High-tensile shot-peened spring wire
      metalness: 0.96,
      roughness: 0.15,
      envMapIntensity: 2.0,
    }),
    cylinderLiner: new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Precision cross-hatch honed ductile cast iron
      metalness: 0.90,
      roughness: 0.14,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      envMapIntensity: 2.6,
      side: THREE.DoubleSide,
    }),
    intakeManifold: new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Cast aluminum tuned plenum
      metalness: 0.84,
      roughness: 0.25,
      envMapIntensity: 1.6,
    }),
    exhaustHeaders: new THREE.MeshStandardMaterial({
      color: 0xc07a4a, // Beautiful heat-tempered bronze-purple 304 stainless steel
      metalness: 0.96,
      roughness: 0.18,
      envMapIntensity: 2.8,
    }),
    sparkPlugCeramic: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.05,
      roughness: 0.10,
      envMapIntensity: 1.2,
    }),
    sparkPlugMetal: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.10,
      envMapIntensity: 2.5,
    }),
    timingChain: new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.94,
      roughness: 0.18,
      envMapIntensity: 1.8,
    }),
    starterMotor: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.32,
      envMapIntensity: 1.3,
    }),
    mainCap: new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.90,
      roughness: 0.25,
      envMapIntensity: 1.8,
    }),
    gasket: new THREE.MeshStandardMaterial({
      color: 0xd97736, // Multi-layer steel with embossed copper sealing beads
      metalness: 0.92,
      roughness: 0.18,
      envMapIntensity: 2.2,
    }),
    oilFilter: new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Glossy blue filter canister
      metalness: 0.65,
      roughness: 0.18,
      envMapIntensity: 2.2,
    }),
    boltMetal: new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Cadmium / zinc-plated 12-point bolts
      metalness: 0.98,
      roughness: 0.08,
      envMapIntensity: 2.8,
    }),
    brassPlug: new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Golden brass expansion freeze plugs
      metalness: 0.96,
      roughness: 0.20,
      envMapIntensity: 2.4,
    }),
    highlighted: new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.95,
      metalness: 0.85,
      roughness: 0.15,
      envMapIntensity: 2.8,
    }),
    combustionFlameCore: new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    combustionFlameOuter: new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    sparkArc: new THREE.MeshBasicMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
    }),
  };
}
// ---------------------------------------------------------------------------------------------
// Cylinder material selector (block / piston crowns / cylinder sleeves)
// ---------------------------------------------------------------------------------------------

const grainCache: Partial<Record<'sand' | 'brushed', THREE.Texture>> = {};

/** Small procedural bump texture drawn on a canvas (no image files, fully offline). */
function getGrainTexture(kind: 'sand' | 'brushed'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const cached = grainCache[kind];
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  if (kind === 'sand') {
    for (let i = 0; i < 9000; i++) {
      const v = 70 + Math.floor(Math.random() * 150);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      const w = 1 + Math.floor(Math.random() * 3);
      ctx.fillRect(Math.random() * size, Math.random() * size, w, w);
    }
  } else {
    for (let y = 0; y < size; y++) {
      const v = 110 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, size, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  grainCache[kind] = tex;
  return tex;
}

function applyLook(mat: THREE.MeshStandardMaterial, look: PartLook) {
  mat.color.setHex(look.color);
  mat.metalness = look.metalness;
  mat.roughness = look.roughness;
  mat.envMapIntensity = look.envMapIntensity;
  const grain = look.grain === 'none' ? null : getGrainTexture(look.grain);
  if (mat.bumpMap !== grain) {
    mat.bumpMap = grain;
    mat.bumpScale = look.grain === 'sand' ? 1.5 : 0.8;
    mat.needsUpdate = true; // shader variant changes when a map is added / removed
  }
}

/** Re-skin the engine block, piston crowns and cylinder sleeves for the chosen material. */
export function applyCylinderMaterial(palette: EngineMaterialPalette, id: CylinderMaterialId) {
  const spec = getCylinderMaterial(id);
  applyLook(palette.block, spec.look.block);
  applyLook(palette.piston, spec.look.piston);
  applyLook(palette.cylinderLiner, spec.look.liner);
}

/**
 * Overheat glow: 0 = none. Block / pistons / sleeves go dull red-hot as the wall temperature
 * climbs past the material's service limit. Cheap enough to call every frame.
 */
export function applyThermalGlow(palette: EngineMaterialPalette, excess01: number) {
  const g = Math.max(0, Math.min(1, excess01));
  const set = (m: THREE.MeshStandardMaterial, k: number) => {
    m.emissive.setHex(0xff3a00);
    m.emissiveIntensity = g * k;
  };
  set(palette.piston, 0.6);
  set(palette.cylinderLiner, 0.5);
  set(palette.block, 0.25);
}
