import { Capacitor } from "@capacitor/core";

export async function applyStatusBarTheme(theme: "dark" | "light"): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	const { StatusBar, Style } = await import("@capacitor/status-bar");
	// setBackgroundColor is ignored on Android 15+ (targetSdk >= 35) — status bar is always transparent
	await StatusBar.setStyle({ style: theme === "dark" ? Style.Light : Style.Dark });
}
