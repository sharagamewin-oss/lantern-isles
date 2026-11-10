// main.js: starts everything and connects all the other files.

import { createScene } from "./scene.js";
import { createSky } from "./sky.js";
import { initUI, setCounter, setJoined, showToast } from "./ui.js";
import { loginAnonymously, hasWish, createWish, listenToWishes } from "./db.js";

// 1. Build the 3D world
const canvas = document.getElementById("scene");
const world = createScene(canvas);
const sky = createSky(world.scene, world.camera, world.onFrame);
world.start();

// 2. Remember who the visitor is
let currentUser = null;
let firstLoadDone = false;

// 3. What happens when someone presses "Light my lantern"
async function handleJoin(data) {
  if (!currentUser) {
    throw new Error("Still connecting. Please wait a moment and try again.");
  }

  try {
    await createWish(currentUser, data);
  } catch (error) {
    console.error(error);
    if (error.code === "permission-denied") {
      throw new Error("Could not save. You may already have a lantern, or the Firestore rules are not published yet.");
    }
    throw new Error("Something went wrong. Please try again.");
  }

  setJoined(true);
  showToast("Your lantern is floating into the sky! ✨");

  // Turn the camera to face the new lantern
  const look = sky.getLook(currentUser.uid);
  if (look) world.lookTowards(look.yaw, look.pitch);
}

initUI({ onSubmit: handleJoin });

// 4. Listen to wishes live (works even before login)
listenToWishes(
  ({ added, total }) => {
    added.forEach((wish, index) => {
      // On first load, lanterns appear one after another
      const delay = firstLoadDone ? 0 : index * 0.08;
      sky.addLantern(wish, delay);
    });
    sky.setPopulation(total);
    setCounter(total);
    firstLoadDone = true;
  },
  () => {
    showToast("Could not load the lanterns. Check your internet or rules.");
  }
);

// 5. Log in as a guest, then check if this guest already has a lantern
async function startLogin() {
  try {
    currentUser = await loginAnonymously();
    const joined = await hasWish(currentUser.uid);
    setJoined(joined);
  } catch (error) {
    console.error(error);
    showToast("Could not log in. Please refresh the page.");
  }
}

startLogin();
