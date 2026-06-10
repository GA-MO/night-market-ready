import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nightmarket.ready",
  appName: "Night Market Ready!",
  webDir: "dist",
  backgroundColor: "#0b0d22",
  android: {
    backgroundColor: "#0b0d22",
  },
  ios: {
    backgroundColor: "#0b0d22",
    contentInset: "always",
  },
};

export default config;
