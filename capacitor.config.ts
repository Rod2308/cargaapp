import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.carga.app",
  appName: "Carga",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
