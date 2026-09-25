// js/login.js
import { loginWithEmail, redirectToDashboard, redirectIfLoggedIn } from "./auth.js";

window.addEventListener("DOMContentLoaded", () => {
  // If already logged in, don't stay on login page
  redirectIfLoggedIn();

  const form = document.querySelector("#loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("#email")?.value.trim();
    const password = document.querySelector("#password")?.value;

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      await loginWithEmail({ email, password });
      await redirectToDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
});
