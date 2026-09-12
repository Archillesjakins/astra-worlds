import * as THREE from 'three';

/** Simple seeded RNG for repeatable layouts */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTree(rand: () => number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunkH = (1.2 + rand() * 1.4) * scale;
  const trunkR = (0.12 + rand() * 0.08) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 6),
    new THREE.MeshStandardMaterial({ color: '#4a3220', flatShading: true }),
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  const levels = 2 + Math.floor(rand() * 2);
  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.28 + rand() * 0.08, 0.45, 0.28 + rand() * 0.1),
    flatShading: true,
  });
  for (let i = 0; i < levels; i++) {
    const r = (1.1 - i * 0.28 + rand() * 0.15) * scale;
    const h = (1.6 + rand() * 0.4) * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat);
    cone.position.y = trunkH * 0.55 + i * h * 0.45;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}

export function createPalm(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: '#6b4e2e', flatShading: true }),
  );
  trunk.position.y = 1.6;
  trunk.rotation.z = (rand() - 0.5) * 0.25;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: '#3d8a45', flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.8, 4), leafMat);
    leaf.position.set(0, 3.1, 0);
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/** Stylized four-legged animal (deer-ish) */
export function createAnimal(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const bodyColor = new THREE.Color().setHSL(0.08 + rand() * 0.05, 0.35, 0.35 + rand() * 0.1);
  const mat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.4), mat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat);
  head.position.set(0.55, 0.75, 0);
  head.castShadow = true;
  g.add(head);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.45, 5);
  const offsets: [number, number][] = [
    [-0.3, 0.12],
    [-0.3, -0.12],
    [0.3, 0.12],
    [0.3, -0.12],
  ];
  for (const [x, z] of offsets) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(x, 0.22, z);
    leg.castShadow = true;
    g.add(leg);
  }

  // Tiny antlers
  if (rand() > 0.4) {
    const antlerMat = new THREE.MeshStandardMaterial({ color: '#d8c8a8', flatShading: true });
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), antlerMat);
      a.position.set(0.55, 1.0, side * 0.08);
      a.rotation.z = side * 0.35;
      g.add(a);
    }
  }

  g.userData.speed = 0.4 + rand() * 0.6;
  g.userData.phase = rand() * Math.PI * 2;
  g.userData.radius = 4 + rand() * 10;
  g.userData.center = new THREE.Vector3((rand() - 0.5) * 20, 0, (rand() - 0.5) * 20);
  return g;
}

export function createBoat(): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#6b4423', flatShading: true });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.0), hullMat);
  hull.position.y = 0.15;
  hull.castShadow = true;
  g.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(1.4, 0.15, 0);
  bow.castShadow = true;
  g.add(bow);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: '#d9c8a0' }),
  );
  mast.position.set(0.1, 1.2, 0);
  g.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.6),
    new THREE.MeshStandardMaterial({ color: '#f2f0e8', side: THREE.DoubleSide, flatShading: true }),
  );
  sail.position.set(0.55, 1.3, 0);
  g.add(sail);

  return g;
}

export function createRock(rand: () => number): THREE.Mesh {
  const s = 0.4 + rand() * 1.2;
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.08, 0.08, 0.35 + rand() * 0.15),
      flatShading: true,
    }),
  );
  mesh.scale.set(1 + rand() * 0.4, 0.6 + rand() * 0.5, 1 + rand() * 0.3);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCloud(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.85,
    flatShading: true,
    roughness: 1,
  });
  const blobs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 1.2 + rand() * 1.8;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mat);
    m.position.set((rand() - 0.5) * 3.5, (rand() - 0.5) * 0.8, (rand() - 0.5) * 2);
    g.add(m);
  }
  return g;
}
