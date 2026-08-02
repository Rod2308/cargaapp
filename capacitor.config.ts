import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.carga.app",
  appName: "Carga",
  webDir: "dist",
  server: {
    url: "https://cargaapp.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_rest_timer",
      iconColor: "#84cc16",
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
