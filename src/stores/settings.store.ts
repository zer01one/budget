import { defineStore } from "pinia";
import { ref } from "vue";
import type { AppSettings } from "@/types";
import { Capacitor } from "@capacitor/core";

const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS: AppSettings = {
	vaultPath: null,
	theme: "dark",
	defaultCurrency: "RUB",
	locale: "ru-RU",
	notificationsEnabled: true,
	reminderTime: "20:00",
	firstLaunch: true,
	deviceId: crypto.randomUUID(),
	sidebarExpanded: true
};

export const useSettingsStore = defineStore("settings", () => {
	const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
	const isLoaded = ref(false);

	async function load(): Promise<void> {
		if (Capacitor.isNativePlatform()) {
			const { Preferences } = await import("@capacitor/preferences");
			const { value } = await Preferences.get({ key: SETTINGS_KEY });
			if (value) {
				settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
			}
		} else {
			const { load: loadStore } = await import("@tauri-apps/plugin-store");
			const store = await loadStore("settings.json");
			const saved = await store.get<AppSettings>(SETTINGS_KEY);
			if (saved) {
				settings.value = { ...DEFAULT_SETTINGS, ...saved };
			}
		}
		isLoaded.value = true;
	}

	async function save(): Promise<void> {
		if (Capacitor.isNativePlatform()) {
			const { Preferences } = await import("@capacitor/preferences");
			await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings.value) });
		} else {
			const { load: loadStore } = await import("@tauri-apps/plugin-store");
			const store = await loadStore("settings.json");
			await store.set(SETTINGS_KEY, settings.value);
			await store.save();
		}
	}

	async function setVaultPath(path: string): Promise<void> {
		settings.value.vaultPath = path;
		settings.value.firstLaunch = false;
		if (!Capacitor.isNativePlatform()) {
			const { setTauriVaultPath } = await import("@/services/filesystem/tauri.adapter");
			setTauriVaultPath(path);
		} else {
			const { setCapacitorVaultUri } = await import("@/services/filesystem/capacitor.adapter");
			setCapacitorVaultUri(path);
		}
		await save();
	}

	async function setTheme(theme: "dark" | "light"): Promise<void> {
		settings.value.theme = theme;
		document.documentElement.dataset.theme = theme;
		const { applyStatusBarTheme } = await import("@/composables/useStatusBar");
		await applyStatusBarTheme(theme);
		await save();
	}

	function applyTheme(): void {
		document.documentElement.dataset.theme = settings.value.theme;
		import("@/composables/useStatusBar").then(({ applyStatusBarTheme }) => {
			applyStatusBarTheme(settings.value.theme);
		});
	}

	function toggleSidebar(): void {
		settings.value.sidebarExpanded = !settings.value.sidebarExpanded;
		save();
	}

	return {
		settings,
		isLoaded,
		load,
		save,
		setVaultPath,
		setTheme,
		applyTheme,
		toggleSidebar
	};
});
