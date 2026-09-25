import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import { signOut, deleteUser } from "firebase/auth";
import { auth, db, storage } from "../../firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../providers/AuthProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

export default function Profile() {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setLocation(data.location || "");
        setPhotoURL(data.photoURL || "");
      }
    } catch (error) {
      console.log("LOAD USER ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  async function pickImage() {
    if (!editing) return;

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission needed",
          "You need to allow photo access to choose a profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        setPhotoURL(result.assets[0].uri);
      }
    } catch (error) {
      console.log("IMAGE PICK ERROR:", error);
      Alert.alert("Error", "Could not open image picker.");
    }
  }

  async function uploadImageAsync(uri) {
    if (!user) return "";

    const response = await fetch(uri);
    const blob = await response.blob();

    const fileRef = ref(storage, `profilePictures/${user.uid}.jpg`);

    await uploadBytes(fileRef, blob);

    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  }

  async function handleSave() {
    try {
      if (!user) return;

      setSaving(true);

      let finalPhotoURL = photoURL;

      if (photoURL && photoURL.startsWith("file")) {
        finalPhotoURL = await uploadImageAsync(photoURL);
      }

      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        location: location.trim(),
        photoURL: finalPhotoURL,
      });

      setPhotoURL(finalPhotoURL);
      setEditing(false);
      Alert.alert("Saved", "Profile updated.");
    } catch (error) {
      console.log("SAVE ERROR:", error);
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete Account",
      "Deleting your account is permanent and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    try {
      if (!user) return;

      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);

      Alert.alert("Deleted", "Your account has been removed.");
      router.replace("/login");
    } catch (error) {
      console.log("DELETE ERROR:", error);
      Alert.alert("Error", error.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const initials =
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.trim() || "U";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.header}>Settings</Text>
          <Text style={styles.subheader}>
            View and update your HandUP profile.
          </Text>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditing((prev) => !prev)}
          >
            <Text style={styles.editButtonText}>
              {editing ? "Cancel Editing" : "Edit Profile"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={editing ? 0.85 : 1}
            style={styles.avatarWrap}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.photoHint}>
            {editing ? "Tap photo to change it" : "Profile photo"}
          </Text>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={firstName}
                onChangeText={setFirstName}
                editable={editing}
                placeholder="First name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={lastName}
                onChangeText={setLastName}
                editable={editing}
                placeholder="Last name"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user?.email || ""}
            editable={false}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={[styles.input, !editing && styles.inputDisabled]}
            value={location}
            onChangeText={setLocation}
            editable={editing}
            placeholder="City, State"
            placeholderTextColor="#9CA3AF"
          />

          {editing ? (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerText}>
            Deleting your account is permanent and cannot be undone.
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F4F1",
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#14B8A6",
    marginBottom: 8,
  },
  header: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 18,
    lineHeight: 22,
  },
  editButton: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF7F5",
    borderWidth: 1,
    borderColor: "#CDEAE6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 18,
  },
  editButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  avatarWrap: {
    alignSelf: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#6B7280",
  },
  photoHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: "#111827",
    marginBottom: 14,
  },
  inputDisabled: {
    backgroundColor: "#F9FAFB",
    color: "#6B7280",
  },
  saveButton: {
    backgroundColor: "#14B8A6",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  logoutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF7F5",
    borderWidth: 1,
    borderColor: "#CDEAE6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 22,
  },
  dangerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 16,
  },
  deleteButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F4F1",
  },
});