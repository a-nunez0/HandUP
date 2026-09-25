import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export default function MyEventDetails() {
  const { id } = useLocalSearchParams();

  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  function getEventDateTime(eventData) {
    if (!eventData?.date) return null;

    const eventTime =
      eventData.time && String(eventData.time).trim() !== ""
        ? String(eventData.time).trim()
        : "23:59";

    const eventDateTime = new Date(`${eventData.date}T${eventTime}`);

    if (isNaN(eventDateTime.getTime())) return null;

    return eventDateTime;
  }

  function hasEventPassed(eventData) {
    const eventDateTime = getEventDateTime(eventData);
    if (!eventDateTime) return false;
    return eventDateTime < new Date();
  }

  const eventPassed = hasEventPassed(event);

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    try {
      setLoading(true);

      const eventSnap = await getDoc(doc(db, "events", String(id)));

      if (eventSnap.exists()) {
        setEvent({ id: eventSnap.id, ...eventSnap.data() });
      } else {
        setEvent(null);
      }

      const q = query(
        collection(db, "joinRequests"),
        where("eventId", "==", String(id))
      );

      const snap = await getDocs(q);

      const requestsWithNames = await Promise.all(
        snap.docs.map(async (d) => {
          const requestData = { id: d.id, ...d.data() };

          let volunteerName = requestData.volunteerName || "Volunteer";

          if (requestData.volunteerId) {
            const userSnap = await getDoc(
              doc(db, "users", requestData.volunteerId)
            );

            if (userSnap.exists()) {
              const userData = userSnap.data();
              volunteerName =
                `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
                requestData.volunteerName ||
                "Volunteer";
            }
          }

          return {
            ...requestData,
            volunteerName,
          };
        })
      );

      setRequests(requestsWithNames);
    } catch (error) {
      console.error("Error loading event details:", error);
      Alert.alert("Error", "Could not load event details.");
    } finally {
      setLoading(false);
    }
  }

  async function approve(r) {
    if (eventPassed) {
      Alert.alert("Event Ended", "This event already happened.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "joinRequests", r.id);
        const eventRef = doc(db, "events", r.eventId);

        const requestSnap = await transaction.get(requestRef);
        const eventSnap = await transaction.get(eventRef);

        if (!requestSnap.exists()) {
          throw new Error("Request not found");
        }

        if (!eventSnap.exists()) {
          throw new Error("Event not found");
        }

        const requestData = requestSnap.data();
        const eventData = eventSnap.data();

        const liveEventDateTime = getEventDateTime(eventData);
        if (liveEventDateTime && liveEventDateTime < new Date()) {
          throw new Error("This event already happened");
        }

        if (requestData.status === "approved") {
          throw new Error("Request already approved");
        }

        const currentSpots = Number(eventData.spots || 0);

        if (currentSpots <= 0) {
          throw new Error("Event full");
        }

        transaction.update(requestRef, { status: "approved" });
        transaction.update(eventRef, { spots: currentSpots - 1 });
      });

      await loadPage();
    } catch (error) {
      console.error("Approve error:", error);
      Alert.alert("Error", error.message || "Could not approve request.");
    }
  }

  async function decline(r) {
    if (eventPassed) {
      Alert.alert("Event Ended", "This event already happened.");
      return;
    }

    try {
      await updateDoc(doc(db, "joinRequests", r.id), {
        status: "rejected",
      });

      await loadPage();
    } catch (error) {
      console.error("Decline error:", error);
      Alert.alert("Error", "Could not decline request.");
    }
  }

  async function deleteEvent() {
    Alert.alert("Delete Event?", "This cannot be undone.", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", event.id));
            router.back();
          } catch (error) {
            console.error("Delete error:", error);
            Alert.alert("Error", "Could not delete event.");
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
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
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <TouchableOpacity style={styles.trash} onPress={deleteEvent}>
          <Text style={styles.trashText}>🗑</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>📍 {event.location}</Text>
        <Text style={styles.meta}>📅 {event.date}</Text>
        <Text style={styles.meta}>⏰ {event.time}</Text>
        <Text style={styles.spots}>Spots left: {event.spots}</Text>

        {eventPassed ? (
          <View style={styles.endedBadge}>
            <Text style={styles.endedBadgeText}>This event already happened</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.section}>Requests</Text>

      {requests.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>No one has requested yet.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.volunteerName}</Text>
              <Text style={styles.statusText}>Status: {item.status}</Text>

              {eventPassed ? (
                <Text style={styles.eventEndedText}>
                  This event already happened.
                </Text>
              ) : item.status === "pending" ? (
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.approve}
                    onPress={() => approve(item)}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.decline}
                    onPress={() => decline(item)}
                  >
                    <Text style={styles.btnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F6F4F1" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  back: { marginBottom: 10, color: "#0F766E", fontWeight: "600" },

  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  meta: { color: "#6B7280", marginTop: 2 },
  spots: { color: "#059669", fontWeight: "700", marginTop: 6 },

  section: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111827",
  },

  name: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 4,
    color: "#111827",
  },

  statusText: {
    color: "#374151",
  },

  eventEndedText: {
    marginTop: 10,
    color: "#B45309",
    fontWeight: "600",
  },

  row: { flexDirection: "row", marginTop: 10 },

  approve: {
    backgroundColor: "#16A34A",
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },

  decline: {
    backgroundColor: "#DC2626",
    padding: 10,
    borderRadius: 8,
  },

  btnText: { color: "white", fontWeight: "700" },

  empty: { textAlign: "center", color: "#6B7280" },

  trash: {
    position: "absolute",
    right: 12,
    top: 12,
  },

  trashText: { fontSize: 18 },

  endedBadge: {
    marginTop: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  endedBadgeText: {
    color: "#92400E",
    fontWeight: "700",
  },
});