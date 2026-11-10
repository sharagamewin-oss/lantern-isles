// ui.js: buttons, the join form, the wish popup, the counter and the message bubble.

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

// ---------- NEW in Phase 2: the wish popup ----------

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
