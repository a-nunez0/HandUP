// js/volunteer-dashboard.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normStatus(s) {
  return (s || "pending").toLowerCase();
}

function pillClass(status) {
  const s = normStatus(status);
  if (s === "pending") return "pill pending";
  if (s === "approved") return "pill approved";
  if (s === "completed") return "pill completed";
  if (s === "rejected") return "pill rejected";
  return "pill";
}

function matchesSearch(r, text) {
  if (!text) return true;
  const t = text.toLowerCase();
  const hay = [
    r.eventTitle || "",
    r.eventLocation || "",
    r.eventDate || "",
    r.eventCategory || "",
  ].join(" ").toLowerCase();
  return hay.includes(t);
}

function renderRow(r) {
  const status = normStatus(r.status);
  const title = escapeHtml(r.eventTitle || "Event");
  const meta = escapeHtml(
    `${r.eventDate || ""}${r.eventLocation ? " • " + r.eventLocation : ""}`.trim()
  );

  const canCancel = status === "pending";

  return `
    <li class="event-card">
      <div class="event-top">
        <div>
          <p class="event-title">${title}</p>
          <p class="event-meta">${meta || "—"}</p>
        </div>

        <span class="${pillClass(status)}">${escapeHtml(status)}</span>
      </div>

      <div class="event-actions">
        <a class="btn btn-secondary" href="event-details.html?id=${escapeHtml(r.eventId || "")}">
          Details
        </a>

        ${
          canCancel
            ? `<button class="btn btn-secondary btn-cancel" data-id="${escapeHtml(r.id)}" type="button">
                 Cancel
               </button>`
            : `<button class="btn btn-secondary" type="button" disabled>
                 ${escapeHtml(status === "approved" ? "Approved" : "Locked")}
               </button>`
        }
      </div>
    </li>
  `;
}

window.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("eventsList");
  const empty = document.getElementById("emptyState");
  const resultsCount = document.getElementById("resultsCount");

  const statPending = document.getElementById("statPending");
  const statApproved = document.getElementById("statApproved");
  const statCompleted = document.getElementById("statCompleted");

  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const sortBy = document.getElementById("sortBy");
  const resetBtn = document.getElementById("resetFiltersBtn");

  let raw = [];
  let unsub = null;

  const applyAndRender = () => {
    if (!list) return;

    const searchText = searchInput?.value?.trim() || "";
    const statusVal = statusFilter?.value || "all";
    const sortVal = sortBy?.value || "dateAsc";

    // Stats
    const pendingCount = raw.filter((r) => normStatus(r.status) === "pending").length;
    const approvedCount = raw.filter((r) => normStatus(r.status) === "approved").length;
    const completedCount = raw.filter((r) => normStatus(r.status) === "completed").length;

    if (statPending) statPending.textContent = String(pendingCount);
    if (statApproved) statApproved.textContent = String(approvedCount);
    if (statCompleted) statCompleted.textContent = String(completedCount);

    let items = [...raw];

    if (statusVal !== "all") {
      items = items.filter((r) => normStatus(r.status) === statusVal);
    }

    items = items.filter((r) => matchesSearch(r, searchText));

    // Sort
    const byDate = (a, b) => String(a.eventDate || "").localeCompare(String(b.eventDate || ""));
    const byName = (a, b) => String(a.eventTitle || "").localeCompare(String(b.eventTitle || ""));

    if (sortVal === "dateAsc") items.sort(byDate);
    if (sortVal === "dateDesc") items.sort((a, b) => byDate(b, a));
    if (sortVal === "nameAsc") items.sort(byName);
    if (sortVal === "nameDesc") items.sort((a, b) => byName(b, a));

    list.innerHTML = items.map(renderRow).join("");

    if (resultsCount) resultsCount.textContent = `${items.length} results`;

    if (items.length === 0) {
      if (empty) empty.style.display = "block";
    } else {
      if (empty) empty.style.display = "none";
    }

    // Cancel pending
    list.querySelectorAll(".btn-cancel").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;

        btn.disabled = true;
        btn.textContent = "Canceling…";

        try {
          await deleteDoc(doc(db, "joinRequests", id));
          // onSnapshot will re-render automatically
        } catch (e) {
          console.error(e);
          btn.disabled = false;
          btn.textContent = "Cancel";
          alert(e?.message || "Cancel failed.");
        }
      });
    });
  };

  searchInput?.addEventListener("input", applyAndRender);
  statusFilter?.addEventListener("change", applyAndRender);
  sortBy?.addEventListener("change", applyAndRender);
  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "all";
    if (sortBy) sortBy.value = "dateAsc";
    applyAndRender();
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (unsub) unsub();

    const q = query(collection(db, "joinRequests"), where("volunteerId", "==", user.uid));

    unsub = onSnapshot(
      q,
      (snap) => {
        raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyAndRender();
      },
      (err) => {
        console.error(err);
        alert(err?.message || "Failed loading dashboard.");
      }
    );
  });
});