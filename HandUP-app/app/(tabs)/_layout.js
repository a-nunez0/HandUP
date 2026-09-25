import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="browse" options={{ title: "Browse" }} />
      <Tabs.Screen name="create-event" options={{ title: "Create" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}