import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ── Store mocks ───────────────────────────────────────────────────────────────
let mockVaultPath: string | null = null;
let mockIsLoaded = true;
const mockSettingsLoad = vi.fn(async () => {});
const mockApplyTheme = vi.fn();
const mockAccountsLoad = vi.fn(async () => {});
const mockCategoriesLoad = vi.fn(async () => {});
const mockGamificationLoad = vi.fn(async () => {});
const mockGamificationCheckStreak = vi.fn();
const mockBudgetsLoad = vi.fn(async () => {});
const mockTxLoadCurrentAndPrevMonth = vi.fn(async () => {});

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({
		settings: { vaultPath: mockVaultPath },
		isLoaded: mockIsLoaded,
		load: mockSettingsLoad,
		applyTheme: mockApplyTheme
	}))
}));
vi.mock("@/stores/accounts.store", () => ({
	useAccountsStore: vi.fn(() => ({ load: mockAccountsLoad }))
}));
vi.mock("@/stores/categories.store", () => ({
	useCategoriesStore: vi.fn(() => ({ load: mockCategoriesLoad }))
}));
vi.mock("@/stores/transactions.store", () => ({
	useTransactionsStore: vi.fn(() => ({ loadCurrentAndPrevMonth: mockTxLoadCurrentAndPrevMonth }))
}));
vi.mock("@/stores/gamification.store", () => ({
	useGamificationStore: vi.fn(() => ({
		load: mockGamificationLoad,
		checkDailyStreak: mockGamificationCheckStreak
	}))
}));
vi.mock("@/stores/budgets.store", () => ({
	useBudgetsStore: vi.fn(() => ({ load: mockBudgetsLoad }))
}));
vi.mock("@/services/filesystem", () => ({
	setVaultPath: vi.fn(async () => {})
}));
vi.mock("@/composables/useRecurring", () => ({
	processRecurringTransactions: vi.fn(async () => {})
}));

async function freshBootstrap() {
	vi.resetModules();
	const { useBootstrap } = await import("./useBootstrap");
	return useBootstrap();
}

describe("useBootstrap – guard", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockVaultPath = "/vault";
		mockIsLoaded = true;
	});

	it("bootstrapped starts false", async () => {
		const { bootstrapped } = await freshBootstrap();
		expect(bootstrapped.value).toBe(false);
	});

	it("bootstrapped is true after bootstrap()", async () => {
		const { bootstrap, bootstrapped } = await freshBootstrap();
		await bootstrap();
		expect(bootstrapped.value).toBe(true);
	});

	it("calling bootstrap() twice only runs once", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		await bootstrap();
		expect(mockAccountsLoad).toHaveBeenCalledOnce();
	});
});

describe("useBootstrap – no vaultPath", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockVaultPath = null;
		mockIsLoaded = true;
	});

	it("returns early when vaultPath is null", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockAccountsLoad).not.toHaveBeenCalled();
	});

	it("does not call transactionsStore.loadCurrentAndPrevMonth when no vault", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockTxLoadCurrentAndPrevMonth).not.toHaveBeenCalled();
	});
});

describe("useBootstrap – settings not loaded", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockVaultPath = "/path/to/vault";
		mockIsLoaded = false;
	});

	it("calls settingsStore.load() when isLoaded is false", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockSettingsLoad).toHaveBeenCalledOnce();
	});

	it("calls settingsStore.applyTheme() after loading settings", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockApplyTheme).toHaveBeenCalledOnce();
	});

	it("still loads vault data after loading settings", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockAccountsLoad).toHaveBeenCalled();
	});
});

describe("useBootstrap – with vaultPath", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockVaultPath = "/path/to/vault";
		mockIsLoaded = true;
	});

	it("does not call settingsStore.load() when already loaded", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockSettingsLoad).not.toHaveBeenCalled();
	});

	it("calls accountsStore.load()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockAccountsLoad).toHaveBeenCalled();
	});

	it("calls categoriesStore.load()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockCategoriesLoad).toHaveBeenCalled();
	});

	it("calls gamificationStore.load()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockGamificationLoad).toHaveBeenCalled();
	});

	it("calls budgetsStore.load()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockBudgetsLoad).toHaveBeenCalled();
	});

	it("calls gamificationStore.checkDailyStreak()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockGamificationCheckStreak).toHaveBeenCalled();
	});

	it("calls txStore.loadCurrentAndPrevMonth()", async () => {
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(mockTxLoadCurrentAndPrevMonth).toHaveBeenCalled();
	});

	it("calls filesystem.setVaultPath()", async () => {
		const { setVaultPath } = await import("@/services/filesystem");
		const { bootstrap } = await freshBootstrap();
		await bootstrap();
		expect(setVaultPath).toHaveBeenCalledWith("/path/to/vault");
	});
});
