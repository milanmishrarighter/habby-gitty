import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.milan.losertracker",
  appName: "Loser Tracker",
  webDir: "dist",
  backgroundColor: "#0c0c0c",
  android: {
    backgroundColor: "#0c0c0c",
    // Keeps the app clear of the status and navigation bars on Android 15+.
    adjustMarginsForEdgeToEdge: "auto",
  },
};

export default config;
