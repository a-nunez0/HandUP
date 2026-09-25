// js/logout.js
import { logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector("#logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await logout();
    window.location.href = "login.html";
  });
});
