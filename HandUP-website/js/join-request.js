// js/join-request.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function normalizeStatus(s) {
  return (s || "pending").toLowerCase();
}

function prettyStatus(s) {
  const st = normalizeStatus(s);
  if (st === "pending") return "Pending";
  if (st === "approved") return "Approved";
  if (st === "rejected") return "Rejected";
  if (st === "completed") return "Completed";
  return st;
}

async function loadEvent(eventId) {
  const ref = doc(db, "events", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function getExistingRequest(eventId, volunteerId) {
  const q = query(
    collection(db, "joinRequests"),
    where("eventId", "==", eventId),
    where("volunteerId", "==", volunteerId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// Strict-safe capacity check: uses event.approvedCount only.
// If approvedCount missing, don't block join (but you’ll fix old events in Option 1).
async function isEventFull(event) {
  const spots = Number(event?.spots || 0);
  if (!spots || spots <= 0) return false;

  const approvedCount = Number(event?.approvedCount);
  if (Number.isFinite(approvedCount)) return approvedCount >= spots;

  // Old events might be missing approvedCount; don't block.
  return false;
}

export async function requestToJoinEvent(eventId) {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "login.html";
    return { ok: false, reason: "not_logged_in" };
  }

  const event = await loadEvent(eventId);
  if (!event) return { ok: false, reason: "event_missing" };

  // OPTION 1: strict rules require organizerId to exist
  if (!event.organizerId) {
    return { ok: false, reason: "event_missing_organizer" };
  }

  if (event.organizerId === user.uid) {
    return { ok: false, reason: "is_organizer" };
  }

  const existing = await getExistingRequest(eventId, user.uid);
  if (existing) {
    return { ok: false, reason: "already_requested", status: prettyStatus(existing.status) };
  }

  if (await isEventFull(event)) {
    return { ok: false, reason: "full" };
  }

  await addDoc(collection(db, "joinRequests"), {
    eventId: event.id,
    organizerId: event.organizerId,
    volunteerId: user.uid,
    status: "pending",
    createdAt: serverTimestamp(),

    // Optional denormalized fields for dashboards/UI
    eventTitle: event.title || "",
    eventDate: event.date || "",
    eventTime: event.time || "",
    eventLocation: event.location || "",
    eventCategory: event.category || "",
  });

  return { ok: true };
}

export async function cancelJoinRequest(eventId) {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: "not_logged_in" };

  const existing = await getExistingRequest(eventId, user.uid);
  if (!existing) return { ok: false, reason: "no_request" };

  const st = normalizeStatus(existing.status);
  if (st !== "pending") return { ok: false, reason: "not_pending" };

  await deleteDoc(doc(db, "joinRequests", existing.id));
  return { ok: true };
}

// Auto-wire Event Details buttons if present
window.addEventListener("DOMContentLoaded", () => {
  const joinTop = document.getElementById("joinBtnTop");
  const joinQuick = document.getElementById("joinBtnQuick");
  const cancelTop = document.getElementById("cancelBtnTop");
  const cancelQuick = document.getElementById("cancelBtnQuick");
  const joinMsg = document.getElementById("joinMsg");
  const chip = document.getElementById("qaStatusChip");

  if (!joinTop && !joinQuick && !cancelTop && !cancelQuick) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("id");
  if (!eventId) return;

  const setUI = ({ joinDisabled, joinText, cancelVisible, cancelDisabled, msg, statusText }) => {
    const setBtn = (btn, disabled, text) => {
      if (!btn) return;
      btn.disabled = !!disabled;
      if (text) btn.textContent = text;
    };

    setBtn(joinTop, joinDisabled, joinText);
    setBtn(joinQuick, joinDisabled, joinText);

    if (cancelTop) {
      cancelTop.style.display = cancelVisible ? "" : "none";
      cancelTop.disabled = !!cancelDisabled;
    }
    if (cancelQuick) {
      cancelQuick.style.display = cancelVisible ? "" : "none";
      cancelQuick.disabled = !!cancelDisabled;
    }

    if (joinMsg && msg !== undefined) joinMsg.textContent = msg;
    if (chip && statusText) chip.textContent = `Status: ${statusText}`;
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const event = await loadEvent(eventId);
    if (!event) return;

    if (!event.organizerId) {
      setUI({
        joinDisabled: true,
        joinText: "Unavailable",
        cancelVisible: false,
        msg: "This event is missing organizer data. Ask the organizer to re-save the event.",
        statusText: "Unavailable",
      });
      return;
    }

    if (event.organizerId === user.uid) {
      setUI({
        joinDisabled: true,
        joinText: "You’re the organizer",
        cancelVisible: false,
        msg: "You can’t request to join your own event.",
        statusText: "Organizer",
      });
      return;
    }

    const existing = await getExistingRequest(eventId, user.uid);
    if (existing) {
      const ps = prettyStatus(existing.status);
      const st = normalizeStatus(existing.status);

      setUI({
        joinDisabled: true,
        joinText: `Request: ${ps}`,
        cancelVisible: st === "pending",
        cancelDisabled: false,
        msg: "Your request is saved.",
        statusText: ps,
      });

      if (st === "pending") {
        const cancelHandler = async () => {
          cancelTop && (cancelTop.disabled = true);
          cancelQuick && (cancelQuick.disabled = true);
          const res = await cancelJoinRequest(eventId);
          if (res.ok) {
            setUI({
              joinDisabled: false,
              joinText: "Request to join",
              cancelVisible: false,
              cancelDisabled: false,
              msg: "Request canceled.",
              statusText: "Not requested",
            });
          }
        };
        cancelTop?.addEventListener("click", cancelHandler, { once: true });
        cancelQuick?.addEventListener("click", cancelHandler, { once: true });
      }
      return;
    }

    const full = await isEventFull(event);
    if (full) {
      setUI({
        joinDisabled: true,
        joinText: "Full",
        cancelVisible: false,
        msg: "No spots left for this event.",
        statusText: "Full",
      });
      return;
    }

    setUI({
      joinDisabled: false,
      joinText: "Request to join",
      cancelVisible: false,
      msg: "",
      statusText: "Not requested",
    });

    const joinHandler = async () => {
      setUI({
        joinDisabled: true,
        joinText: "Sending…",
        cancelVisible: false,
        msg: "",
        statusText: "Pending",
      });

      try {
        const res = await requestToJoinEvent(eventId);

        if (res.ok) {
          setUI({
            joinDisabled: true,
            joinText: "Request: Pending",
            cancelVisible: true,
            cancelDisabled: false,
            msg: "Your request is pending organizer approval.",
            statusText: "Pending",
          });

          const cancelHandler = async () => {
            const c = await cancelJoinRequest(eventId);
            if (c.ok) {
              setUI({
                joinDisabled: false,
                joinText: "Request to join",
                cancelVisible: false,
                msg: "Request canceled.",
                statusText: "Not requested",
              });
            }
          };

          cancelTop?.addEventListener("click", cancelHandler, { once: true });
          cancelQuick?.addEventListener("click", cancelHandler, { once: true });
          return;
        }

        if (res.reason === "event_missing_organizer") {
          setUI({
            joinDisabled: true,
            joinText: "Unavailable",
            cancelVisible: false,
            msg: "This event is missing organizer data. Fix it in Firestore (add organizerId).",
            statusText: "Unavailable",
          });
          return;
        }

        if (res.reason === "full") {
          setUI({
            joinDisabled: true,
            joinText: "Full",
            cancelVisible: false,
            msg: "No spots left for this event.",
            statusText: "Full",
          });
          return;
        }

        setUI({
          joinDisabled: false,
          joinText: "Request to join",
          cancelVisible: false,
          msg: "Could not send request.",
          statusText: "Not requested",
        });
      } catch (err) {
        console.error(err);
        setUI({
          joinDisabled: false,
          joinText: "Request to join",
          cancelVisible: false,
          msg: err?.message || "Could not send request.",
          statusText: "Not requested",
        });
      }
    };

    joinTop?.addEventListener("click", joinHandler, { once: true });
    joinQuick?.addEventListener("click", joinHandler, { once: true });
  });
});