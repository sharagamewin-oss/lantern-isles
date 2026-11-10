// islands.js: the floating island, its houses, and where you are allowed to walk.

import * as THREE from "three";

// ---------- Settings (you can change these numbers later) ----------
const ISLAND_Y = -6;        // height of the island's grass surface
const ISLAND_Z = -58;       // how far in front of the sky camera the island floats
const MIN_RADIUS = 12;      // smallest island size (when it is empty)
const MAX_RADIUS = 31;      // biggest island size
const SPACING = 2.6;        // how far apart houses are placed
const MAX_HOUSES = 100;     // this island holds 100 houses
const HOUSE_BLOCK = 1.7;    // you cannot walk closer than this to a house centre

// Soft house colors
const BODY_COLORS = [0xe8c9a0, 0xd9a5a0, 0xa7c4bc, 0xc7b8e0, 0xf0d58c];

// Turns a text (the wish ID) into a number (same helper idea as sky.js)
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The time a wish was created, as a number (a brand-new wish may not have it yet)
function createdMillis(wish) {
  const t = wish.createdAt;
  return t && t.toMillis ? t.toMillis() : Infinity;
}

export function createIsland(scene, onFrame) {
  // ---------- Lights (so the island is visible at night) ----------
  const skyLight = new THREE.HemisphereLight(0x9bb4ff, 0x20182e, 1.0); // soft light from above
  const moonLight = new THREE.DirectionalLight(0xc8d6ff, 1.6);         // moonlight
  moonLight.position.set(-30, 60, 20);
  scene.add(skyLight, moonLight);

  // ---------- The island itself ----------
  // "island" is the box that holds everything. We place it far in front of us.
  const island = new THREE.Group();
  island.position.set(0, ISLAND_Y, ISLAND_Z);
  scene.add(island);

  // "body" is the grass and rock. It is built for radius 10, then scaled bigger.
  const body = new THREE.Group();
  island.add(body);

  // Grass top (its flat surface is at y = 0)
  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 0.8, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f6b55 })
  );
  grass.position.y = -0.4;
  body.add(grass);

  // Rock underneath, narrowing to a point like a floating island
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 2, 8, 9, 3),
    new THREE.MeshStandardMaterial({ color: 0x4a4560, flatShading: true })
  );
  rock.position.y = -4.8;
  body.add(rock);

  // "housesGroup" holds the houses. It is NOT scaled, so houses keep their size.
  const housesGroup = new THREE.Group();
  island.add(housesGroup);

  // ---------- House parts (built once, shared by all houses) ----------
  const wallGeometry = new THREE.BoxGeometry(2.2, 1.6, 2.2);
  const roofGeometry = new THREE.ConeGeometry(1.9, 1.2, 4);
  const windowGeometry = new THREE.PlaneGeometry(0.5, 0.5);
  const doorGeometry = new THREE.PlaneGeometry(0.5, 0.9);

  const wallMaterials = BODY_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color: color })
  );
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3f3a, flatShading: true });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a }); // glows warm
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2f20 });

  // ---------- State ----------
  const houses = new Map();       // wish id -> house info
  let radius = MIN_RADIUS;        // current island radius
  let targetRadius = MIN_RADIUS;  // radius the island is growing toward
  let now = 0;                    // current time in seconds

  // Builds one house (front of the house faces +z)
  function createHouse(wish) {
    const group = new THREE.Group();

    const walls = new THREE.Mesh(wallGeometry, wallMaterials[hashString(wish.id) % BODY_COLORS.length]);
    walls.position.y = 0.8;

    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 2.2;
    roof.rotation.y = Math.PI / 4; // turn the pyramid so its edges match the walls

    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 0.45, 1.11);

    const windowLeft = new THREE.Mesh(windowGeometry, windowMaterial);
    windowLeft.position.set(-0.7, 1.0, 1.11);
    const windowRight = new THREE.Mesh(windowGeometry, windowMaterial);
    windowRight.position.set(0.7, 1.0, 1.11);

    group.add(walls, roof, door, windowLeft, windowRight);
    group.scale.setScalar(0.001); // starts tiny, then pops up

    return { group: group, x: 0, z: 0, bornAt: now, wish: wish };
  }

  // House number i gets a spot in a sunflower-seed spiral.
  // The spiral means every new house lands in a free spot.
  function slotPosition(i) {
    const angle = i * 2.399963; // the "golden angle"
    const r = SPACING * Math.sqrt(i + 0.5);
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      // turn the house so its door faces the middle of the island
      rotation: Math.atan2(-Math.cos(angle), -Math.sin(angle))
    };
  }

  // Called by main.js with ALL wishes. It makes sure every wish has a house.
  function setHouses(wishList) {
    // Oldest first, so a new person always gets the next free spot.
    // The wish ID breaks ties, so every device gives the same order.
    const sorted = wishList.slice().sort((a, b) => {
      const ta = createdMillis(a);
      const tb = createdMillis(b);
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    }).slice(0, MAX_HOUSES);

    const keep = new Set();

    sorted.forEach((wish, i) => {
      keep.add(wish.id);
      const slot = slotPosition(i);

      let house = houses.get(wish.id);
      if (!house) {
        house = createHouse(wish);
        houses.set(wish.id, house);
        housesGroup.add(house.group);
      }
      house.wish = wish;
      house.x = slot.x;
      house.z = slot.z;
      house.group.position.set(slot.x, 0, slot.z);
      house.group.rotation.y = slot.rotation;
    });

    // Remove houses whose wish is gone
    houses.forEach((house, id) => {
      if (!keep.has(id)) {
        housesGroup.remove(house.group);
        houses.delete(id);
      }
    });

    // More houses = bigger island
    targetRadius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, SPACING * Math.sqrt(sorted.length) + 5));
  }

  // Keeps a walking person on the grass and out of the houses.
  // Takes a wanted position (x, z) and returns the allowed position.
  function constrain(x, z) {
    // Work in island coordinates (the middle of the island is 0, 0)
    let lx = x - island.position.x;
    let lz = z - island.position.z;

    // 1. Do not walk off the edge
    const maxDistance = radius - 1.0;
    const distance = Math.hypot(lx, lz);
    if (distance > maxDistance) {
      lx = (lx / distance) * maxDistance;
      lz = (lz / distance) * maxDistance;
    }

    // 2. Do not walk through houses (push the person out to the edge of the house)
    houses.forEach((house) => {
      const dx = lx - house.x;
      const dz = lz - house.z;
      const d = Math.hypot(dx, dz);
      if (d < HOUSE_BLOCK) {
        if (d < 0.0001) {
          lx = house.x + HOUSE_BLOCK;
        } else {
          lx = house.x + (dx / d) * HOUSE_BLOCK;
          lz = house.z + (dz / d) * HOUSE_BLOCK;
        }
      }
    });

    return { x: lx + island.position.x, z: lz + island.position.z };
  }

  // Where you land when you fly down: the front edge of the island (no houses there)
  function getSpawn() {
    return {
      x: island.position.x,
      y: ISLAND_Y,
      z: island.position.z + radius - 3
    };
  }

  // NEW in Phase 4: which house is under this tap? (returns the wish id, or null)
  const tempVector = new THREE.Vector3();
  function pickHouse(clientX, clientY, camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let bestId = null;
    let bestDistance = 45; // a tap must be within 45 pixels of a house

    houses.forEach((house, id) => {
      // The middle of the house in the 3D world (a bit above the ground)
      house.group.getWorldPosition(tempVector);
      tempVector.y += 1.2;

      // Turn that 3D position into a position on the screen
      tempVector.project(camera);
      if (tempVector.z > 1) return; // it is behind us

      const screenX = (tempVector.x * 0.5 + 0.5) * w;
      const screenY = (-tempVector.y * 0.5 + 0.5) * h;
      const distance = Math.hypot(screenX - clientX, screenY - clientY);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    });

    return bestId;
  }

  // Runs every frame: grow the island and pop up new houses
  onFrame((time, delta) => {
    now = time;

    // The island grows smoothly toward its target size
    radius += (targetRadius - radius) * Math.min(1, delta * 2);
    body.scale.setScalar(radius / 10);

    // New houses grow from tiny to full size in 1.2 seconds
    houses.forEach((house) => {
      const k = Math.min((time - house.bornAt) / 1.2, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      house.group.scale.setScalar(Math.max(ease, 0.001));
    });
  });

  return { topY: ISLAND_Y, setHouses, constrain, getSpawn, pickHouse };
}
