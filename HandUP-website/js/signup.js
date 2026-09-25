// js/signup.js
import { signupWithEmail, redirectToDashboard } from "./auth.js";

window.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#signupForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.querySelector("#firstName")?.value.trim();
    const lastName = document.querySelector("#lastName")?.value.trim();
    const email = document.querySelector("#email")?.value.trim();
    const password = document.querySelector("#password")?.value;
    const confirmPassword = document.querySelector("#confirmPassword")?.value;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      alert("Please fill out all fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      await signupWithEmail({
        email,
        password,
        firstName,
        lastName,
        role: "volunteer",
      });

      await redirectToDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
});
