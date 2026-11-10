// walk.js: flying down to a place (island or gallery), walking around, and flying back up.
// Controls: WASD / arrow keys on desktop, the joystick on touch screens.
// Looking around by dragging is handled in scene.js.

import * as THREE from "three";

const EYE_HEIGHT = 1.7;      // how high your eyes are above the ground
const WALK_SPEED = 6;        // units per second
const TRAVEL_SECONDS = 1.8;  // how long the fly-down / fly-up takes
const STICK_RADIUS = 40;     // how far the joystick knob can move (pixels)

const MOVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];

// CHANGED in Phase 5: "places" holds every place you can walk in:
//   places.island and places.gallery. Each one has getSpawn(), constrain(x, z) and topY.
export function createWalk({ camera, world, places, onModeChange }) {
  // mode is one of: "sky", "in" (flying down), "walking", "out" (flying up)
  let mode = "sky";
  let place = "island"; // NEW: which place we are going to / standing in: "island" or "gallery"
  let t = 0; // progress of the flight, from 0 to 1

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const skyPosition = camera.position.clone(); // where the camera floats in sky view

  // ---------- Keyboard ----------
  const keys = {};

  // Is a popup open? Then the keyboard should not move us.
  function modalIsOpen() {
    return document.querySelector(".modal:not([hidden])") !== null;
  }

  window.addEventListener("keydown", (e) => {
    if (modalIsOpen()) return;
    const key = e.key.toLowerCase();
    if (MOVE_KEYS.includes(key)) {
      keys[key] = true;
      if (mode === "walking") e.preventDefault(); // stop arrow keys scrolling the page
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // ---------- Joystick (touch screens) ----------
  const joystickBox = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  const joy = { x: 0, y: 0 }; // -1 to 1 in each direction
  let joyPointer = null;

  function moveStick(e) {
    const rect = joystickBox.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;

    // The knob cannot leave the circle
    const distance = Math.hypot(dx, dy);
    if (distance > STICK_RADIUS) {
      dx = (dx / distance) * STICK_RADIUS;
      dy = (dy / distance) * STICK_RADIUS;
    }

    stick.style.transform = "translate(" + dx + "px, " + dy + "px)";
    joy.x = dx / STICK_RADIUS;
    joy.y = dy / STICK_RADIUS;
  }

  function releaseStick() {
    joyPointer = null;
    joy.x = 0;
    joy.y = 0;
    stick.style.transform = "translate(0px, 0px)";
  }

  joystickBox.addEventListener("pointerdown", (e) => {
    if (joyPointer !== null) return;
    joyPointer = e.pointerId;
    joystickBox.setPointerCapture(e.pointerId); // keep getting moves even if the finger slides out
    moveStick(e);
  });
  joystickBox.addEventListener("pointermove", (e) => {
    if (e.pointerId === joyPointer) moveStick(e);
  });
  joystickBox.addEventListener("pointerup", (e) => {
    if (e.pointerId === joyPointer) releaseStick();
  });
  joystickBox.addEventListener("pointercancel", (e) => {
    if (e.pointerId === joyPointer) releaseStick();
  });

  // Forget all pressed keys and the joystick
  function resetInput() {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    releaseStick();
  }
  window.addEventListener("blur", resetInput);

  // ---------- Changing mode ----------
  function setMode(newMode) {
    mode = newMode;
    joystickBox.hidden = !(isTouchDevice && mode === "walking");
    if (mode !== "walking") resetInput();
    onModeChange(mode, place); // CHANGED: the place is sent too
  }

  // Fly down to a place ("island" or "gallery").
  // Works from the sky AND from another place (you fly straight there).
  function enter(placeName) {
    place = placeName;
    const spawn = places[place].getSpawn();
    from.copy(camera.position);
    to.set(spawn.x, spawn.y + EYE_HEIGHT, spawn.z);
    t = 0;
    world.lookTowards(0, 0); // turn to face forward
    setMode("in");
  }

  // Fly back up to the sky
  function leave() {
    from.copy(camera.position);
    to.copy(skyPosition);
    t = 0;
    world.setFreeLook(false);
    world.lookTowards(0, 0);
    setMode("out");
  }

  // The Walk / Sky button calls this
  function toggle() {
    if (mode === "sky") enter("island");
    else if (mode === "walking") leave();
  }

  // NEW: the Gallery / Island button calls this
  function toggleGallery() {
    if (mode === "sky") enter("gallery");
    else if (mode === "walking") enter(place === "gallery" ? "island" : "gallery");
  }

  // ---------- Runs every frame ----------
  world.onFrame((time, delta) => {
    // Flying down or up
    if (mode === "in" || mode === "out") {
      t = Math.min(t + delta / TRAVEL_SECONDS, 1);
      const ease = t * t * (3 - 2 * t); // slow start, slow end

      camera.position.lerpVectors(from, to, ease);
      camera.position.y += Math.sin(Math.PI * t) * 3; // a little arc upward in the middle

      if (t >= 1) {
        if (mode === "in") {
          world.setFreeLook(true);
          setMode("walking");
        } else {
          camera.position.copy(skyPosition);
          setMode("sky");
        }
      }
      return;
    }

    if (mode !== "walking") return;
    if (modalIsOpen()) return;

    // How much do we want to go forward and right? (from -1 to 1)
    let forward = 0;
    let right = 0;
    if (keys["w"] || keys["arrowup"]) forward += 1;
    if (keys["s"] || keys["arrowdown"]) forward -= 1;
    if (keys["d"] || keys["arrowright"]) right += 1;
    if (keys["a"] || keys["arrowleft"]) right -= 1;
    forward += -joy.y; // pushing the joystick up = forward
    right += joy.x;

    // Going diagonally should not be faster
    const length = Math.hypot(forward, right);
    if (length > 1) {
      forward /= length;
      right /= length;
    }

    // Turn "forward" and "right" into real directions using where we are looking
    const yaw = world.getView().yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const step = WALK_SPEED * delta;

    const wantedX = camera.position.x + (-sin * forward + cos * right) * step;
    const wantedZ = camera.position.z + (-cos * forward - sin * right) * step;

    // Keep us inside this place (on the island, or on the street)
    const current = places[place];
    const allowed = current.constrain(wantedX, wantedZ);
    camera.position.x = allowed.x;
    camera.position.z = allowed.z;
    camera.position.y = current.topY + EYE_HEIGHT;
  });

  return { toggle: toggle, toggleGallery: toggleGallery, getMode: () => mode, getPlace: () => place };
}
