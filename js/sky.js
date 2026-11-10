// sky.js: the stars and the lanterns.

import * as THREE from "three";

// Warm lantern colors
const PALETTE = [0xffc857, 0xff9f43, 0xff7b54, 0xffd6a5, 0xffb347];

// ---------- Small helper functions ----------

// Turns a text (the wish ID) into a number
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A "random" number maker that gives the SAME numbers for the same seed.
// This means a lantern appears at the same place on every device.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Makes a soft round glow picture (white in the middle, fading out)
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Makes a layer of stars spread across the sky
function makeStars(count, size, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const y = Math.random() * 1.15 - 0.15; // mostly above the horizon
    const flat = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * flat * 300;
    positions[i * 3 + 1] = y * 300;
    positions[i * 3 + 2] = Math.sin(angle) * flat * 300;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: size,
    sizeAttenuation: false, // star size in pixels, not affected by distance
    transparent: true,
    opacity: opacity
  });
  return new THREE.Points(geometry, material);
}

// ---------- The main function ----------
export function createSky(scene, camera, onFrame) {
  // Stars: one layer of small ones, one of bigger ones
  const smallStars = makeStars(2000, 1.5, 0.8);
  const bigStars = makeStars(400, 2.6, 0.9);
  scene.add(smallStars);
  scene.add(bigStars);

  // Shared parts, so 200 lanterns don't each make their own copies
  const glowTexture = makeGlowTexture();
  const bodyGeometry = new THREE.CylinderGeometry(0.55, 0.42, 1.6, 10, 1, true);
  const capGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 10);
  const capMaterial = new THREE.MeshBasicMaterial({ color: 0x3b2a1a });

  const bodyMaterials = PALETTE.map(
    (color) => new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })
  );
  const glowMaterials = PALETTE.map(
    (color) =>
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending, // glow adds light instead of covering
        depthWrite: false
      })
  );

  const lanterns = new Map(); // wish id -> lantern info
  let now = 0;                // current time in seconds

  // Add one lantern for one wish
  function addLantern(wish, delay = 0) {
    if (lanterns.has(wish.id)) return; // never add the same lantern twice

    // Position comes from the wish ID, so it is the same on every device
    const rand = mulberry32(hashString(wish.id));
    const theta = (rand() * 2 - 1) * 1.1;   // left/right angle
    const radius = 18 + rand() * 28;        // distance from us
    const height = 3 + rand() * 16;         // how high
    const colorIndex = Math.floor(rand() * PALETTE.length);

    const group = new THREE.Group();

    const body = new THREE.Mesh(bodyGeometry, bodyMaterials[colorIndex]);
    const topCap = new THREE.Mesh(capGeometry, capMaterial);
    topCap.position.y = 0.8;
    const bottomCap = new THREE.Mesh(capGeometry, capMaterial);
    bottomCap.position.y = -0.8;

    const glow = new THREE.Sprite(glowMaterials[colorIndex]);
    glow.scale.set(9, 9, 1);

    group.add(body, topCap, bottomCap, glow);
    group.visible = false;       // hidden until its turn to appear
    group.scale.setScalar(0);
    scene.add(group);

    lanterns.set(wish.id, {
      group: group,
      baseX: Math.sin(theta) * radius,
      baseY: height,
      baseZ: -Math.cos(theta) * radius,
      theta: theta,
      radius: radius,
      height: height,
      phase: rand() * Math.PI * 2,
      speed: 0.6 + rand() * 0.6,
      bornAt: now,
      delay: delay,
      wish: wish // kept for Phase 2 (tap to read the wish)
    });
  }

  // More people = brighter glow (full brightness at 100 lanterns)
  function setPopulation(total) {
    const boost = 0.45 + 0.55 * Math.min(total, 100) / 100;
    glowMaterials.forEach((m) => {
      m.opacity = 0.8 * boost;
    });
  }

  // Which direction should the camera turn to see this lantern?
  function getLook(id) {
    const l = lanterns.get(id);
    if (!l) return null;
    return {
      yaw: -l.theta,
      pitch: Math.atan2(l.height - camera.position.y, l.radius)
    };
  }

  // Runs every frame: twinkle stars, float lanterns
  onFrame((time) => {
    now = time;

    smallStars.material.opacity = 0.65 + 0.25 * Math.sin(time * 1.3);
    bigStars.material.opacity = 0.65 + 0.3 * Math.sin(time * 0.9 + 2);
    smallStars.rotation.y = time * 0.004;
    bigStars.rotation.y = time * 0.004;

    lanterns.forEach((l) => {
      const age = time - l.bornAt - l.delay;
      if (age < 0) return; // not its turn yet

      l.group.visible = true;

      // Grow and rise for 2.5 seconds, then keep floating
      const k = Math.min(age / 2.5, 1);
      const ease = 1 - Math.pow(1 - k, 3);

      const bob = Math.sin(time * l.speed + l.phase) * 0.5;
      const drift = Math.sin(time * 0.3 + l.phase) * 0.4;

      l.group.position.set(
        l.baseX + drift,
        l.baseY + bob - (1 - ease) * 10, // starts 10 units lower and rises
        l.baseZ
      );
      l.group.scale.setScalar(ease);
      l.group.rotation.z = Math.sin(time * 0.5 + l.phase) * 0.05;
    });
  }

  return { addLantern, setPopulation, getLook };
}
