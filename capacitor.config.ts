import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.carga.app",
  appName: "Carga",
  webDir: "dist",
  server: {
    androidScheme: "https",
    url: "https://cargaapp.lovable.app",
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
