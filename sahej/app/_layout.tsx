import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

const sahejTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#050505",
    card: "#050505",
    border: "rgba(138,43,226,0.22)",
    primary: "#8a2be2",
    text: "#f5f2ff",
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={sahejTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            title: "Sahej",
            contentStyle: { backgroundColor: "#050505" },
            headerStyle: { backgroundColor: "#050505" },
            headerTintColor: "#f5f2ff",
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
