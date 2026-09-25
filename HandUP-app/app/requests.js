import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "joinRequests"),
        where("organizerId", "==", user.uid)
      );

      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setRequests(list);
    } catch (error) {
      console.log("REQUEST LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  async function approveRequest(request) {
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "joinRequests", request.id);
        const eventRef = doc(db, "events", request.eventId);

        const requestSnap = await transaction.get(requestRef);
        const eventSnap = await transaction.get(eventRef);

        if (!requestSnap.exists()) throw "Request not found";
        if (!eventSnap.exists()) throw "Event not found";

        const requestData = requestSnap.data();
        const eventData = eventSnap.data();

        if (requestData.status === "approved") return;

        const currentSpots = Number(eventData.spots || 0);

        if (currentSpots <= 0) {
          throw "Event is full.";
        }

        transaction.update(requestRef, {
          status: "approved",
        });

        transaction.update(eventRef, {
          spots: currentSpots - 1,
        });
      });

      Alert.alert("Approved", "Volunteer approved.");

      loadRequests();
    } catch (error) {
      console.log("APPROVE ERROR:", error);
      Alert.alert("Error", String(error));
    }
  }

  async function declineRequest(request) {
    try {
      const requestRef = doc(db, "joinRequests", request.id);

      await updateDoc(requestRef, {
        status: "rejected",
      });

      Alert.alert("Declined", "Request declined.");

      loadRequests();
    } catch (error) {
      console.log("DECLINE ERROR:", error);
      Alert.alert("Error", "Could not decline request.");
    }
  }

  function renderRequest({ item }) {
    return (
      <View style={styles.card}>
        <Text style={styles.eventTitle}>{item.eventTitle}</Text>
        <Text style={styles.volunteer}>Volunteer: {item.volunteerName}</Text>
        <Text style={styles.status}>Status: {item.status}</Text>

        {item.status === "pending" && (
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.approve}
              onPress={() => approveRequest(item)}
            >
              <Text style={styles.buttonText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.decline}
              onPress={() => declineRequest(item)}
            >
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Join Requests</Text>

      {requests.length === 0 ? (
        <Text style={styles.empty}>No requests yet.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F6F4F1",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F4F1",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  empty: {
    fontSize: 16,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  volunteer: {
    marginTop: 6,
    color: "#374151",
  },
  status: {
    marginTop: 6,
    fontWeight: "600",
  },
  buttons: {
    flexDirection: "row",
    marginTop: 12,
  },
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
  buttonText: {
    color: "white",
    fontWeight: "700",
  },
});