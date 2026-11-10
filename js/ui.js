// ui.js: buttons, the join form, the wish popup, the room popup, the art form and popup,
// the walk and gallery buttons, the counter and the message bubble.

const $ = (id) => document.getElementById(id);

let toastTimer = null;

// Show a small message for a few seconds
export function showToast(message, ms = 3500) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), ms);
}

// Update the "Lanterns lit" number
export function setCounter(n) {
  $("counter").textContent = n;
}

// After a person has joined, change the button
export function setJoined(joined) {
  const btn = $("join-btn");
  if (joined) {
    btn.textContent = "✨ Your lantern is lit";
    btn.disabled = true;
  }
}

// Set up the join form and its buttons.
// onSubmit is a function (from main.js) that saves the wish.
export function initUI({ onSubmit }) {
  const modal = $("join-modal");
  const form = $("join-form");
  const nameInput = $("name-input");
  const collegeInput = $("college-input");
  const wishInput = $("wish-input");
  const wishCount = $("wish-count");
  const errorBox = $("form-error");
  const submitBtn = $("submit-btn");

  function openForm() {
    errorBox.textContent = "";
    modal.hidden = false;
    nameInput.focus();
  }

  function closeForm() {
    modal.hidden = true;
  }

  $("join-btn").addEventListener("click", openForm);
  $("cancel-btn").addEventListener("click", closeForm);

  // Clicking the dark area outside the card also closes the form
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeForm();
  });

  // Show how many letters are typed in the wish box
  wishInput.addEventListener("input", () => {
    wishCount.textContent = wishInput.value.length;
  });

  // When the form is submitted
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop the page from reloading

    const name = nameInput.value.trim();
    const college = collegeInput.value.trim();
    const wishText = wishInput.value.trim();

    // Check the text before sending
    if (!name || !college || !wishText) {
      errorBox.textContent = "Please fill in all the boxes.";
      return;
    }
    if (name.length > 40 || college.length > 60 || wishText.length > 150) {
      errorBox.textContent = "One of your answers is too long.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Lighting...";
    errorBox.textContent = "";

    try {
      await onSubmit({ name, college, wishText });
      closeForm();
      form.reset();
      wishCount.textContent = "0";
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Light my lantern";
    }
  });
}

// ---------- Phase 2: the wish popup ----------

// Set up the popup's buttons.
// onSpark runs when "Send spark" is pressed. onClose runs when the popup closes.
export function initWishPopup({ onSpark, onClose }) {
  const modal = $("wish-modal");

  function close() {
    modal.hidden = true;
    onClose();
  }

  $("wish-close-btn").addEventListener("click", close);

  // Clicking the dark area outside the card also closes it
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  $("spark-btn").addEventListener("click", onSpark);
}

// Fill the popup with a wish and show it.
// We use textContent (not innerHTML) so nobody can sneak code into a wish.
export function openWishPopup(wish) {
  $("wish-name").textContent = wish.name;
  $("wish-college").textContent = wish.college;
  $("wish-text").textContent = "“" + wish.wishText + "”";
  updateWishPopupSparks(wish.sparks || 0);
  setSparkStatus("checking");
  $("wish-modal").hidden = false;
}

// Change the "✨ 3 sparks" line
export function updateWishPopupSparks(n) {
  $("wish-sparks").textContent = "✨ " + n + (n === 1 ? " spark" : " sparks");
}

// Change the spark button depending on the situation
export function setSparkStatus(status) {
  const btn = $("spark-btn");

  const states = {
    checking: { text: "Checking...", disabled: true },
    ready: { text: "✨ Send spark", disabled: false },
    sending: { text: "Sending...", disabled: true },
    sparked: { text: "✅ Spark sent", disabled: true },
    own: { text: "💛 This is your lantern", disabled: true }
  };

  const state = states[status] || states.ready;
  btn.textContent = state.text;
  btn.disabled = state.disabled;
}

// ---------- Phase 3: the walk button ----------

// Connect the Walk button. onToggle runs when it is pressed.
export function initWalkButton({ onToggle }) {
  $("walk-btn").addEventListener("click", onToggle);
}

// CHANGED in Phase 5: the buttons and the hint change with the mode AND the place.
// mode is "sky", "in" (flying down), "walking" or "out" (flying up).
// place is "island" or "gallery".
export function setWalkMode(mode, place) {
  const walkBtn = $("walk-btn");
  const galleryBtn = $("gallery-btn");
  const hint = $("hint");
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  if (mode === "sky") {
    walkBtn.textContent = "🚶 Walk";
    walkBtn.disabled = false;
    galleryBtn.textContent = "🖼️ Gallery";
    galleryBtn.disabled = false;
    hint.textContent = "Drag to look around. Tap a lantern to read its wish, or a house to see its room.";
  } else if (mode === "walking") {
    walkBtn.textContent = "🌌 Sky";
    walkBtn.disabled = false;
    galleryBtn.disabled = false;

    if (place === "gallery") {
      galleryBtn.textContent = "🏝️ Island";
      hint.textContent = isTouch
        ? "Use the joystick to walk down the street. Tap a picture to see it and leave a flower."
        : "W A S D to walk down the street. Tap a picture to see it and leave a flower.";
    } else {
      galleryBtn.textContent = "🖼️ Gallery";
      hint.textContent = isTouch
        ? "Use the joystick to walk. Drag the screen to look. Tap a house to see its room."
        : "W A S D to walk. Drag the mouse to look. Tap a house to see its room.";
    }
  } else {
    // flying: the buttons are switched off until we arrive
    walkBtn.textContent = "✈️ ...";
    walkBtn.disabled = true;
    galleryBtn.disabled = true;
  }
}

// ---------- Phase 4: the room popup ----------

// What the popup is showing right now (used to fill the edit form)
let roomIsOwner = false;
let roomData = { skills: "", projects: "" };

// Show the view mode (skills and projects as text)
function showRoomView() {
  $("room-view").hidden = false;
  $("room-buttons").hidden = false;
  $("room-form").hidden = true;
}

// Put the skills and projects text into the view
function fillRoomView() {
  $("room-skills").textContent = roomData.skills || "Not added yet";
  $("room-projects").textContent = roomData.projects || "Not added yet";
}

// Set up the room popup.
// onSave({ skills, projects }) saves the room (from main.js). onClose runs when the popup closes.
export function initRoomPopup({ onSave, onClose }) {
  const modal = $("room-modal");
  const form = $("room-form");
  const skillsInput = $("room-skills-input");
  const projectsInput = $("room-projects-input");
  const errorBox = $("room-error");
  const saveBtn = $("room-save-btn");

  function close() {
    modal.hidden = true;
    showRoomView(); // so it opens in view mode next time
    onClose();
  }

  $("room-close-btn").addEventListener("click", close);

  // Clicking the dark area outside the card also closes it
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  // "Edit my room": switch to the form, filled with the current text
  $("room-edit-btn").addEventListener("click", () => {
    skillsInput.value = roomData.skills;
    projectsInput.value = roomData.projects;
    errorBox.textContent = "";
    $("room-view").hidden = true;
    $("room-buttons").hidden = true;
    form.hidden = false;
    skillsInput.focus();
  });

  $("room-cancel-btn").addEventListener("click", showRoomView);

  // When "Save" is pressed
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const skills = skillsInput.value.trim();
    const projects = projectsInput.value.trim();

    if (skills.length > 100 || projects.length > 300) {
      errorBox.textContent = "One of your answers is too long.";
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    errorBox.textContent = "";

    try {
      await onSave({ skills, projects });
      roomData = { skills, projects };
      fillRoomView();
      showRoomView();
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });
}

// Open the popup right away while the room is still loading.
// textContent (not innerHTML) keeps the page safe from sneaky code.
export function openRoomPopup({ name, college, isOwner }) {
  roomIsOwner = isOwner;
  roomData = { skills: "", projects: "" };

  $("room-title").textContent = "🏠 " + name + (isOwner ? " (you)" : "");
  $("room-college").textContent = college;
  $("room-skills").textContent = "Loading...";
  $("room-projects").textContent = "Loading...";
  $("room-edit-btn").hidden = true; // shown after loading, owner only

  showRoomView();
  $("room-modal").hidden = false;
}

// When the room has loaded (room can be null = no room data yet)
export function setRoomContent(room) {
  roomData = {
    skills: (room && room.skills) || "",
    projects: (room && room.projects) || ""
  };
  fillRoomView();
  $("room-edit-btn").hidden = !roomIsOwner; // only the owner can edit
}

// When the room could not be loaded
export function setRoomLoadFailed() {
  $("room-skills").textContent = "Could not load this room.";
  $("room-projects").textContent = "";
}

// ---------- NEW in Phase 5: the art button, the art form and the art popup ----------

// Connect the two new buttons on the right side of the screen.
// onGallery: fly to Gallery Street (or back to the island). onAddArt: open the art form.
export function initGalleryButtons({ onGallery, onAddArt }) {
  $("gallery-btn").addEventListener("click", onGallery);
  $("art-btn").addEventListener("click", onAddArt);
}

// The art button says "Add" or "Change" depending on whether you already have art
export function setArtButton(hasArt) {
  $("art-btn").textContent = hasArt ? "🎨 Change my art" : "🎨 Add my art";
}

// Set up the art form (title + picture).
// onSubmit({ title, file }) runs in main.js. It throws an Error with a friendly message if it fails.
export function initArtForm({ onSubmit }) {
  const modal = $("art-modal");
  const form = $("art-form");
  const titleInput = $("art-title-input");
  const fileInput = $("art-file-input");
  const preview = $("art-preview");
  const errorBox = $("art-error");
  const submitBtn = $("art-submit-btn");
  let previewUrl = null; // the temporary address of the preview picture

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    preview.hidden = true;
    preview.removeAttribute("src");
  }

  function closeForm() {
    modal.hidden = true;
    clearPreview();
  }

  $("art-cancel-btn").addEventListener("click", closeForm);

  // Clicking the dark area outside the card also closes the form
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeForm();
  });

  // Show a small preview as soon as a picture is chosen
  fileInput.addEventListener("change", () => {
    clearPreview();
    const file = fileInput.files[0];
    if (file && file.type && file.type.startsWith("image/")) {
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.hidden = false;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const file = fileInput.files[0];

    if (!title) {
      errorBox.textContent = "Please give your art a title.";
      return;
    }
    if (title.length > 60) {
      errorBox.textContent = "The title is too long.";
      return;
    }
    if (!file) {
      errorBox.textContent = "Please choose a picture.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";
    errorBox.textContent = "";

    try {
      await onSubmit({ title, file });
      closeForm();
      form.reset();
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Hang my art";
    }
  });
}

// Open the art form. hasArt = true means this person is replacing their old picture.
export function openArtForm({ hasArt }) {
  $("art-form-title").textContent = hasArt ? "Change your art" : "Share your art";
  $("art-error").textContent = "";
  $("art-modal").hidden = false;
  $("art-title-input").focus();
}

// Set up the popup that shows one picture.
// onFlower runs when "Leave a flower" is pressed. onClose runs when the popup closes.
export function initArtPopup({ onFlower, onClose }) {
  const modal = $("art-view-modal");

  function close() {
    modal.hidden = true;
    onClose();
  }

  $("art-view-close-btn").addEventListener("click", close);

  // Clicking the dark area outside the card also closes it
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  $("flower-btn").addEventListener("click", onFlower);
}

// Fill the popup with a picture and show it.
// artist and college come from the person's wish. textContent keeps the page safe.
export function openArtPopup({ art, artist, college }) {
  $("art-view-artist").textContent = artist + (college ? " · " + college : "");
  updateArtPopup(art);
  setFlowerStatus("checking");
  $("art-view-modal").hidden = false;
}

// Refresh the picture, the title and the flower count (used when the art changes live)
export function updateArtPopup(art) {
  const img = $("art-view-img");
  // Only show real picture text (the database rules also check this)
  if (typeof art.imageUrl === "string" && art.imageUrl.startsWith("data:image/")) {
    img.src = art.imageUrl;
  }
  $("art-view-title").textContent = art.title;
  const n = art.flowers || 0;
  $("art-view-flowers").textContent = "🌸 " + n + (n === 1 ? " flower" : " flowers");
}

// Change the flower button depending on the situation
export function setFlowerStatus(status) {
  const btn = $("flower-btn");

  const states = {
    checking: { text: "Checking...", disabled: true },
    ready: { text: "🌸 Leave a flower", disabled: false },
    sending: { text: "Sending...", disabled: true },
    flowered: { text: "✅ Flower left", disabled: true },
    own: { text: "💛 This is your art", disabled: true }
  };

  const state = states[status] || states.ready;
  btn.textContent = state.text;
  btn.disabled = state.disabled;
}
