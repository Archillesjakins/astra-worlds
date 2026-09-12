/**
 * Runtime scene description produced by the keyword/rule parser.
 * The world builder maps this into a Three.js scene.
 */
export type TerrainKind = 'forest' | 'island' | 'ocean' | 'desert' | 'meadow';
export type CameraMode = 'fps' | 'orbit';
export type TimeOfDay = 'day' | 'dusk' | 'night';

export interface SceneSpec {
  /** Short label shown in the HUD */
  label: string;
  terrain: TerrainKind;
  fog: {
    enabled: boolean;
    color: string;
    near: number;
    far: number;
  };
  sky: {
    top: string;
    bottom: string;
    time: TimeOfDay;
  };
  lighting: {
    ambient: number;
    sunIntensity: number;
    sunColor: string;
    sunPosition: [number, number, number];
  };
  features: {
    trees: boolean;
    animals: boolean;
    boat: boolean;
    water: boolean;
    clouds: boolean;
    rocks: boolean;
  };
  cameraMode: CameraMode;
  /** Ground / water tint */
  groundColor: string;
  waterColor: string;
}

/**
 * Optional future contract for an LLM-backed scene generator.
 * Not used at runtime today — the keyword parser fills SceneSpec instead.
 * Keep this shape stable if you wire up an API later.
 *
 * interface LLMSceneSpec {
 *   prompt: string;
 *   terrain: TerrainKind;
 *   mood: string;
 *   fogDensity: number; // 0..1
 *   timeOfDay: TimeOfDay;
 *   props: Array<'trees' | 'animals' | 'boat' | 'rocks' | 'clouds' | 'water'>;
 *   cameraMode: CameraMode;
 *   palette?: {
 *     fog?: string;
 *     skyTop?: string;
 *     skyBottom?: string;
 *     ground?: string;
 *     water?: string;
 *   };
 * }
 */
