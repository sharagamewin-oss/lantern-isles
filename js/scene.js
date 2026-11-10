// scene.js: the Three.js "stage": scene, camera, renderer, and the animation loop.

import * as THREE from "three";

// Paints a dark blue gradient to use as the sky background
function makeSkyGradient() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#02030a");   // top: almost black
  g.addColorStop(0.6, "#0b1533");
  g.addColorStop(1, "#1b2a5c");   // bottom: lighter blue
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createScene(canvas) {
  // The scene is the "world" that holds everything
  const scene = new THREE.Scene();
  scene.background = makeSkyGradient();

  // The camera is our eye. It starts at height 4 and looks forward.
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
  camera.position.set(0, 4, 0);
  camera.rotation.order = "YXZ"; // turn left/right first, then up/down

  // The renderer draws the scene onto the canvas
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Make the canvas match the window size
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Look around by dragging ----------
  let yaw = 0;          // current left/right turn
  let pitch = 0;        // current up/down tilt
  let targetYaw = 0;    // where we want to turn to
  let targetPitch = 0;

  // NEW: freeLook = false -> sky view (limited turning, smooth movement)
  //      freeLook = true  -> walking (turn all the way round, instant response)
  let freeLook = false;

  // NEW: we remember WHICH finger/mouse is dragging the view.
  // This stops the joystick finger from also turning the camera.
  let activePointer = null;
  let lastX = 0;
  let lastY = 0;

  // Used to tell a TAP apart from a DRAG
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  const tapCallbacks = [];

  function clampLook() {
    if (freeLook) {
      targetPitch = Math.max(-1.2, Math.min(1.2, targetPitch));
    } else {
      targetYaw = Math.max(-1.3, Math.min(1.3, targetYaw));
      targetPitch = Math.max(-0.4, Math.min(0.7, targetPitch));
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (activePointer !== null) return; // already tracking one finger
    activePointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  });

  window.addEventListener("pointerup", (e) => {
    if (e.pointerId !== activePointer) return;

    // A tap = finger/mouse barely moved AND it was quick
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const quick = performance.now() - downTime < 600;
    if (moved < 8 && quick) {
      tapCallbacks.forEach((fn) => fn(e.clientX, e.clientY));
    }
    activePointer = null;
  });

  window.addEventListener("pointercancel", (e) => {
    if (e.pointerId === activePointer) activePointer = null;
  });

  window.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointer) return;

    // Sky view: dragging "grabs" the sky.
    // Walking: dragging turns your head like a game (drag right = look right).
    const direction = freeLook ? -1 : 1;
    targetYaw += direction * (e.clientX - lastX) * 0.004;
    targetPitch += direction * (e.clientY - lastY) * 0.004;
    lastX = e.clientX;
    lastY = e.clientY;
    clampLook();
  });

  // Other files can ask to be told when the sky is tapped
  function onTap(fn) {
    tapCallbacks.push(fn);
  }

  // Smoothly turn the camera toward a direction
  function lookTowards(newYaw, newPitch) {
    targetYaw = newYaw;
    targetPitch = newPitch;
    clampLook();
  }

  // NEW: switch between sky view and walking view
  function setFreeLook(on) {
    freeLook = on;
    if (on) {
      // keep looking exactly where we are looking now (no sudden jump)
      targetYaw = yaw;
      targetPitch = pitch;
    } else {
      // wrap the turn into -180..180 degrees so we don't spin back wildly
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      targetYaw = yaw;
      targetPitch = pitch;
      clampLook();
    }
  }

  // NEW: tell other files where the camera is looking right now
  function getView() {
    return { yaw: yaw, pitch: pitch };
  }

  // ---------- Animation loop ----------
  const frameCallbacks = [];
  function onFrame(fn) {
    frameCallbacks.push(fn);
  }

  const clock = new THREE.Clock();

  function loop() {
    requestAnimationFrame(loop);
    // If the tab was asleep, delta could be huge. Cap it so nothing jumps.
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    if (freeLook) {
      // Walking: respond instantly, no sway
      yaw = targetYaw;
      pitch = targetPitch;
      camera.rotation.y = yaw;
    } else {
      // Sky view: move a little toward the target (smooth) and sway gently
      yaw += (targetYaw - yaw) * 0.06;
      pitch += (targetPitch - pitch) * 0.06;
      camera.rotation.y = yaw + Math.sin(time * 0.15) * 0.03;
    }
    camera.rotation.x = pitch;

    // Let other files (sky.js, islands.js, walk.js) animate their things
    frameCallbacks.forEach((fn) => fn(time, delta));

    renderer.render(scene, camera);
  }

  function start() {
    loop();
  }

  return { scene, camera, renderer, onFrame, onTap, lookTowards, setFreeLook, getView, start };
}
