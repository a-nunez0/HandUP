import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { router } from "expo-router";
import { auth, db } from "../../firebase";

export default function Browse() {
  const [activeTab, setActiveTab] = useState("browse");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const isUpcomingEvent = (event) => {
    if (!event?.date) return false;

    const eventTime =
      event.time && event.time.trim() !== "" ? event.time : "23:59";

    const eventDateTime = new Date(`${event.date}T${eventTime}`);

    if (isNaN(eventDateTime.getTime())) return false;

    return eventDateTime >= new Date();
  };

  const hasEventPassed = (event) => {
    if (!event?.date) return false;

    const eventTime =
      event.time && event.time.trim() !== "" ? event.time : "23:59";

    const eventDateTime = new Date(`${event.date}T${eventTime}`);

    if (isNaN(eventDateTime.getTime())) return false;

    return eventDateTime < new Date();
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const upcomingEvents = list.filter(isUpcomingEvent);

      setEvents(upcomingEvents);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTab === "requests") {
      loadMyRequests();
    }
  }, [activeTab]);

  async function loadMyRequests() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setLoadingRequests(true);

      const q = query(
        collection(db, "joinRequests"),
        where("volunteerId", "==", user.uid)
      );

      const snap = await getDocs(q);

      const requestList = await Promise.all(
        snap.docs.map(async (requestDoc) => {
          const requestData = {
            id: requestDoc.id,
            ...requestDoc.data(),
          };

          try {
            const eventRef = doc(db, "events", requestData.eventId);
            const eventSnap = await getDoc(eventRef);

            if (eventSnap.exists()) {
              return {
                id: requestDoc.id,
                ...requestData,
                event: {
                  id: eventSnap.id,
                  ...eventSnap.data(),
                },
              };
            } else {
              return {
                id: requestDoc.id,
                ...requestData,
                event: null,
              };
            }
          } catch (error) {
            console.log("EVENT LOAD ERROR:", error);
            return {
              id: requestDoc.id,
              ...requestData,
              event: null,
            };
          }
        })
      );

      setMyRequests(requestList);
    } catch (error) {
      console.log("LOAD REQUESTS ERROR:", error);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function cancelRequest(requestItem) {
    try {
      await deleteDoc(doc(db, "joinRequests", requestItem.id));
      Alert.alert("Canceled", "Your request was canceled.");
      loadMyRequests();
    } catch (error) {
      console.log("CANCEL REQUEST ERROR:", error);
      Alert.alert("Error", "Could not cancel request.");
    }
  }

  function confirmCancel(requestItem) {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => cancelRequest(requestItem),
        },
      ]
    );
  }

  const pendingRequests = myRequests.filter(
    (item) => item.status === "pending" && !hasEventPassed(item.event)
  );

  const updatedRequests = myRequests.filter(
    (item) =>
      (item.status === "approved" || item.status === "rejected") &&
      !hasEventPassed(item.event)
  );

  const pastRequests = myRequests.filter((item) => hasEventPassed(item.event));

  function renderBrowseEvent({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({
            pathname: "/event-details",
            params: { id: item.id },
          })
        }
      >
        <Text style={styles.title}>{item.title || "Untitled Event"}</Text>

        <Text style={styles.meta}>
          📍 {item.location || "No location provided"}
        </Text>

        <Text style={styles.meta}>
          📅 {item.date || "No date provided"}
        </Text>

        {item.time ? <Text style={styles.meta}>⏰ {item.time}</Text> : null}

        {item.organizerName ? (
          <Text style={styles.organizer}>By {item.organizerName}</Text>
        ) : null}

        <Text style={styles.description} numberOfLines={2}>
          {item.description || "No description available."}
        </Text>

        <Text style={styles.spots}>
          Spots: {item.spots ?? item.spotsAvailable ?? "Not listed"}
        </Text>

        <View style={styles.mainButton}>
          <Text style={styles.mainButtonText}>View Details</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderRequestCard(item, isPending = false) {
    const event = item.event;
    const eventPassed = hasEventPassed(event);

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (event?.id) {
              router.push({
                pathname: "/event-details",
                params: { id: event.id },
              });
            }
          }}
        >
          <Text style={styles.title}>
            {event?.title || item.eventTitle || "Event no longer available"}
          </Text>

          <Text style={styles.meta}>
            📍 {event?.location || "No location provided"}
          </Text>

          <Text style={styles.meta}>
            📅 {event?.date || "No date provided"}
          </Text>

          {event?.time ? <Text style={styles.meta}>⏰ {event.time}</Text> : null}

          {event?.organizerName ? (
            <Text style={styles.organizer}>By {event.organizerName}</Text>
          ) : null}

          <Text style={styles.description} numberOfLines={2}>
            {event?.description || "This event may have been removed."}
          </Text>

          <Text
            style={[
              styles.status,
              item.status === "pending" && styles.statusPending,
              item.status === "approved" && styles.statusApproved,
              item.status === "rejected" && styles.statusRejected,
            ]}
          >
            Status: {item.status || "pending"}
          </Text>

          {eventPassed ? (
            <Text style={styles.pastText}>This event already happened</Text>
          ) : null}
        </TouchableOpacity>

        {isPending && !eventPassed ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => confirmCancel(item)}
            >
              <Text style={styles.actionButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mainButton}>
            <Text style={styles.mainButtonText}>
              {eventPassed ? "Past Event" : "Updated"}
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderRequestsContent() {
    if (loadingRequests) {
      return (
        <View style={styles.centerInside}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (myRequests.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.emptyCardText}>
            You have not requested any events yet.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <View>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingRequests.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyCardText}>
                  You have no pending requests.
                </Text>
              </View>
            ) : (
              pendingRequests.map((item) => (
                <View key={item.id}>{renderRequestCard(item, true)}</View>
              ))
            )}

            <Text style={styles.sectionTitle}>Request Updates</Text>
            {updatedRequests.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyCardText}>
                  No approved or rejected requests yet.
                </Text>
              </View>
            ) : (
              updatedRequests.map((item) => (
                <View key={item.id}>{renderRequestCard(item, false)}</View>
              ))
            )}

            <Text style={styles.sectionTitle}>Past Requests</Text>
            {pastRequests.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyCardText}>No past requests.</Text>
              </View>
            ) : (
              pastRequests.map((item) => (
                <View key={item.id}>{renderRequestCard(item, false)}</View>
              ))
            )}
          </View>
        )}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.header}>Find ways to help</Text>
        <Text style={styles.subheader}>
          Discover volunteer opportunities near you
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === "browse" && styles.toggleActive,
            ]}
            onPress={() => setActiveTab("browse")}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "browse" && styles.toggleTextActive,
              ]}
            >
              Browse
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === "requests" && styles.toggleActive,
            ]}
            onPress={() => setActiveTab("requests")}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "requests" && styles.toggleTextActive,
              ]}
            >
              My Requests
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "browse" ? (
          loading ? (
            <View style={styles.centerInside}>
              <ActivityIndicator size="large" />
            </View>
          ) : events.length === 0 ? (
            <Text style={styles.empty}>No events found.</Text>
          ) : (
            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={renderBrowseEvent}
            />
          )
        ) : (
          renderRequestsContent()
        )}
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
    paddingHorizontal: 20,
  },
  centerInside: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  subheader: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 18,
  },
  toggle: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#ECE8E1",
    borderRadius: 14,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: "#FFFFFF",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleTextActive: {
    color: "#111827",
  },
  empty: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 20,
  },
  emptyCardText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 3,
  },
  organizer: {
    fontSize: 14,
    color: "#374151",
    marginTop: 6,
    marginBottom: 8,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 10,
  },
  spots: {
    fontSize: 13,
    color: "#059669",
    marginBottom: 14,
    fontWeight: "600",
  },
  status: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
    textTransform: "capitalize",
  },
  statusPending: {
    color: "#D97706",
  },
  statusApproved: {
    color: "#16A34A",
  },
  statusRejected: {
    color: "#DC2626",
  },
  pastText: {
    marginTop: 8,
    color: "#B45309",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  mainButton: {
    backgroundColor: "#14B8A6",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  mainButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});