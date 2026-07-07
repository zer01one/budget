import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { nextTick } from "vue";
import ProfileView from "@/views/ProfileView.vue";
import { useGamificationStore } from "@/stores/gamification.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Achievement } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
	mockExportCSV,
	mockExportJSON,
	mockRequestPermission,
	mockScheduleReminder,
	mockCancelReminder,
	mockSettingsSave,
	mockSetTheme,
	mockSetVaultPath,
	mockPickFolder,
	mockReadMetadata,
	mockInitNewVault
} = vi.hoisted(() => ({
	mockExportCSV: vi.fn().mockResolvedValue(undefined),
	mockExportJSON: vi.fn().mockResolvedValue(undefined),
	mockRequestPermission: vi.fn().mockResolvedValue(true),
	mockScheduleReminder: vi.fn().mockResolvedValue(undefined),
	mockCancelReminder: vi.fn().mockResolvedValue(undefined),
	mockSettingsSave: vi.fn().mockResolvedValue(undefined),
	mockSetTheme: vi.fn().mockResolvedValue(undefined),
	mockSetVaultPath: vi.fn().mockResolvedValue(undefined),
	mockPickFolder: vi.fn().mockResolvedValue({ uri: "/new/vault", displayPath: "new/vault" }),
	mockReadMetadata: vi.fn().mockResolvedValue(null),
	mockInitNewVault: vi.fn().mockResolvedValue(undefined)
}));

// Settings data — mutated per test in beforeEach
let settingsData = {
	notificationsEnabled: false,
	reminderTime: "20:00",
	theme: "dark" as "dark" | "light",
	vaultPath: null as string | null,
	deviceId: "test-device"
};

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({
		settings: settingsData,
		save: mockSettingsSave,
		setTheme: mockSetTheme,
		setVaultPath: mockSetVaultPath
	}))
}));

// Секция уведомлений рендерится только под v-if="isNativePlatform"
vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: () => true }
}));

vi.mock("@/services/data/export.service", () => ({
	exportTransactionsCSV: mockExportCSV,
	exportVaultJSON: mockExportJSON
}));

vi.mock("@/services/notifications.service", () => ({
	requestNotificationPermission: mockRequestPermission,
	scheduleDailyReminder: mockScheduleReminder,
	cancelDailyReminder: mockCancelReminder
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		pickFolder: mockPickFolder,
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: vi.fn().mockResolvedValue(null),
		listMonths: vi.fn().mockResolvedValue([])
	}
}));

vi.mock("@/services/data/vault.service", () => ({
	vaultService: {
		readMetadata: mockReadMetadata,
		initNewVault: mockInitNewVault
	}
}));

// ── Globals ───────────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
	mockExportCSV.mockResolvedValue(undefined);
	mockExportJSON.mockResolvedValue(undefined);
	mockRequestPermission.mockResolvedValue(true);
	mockScheduleReminder.mockResolvedValue(undefined);
	mockCancelReminder.mockResolvedValue(undefined);
	mockSettingsSave.mockResolvedValue(undefined);
	mockSetVaultPath.mockResolvedValue(undefined);
	mockPickFolder.mockResolvedValue({ uri: "/new/vault", displayPath: "new/vault" });
	mockReadMetadata.mockResolvedValue(null);
	mockInitNewVault.mockResolvedValue(undefined);
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAchievement(key: string, overrides: Partial<Achievement> = {}): Achievement {
	return {
		key: key as Achievement["key"],
		unlockedAt: null,
		progress: 0,
		notifiedAt: null,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: ProfileView },
			{ path: "/import", component: { template: "<div/>" } }
		]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(ProfileView, {
		global: { plugins: [pinia, router] }
	});
	await flushPromises();
	return { wrapper, router };
}

// ── Level card ────────────────────────────────────────────────────────────────

describe("ProfileView – level card", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("renders level label", async () => {
		useGamificationStore().state.level = "apprentice";
		const { wrapper } = await mountView();
		expect(wrapper.find(".level-card__level").text()).toBe("Ученик");
	});

	it("renders xp value", async () => {
		useGamificationStore().state.xp = 250;
		const { wrapper } = await mountView();
		expect(wrapper.find(".level-card__xp").text()).toContain("250");
	});

	it("shows 'До уровня' when nextLevel exists", async () => {
		useGamificationStore().state.level = "novice";
		useGamificationStore().state.xp = 0;
		const { wrapper } = await mountView();
		expect(wrapper.find(".level-card__next").text()).toContain("До уровня");
	});

	it("shows xpToNextLevel in the next-level text", async () => {
		useGamificationStore().state.level = "novice";
		useGamificationStore().state.xp = 100;
		const { wrapper } = await mountView();
		// xpToNextLevel = 500 - 100 = 400
		expect(wrapper.find(".level-card__next").text()).toContain("400");
	});

	it("shows 'Максимальный уровень' at master level", async () => {
		useGamificationStore().state.level = "master";
		useGamificationStore().state.xp = 6000;
		const { wrapper } = await mountView();
		expect(wrapper.find(".level-card__next").text()).toContain("Максимальный уровень");
	});

	it("level bar width reflects levelProgress", async () => {
		// novice: xp=250 → (250-0)/(500-0)*100 = 50%
		useGamificationStore().state.level = "novice";
		useGamificationStore().state.xp = 250;
		const { wrapper } = await mountView();
		expect(wrapper.find(".level-card__bar").attributes("style")).toContain("50");
	});
});

// ── Stats grid ────────────────────────────────────────────────────────────────

describe("ProfileView – stats grid", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows totalTransactions", async () => {
		useGamificationStore().state.totalTransactions = 42;
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".stat__value")[0].text()).toContain("42");
	});

	it("shows currentStreak", async () => {
		useGamificationStore().state.currentStreak = 7;
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".stat__value")[1].text()).toContain("7");
	});

	it("shows longestStreak", async () => {
		useGamificationStore().state.longestStreak = 30;
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".stat__value")[2].text()).toContain("30");
	});
});

// ── Achievements ──────────────────────────────────────────────────────────────

describe("ProfileView – achievements", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("renders one element per achievement", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction"), makeAchievement("streak_7"), makeAchievement("century")];
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".achievement")).toHaveLength(3);
	});

	it("locked achievement has --locked class", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction", { unlockedAt: null })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement").classes()).toContain("achievement--locked");
	});

	it("unlocked achievement lacks --locked class", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction", { unlockedAt: "2026-06-01T00:00:00Z" })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement").classes()).not.toContain("achievement--locked");
	});

	it("unlocked achievement shows trophy icon", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction", { unlockedAt: "2026-06-01T00:00:00Z" })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__icon").text()).toContain("🏆");
	});

	it("locked achievement shows lock icon", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction")];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__icon").text()).toContain("🔒");
	});

	it("shows progress bar when locked and progress > 0", async () => {
		useGamificationStore().state.achievements = [makeAchievement("century", { unlockedAt: null, progress: 50 })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__progress-wrap").exists()).toBe(true);
	});

	it("progress bar width matches progress value", async () => {
		useGamificationStore().state.achievements = [makeAchievement("century", { unlockedAt: null, progress: 75 })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__progress").attributes("style")).toContain("75%");
	});

	it("no progress bar when progress = 0", async () => {
		useGamificationStore().state.achievements = [makeAchievement("century", { progress: 0 })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__progress-wrap").exists()).toBe(false);
	});

	it("no progress bar when achievement is unlocked (even if progress = 100)", async () => {
		useGamificationStore().state.achievements = [makeAchievement("century", { unlockedAt: "2026-06-01T00:00:00Z", progress: 100 })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__progress-wrap").exists()).toBe(false);
	});

	it("renders achievement name from ACHIEVEMENT_LABELS", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction")];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__name").text()).toBe("Первый шаг");
	});

	it("renders achievement description from ACHIEVEMENT_LABELS", async () => {
		useGamificationStore().state.achievements = [makeAchievement("first_transaction")];
		const { wrapper } = await mountView();
		expect(wrapper.find(".achievement__desc").text()).toContain("первую транзакцию");
	});
});

// ── Import / Export ───────────────────────────────────────────────────────────

describe("ProfileView – import section", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("import button navigates to /import", async () => {
		const { wrapper, router } = await mountView();
		const spy = vi.spyOn(router, "push");
		const importRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Импортировать"));
		await importRow!.find("button").trigger("click");
		expect(spy).toHaveBeenCalledWith("/import");
	});
});

describe("ProfileView – export section", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("no export error shown on initial render", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".export-error").exists()).toBe(false);
	});

	it("CSV export button calls exportTransactionsCSV with store data", async () => {
		const { wrapper } = await mountView();
		const csvRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (CSV)"));
		await csvRow!.find("button").trigger("click");
		await flushPromises();
		expect(mockExportCSV).toHaveBeenCalledOnce();
		expect(mockExportCSV).toHaveBeenCalledWith(useTransactionsStore().allCached, useAccountsStore().accounts, useCategoriesStore().categories);
	});

	it("JSON export button calls exportVaultJSON", async () => {
		const { wrapper } = await mountView();
		const jsonRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (JSON)"));
		await jsonRow!.find("button").trigger("click");
		await flushPromises();
		expect(mockExportJSON).toHaveBeenCalledOnce();
	});

	it("exportVaultJSON receives allCached", async () => {
		const { wrapper } = await mountView();
		const jsonRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (JSON)"));
		await jsonRow!.find("button").trigger("click");
		await flushPromises();
		expect(mockExportJSON).toHaveBeenCalledWith(useTransactionsStore().allCached);
	});

	it("shows Error.message on CSV failure", async () => {
		mockExportCSV.mockRejectedValue(new Error("Нет доступа"));
		const { wrapper } = await mountView();
		const csvRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (CSV)"));
		await csvRow!.find("button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".export-error").text()).toBe("Нет доступа");
	});

	it("shows Error.message on JSON failure", async () => {
		mockExportJSON.mockRejectedValue(new Error("Ошибка JSON"));
		const { wrapper } = await mountView();
		const jsonRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (JSON)"));
		await jsonRow!.find("button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".export-error").text()).toBe("Ошибка JSON");
	});

	it("shows fallback message for non-Error throws on CSV", async () => {
		mockExportCSV.mockRejectedValue("generic");
		const { wrapper } = await mountView();
		const csvRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (CSV)"));
		await csvRow!.find("button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".export-error").text()).toBe("Ошибка экспорта");
	});

	it("shows fallback message for non-Error throws on JSON", async () => {
		mockExportJSON.mockRejectedValue("generic");
		const { wrapper } = await mountView();
		const jsonRow = wrapper.findAll(".export-row").find((r) => r.text().includes("Транзакции (JSON)"));
		await jsonRow!.find("button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".export-error").text()).toBe("Ошибка экспорта");
	});
});

// ── Notifications toggle ──────────────────────────────────────────────────────

describe("ProfileView – notifications toggle", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("toggle has --on class when notifications enabled", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		expect(wrapper.find(".toggle").classes()).toContain("toggle--on");
	});

	it("toggle lacks --on class when notifications disabled", async () => {
		settingsData.notificationsEnabled = false;
		const { wrapper } = await mountView();
		expect(wrapper.find(".toggle").classes()).not.toContain("toggle--on");
	});

	it("enabling: calls requestNotificationPermission", async () => {
		settingsData.notificationsEnabled = false;
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockRequestPermission).toHaveBeenCalledOnce();
	});

	it("enabling with granted permission: calls scheduleDailyReminder with reminderTime", async () => {
		settingsData.notificationsEnabled = false;
		settingsData.reminderTime = "09:00";
		mockRequestPermission.mockResolvedValue(true);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockScheduleReminder).toHaveBeenCalledWith("09:00");
	});

	it("enabling with granted permission: saves settings", async () => {
		settingsData.notificationsEnabled = false;
		mockRequestPermission.mockResolvedValue(true);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockSettingsSave).toHaveBeenCalledOnce();
	});

	it("enabling with denied permission: does not call scheduleDailyReminder", async () => {
		settingsData.notificationsEnabled = false;
		mockRequestPermission.mockResolvedValue(false);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockScheduleReminder).not.toHaveBeenCalled();
	});

	it("enabling with denied permission: does not save settings", async () => {
		settingsData.notificationsEnabled = false;
		mockRequestPermission.mockResolvedValue(false);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockSettingsSave).not.toHaveBeenCalled();
	});

	it("enabling with denied permission: reverts toggle (no --on class)", async () => {
		settingsData.notificationsEnabled = false;
		mockRequestPermission.mockResolvedValue(false);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(wrapper.find(".toggle").classes()).not.toContain("toggle--on");
	});

	it("disabling: calls cancelDailyReminder", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockCancelReminder).toHaveBeenCalledOnce();
	});

	it("disabling: does not call requestNotificationPermission", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockRequestPermission).not.toHaveBeenCalled();
	});

	it("disabling: saves settings", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await flushPromises();
		expect(mockSettingsSave).toHaveBeenCalledOnce();
	});

	it("toggle is disabled while async save is in flight", async () => {
		settingsData.notificationsEnabled = false;
		let resolvePerm!: (v: boolean) => void;
		mockRequestPermission.mockReturnValue(
			new Promise((r) => {
				resolvePerm = r;
			})
		);
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await nextTick();
		expect(wrapper.find(".toggle").element.hasAttribute("disabled")).toBe(true);
		resolvePerm(true);
		await flushPromises();
		expect(wrapper.find(".toggle").element.hasAttribute("disabled")).toBe(false);
	});
});

// ── Notification time input ───────────────────────────────────────────────────

describe("ProfileView – notification time input", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("time input hidden when notifications disabled", async () => {
		settingsData.notificationsEnabled = false;
		const { wrapper } = await mountView();
		expect(wrapper.find("input[type='time']").exists()).toBe(false);
	});

	it("time input shown when notifications enabled", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		expect(wrapper.find("input[type='time']").exists()).toBe(true);
	});

	it("time input value matches reminderTime from settings", async () => {
		settingsData.notificationsEnabled = true;
		settingsData.reminderTime = "08:30";
		const { wrapper } = await mountView();
		expect((wrapper.find("input[type='time']").element as HTMLInputElement).value).toBe("08:30");
	});

	it("saveNotifTime: calls scheduleDailyReminder with new time when enabled", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		const input = wrapper.find("input[type='time']");
		await input.setValue("09:30");
		await input.trigger("change");
		await flushPromises();
		expect(mockScheduleReminder).toHaveBeenCalledWith("09:30");
	});

	it("saveNotifTime: calls save when enabled", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		await wrapper.find("input[type='time']").setValue("09:30");
		await wrapper.find("input[type='time']").trigger("change");
		await flushPromises();
		expect(mockSettingsSave).toHaveBeenCalled();
	});

	it("saveNotifTime: updates reminderTime in settings", async () => {
		settingsData.notificationsEnabled = true;
		const { wrapper } = await mountView();
		await wrapper.find("input[type='time']").setValue("08:00");
		await wrapper.find("input[type='time']").trigger("change");
		await flushPromises();
		expect(settingsData.reminderTime).toBe("08:00");
	});
});

// ── Theme & settings ──────────────────────────────────────────────────────────

describe("ProfileView – theme toggle", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows '☀ Светлая' button when theme is dark", async () => {
		settingsData.theme = "dark";
		const { wrapper } = await mountView();
		expect(wrapper.find(".theme-toggle").text()).toContain("Светлая");
	});

	it("shows '🌙 Тёмная' button when theme is light", async () => {
		settingsData.theme = "light";
		const { wrapper } = await mountView();
		expect(wrapper.find(".theme-toggle").text()).toContain("Тёмная");
	});

	it("clicking theme toggle calls setTheme('light') when currently dark", async () => {
		settingsData.theme = "dark";
		const { wrapper } = await mountView();
		await wrapper.find(".theme-toggle").trigger("click");
		expect(mockSetTheme).toHaveBeenCalledWith("light");
	});

	it("clicking theme toggle calls setTheme('dark') when currently light", async () => {
		settingsData.theme = "light";
		const { wrapper } = await mountView();
		await wrapper.find(".theme-toggle").trigger("click");
		expect(mockSetTheme).toHaveBeenCalledWith("dark");
	});
});

describe("ProfileView – settings: vault path", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: null, deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows '—' when vaultPath is null", async () => {
		settingsData.vaultPath = null;
		const { wrapper } = await mountView();
		expect(wrapper.find(".vault-path").text()).toBe("—");
	});

	it("shows vault path when set", async () => {
		settingsData.vaultPath = "/home/user/budget";
		const { wrapper } = await mountView();
		expect(wrapper.find(".vault-path").text()).toBe("/home/user/budget");
	});
});

// ── Vault change ──────────────────────────────────────────────────────────────

async function mountViewWithTeleport() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: ProfileView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(ProfileView, {
		global: {
			plugins: [pinia, router],
			stubs: { Teleport: true }
		}
	});
	await flushPromises();
	return { wrapper, router };
}

describe("ProfileView – vault change", () => {
	beforeEach(() => {
		settingsData = { notificationsEnabled: false, reminderTime: "20:00", theme: "dark", vaultPath: "/old/vault", deviceId: "test-device" };
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("'Сменить' button is rendered", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".vault-change-btn").exists()).toBe(true);
	});

	it("clicking 'Сменить' opens vault modal", async () => {
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		expect(wrapper.find(".vault-modal").exists()).toBe(true);
	});

	it("vault modal shows both option buttons", async () => {
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		const options = wrapper.findAll(".vault-option");
		expect(options).toHaveLength(2);
		expect(options[0].text()).toContain("Перенести данные");
		expect(options[1].text()).toContain("Открыть другое хранилище");
	});

	it("moveVault: calls pickFolder then setVaultPath with returned URI", async () => {
		mockPickFolder.mockResolvedValue({ uri: "/new/vault", displayPath: "new/vault" });
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		await flushPromises();
		expect(mockPickFolder).toHaveBeenCalledOnce();
		expect(mockSetVaultPath).toHaveBeenCalledWith("/new/vault");
	});

	it("moveVault: closes modal on success", async () => {
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".vault-modal").exists()).toBe(false);
	});

	it("moveVault: shows error when pickFolder rejects", async () => {
		mockPickFolder.mockRejectedValue(new Error("Отменено пользователем"));
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".vault-modal__error").text()).toBe("Отменено пользователем");
	});

	it("moveVault: shows fallback error for non-Error throws", async () => {
		mockPickFolder.mockRejectedValue("something");
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".vault-modal__error").text()).toBe("Ошибка переноса данных");
	});

	it("moveVault: calls initNewVault when no metadata in old vault", async () => {
		mockReadMetadata.mockResolvedValue(null);
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		await flushPromises();
		expect(mockInitNewVault).toHaveBeenCalledOnce();
	});

	it("switchVault: calls pickFolder then setVaultPath with returned URI", async () => {
		mockPickFolder.mockResolvedValue({ uri: "/other/vault", displayPath: "other/vault" });
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[1].trigger("click");
		await flushPromises();
		expect(mockPickFolder).toHaveBeenCalledOnce();
		expect(mockSetVaultPath).toHaveBeenCalledWith("/other/vault");
	});

	it("switchVault: closes modal on success", async () => {
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[1].trigger("click");
		await flushPromises();
		expect(wrapper.find(".vault-modal").exists()).toBe(false);
	});

	it("switchVault: calls initNewVault when target folder has no metadata", async () => {
		mockReadMetadata.mockResolvedValue(null);
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[1].trigger("click");
		await flushPromises();
		expect(mockInitNewVault).toHaveBeenCalledOnce();
	});

	it("switchVault: does not call initNewVault when target folder has metadata", async () => {
		mockReadMetadata.mockResolvedValue({
			schemaVersion: 1,
			deviceId: "x",
			appVersion: "0.1.0",
			createdAt: "",
			vaultName: "",
			updatedAt: "",
			version: 1
		});
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[1].trigger("click");
		await flushPromises();
		expect(mockInitNewVault).not.toHaveBeenCalled();
	});

	it("switchVault: shows error when pickFolder rejects", async () => {
		mockPickFolder.mockRejectedValue(new Error("Нет прав"));
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[1].trigger("click");
		await flushPromises();
		expect(wrapper.find(".vault-modal__error").text()).toBe("Нет прав");
	});

	it("modal cannot be closed while loading (closeVaultModal is blocked)", async () => {
		// Block after pickFolder resolves so vaultStep becomes "loading" before we try to close
		let resolveSetVaultPath!: () => void;
		mockSetVaultPath.mockReturnValue(new Promise<void>((r) => (resolveSetVaultPath = r)));
		const { wrapper } = await mountViewWithTeleport();
		await wrapper.find(".vault-change-btn").trigger("click");
		await nextTick();
		await wrapper.findAll(".vault-option")[0].trigger("click");
		// flush until setVaultPath blocks — vaultStep is now "loading"
		await flushPromises();
		const closeBtn = wrapper.find(".modal__close");
		if (closeBtn.exists()) await closeBtn.trigger("click");
		await nextTick();
		expect(wrapper.find(".vault-modal").exists()).toBe(true);
		resolveSetVaultPath();
		await flushPromises();
	});
});
