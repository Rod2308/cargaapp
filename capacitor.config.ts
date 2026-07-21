import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.carga.app",
  appName: "Carga",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#84cc16",
      sound: "rest_timer.wav",
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
