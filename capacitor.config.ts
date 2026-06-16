import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.NODE_ENV === "development";

const config: CapacitorConfig = {
	appId: "com.budget.app",
	appName: "Budget",
	webDir: "dist",
	// During development, point to local Vite server
	// Comment out for production builds
	// server: {
	//   url: 'http://192.168.X.X:5173',
	//   cleartext: true,
	// },
	plugins: {
		LocalNotifications: {
			smallIcon: "ic_stat_icon_config_sample",
			iconColor: "#7C3AED"
		}
	}
};

export default config;
