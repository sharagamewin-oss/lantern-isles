// main.js: starts everything and connects all the other files.

import { createScene } from "./scene.js";
import { createSky } from "./sky.js";
import {
  initUI,
  setCounter,
  setJoined,
  showToast,
  initWishPopup,
  openWishPopup,
  updateWishPopupSparks,
  setSparkStatus
} from "./ui.js";
import {
  loginAnonymously,
  hasWish,
  createWish,
  listenToWishes,
  hasSparked,
  sendSpark
} from "./db.js";

// 1. Build the 3D world
const canvas = document.getElementById("scene");
const world = createScene(canvas);
const sky = createSky(world.scene, world.camera, world.onFrame);
world.start();

// 2. Things we remember while the page is open
let currentUser = null;
let firstLoadDone = false;
const wishes = new Map(); // wish id -> latest wish data
let openWishId = null;    // which lantern's popup is open right now (or null)

// 3. Start the guest login right away and keep the "promise" so other code can wait for it
const loginPromise = loginAnonymously()
  .then((user) => {
    currentUser = user;
    return user;
  })
  .catch((error) => {
    console.error("Login failed:", error);
    showToast("Login problem: " + (error.code || error.message), 10000);
    return null;
  });

// 4. What happens when someone presses "Light my lantern"
async function handleJoin(data) {
  const user = currentUser || (await loginPromise);
  if (!user) {
    throw new Error("Could not log in. Please refresh the page and check Firebase login settings.");
  }

  try {
    await createWish(user, data);
  } catch (error) {
    console.error(error);
    if (error.code === "permission-denied") {
      throw new Error("Could not save. You may already have a lantern, or the Firestore rules are not published yet.");
    }
    throw new Error("Something went wrong: " + (error.code || "please try again."));
  }

  setJoined(true);
  showToast("Your lantern is floating into the sky! ✨");

  // Turn the camera to face the new lantern
  const look = sky.getLook(user.uid);
  if (look) world.lookTowards(look.yaw, look.pitch);
}

initUI({ onSubmit: handleJoin });

// 5. NEW: what happens when someone presses "Send spark"
async function handleSpark() {
  const id = openWishId;
  if (!id) return;

  const user = currentUser || (await loginPromise);
  if (!user) {
    showToast("Could not log in. Please refresh the page.");
    return;
  }

  setSparkStatus("sending");

  try {
    await sendSpark(id, user.uid);
    if (openWishId === id) setSparkStatus("sparked");
    showToast("Your spark is on its way! ✨");
  } catch (error) {
    console.error(error);

    // Find out if it failed because this person already sparked this lantern
    let already = false;
    try {
      already = await hasSparked(id, user.uid);
    } catch (e) {
      console.error(e);
    }

    if (openWishId === id) setSparkStatus(already ? "sparked" : "ready");
    showToast(
      already
        ? "You already sent a spark to this lantern."
        : "Could not send the spark. Check that the new Firestore rules are published."
    );
  }
}

initWishPopup({
  onSpark: handleSpark,
  onClose: () => {
    openWishId = null;
  }
});

// 6. NEW: what happens when someone taps the sky
world.onTap(async (x, y) => {
  const id = sky.pickLantern(x, y); // which lantern is under the tap?
  if (!id) return;

  const wish = wishes.get(id);
  if (!wish) return;

  // Show the popup right away (button says "Checking...")
  openWishId = id;
  openWishPopup(wish);

  // Then find out what the button should say
  const user = currentUser || (await loginPromise);
  if (openWishId !== id) return; // popup was closed or changed meanwhile

  if (!user) {
    setSparkStatus("ready");
    return;
  }

  if (user.uid === id) {
    setSparkStatus("own"); // you cannot spark your own lantern
    return;
  }

  try {
    const done = await hasSparked(id, user.uid);
    if (openWishId !== id) return;
    setSparkStatus(done ? "sparked" : "ready");
  } catch (error) {
    console.error(error);
    if (openWishId === id) setSparkStatus("ready");
  }
});

// 7. Listen to wishes live (works even before login)
listenToWishes(
  ({ added, modified, total }) => {
    // New lanterns
    added.forEach((wish, index) => {
      wishes.set(wish.id, wish);
      // On first load, lanterns appear one after another
      const delay = firstLoadDone ? 0 : index * 0.08;
      sky.addLantern(wish, delay);
    });

    // Lanterns that changed (for example, they got a spark)
    modified.forEach((wish) => {
      const before = wishes.get(wish.id);
      wishes.set(wish.id, wish);
      sky.updateLantern(wish);

      // If the spark count went up, play the spark effect (on every device)
      if (before && (wish.sparks || 0) > (before.sparks || 0)) {
        sky.burst(wish.id);
      }

      // If this lantern's popup is open, update its number
      if (wish.id === openWishId) {
        updateWishPopupSparks(wish.sparks || 0);
      }
    });

    sky.setPopulation(total);
    setCounter(total);
    firstLoadDone = true;
  },
  () => {
    showToast("Could not load the lanterns. Check your internet or rules.");
  }
);

// 8. After login, check if this guest already has a lantern
loginPromise.then(async (user) => {
  if (!user) return;
  try {
    const joined = await hasWish(user.uid);
    setJoined(joined);
  } catch (error) {
    console.error("Could not check for an existing wish:", error);
  }
});
