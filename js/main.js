// main.js: starts everything and connects all the other files.

import { createScene } from "./scene.js";
import { createSky } from "./sky.js";
import { createIsland } from "./islands.js";
import { createGallery, prepareArtImage } from "./gallery.js";
import { createWalk } from "./walk.js";
import {
  initUI,
  setCounter,
  setJoined,
  showToast,
  initWishPopup,
  openWishPopup,
  updateWishPopupSparks,
  setSparkStatus,
  initWalkButton,
  setWalkMode,
  initRoomPopup,
  openRoomPopup,
  setRoomContent,
  setRoomLoadFailed,
  initGalleryButtons,
  setArtButton,
  initArtForm,
  openArtForm,
  initArtPopup,
  openArtPopup,
  updateArtPopup,
  setFlowerStatus
} from "./ui.js";
import {
  loginAnonymously,
  hasWish,
  createWish,
  listenToWishes,
  hasSparked,
  sendSpark,
  getRoom,
  saveRoom,
  listenToArt,
  saveArt,
  hasFlowered,
  sendFlower
} from "./db.js";

// 1. Build the 3D world
const canvas = document.getElementById("scene");
const world = createScene(canvas);
const sky = createSky(world.scene, world.camera, world.onFrame);

// The island, Gallery Street, and the walking controls
const island = createIsland(world.scene, world.onFrame);
const gallery = createGallery(world.scene, world.onFrame); // NEW in Phase 5
const walk = createWalk({
  camera: world.camera,
  world: world,
  places: { island: island, gallery: gallery }, // CHANGED: walk.js now knows both places
  onModeChange: setWalkMode // the buttons change when the mode changes
});
setWalkMode("sky", "island");
initWalkButton({ onToggle: () => walk.toggle() });

world.start();

// 2. Things we remember while the page is open
let currentUser = null;
let firstLoadDone = false;
const wishes = new Map();   // wish id -> latest wish data
const artworks = new Map(); // NEW: art id -> latest art data
let openWishId = null;      // which lantern's popup is open right now (or null)
let openRoomId = null;      // which room's popup is open right now (or null)
let openArtId = null;       // NEW: which picture's popup is open right now (or null)

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
  showToast("Your lantern is floating into the sky and your house is being built! ✨");

  // Turn the camera to face the new lantern (only in sky view)
  if (walk.getMode() === "sky") {
    const look = sky.getLook(user.uid);
    if (look) world.lookTowards(look.yaw, look.pitch);
  }
}

initUI({ onSubmit: handleJoin });

// 5. What happens when someone presses "Send spark"
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
        : "Could not send the spark. Check that the Firestore rules are published."
    );
  }
}

initWishPopup({
  onSpark: handleSpark,
  onClose: () => {
    openWishId = null;
  }
});

// 6. What happens when someone presses "Save" in their room
async function handleRoomSave({ skills, projects }) {
  const user = currentUser || (await loginPromise);
  if (!user) {
    throw new Error("Could not log in. Please refresh the page.");
  }

  // You can only edit your own room
  const wish = wishes.get(user.uid);
  if (!wish || openRoomId !== user.uid) {
    throw new Error("You can only edit your own room.");
  }

  try {
    await saveRoom(user, wish, { skills, projects });
  } catch (error) {
    console.error(error);
    if (error.code === "permission-denied") {
      throw new Error("Could not save. Check that the new Firestore rules are published.");
    }
    throw new Error("Something went wrong: " + (error.code || "please try again."));
  }

  showToast("Your room is saved! 🏠");
}

initRoomPopup({
  onSave: handleRoomSave,
  onClose: () => {
    openRoomId = null;
  }
});

// 7. Show a lantern's wish popup
async function showLantern(id) {
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
}

// 8. Show a house's room popup
async function showRoom(id) {
  const wish = wishes.get(id);
  if (!wish) return;

  const user = currentUser || (await loginPromise);

  // Show the popup right away (it says "Loading...")
  openRoomId = id;
  openRoomPopup({
    name: wish.name,
    college: wish.college,
    isOwner: !!user && user.uid === id
  });

  // Then load the real room from the database
  try {
    const room = await getRoom(id);
    if (openRoomId !== id) return; // popup was closed or changed meanwhile
    setRoomContent(room);
  } catch (error) {
    console.error(error);
    if (openRoomId === id) setRoomLoadFailed();
  }
}

// 9. NEW in Phase 5: the Gallery button and the "Add my art" button

// "Add my art" was pressed: only people with a lantern can share art
async function handleAddArtClick() {
  const user = currentUser || (await loginPromise);
  if (!user) {
    showToast("Could not log in. Please refresh the page.");
    return;
  }

  try {
    const joined = await hasWish(user.uid);
    if (!joined) {
      showToast("Light your lantern first. Then you can share your art. 🎨");
      return;
    }
  } catch (error) {
    console.error(error);
    showToast("Could not check your lantern. Please try again.");
    return;
  }

  openArtForm({ hasArt: artworks.has(user.uid) });
}

// "Hang my art" was pressed in the art form
async function handleArtSubmit({ title, file }) {
  const user = currentUser || (await loginPromise);
  if (!user) {
    throw new Error("Could not log in. Please refresh the page.");
  }

  // Shrink the picture first (this throws a friendly Error if the file is not OK)
  const imageUrl = await prepareArtImage(file);

  try {
    await saveArt(user, { title, imageUrl });
  } catch (error) {
    console.error(error);
    if (error.code === "permission-denied") {
      throw new Error("Could not save. Check that the new Firestore rules are published, and that you have lit a lantern.");
    }
    throw new Error("Something went wrong: " + (error.code || "please try again."));
  }

  showToast("Your art is on Gallery Street! 🎨");
}

initArtForm({ onSubmit: handleArtSubmit });

initGalleryButtons({
  onGallery: () => walk.toggleGallery(),
  onAddArt: handleAddArtClick
});

// 10. NEW in Phase 5: show a picture's popup
async function showArt(id) {
  const art = artworks.get(id);
  if (!art) return;

  const user = currentUser || (await loginPromise);

  // The artist's name and college come from their wish
  const wish = wishes.get(art.uid || id);

  // Show the popup right away (the flower button says "Checking...")
  openArtId = id;
  openArtPopup({
    art: art,
    artist: wish ? wish.name : "A guest",
    college: wish ? wish.college : ""
  });

  // Then find out what the flower button should say
  if (!user) {
    setFlowerStatus("ready");
    return;
  }

  if (user.uid === id) {
    setFlowerStatus("own"); // you cannot leave a flower on your own art
    return;
  }

  try {
    const done = await hasFlowered(id, user.uid);
    if (openArtId !== id) return; // popup was closed or changed meanwhile
    setFlowerStatus(done ? "flowered" : "ready");
  } catch (error) {
    console.error(error);
    if (openArtId === id) setFlowerStatus("ready");
  }
}

// What happens when someone presses "Leave a flower"
async function handleFlower() {
  const id = openArtId;
  if (!id) return;

  const user = currentUser || (await loginPromise);
  if (!user) {
    showToast("Could not log in. Please refresh the page.");
    return;
  }

  setFlowerStatus("sending");

  try {
    await sendFlower(id, user.uid);
    if (openArtId === id) setFlowerStatus("flowered");
    showToast("Your flower is on its way! 🌸");
  } catch (error) {
    console.error(error);

    // Find out if it failed because this person already left a flower here
    let already = false;
    try {
      already = await hasFlowered(id, user.uid);
    } catch (e) {
      console.error(e);
    }

    if (openArtId === id) setFlowerStatus(already ? "flowered" : "ready");
    showToast(
      already
        ? "You already left a flower on this art."
        : "Could not leave the flower. Check that the Firestore rules are published."
    );
  }
}

initArtPopup({
  onFlower: handleFlower,
  onClose: () => {
    openArtId = null;
  }
});

// 11. What happens when someone taps the screen (works in the sky AND while walking)
world.onTap((x, y) => {
  // Lanterns first
  const lanternId = sky.pickLantern(x, y);
  if (lanternId) {
    showLantern(lanternId);
    return;
  }

  // Then pictures on Gallery Street
  const artId = gallery.pickFrame(x, y, world.camera);
  if (artId) {
    showArt(artId);
    return;
  }

  // Then houses
  const houseId = island.pickHouse(x, y, world.camera);
  if (houseId) {
    showRoom(houseId);
  }
});

// 12. Listen to wishes live (works even before login)
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

    // Give every wish a house on the island
    island.setHouses(Array.from(wishes.values()));

    sky.setPopulation(total);
    setCounter(total);
    firstLoadDone = true;
  },
  () => {
    showToast("Could not load the lanterns. Check your internet or rules.");
  }
);

// 13. NEW in Phase 5: listen to the art live
listenToArt(
  ({ list }) => {
    // Remember the newest list
    artworks.clear();
    list.forEach((art) => artworks.set(art.id, art));

    // Give every picture a frame on Gallery Street
    // (gallery.js plays the flower petals by itself when a flower count goes up)
    gallery.setArt(list);

    // If this picture's popup is open, refresh it (new flower, new picture...)
    if (openArtId && artworks.has(openArtId)) {
      updateArtPopup(artworks.get(openArtId));
    }

    // The art button says "Change my art" if I already have art
    if (currentUser) setArtButton(artworks.has(currentUser.uid));
  },
  () => {
    showToast("Could not load the art. Check that the new Firestore rules are published.");
  }
);

// 14. After login, check if this guest already has a lantern (and already has art)
loginPromise.then(async (user) => {
  if (!user) return;
  setArtButton(artworks.has(user.uid));
  try {
    const joined = await hasWish(user.uid);
    setJoined(joined);
  } catch (error) {
    console.error("Could not check for an existing wish:", error);
  }
});
