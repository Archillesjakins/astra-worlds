import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneSpec } from '../types';
import { FPSControls } from '../controls/FPSControls';
import {
  createAnimal,
  createBoat,
  createCloud,
  createPalm,
  createRock,
  createTree,
  mulberry32,
} from './props';

export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animId = 0;
  private fps: FPSControls | null = null;
  private orbit: OrbitControls | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private animals: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private boat: THREE.Group | null = null;
  private disposed = false;
  private groundY = 0;
  private spec: SceneSpec | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  get cameraMode(): 'fps' | 'orbit' | null {
    return this.spec?.cameraMode ?? null;
  }

  build(spec: SceneSpec): void {
    this.clearScene();
    this.spec = spec;
    const rand = mulberry32(hashString(spec.label + spec.terrain));

    // Fog
    if (spec.fog.enabled) {
      this.scene.fog = new THREE.Fog(spec.fog.color, spec.fog.near, spec.fog.far);
      this.scene.background = new THREE.Color(spec.fog.color);
    } else {
      this.scene.fog = null;
      this.scene.background = new THREE.Color(spec.sky.bottom);
    }

    // Sky dome (gradient via vertex colors on a large sphere)
    this.scene.add(makeSkyDome(spec.sky.top, spec.sky.bottom));

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, spec.lighting.ambient);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(spec.sky.top, spec.groundColor, 0.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(spec.lighting.sunColor, spec.lighting.sunIntensity);
    sun.position.set(...spec.lighting.sunPosition);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    if (spec.sky.time === 'night') {
      const moon = new THREE.PointLight('#a8c0ff', 0.6, 120);
      moon.position.set(-30, 35, 20);
      this.scene.add(moon);
      addStars(this.scene, rand);
    }

    // Terrain pieces
    if (spec.terrain === 'island') {
      this.buildIsland(spec, rand);
    } else if (spec.terrain === 'ocean') {
      this.buildOcean(spec, rand);
    } else if (spec.terrain === 'desert') {
      this.buildDesert(spec, rand);
    } else {
      this.buildGroundWorld(spec, rand);
    }

    // Shared props
    if (spec.features.clouds) this.scatterClouds(rand, spec.terrain === 'island' ? 18 : 10);
    if (spec.features.animals) this.scatterAnimals(rand, spec.terrain === 'forest' ? 7 : 4);
    if (spec.features.boat) this.placeBoat(spec);

    this.setupCamera(spec);
    this.clock.start();
    this.loop();
  }

  private buildGroundWorld(spec: SceneSpec, rand: () => number): void {
    this.groundY = 0;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 64),
      new THREE.MeshStandardMaterial({ color: spec.groundColor, flatShading: true, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Gentle hills
    for (let i = 0; i < 8; i++) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(4 + rand() * 6, 12, 8),
        new THREE.MeshStandardMaterial({ color: spec.groundColor, flatShading: true }),
      );
      hill.scale.y = 0.25 + rand() * 0.2;
      hill.position.set((rand() - 0.5) * 60, 0, (rand() - 0.5) * 60);
      hill.receiveShadow = true;
      this.scene.add(hill);
    }

    if (spec.features.water) {
      const pond = this.makeWater(18, spec.waterColor);
      pond.position.set(12, 0.05, -8);
      this.scene.add(pond);
      this.waterMesh = pond;
    }

    if (spec.features.trees) {
      const count = spec.terrain === 'forest' ? 55 : 18;
      for (let i = 0; i < count; i++) {
        const tree = createTree(rand, 0.85 + rand() * 0.5);
        const a = rand() * Math.PI * 2;
        const r = 4 + rand() * 42;
        tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        // Keep spawn clear near origin
        if (tree.position.length() < 3.5) continue;
        this.scene.add(tree);
      }
    }

    if (spec.features.rocks) {
      for (let i = 0; i < 12; i++) {
        const rock = createRock(rand);
        rock.position.set((rand() - 0.5) * 50, 0.1, (rand() - 0.5) * 50);
        this.scene.add(rock);
      }
    }
  }

  private buildIsland(spec: SceneSpec, rand: () => number): void {
    this.groundY = 8;
    // Cloud sea below
    const cloudSea = this.makeWater(200, '#dce8f5');
    cloudSea.position.y = -6;
    (cloudSea.material as THREE.MeshStandardMaterial).opacity = 0.55;
    (cloudSea.material as THREE.MeshStandardMaterial).color.set('#c5d8f0');
    this.scene.add(cloudSea);
    this.waterMesh = cloudSea;

    // Floating island body
    const island = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 12, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: spec.groundColor, flatShading: true }),
    );
    top.position.y = 8;
    top.receiveShadow = true;
    top.castShadow = true;
    island.add(top);

    const dirt = new THREE.Mesh(
      new THREE.ConeGeometry(11, 14, 10),
      new THREE.MeshStandardMaterial({ color: '#5a4030', flatShading: true }),
    );
    dirt.position.y = 1;
    dirt.rotation.x = Math.PI;
    dirt.castShadow = true;
    island.add(dirt);

    // Grass cap disk
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(9.5, 24),
      new THREE.MeshStandardMaterial({ color: '#4f8a3e', flatShading: true }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 9.12;
    grass.receiveShadow = true;
    island.add(grass);

    this.scene.add(island);

    if (spec.features.trees) {
      for (let i = 0; i < 14; i++) {
        const tree = createTree(rand, 0.7 + rand() * 0.4);
        const a = rand() * Math.PI * 2;
        const r = 1.5 + rand() * 7;
        tree.position.set(Math.cos(a) * r, 9.1, Math.sin(a) * r);
        island.add(tree);
      }
    }

    if (spec.features.rocks) {
      for (let i = 0; i < 6; i++) {
        const rock = createRock(rand);
        const a = rand() * Math.PI * 2;
        const r = 3 + rand() * 6;
        rock.position.set(Math.cos(a) * r, 9.15, Math.sin(a) * r);
        island.add(rock);
      }
    }

    // Extra distant islands
    for (let i = 0; i < 3; i++) {
      const mini = new THREE.Mesh(
        new THREE.ConeGeometry(3 + rand() * 2, 8 + rand() * 4, 7),
        new THREE.MeshStandardMaterial({ color: '#5a4030', flatShading: true }),
      );
      mini.rotation.x = Math.PI;
      mini.position.set((rand() - 0.5) * 60, -2 - rand() * 4, (rand() - 0.5) * 60);
      this.scene.add(mini);
    }
  }

  private buildOcean(spec: SceneSpec, rand: () => number): void {
    this.groundY = 0.4;
    const water = this.makeWater(160, spec.waterColor);
    water.position.y = 0;
    this.scene.add(water);
    this.waterMesh = water;

    // Small island / dock piece
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 6, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: '#c2a36b', flatShading: true }),
    );
    sand.position.set(-8, 0.2, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);

    for (let i = 0; i < 4; i++) {
      const palm = createPalm(rand);
      const a = rand() * Math.PI * 2;
      palm.position.set(-8 + Math.cos(a) * 2.5, 0.8, Math.sin(a) * 2.5);
      this.scene.add(palm);
    }

    if (spec.features.rocks) {
      for (let i = 0; i < 8; i++) {
        const rock = createRock(rand);
        rock.position.set((rand() - 0.5) * 40, 0.1, (rand() - 0.5) * 40);
        this.scene.add(rock);
      }
    }
  }

  private buildDesert(spec: SceneSpec, rand: () => number): void {
    this.groundY = 0;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(90, 48),
      new THREE.MeshStandardMaterial({ color: spec.groundColor, flatShading: true, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    for (let i = 0; i < 16; i++) {
      const dune = new THREE.Mesh(
        new THREE.SphereGeometry(5 + rand() * 8, 10, 6),
        new THREE.MeshStandardMaterial({ color: spec.groundColor, flatShading: true }),
      );
      dune.scale.y = 0.2 + rand() * 0.25;
      dune.position.set((rand() - 0.5) * 70, 0, (rand() - 0.5) * 70);
      dune.receiveShadow = true;
      this.scene.add(dune);
    }

    if (spec.features.rocks) {
      for (let i = 0; i < 20; i++) {
        const rock = createRock(rand);
        rock.position.set((rand() - 0.5) * 60, 0.1, (rand() - 0.5) * 60);
        this.scene.add(rock);
      }
    }
  }

  private makeWater(size: number, color: string): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(size, size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.userData.basePositions = Float32Array.from(geo.attributes.position.array as Float32Array);
    return mesh;
  }

  private scatterClouds(rand: () => number, count: number): void {
    for (let i = 0; i < count; i++) {
      const cloud = createCloud(rand);
      cloud.position.set((rand() - 0.5) * 100, 12 + rand() * 20, (rand() - 0.5) * 100);
      cloud.scale.setScalar(0.8 + rand() * 1.4);
      cloud.userData.drift = 0.15 + rand() * 0.35;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private scatterAnimals(rand: () => number, count: number): void {
    for (let i = 0; i < count; i++) {
      const animal = createAnimal(rand);
      const baseY = this.spec?.terrain === 'island' ? 9.1 : 0;
      animal.userData.center.y = baseY;
      animal.position.copy(animal.userData.center as THREE.Vector3);
      animal.position.y = baseY;
      this.scene.add(animal);
      this.animals.push(animal);
    }
  }

  private placeBoat(spec: SceneSpec): void {
    const boat = createBoat();
    if (spec.terrain === 'ocean') {
      boat.position.set(2, 0.35, 3);
    } else if (spec.terrain === 'island') {
      boat.position.set(14, -5.5, 4);
    } else {
      boat.position.set(12, 0.2, -8);
    }
    this.scene.add(boat);
    this.boat = boat;
  }

  private setupCamera(spec: SceneSpec): void {
    this.disposeControls();

    if (spec.cameraMode === 'orbit') {
      this.camera.position.set(18, 16, 22);
      this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
      this.orbit.target.set(0, 8, 0);
      this.orbit.enableDamping = true;
      this.orbit.dampingFactor = 0.06;
      this.orbit.minDistance = 8;
      this.orbit.maxDistance = 60;
      this.orbit.maxPolarAngle = Math.PI * 0.48;
      this.orbit.update();
    } else {
      this.fps = new FPSControls(this.camera, this.renderer.domElement, 1.7);
      this.scene.add(this.fps.object);
      const startY = spec.terrain === 'ocean' ? 0.8 : 0;
      this.fps.setPosition(0, startY, 8);
      // Face into the scene (-Z)
      this.fps.setYaw(Math.PI);
    }
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.fps) this.fps.update(dt, this.groundY);
    if (this.orbit) this.orbit.update();

    // Animate water
    if (this.waterMesh) {
      const pos = this.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.waterMesh.userData.basePositions as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const wave =
          Math.sin(x * 0.35 + t * 1.4) * 0.12 + Math.cos(y * 0.28 + t * 1.1) * 0.1;
        pos.setZ(i, wave);
      }
      pos.needsUpdate = true;
      this.waterMesh.geometry.computeVertexNormals();
    }

    // Drift clouds
    for (const c of this.clouds) {
      c.position.x += (c.userData.drift as number) * dt;
      if (c.position.x > 60) c.position.x = -60;
    }

    // Wander animals
    for (const a of this.animals) {
      const center = a.userData.center as THREE.Vector3;
      const radius = a.userData.radius as number;
      const speed = a.userData.speed as number;
      const phase = a.userData.phase as number;
      const ang = t * speed * 0.25 + phase;
      a.position.x = center.x + Math.cos(ang) * radius;
      a.position.z = center.z + Math.sin(ang) * radius;
      a.position.y = center.y;
      a.rotation.y = -ang + Math.PI / 2;
    }

    // Bob boat
    if (this.boat) {
      this.boat.position.y += Math.sin(t * 1.5) * 0.002;
      this.boat.rotation.z = Math.sin(t * 1.2) * 0.03;
      this.boat.rotation.x = Math.cos(t * 0.9) * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private clearScene(): void {
    cancelAnimationFrame(this.animId);
    this.disposeControls();
    while (this.scene.children.length) {
      const obj = this.scene.children.pop()!;
      disposeObject(obj);
    }
    this.waterMesh = null;
    this.animals = [];
    this.clouds = [];
    this.boat = null;
    this.scene.fog = null;
  }

  private disposeControls(): void {
    if (this.fps) {
      // Detach camera from FPS rig before disposing
      const cam = this.camera;
      this.fps.object.remove(cam);
      this.fps.object.removeFromParent();
      this.fps.dispose();
      this.fps = null;
    }
    if (this.orbit) {
      this.orbit.dispose();
      this.orbit = null;
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    this.clearScene();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

function makeSkyDome(top: string, bottom: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(200, 32, 16);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  const cTop = new THREE.Color(top);
  const cBottom = new THREE.Color(bottom);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y + 40) / 120, 0, 1);
    tmp.copy(cBottom).lerp(cTop, t);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}

function addStars(scene: THREE.Scene, rand: () => number): void {
  const n = 400;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 80 + rand() * 100;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat));
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
