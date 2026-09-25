import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { auth, db } from "../../firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default function CreateEventScreen() {
  const [activeTab, setActiveTab] = useState("create");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [spots, setSpots] = useState("");

  const [pickedDate, setPickedDate] = useState(new Date());
  const [pickedTime, setPickedTime] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSpotsPicker, setShowSpotsPicker] = useState(false);

  const [myEvents, setMyEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    if (activeTab === "my-events") {
      loadMyEvents();
    }
  }, [activeTab]);

  async function loadMyEvents() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setLoadingEvents(true);

      const q = query(
        collection(db, "events"),
        where("organizerId", "==", user.uid)
      );

      const snap = await getDocs(q);

      const eventsList = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMyEvents(eventsList);
    } catch (error) {
      console.log("LOAD MY EVENTS ERROR:", error);
    } finally {
      setLoadingEvents(false);
    }
  }

  function formatDateToString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatTimeToString(dateObj) {
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function onChangeDate(event, selectedDate) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setPickedDate(selectedDate);
      setDate(formatDateToString(selectedDate));
    }
  }

  function onChangeTime(event, selectedTime) {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (selectedTime) {
      setPickedTime(selectedTime);
      setTime(formatTimeToString(selectedTime));
    }
  }

  async function handleCreateEvent() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (
        !title ||
        !description ||
        !category ||
        !location ||
        !date ||
        !time ||
        !spots
      ) {
        Alert.alert("Missing info", "Please fill out all fields.");
        return;
      }

      setCreating(true);

      await addDoc(collection(db, "events"), {
        title,
        description,
        category,
        location,
        date,
        time,
        spots: Number(spots),
        organizerId: user.uid,
        organizerName: user.displayName || user.email,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Event created.");

      setTitle("");
      setDescription("");
      setCategory("");
      setLocation("");
      setDate("");
      setTime("");
      setSpots("");
      setPickedDate(new Date());
      setPickedTime(new Date());
      setShowDatePicker(false);
      setShowTimePicker(false);
      setShowSpotsPicker(false);

      setActiveTab("my-events");
      loadMyEvents();
    } catch (error) {
      console.log("CREATE EVENT ERROR:", error);
      Alert.alert("Error", "Could not create event.");
    } finally {
      setCreating(false);
    }
  }

  function renderEventCard(item, isPast = false) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => router.push(`/my-event-details?id=${item.id}`)}
      >
        <Text style={styles.title}>{item.title || "Untitled Event"}</Text>

        <Text style={styles.meta}>
          📍 {item.location || "No location provided"}
        </Text>

        <Text style={styles.meta}>
          📅 {item.date || "No date provided"}
        </Text>

        {item.time ? <Text style={styles.meta}>⏰ {item.time}</Text> : null}

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <Text style={styles.spots}>
          Spots: {item.spots ?? "Not listed"}
        </Text>

        {isPast ? (
          <View style={styles.pastBadge}>
            <Text style={styles.pastBadgeText}>This event already happened</Text>
          </View>
        ) : null}

        <View style={styles.mainButton}>
          <Text style={styles.mainButtonText}>View Event</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderCreateTab() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create a new event</Text>
          <Text style={styles.formSubtext}>
            Fill out the details below to post a volunteer opportunity.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Event title"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <TextInput
            style={styles.input}
            placeholder="Category"
            placeholderTextColor="#9CA3AF"
            value={category}
            onChangeText={setCategory}
          />

          <TextInput
            style={styles.input}
            placeholder="Location"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              setShowTimePicker(false);
              setShowSpotsPicker(false);
              setShowDatePicker(true);
            }}
          >
            <Text style={date ? styles.selectText : styles.selectPlaceholder}>
              {date || "Pick a date"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <View style={styles.pickerPanel}>
              <DateTimePicker
                value={pickedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onChangeDate}
                minimumDate={new Date()}
                style={styles.dateTimePicker}
              />

              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              setShowDatePicker(false);
              setShowSpotsPicker(false);
              setShowTimePicker(true);
            }}
          >
            <Text style={time ? styles.selectText : styles.selectPlaceholder}>
              {time || "Pick a time"}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <View style={styles.pickerPanel}>
              <DateTimePicker
                value={pickedTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onChangeTime}
                style={styles.dateTimePicker}
              />

              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowTimePicker(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
              setShowSpotsPicker(true);
            }}
          >
            <Text style={spots ? styles.selectText : styles.selectPlaceholder}>
              {spots ? `${spots} spots` : "Select spots available"}
            </Text>
          </TouchableOpacity>

          {showSpotsPicker && (
            <View style={styles.pickerPanel}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={spots}
                  onValueChange={(itemValue) => setSpots(itemValue)}
                >
                  <Picker.Item label="Select spots available" value="" />
                  <Picker.Item label="1 spot" value="1" />
                  <Picker.Item label="2 spots" value="2" />
                  <Picker.Item label="3 spots" value="3" />
                  <Picker.Item label="4 spots" value="4" />
                  <Picker.Item label="5 spots" value="5" />
                  <Picker.Item label="10 spots" value="10" />
                  <Picker.Item label="15 spots" value="15" />
                  <Picker.Item label="20 spots" value="20" />
                  <Picker.Item label="25 spots" value="25" />
                </Picker>
              </View>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowSpotsPicker(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.mainButton, creating && styles.disabledButton]}
            onPress={handleCreateEvent}
            disabled={creating}
          >
            <Text style={styles.mainButtonText}>
              {creating ? "Creating..." : "Create Event"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  function renderMyEventsTab() {
    if (loadingEvents) {
      return (
        <View style={styles.centerInside}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (myEvents.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.emptyCardText}>
            You have not created any events yet.
          </Text>
        </View>
      );
    }

    const upcomingEvents = myEvents.filter((event) => !hasEventPassed(event));
    const pastEvents = myEvents.filter((event) => hasEventPassed(event));

    return (
      <FlatList
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <View>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {upcomingEvents.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyCardText}>
                  You do not have any upcoming events.
                </Text>
              </View>
            ) : (
              upcomingEvents.map((item) => (
                <View key={item.id}>{renderEventCard(item, false)}</View>
              ))
            )}

            <Text style={styles.sectionTitle}>Past Events</Text>
            {pastEvents.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyCardText}>
                  You do not have any past events yet.
                </Text>
              </View>
            ) : (
              pastEvents.map((item) => (
                <View key={item.id}>{renderEventCard(item, true)}</View>
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
        <Text style={styles.header}>Create opportunities</Text>
        <Text style={styles.subheader}>
          Post an event or manage the ones you already created
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === "create" && styles.toggleActive,
            ]}
            onPress={() => setActiveTab("create")}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "create" && styles.toggleTextActive,
              ]}
            >
              Create
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === "my-events" && styles.toggleActive,
            ]}
            onPress={() => setActiveTab("my-events")}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "my-events" && styles.toggleTextActive,
              ]}
            >
              My Events
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "create" ? renderCreateTab() : renderMyEventsTab()}
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
  formCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  formSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#111827",
  },
  textArea: {
    minHeight: 110,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  selectText: {
    fontSize: 14,
    color: "#111827",
  },
  selectPlaceholder: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  pickerPanel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 12,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    overflow: "hidden",
  },
  dateTimePicker: {
    width: "100%",
    alignSelf: "center",
  },
  doneButton: {
    marginTop: 8,
    backgroundColor: "#14B8A6",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
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
  description: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  spots: {
    fontSize: 13,
    color: "#059669",
    marginBottom: 14,
    fontWeight: "600",
  },
  pastBadge: {
    marginBottom: 14,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pastBadgeText: {
    color: "#92400E",
    fontWeight: "700",
    fontSize: 13,
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
  disabledButton: {
    opacity: 0.7,
  },
});