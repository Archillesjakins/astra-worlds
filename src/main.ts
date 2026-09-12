import './style.css';
import { parsePrompt } from './parsePrompt';
import { World } from './world/World';

const landing = document.querySelector<HTMLDivElement>('#landing')!;
const hud = document.querySelector<HTMLDivElement>('#hud')!;
const promptEl = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const generateBtn = document.querySelector<HTMLButtonElement>('#generate')!;
const backBtn = document.querySelector<HTMLButtonElement>('#back')!;
const hintEl = document.querySelector<HTMLDivElement>('#hint')!;
const labelEl = document.querySelector<HTMLDivElement>('#scene-label')!;
const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const presets = document.querySelectorAll<HTMLButtonElement>('.chip');

const world = new World(canvas);

function showLanding(): void {
  landing.classList.remove('hidden');
  hud.classList.add('hidden');
  // Rebuild empty clear by re-hiding — keep last frame; dispose controls via rebuild on next gen
  document.exitPointerLock();
}

function enterWorld(prompt: string): void {
  const trimmed = prompt.trim();
  if (!trimmed) {
    promptEl.focus();
    return;
  }

  const spec = parsePrompt(trimmed);
  world.build(spec);

  landing.classList.add('hidden');
  hud.classList.remove('hidden');
  labelEl.textContent = spec.label;

  if (spec.cameraMode === 'orbit') {
    hintEl.textContent = 'Drag to orbit · Scroll to zoom · Esc / New world to leave';
  } else {
    hintEl.textContent = 'Click to lock pointer · WASD move · Mouse look · Space/Shift up/down · Esc to unlock';
  }
}

presets.forEach((chip) => {
  chip.addEventListener('click', () => {
    const p = chip.dataset.prompt ?? chip.textContent ?? '';
    promptEl.value = p;
    promptEl.focus();
  });
});

generateBtn.addEventListener('click', () => enterWorld(promptEl.value));

promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    enterWorld(promptEl.value);
  }
});

backBtn.addEventListener('click', () => {
  showLanding();
});

// Default prompt for first impression
promptEl.value = 'Foggy forest with animals';
