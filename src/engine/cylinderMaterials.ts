import { CylinderMaterialId } from './engineParams';

/** Visual PBR settings for one engine part (block / piston crown / cylinder sleeve). */
export interface PartLook {
  color: number;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  /** Procedural surface grain used as a bump map (no external image files; works offline). */
  grain: 'none' | 'sand' | 'brushed';
}

export interface CylinderMaterialSpec {
  id: CylinderMaterialId;
  label: string;
  note: string;
  /** Thermal conductivity k, W/(m*K) */
  conductivityWmK: number;
  /** Highest sensible continuous gas-side wall temperature, K */
  maxServiceTempK: number;
  densityKgM3: number;
  look: { block: PartLook; piston: PartLook; liner: PartLook };
}

/**
 * "aluminum_alloy" reproduces the original look exactly (default).
 * Conductivities / densities are typical handbook values; max service temperatures are practical
 * engineering limits, rounded for the simulation.
 */
export const CYLINDER_MATERIALS: Record<CylinderMaterialId, CylinderMaterialSpec> = {
  aluminum_alloy: {
    id: 'aluminum_alloy',
    label: 'Aluminum Alloy',
    note: 'Light and conducts heat very well, but softens above ~300 °C.',
    conductivityWmK: 150,
    maxServiceTempK: 573,
    densityKgM3: 2700,
    look: {
      block: { color: 0x334155, metalness: 0.72, roughness: 0.36, envMapIntensity: 1.5, grain: 'none' },
      piston: { color: 0xe2e8f0, metalness: 0.94, roughness: 0.12, envMapIntensity: 2.4, grain: 'none' },
      liner: { color: 0x94a3b8, metalness: 0.9, roughness: 0.14, envMapIntensity: 2.6, grain: 'none' },
    },
  },
  cast_iron: {
    id: 'cast_iron',
    label: 'Cast Iron',
    note: 'Heavy, rough sand-cast finish, tolerates heat, moderate conductivity.',
    conductivityWmK: 50,
    maxServiceTempK: 723,
    densityKgM3: 7200,
    look: {
      block: { color: 0x2b2d31, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.9, grain: 'sand' },
      piston: { color: 0x8b8f96, metalness: 0.65, roughness: 0.45, envMapIntensity: 1.0, grain: 'sand' },
      liner: { color: 0x565a61, metalness: 0.6, roughness: 0.5, envMapIntensity: 1.2, grain: 'none' },
    },
  },
  forged_steel: {
    id: 'forged_steel',
    label: 'Forged Steel',
    note: 'Very strong, brushed blue-steel finish, handles high temperatures.',
    conductivityWmK: 45,
    maxServiceTempK: 873,
    densityKgM3: 7850,
    look: {
      block: { color: 0x3f4f63, metalness: 0.92, roughness: 0.28, envMapIntensity: 2.0, grain: 'brushed' },
      piston: { color: 0xcfd6df, metalness: 0.96, roughness: 0.18, envMapIntensity: 2.6, grain: 'none' },
      liner: { color: 0x9fb0c4, metalness: 0.95, roughness: 0.12, envMapIntensity: 2.6, grain: 'none' },
    },
  },
  titanium: {
    id: 'titanium',
    label: 'Titanium',
    note: 'Light and strong but a poor heat conductor, so walls run hot.',
    conductivityWmK: 7,
    maxServiceTempK: 853,
    densityKgM3: 4430,
    look: {
      block: { color: 0x4b4a58, metalness: 0.88, roughness: 0.38, envMapIntensity: 1.8, grain: 'none' },
      piston: { color: 0x9a95ad, metalness: 0.9, roughness: 0.3, envMapIntensity: 2.0, grain: 'none' },
      liner: { color: 0x8e8aa0, metalness: 0.9, roughness: 0.2, envMapIntensity: 2.0, grain: 'none' },
    },
  },
};

export const CYLINDER_MATERIAL_ORDER: CylinderMaterialId[] = ['aluminum_alloy', 'cast_iron', 'forged_steel', 'titanium'];

export function getCylinderMaterial(id: CylinderMaterialId): CylinderMaterialSpec {
  return CYLINDER_MATERIALS[id] ?? CYLINDER_MATERIALS.aluminum_alloy;
}
