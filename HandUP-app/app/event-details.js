import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";

export default function EventDetails() {
  const { id } = useLocalSearchParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    try {
      setLoading(true);

      if (!id) {
        setEvent(null);
        return;
      }

      const eventRef = doc(db, "events", String(id));
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        setEvent(null);
        return;
      }

      const eventData = { id: eventSnap.id, ...eventSnap.data() };
      setEvent(eventData);

      await checkExistingRequest(eventData.id);
    } catch (error) {
      console.log("EVENT DETAILS ERROR:", error);
      Alert.alert("Error", "Could not load event details.");
    } finally {
      setLoading(false);
    }
  }

  async function checkExistingRequest(eventId) {
    try {
      const user = auth.currentUser;
      if (!user) {
        setRequestStatus(null);
        return;
      }

      const q = query(
        collection(db, "joinRequests"),
        where("eventId", "==", eventId),
        where("volunteerId", "==", user.uid)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const requestDoc = snap.docs[0].data();
        setRequestStatus(requestDoc.status || "pending");
      } else {
        setRequestStatus(null);
      }
    } catch (error) {
      console.log("CHECK REQUEST ERROR:", error);
    }
  }

  function isOwnEvent() {
    const user = auth.currentUser;
    return !!user && event?.organizerId === user.uid;
  }

  function isEventFull() {
    if (!event) return false;

    const spotsLeft = event.spotsAvailable ?? event.spots;

    if (spotsLeft === undefined || spotsLeft === null) return false;

    return Number(spotsLeft) <= 0;
  }

  function getButtonLabel() {
    if (isOwnEvent()) return "Your Event";
    if (isEventFull()) return "Event Full";
    if (requestStatus === "pending") return "Requested";
    if (requestStatus === "approved") return "Approved";
    if (requestStatus === "rejected") return "Declined";
    return "Join Event";
  }

  function isButtonDisabled() {
    return (
      joining ||
      isOwnEvent() ||
      isEventFull() ||
      requestStatus === "pending" ||
      requestStatus === "approved" ||
      requestStatus === "rejected"
    );
  }

  async function handleJoin() {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Login Required", "Please log in to join this event.");
        return;
      }

      if (!event) return;
      if (isOwnEvent()) return;
      if (isEventFull()) return;

      setJoining(true);

      const existingQuery = query(
        collection(db, "joinRequests"),
        where("eventId", "==", event.id),
        where("volunteerId", "==", user.uid)
      );

      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        const existingRequest = existingSnap.docs[0].data();
        setRequestStatus(existingRequest.status || "pending");
        Alert.alert("Already Requested", "You already have a request for this event.");
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      let firstName = "";
      let lastName = "";

      if (userSnap.exists()) {
        const userData = userSnap.data();
        firstName = userData.firstName || "";
        lastName = userData.lastName || "";
      }

      const fullName =
        `${firstName} ${lastName}`.trim() ||
        user.displayName ||
        user.email ||
        "Unknown User";

      await addDoc(collection(db, "joinRequests"), {
        eventId: event.id,
        eventTitle: event.title || "",
        eventCategory: event.category || event.eventCategory || "",
        eventDate: event.date || event.eventDate || "",
        eventTime: event.time || event.eventTime || "",
        eventLocation: event.location || event.eventLocation || "",
        organizerId: event.organizerId || "",
        volunteerId: user.uid,
        volunteerFirstName: firstName,
        volunteerLastName: lastName,
        volunteerName: fullName,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setRequestStatus("pending");
      Alert.alert("Success", "Your join request was sent.");
    } catch (error) {
      console.log("JOIN REQUEST ERROR:", error);
      Alert.alert("Error", "Could not send join request.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Event not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>{event.title}</Text>

          <Text style={styles.meta}>📍 {event.location || event.eventLocation}</Text>
          <Text style={styles.meta}>📅 {event.date || event.eventDate}</Text>
          <Text style={styles.meta}>⏰ {event.time || event.eventTime}</Text>

          {event.organizerName && (
            <Text style={styles.organizer}>By {event.organizerName}</Text>
          )}

          <Text style={styles.description}>
            {event.description || "No description provided."}
          </Text>

          <Text style={styles.spots}>
            Spots left: {event.spots ?? event.spotsAvailable ?? "Not listed"}
          </Text>

          <TouchableOpacity
            style={[
              styles.joinButton,
              isButtonDisabled() && styles.joinButtonDisabled,
            ]}
            onPress={handleJoin}
            disabled={isButtonDisabled()}
          >
            <Text style={styles.joinButtonText}>
              {joining ? "Sending..." : getButtonLabel()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F4F1",
  },

  container: {
    flex: 1,
    padding: 20,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  back: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F766E",
    marginBottom: 16,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  meta: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 6,
  },

  organizer: {
    fontSize: 15,
    color: "#374151",
    marginTop: 8,
    marginBottom: 14,
    fontWeight: "600",
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
    color: "#4B5563",
    marginBottom: 16,
  },

  spots: {
    fontSize: 14,
    color: "#059669",
    marginBottom: 18,
    fontWeight: "700",
  },

  joinButton: {
    backgroundColor: "#14B8A6",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  joinButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },

  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});