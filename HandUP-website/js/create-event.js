// js/create-event.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createEventForm");
  const clearBtn = document.getElementById("clearBtn");

  clearBtn?.addEventListener("click", () => form?.reset());

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = document.getElementById("title")?.value.trim() || "";
      const date = document.getElementById("date")?.value || "";
      const time = document.getElementById("time")?.value || "";
      const location = document.getElementById("location")?.value.trim() || "";
      const category = document.getElementById("category")?.value || "";
      const spots = Number(document.getElementById("spots")?.value || 0);
      const description = document.getElementById("description")?.value.trim() || "";
      const contactName = document.getElementById("contactName")?.value.trim() || "";
      const contactEmail = document.getElementById("contactEmail")?.value.trim() || "";

      if (!title || !date || !time || !location || !category) {
        alert("Please fill out Title, Date, Time, Location, and Category.");
        return;
      }

      try {
        await addDoc(collection(db, "events"), {
          title,
          date,
          time,
          location,
          category,
          spots: spots > 0 ? spots : 0,
          approvedCount: 0, // required for capacity logic
          description,
          contactName,
          contactEmail,

          organizerId: user.uid, // REQUIRED for strict rules + organizer approvals
          createdAt: serverTimestamp(),
        });

        alert("Event created ✅");
        window.location.href = "browse.html";
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to create event.");
      }
    });
  });
});