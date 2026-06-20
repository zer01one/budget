import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mocks = vi.hoisted(() => {
	const storeInstance = {
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	};
	return {
		pluginStoreLoad: vi.fn().mockResolvedValue(storeInstance),
		storeInstance
	};
});

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: vi.fn(() => false) }
}));

vi.mock("@tauri-apps/plugin-store", () => ({
	load: mocks.pluginStoreLoad
}));

vi.mock("@capacitor/preferences", () => ({
	Preferences: {
		get: vi.fn(async () => ({ value: null })),
		set: vi.fn(async () => {})
	}
}));

vi.mock("@/services/filesystem/tauri.adapter", () => ({
	setTauriVaultPath: vi.fn()
}));

vi.mock("@/services/filesystem/capacitor.adapter", () => ({
	setCapacitorVaultUri: vi.fn()
}));

import { useSettingsStore } from "./settings.store";

// Stub the Tauri bridge so that fire-and-forget save() calls that escape
// mock teardown (e.g. second call in "toggling twice") don't throw.
beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

describe("useSettingsStore – default state", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("theme defaults to dark", () => {
		const store = useSettingsStore();
		expect(store.settings.theme).toBe("dark");
	});

	it("defaultCurrency defaults to KZT", () => {
		const store = useSettingsStore();
		expect(store.settings.defaultCurrency).toBe("KZT");
	});

	it("locale defaults to ru-RU", () => {
		const store = useSettingsStore();
		expect(store.settings.locale).toBe("ru-RU");
	});

	it("notificationsEnabled defaults to true", () => {
		const store = useSettingsStore();
		expect(store.settings.notificationsEnabled).toBe(true);
	});

	it("sidebarExpanded defaults to true", () => {
		const store = useSettingsStore();
		expect(store.settings.sidebarExpanded).toBe(true);
	});

	it("firstLaunch defaults to true", () => {
		const store = useSettingsStore();
		expect(store.settings.firstLaunch).toBe(true);
	});

	it("vaultPath defaults to null", () => {
		const store = useSettingsStore();
		expect(store.settings.vaultPath).toBeNull();
	});

	it("deviceId is a UUID string", () => {
		const store = useSettingsStore();
		expect(store.settings.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it("isLoaded starts false", () => {
		const store = useSettingsStore();
		expect(store.isLoaded).toBe(false);
	});
});

describe("useSettingsStore – toggleSidebar", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mocks.pluginStoreLoad.mockClear();
	});

	afterEach(async () => {
		// Ensure the fire-and-forget save() completes inside mock context
		await vi.waitFor(() => expect(mocks.pluginStoreLoad).toHaveBeenCalled(), {
			timeout: 2000
		});
	});

	it("flips sidebarExpanded from true to false", () => {
		const store = useSettingsStore();
		store.settings.sidebarExpanded = true;
		store.toggleSidebar();
		expect(store.settings.sidebarExpanded).toBe(false);
	});

	it("flips sidebarExpanded from false to true", () => {
		const store = useSettingsStore();
		store.settings.sidebarExpanded = false;
		store.toggleSidebar();
		expect(store.settings.sidebarExpanded).toBe(true);
	});

	it("toggling twice returns to original value", () => {
		const store = useSettingsStore();
		const original = store.settings.sidebarExpanded;
		store.toggleSidebar();
		store.toggleSidebar();
		expect(store.settings.sidebarExpanded).toBe(original);
	});
});

describe("useSettingsStore – applyTheme", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("sets document.documentElement.dataset.theme to current theme", () => {
		const store = useSettingsStore();
		store.settings.theme = "dark";
		store.applyTheme();
		expect(document.documentElement.dataset.theme).toBe("dark");
	});

	it("applies light theme", () => {
		const store = useSettingsStore();
		store.settings.theme = "light";
		store.applyTheme();
		expect(document.documentElement.dataset.theme).toBe("light");
	});
});

describe("useSettingsStore – setTheme", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("updates theme in settings", async () => {
		const store = useSettingsStore();
		await store.setTheme("light");
		expect(store.settings.theme).toBe("light");
	});

	it("sets document.documentElement.dataset.theme", async () => {
		const store = useSettingsStore();
		await store.setTheme("light");
		expect(document.documentElement.dataset.theme).toBe("light");
	});

	it("can set back to dark", async () => {
		const store = useSettingsStore();
		await store.setTheme("light");
		await store.setTheme("dark");
		expect(store.settings.theme).toBe("dark");
	});
});

describe("useSettingsStore – load (Tauri path)", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("sets isLoaded=true after load completes", async () => {
		const store = useSettingsStore();
		await store.load();
		expect(store.isLoaded).toBe(true);
	});

	it("keeps defaults when no saved settings exist", async () => {
		const store = useSettingsStore();
		await store.load();
		expect(store.settings.theme).toBe("dark");
		expect(store.settings.defaultCurrency).toBe("KZT");
	});

	it("merges saved settings with defaults", async () => {
		mocks.pluginStoreLoad.mockResolvedValueOnce({
			get: vi.fn(async () => ({ theme: "light", locale: "en-US" })),
			set: vi.fn(),
			save: vi.fn()
		} as never);
		setActivePinia(createPinia());
		const store = useSettingsStore();
		await store.load();
		expect(store.settings.theme).toBe("light");
		expect(store.settings.locale).toBe("en-US");
		// defaults preserved for unset keys
		expect(store.settings.defaultCurrency).toBe("KZT");
	});
});
