import type { SceneSpec, TerrainKind, TimeOfDay, CameraMode } from './types';

function has(text: string, ...words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/**
 * Keyword / rule-based prompt → SceneSpec mapper.
 * No network, no API keys — purely local heuristics.
 */
export function parsePrompt(raw: string): SceneSpec {
  const text = raw.toLowerCase().trim();

  const wantsFog = has(text, 'fog', 'mist', 'haze', 'misty', 'foggy');
  const wantsForest = has(text, 'forest', 'tree', 'woods', 'jungle', 'pine');
  const wantsIsland = has(text, 'island', 'floating', 'sky island');
  const wantsOcean = has(text, 'ocean', 'sea', 'water', 'lake', 'bay', 'coast');
  const wantsBoat = has(text, 'boat', 'ship', 'sail', 'yacht', 'canoe');
  const wantsAnimals = has(text, 'animal', 'animals', 'deer', 'bird', 'creature', 'wildlife', 'fox');
  const wantsNight = has(text, 'night', 'moon', 'star', 'midnight');
  const wantsDusk = has(text, 'dusk', 'sunset', 'dawn', 'twilight', 'evening');
  const wantsDesert = has(text, 'desert', 'sand', 'dune', 'arid');
  const wantsClouds = has(text, 'cloud', 'clouds', 'sky', 'floating');
  const wantsRocks = has(text, 'rock', 'cliff', 'stone', 'boulder');

  let terrain: TerrainKind = 'meadow';
  if (wantsIsland) terrain = 'island';
  else if (wantsBoat || (wantsOcean && !wantsForest)) terrain = 'ocean';
  else if (wantsDesert) terrain = 'desert';
  else if (wantsForest) terrain = 'forest';
  else if (wantsOcean) terrain = 'ocean';

  const time: TimeOfDay = wantsNight ? 'night' : wantsDusk ? 'dusk' : 'day';
  const cameraMode: CameraMode = terrain === 'island' ? 'orbit' : 'fps';

  const features = {
    trees: terrain === 'forest' || terrain === 'island' || terrain === 'meadow' || wantsForest,
    animals: wantsAnimals,
    boat: wantsBoat || (terrain === 'ocean' && has(text, 'ocean', 'sea', 'boat', 'calm')),
    water: wantsOcean || wantsBoat || terrain === 'ocean' || terrain === 'island',
    clouds: wantsClouds || terrain === 'island' || time === 'day',
    rocks: wantsRocks || terrain === 'island' || terrain === 'desert',
  };

  if (terrain === 'ocean' && !wantsForest) features.trees = false;
  if (terrain === 'desert' && !wantsForest) features.trees = false;

  const skyByTime: Record<TimeOfDay, { top: string; bottom: string }> = {
    day: { top: '#6eb6ff', bottom: '#dce9ff' },
    dusk: { top: '#2a1a4a', bottom: '#ff8a5c' },
    night: { top: '#050814', bottom: '#1a2744' },
  };

  const fogByTerrain: Record<TerrainKind, { color: string; near: number; far: number }> = {
    forest: { color: time === 'night' ? '#1a2230' : '#c5d4c8', near: 8, far: 55 },
    island: { color: '#b8c9e0', near: 20, far: 90 },
    ocean: { color: '#9ec5d8', near: 15, far: 80 },
    desert: { color: '#e8d5a8', near: 12, far: 70 },
    meadow: { color: '#c8d8e8', near: 20, far: 85 },
  };

  const groundByTerrain: Record<TerrainKind, string> = {
    forest: '#3d5c3a',
    island: '#5a7a45',
    ocean: '#1a4a6e',
    desert: '#c2a36b',
    meadow: '#4f7a3e',
  };

  const waterByTime: Record<TimeOfDay, string> = {
    day: '#2a7aad',
    dusk: '#2a4a6e',
    night: '#0e2438',
  };

  const lightingByTime: Record<
    TimeOfDay,
    { ambient: number; sunIntensity: number; sunColor: string; sunPosition: [number, number, number] }
  > = {
    day: { ambient: 0.55, sunIntensity: 1.15, sunColor: '#fff5e0', sunPosition: [40, 60, 20] },
    dusk: { ambient: 0.35, sunIntensity: 0.85, sunColor: '#ff9a60', sunPosition: [50, 18, -10] },
    night: { ambient: 0.18, sunIntensity: 0.25, sunColor: '#a8c0ff', sunPosition: [-20, 40, 30] },
  };

  const fogPreset = fogByTerrain[terrain];
  const fogEnabled = wantsFog || terrain === 'forest' || terrain === 'island';

  const labelParts: string[] = [];
  if (wantsFog) labelParts.push('Foggy');
  labelParts.push(
    terrain === 'forest'
      ? 'forest'
      : terrain === 'island'
        ? 'floating island'
        : terrain === 'ocean'
          ? 'ocean'
          : terrain === 'desert'
            ? 'desert'
            : 'meadow',
  );
  if (features.animals) labelParts.push('· animals');
  if (features.boat) labelParts.push('· boat');
  if (time !== 'day') labelParts.push(`· ${time}`);

  return {
    label: labelParts.join(' ') || 'Astra world',
    terrain,
    fog: {
      enabled: fogEnabled,
      color: fogPreset.color,
      near: fogEnabled ? fogPreset.near : 40,
      far: fogEnabled ? fogPreset.far : 200,
    },
    sky: {
      ...skyByTime[time],
      time,
    },
    lighting: lightingByTime[time],
    features,
    cameraMode,
    groundColor: groundByTerrain[terrain],
    waterColor: waterByTime[time],
  };
}

export const PRESETS = [
  'Foggy forest with animals',
  'Floating island over clouds',
  'Boat on a calm ocean',
] as const;
