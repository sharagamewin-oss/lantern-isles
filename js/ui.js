// ui.js: buttons, the join form, the counter and the message bubble.

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

// Set up the form and the buttons.
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
