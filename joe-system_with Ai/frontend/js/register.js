// register.js
import { redirectIfAuthenticated, signUp } from "./auth.js";

redirectIfAuthenticated();

const form = document.getElementById("register-form");
const submitBtn = document.getElementById("register-submit");
const messageEl = document.getElementById("auth-message");

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = `auth-message is-visible auth-message--${kind}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const confirm = document.getElementById("register-password-confirm").value;

  if (password !== confirm) {
    showMessage("Passwords don't match.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  try {
    const result = await signUp(email, password);
    if (result.access_token) {
      // Email confirmation is disabled in the Supabase project -> already signed in.
      window.location.href = "index.html";
      return;
    }
    // Default Supabase behavior: confirmation email sent, no session yet.
    showMessage(
      "Account created! Check your email to confirm it, then log in.",
      "success"
    );
    form.reset();
    submitBtn.textContent = "Create account";
    submitBtn.disabled = false;
  } catch (err) {
    showMessage(err.message, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
});
