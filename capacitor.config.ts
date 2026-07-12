import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.CAP_DEV === "true";

const config: CapacitorConfig = {
  appId: "com.personalbrain.backstage",
  appName: "BACKSTAGE",
  webDir: ".capacitor-assets",
  server: {
    url: isDev ? "http://10.0.2.2:3000" : "https://brain.mprnl.fr",
    cleartext: isDev,
  },
  android: {
    allowMixedContent: isDev,
  },
  plugins: {
    DeepLinks: {
      schemes: ["backstage"],
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0f0f0f",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
