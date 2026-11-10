// gallery.js: Gallery Street (a floating street with picture frames) and the picture shrinker.
//
// The street floats to the RIGHT of the island and runs away from you (into the screen).
// Each person can have ONE picture. Pictures hang on both sides of the street.

import * as THREE from "three";

// ---------- Settings (you can change these numbers later) ----------
const STREET_X = 58;          // how far to the right of the island the street floats
const STREET_Y = -6;          // height of the street floor (same as the island)
const START_Z = -34;          // where the street starts (the entrance)
const STREET_WIDTH = 10;      // the floating platform is this wide
const WALK_HALF_WIDTH = 2.2;  // you can walk this far left/right of the middle
const FRAME_OFFSET = 3.6;     // how far from the middle the frames hang
const FIRST_ROW = 7;          // distance from the entrance to the first pair of frames
const ROW_SPACING = 6;        // distance between pairs of frames
const MAX_ART = 24;           // the street shows 24 pictures (12 on each side)
const MAX_ROWS = MAX_ART / 2;
const MIN_LENGTH = 30;        // the street is at least this long, even when empty
const FRAME_Y = 2.1;          // height of the middle of each picture
const PICTURE_MAX_W = 3.0;    // biggest picture size inside a frame
const PICTURE_MAX_H = 2.4;
const FRAME_MARGIN = 0.3;     // gold border around the picture

// Picture shrinking settings (used by prepareArtImage)
const MAX_SIDE = 480;           // longest side of a stored picture, in pixels
const MAX_DATA_LENGTH = 110000; // the finished text must be shorter than this (the rules allow 120000)
const MAX_FILE_MB = 10;         // the file the person picks can be up to this big

// The time an art piece was created, as a number (a brand-new one may not have it yet)
function createdMillis(art) {
  const t = art.createdAt;
  return t && t.toMillis ? t.toMillis() : Infinity;
}

// ---------- Shrinking a picture so it fits inside the database ----------

// Opens the chosen file as an <img>
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open that picture. Please try a JPG or PNG."));
    };
    img.src = url;
  });
}

// Takes a picture file and returns a small JPEG as text ("data:image/jpeg;base64,...").
// Throws an Error with a friendly message if something is wrong.
export async function prepareArtImage(file) {
  if (!file) throw new Error("Please choose a picture.");
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("That file is not a picture.");
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error("That picture is too big. Please choose one under " + MAX_FILE_MB + " MB.");
  }

  const img = await loadImageFile(file);

  // Work out the smaller size (keep the same shape)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  // Draw it small on a hidden canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // a white background (JPEG has no see-through parts)
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Save it as a JPEG. If it is still too big, try a lower quality.
  const qualities = [0.8, 0.65, 0.5, 0.35];
  for (const quality of qualities) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_LENGTH) return dataUrl;
  }
  throw new Error("This picture is too detailed. Please try a simpler one.");
}

// ---------- The street ----------

export function createGallery(scene, onFrame) {
  // "street" holds the floor, the arch, the lamps and the frames
  const street = new THREE.Group();
  street.position.set(STREET_X, STREET_Y, 0);
  scene.add(street);

  // ----- The floating floor. These are built 1 unit long, then stretched to the real length. -----
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(STREET_WIDTH, 0.8, 1),
    new THREE.MeshStandardMaterial({ color: 0x3b3a63 })
  );
  deck.position.y = -0.4;

  const path = new THREE.Mesh(
    new THREE.BoxGeometry(WALK_HALF_WIDTH * 2 + 0.6, 0.05, 1),
    new THREE.MeshStandardMaterial({ color: 0xd8c8a0 }) // the light walking path
  );
  path.position.y = 0.025;

  const rock = new THREE.Mesh(
    new THREE.BoxGeometry(STREET_WIDTH - 3, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0x4a4560, flatShading: true })
  );
  rock.position.y = -2.8;

  street.add(deck, path, rock);

  // ----- The entrance arch with a sign (the sign faces the sky camera) -----
  const archMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f });
  const pillarGeometry = new THREE.BoxGeometry(0.5, 4.4, 0.5);
  const archZ = START_Z - 0.3;

  const pillarLeft = new THREE.Mesh(pillarGeometry, archMaterial);
  pillarLeft.position.set(-3.1, 2.2, archZ);
  const pillarRight = new THREE.Mesh(pillarGeometry, archMaterial);
  pillarRight.position.set(3.1, 2.2, archZ);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(6.7, 1.5, 0.4), archMaterial);
  beam.position.set(0, 4.6, archZ);

  // The sign text is drawn on a small hidden canvas
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const signCtx = signCanvas.getContext("2d");
  signCtx.fillStyle = "#1b1440";
  signCtx.fillRect(0, 0, 512, 128);
  signCtx.strokeStyle = "#ffd27a";
  signCtx.lineWidth = 6;
  signCtx.strokeRect(6, 6, 500, 116);
  signCtx.fillStyle = "#ffd27a";
  signCtx.font = "bold 54px system-ui, sans-serif";
  signCtx.textAlign = "center";
  signCtx.textBaseline = "middle";
  signCtx.fillText("GALLERY STREET", 256, 68);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.4),
    new THREE.MeshBasicMaterial({ map: signTexture })
  );
  sign.position.set(0, 4.6, archZ + 0.21);

  street.add(pillarLeft, pillarRight, beam, sign);

  // ----- Lamp posts (glowing balls, no real light, so it stays fast) -----
  const lampPostGeometry = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6);
  const lampBulbGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const lampPostMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2540 });
  const lampBulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const lamps = [];

  for (let r = 0; r <= MAX_ROWS; r++) {
    const z = START_Z - FIRST_ROW - r * ROW_SPACING + 3; // between two rows of frames
    [-4.4, 4.4].forEach((x) => {
      const lamp = new THREE.Group();
      const post = new THREE.Mesh(lampPostGeometry, lampPostMaterial);
      post.position.y = 1.2;
      const bulb = new THREE.Mesh(lampBulbGeometry, lampBulbMaterial);
      bulb.position.y = 2.5;
      lamp.add(post, bulb);
      lamp.position.set(x, 0, z);
      street.add(lamp);
      lamps.push({ group: lamp, distance: START_Z - z }); // distance from the entrance
    });
  }

  // ----- Frame parts (built once, shared by all frames) -----
  const borderGeometry = new THREE.BoxGeometry(1, 1, 0.15); // stretched to fit each picture
  const pictureGeometry = new THREE.PlaneGeometry(1, 1);
  const postGeometry = new THREE.BoxGeometry(0.18, FRAME_Y, 0.18);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2540 });
  const textureLoader = new THREE.TextureLoader();

  // ----- State -----
  const frames = new Map(); // art id -> frame info
  let length = MIN_LENGTH;       // current street length
  let targetLength = MIN_LENGTH; // length the street is growing toward
  let now = 0;                   // current time in seconds

  // Stretch the floor to the current length
  function applyLength() {
    [deck, path, rock].forEach((part) => {
      part.scale.z = length;
      part.position.z = START_Z - length / 2;
    });
    lamps.forEach((lamp) => {
      lamp.group.visible = lamp.distance <= length - 1;
    });
  }
  applyLength();

  // Fit the picture and its gold border to the real shape of the image
  function fitPicture(frame, imageWidth, imageHeight) {
    const ratio = imageWidth / imageHeight;
    let w = PICTURE_MAX_W;
    let h = w / ratio;
    if (h > PICTURE_MAX_H) {
      h = PICTURE_MAX_H;
      w = h * ratio;
    }
    frame.picture.scale.set(w, h, 1);
    frame.border.scale.set(w + FRAME_MARGIN, h + FRAME_MARGIN, 1);
  }

  // Load the picture (it is a text "data:image/jpeg;base64,...") onto the frame
  function loadPicture(frame, url) {
    frame.imageUrl = url;
    textureLoader.load(
      url,
      (texture) => {
        // If the picture was replaced while loading, throw this one away
        if (frame.imageUrl !== url) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        if (frame.pictureMaterial.map) frame.pictureMaterial.map.dispose();
        frame.pictureMaterial.map = texture;
        frame.pictureMaterial.color.set(0xffffff);
        frame.pictureMaterial.needsUpdate = true;
        fitPicture(frame, texture.image.width, texture.image.height);
      },
      undefined,
      () => console.error("Could not show a picture on Gallery Street.")
    );
  }

  // Builds one frame (its front faces +z; we turn it later to face the street)
  function createFrame(art) {
    const group = new THREE.Group();

    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a24b,
      emissive: 0xffa63d,
      emissiveIntensity: 0.2
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.y = FRAME_Y;
    border.scale.set(PICTURE_MAX_W + FRAME_MARGIN, PICTURE_MAX_H + FRAME_MARGIN, 1);

    // MeshBasicMaterial = not affected by lights, so pictures glow nicely at night
    const pictureMaterial = new THREE.MeshBasicMaterial({ color: 0x222233 });
    const picture = new THREE.Mesh(pictureGeometry, pictureMaterial);
    picture.position.set(0, FRAME_Y, 0.09);
    picture.scale.set(PICTURE_MAX_W, PICTURE_MAX_H, 1);

    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(0, FRAME_Y / 2 - 0.5, -0.12);

    group.add(post, border, picture);
    group.scale.setScalar(0.001); // starts tiny, then pops up

    const frame = {
      group: group,
      border: border,
      borderMaterial: borderMaterial,
      picture: picture,
      pictureMaterial: pictureMaterial,
      imageUrl: "",
      side: 0,
      bornAt: now,
      art: art
    };
    loadPicture(frame, art.imageUrl);
    return frame;
  }

  // Number i gets a spot: even numbers on the left, odd numbers on the right
  function slotPosition(i) {
    const side = i % 2;
    const row = Math.floor(i / 2);
    return {
      side: side,
      x: side === 0 ? -FRAME_OFFSET : FRAME_OFFSET,
      z: START_Z - FIRST_ROW - row * ROW_SPACING,
      rotation: side === 0 ? Math.PI / 2 : -Math.PI / 2 // face the middle of the street
    };
  }

  // ----- Flower petals (the little burst when someone leaves a flower) -----
  const petalGeometry = new THREE.SphereGeometry(0.08, 6, 6);
  const petals = [];
  const tempVector = new THREE.Vector3();

  function bloom(frame) {
    frame.group.getWorldPosition(tempVector);
    const direction = frame.side === 0 ? 1 : -1; // petals fly toward the middle of the street

    for (let i = 0; i < 14; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff9ec7 : 0xffd1e3,
        transparent: true
      });
      const mesh = new THREE.Mesh(petalGeometry, material);
      mesh.position.set(
        tempVector.x + direction * 0.3,
        tempVector.y + FRAME_Y + (Math.random() - 0.5) * 1.2,
        tempVector.z + (Math.random() - 0.5) * 2
      );
      scene.add(mesh);
      petals.push({
        mesh: mesh,
        vx: direction * (0.5 + Math.random() * 1.2),
        vy: 1 + Math.random() * 1.5,
        vz: (Math.random() - 0.5) * 1.5,
        age: 0,
        life: 1.6 + Math.random() * 0.6
      });
    }
  }

  // Called by main.js with ALL the art. It makes sure every picture has a frame.
  function setArt(artList) {
    // Oldest first; the ID breaks ties so every device gives the same order
    const sorted = artList.slice().sort((a, b) => {
      const ta = createdMillis(a);
      const tb = createdMillis(b);
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    }).slice(0, MAX_ART);

    const keep = new Set();

    sorted.forEach((art, i) => {
      keep.add(art.id);
      const slot = slotPosition(i);

      let frame = frames.get(art.id);
      if (!frame) {
        frame = createFrame(art);
        frames.set(art.id, frame);
        street.add(frame.group);
      } else {
        // Someone left a flower: play the petals and make the border glow more
        if ((art.flowers || 0) > (frame.art.flowers || 0)) bloom(frame);
        // The owner changed the picture
        if (art.imageUrl !== frame.imageUrl) loadPicture(frame, art.imageUrl);
      }

      frame.art = art;
      frame.side = slot.side;
      frame.group.position.set(slot.x, 0, slot.z);
      frame.group.rotation.y = slot.rotation;
      frame.borderMaterial.emissiveIntensity = Math.min(0.2 + (art.flowers || 0) * 0.12, 1.2);
    });

    // Remove frames whose art is gone
    frames.forEach((frame, id) => {
      if (!keep.has(id)) {
        street.remove(frame.group);
        if (frame.pictureMaterial.map) frame.pictureMaterial.map.dispose();
        frame.pictureMaterial.dispose();
        frame.borderMaterial.dispose();
        frames.delete(id);
      }
    });

    // More pictures = longer street
    const rows = Math.ceil(sorted.length / 2);
    targetLength = Math.max(MIN_LENGTH, FIRST_ROW + rows * ROW_SPACING + 8);
  }

  // Keeps a walking person on the walking path (not off the street).
  // Takes a wanted position (x, z) and returns the allowed position.
  function constrain(x, z) {
    const minX = STREET_X - WALK_HALF_WIDTH;
    const maxX = STREET_X + WALK_HALF_WIDTH;
    const minZ = START_Z - length + 1.5; // far end of the street
    const maxZ = START_Z - 1;            // do not walk back out through the entrance
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      z: Math.max(minZ, Math.min(maxZ, z))
    };
  }

  // Where you land when you fly here: just inside the entrance
  function getSpawn() {
    return { x: STREET_X, y: STREET_Y, z: START_Z - 2 };
  }

  // Which frame is under this tap? (returns the art id, or null)
  function pickFrame(clientX, clientY, camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let bestId = null;
    let bestDistance = 60; // a tap must be within 60 pixels of a frame

    frames.forEach((frame, id) => {
      frame.group.getWorldPosition(tempVector);
      tempVector.y += FRAME_Y;
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

  // Runs every frame
  onFrame((time, delta) => {
    now = time;

    // The street grows smoothly toward its target length
    length += (targetLength - length) * Math.min(1, delta * 2);
    applyLength();

    // New frames grow from tiny to full size in 1 second
    frames.forEach((frame) => {
      const k = Math.min((time - frame.bornAt) / 1.0, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      frame.group.scale.setScalar(Math.max(ease, 0.001));
    });

    // Move the flower petals and fade them out
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.age += delta;
      if (p.age >= p.life) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        petals.splice(i, 1);
        continue;
      }
      p.vy -= 1.6 * delta; // gravity
      p.mesh.position.x += p.vx * delta;
      p.mesh.position.y += p.vy * delta;
      p.mesh.position.z += p.vz * delta;
      p.mesh.material.opacity = 1 - p.age / p.life;
    }
  });

  return { topY: STREET_Y, setArt, constrain, getSpawn, pickFrame };
}
