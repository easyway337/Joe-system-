// login.js
import { redirectIfAuthenticated, signIn } from "./auth.js";

redirectIfAuthenticated();

const form = document.getElementById("login-form");
const submitBtn = document.getElementById("login-submit");
const messageEl = document.getElementById("auth-message");

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = `auth-message is-visible auth-message--${kind}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    await signIn(email, password);
    window.location.href = "index.html";
  } catch (err) {
    showMessage(err.message, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
