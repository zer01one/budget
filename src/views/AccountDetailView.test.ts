import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import AccountDetailView from "./AccountDetailView.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Account, Transaction, Category } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		loadMonth: vi.fn().mockResolvedValue(null),
		saveMonth: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

// ─── factories ────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Wallet",
		type: "cash",
		currency: "KZT",
		initialBalance: 10000,
		color: "#10B981",
		icon: "💰",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 500,
		currency: "KZT",
		date: "2026-06-15",
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: null,
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-15T10:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Groceries",
		type: "expense",
		color: "#FF6B6B",
		icon: "AB_ext",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ─── setup ────────────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
	vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
});

afterEach(() => {
	vi.clearAllMocks();
	(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

async function mountView(accountId = "acc-1") {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/accounts/:id", component: AccountDetailView },
			{ path: "/transactions/add", component: { template: "<div/>" } },
			{ path: "/transactions/:id", component: { template: "<div/>" } }
		]
	});
	router.push(`/accounts/${accountId}`);
	await router.isReady();
	const wrapper = mount(AccountDetailView, { global: { plugins: [pinia, router] } });
	await flushPromises();
	return { wrapper, router };
}

// ─── not found ────────────────────────────────────────────────────────────────

describe("AccountDetailView – not found", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows not-found message when id missing from store", async () => {
		const { wrapper } = await mountView("missing-id");
		expect(wrapper.find(".account-detail__not-found").exists()).toBe(true);
		expect(wrapper.text()).toContain("Счёт не найден");
	});

	it("title shows fallback 'Счёт' when account not found", async () => {
		const { wrapper } = await mountView("missing-id");
		expect(wrapper.find(".account-detail__title").text()).toBe("Счёт");
	});

	it("does not render balance-hero when account not found", async () => {
		const { wrapper } = await mountView("missing-id");
		expect(wrapper.find(".balance-hero").exists()).toBe(false);
	});
});

// ─── account found – basic display ───────────────────────────────────────────

describe("AccountDetailView – account found", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("shows account name in title", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".account-detail__title").text()).toBe("Wallet");
	});

	it("hides not-found block when account exists", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".account-detail__not-found").exists()).toBe(false);
	});

	it("renders balance-hero", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".balance-hero").exists()).toBe(true);
	});

	it("balance-hero shows account icon", async () => {
		useAccountsStore().accounts = [makeAccount({ icon: "AB" })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".balance-hero__icon").text()).toBe("AB");
	});

	it("balance-hero shows currency", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".balance-hero__amount").text()).toContain("KZT");
	});

	it("renders Архивировать button", async () => {
		const { wrapper } = await mountView();
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Архивировать"));
		expect(btn?.exists()).toBe(true);
	});

	it("renders Добавить операцию button", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.text()).toContain("Добавить операцию");
	});
});

// ─── balance ──────────────────────────────────────────────────────────────────

describe("AccountDetailView – balance", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount({ initialBalance: 5000 })];
	});

	it("shows initialBalance when no transactions", async () => {
		const { wrapper } = await mountView();
		const text = wrapper.find(".balance-hero__amount").text();
		expect(text).toContain("5");
		expect(text).toContain("000");
	});

	it("adds income transactions to balance", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "income", amount: 1000 })]);
		await nextTick();
		expect(wrapper.find(".balance-hero__amount").text()).toContain("6");
	});

	it("subtracts expense transactions from balance", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "expense", amount: 1000 })]);
		await nextTick();
		expect(wrapper.find(".balance-hero__amount").text()).toContain("4");
	});
});

// ─── no transactions ──────────────────────────────────────────────────────────

describe("AccountDetailView – no transactions", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("shows empty-state message", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".empty").exists()).toBe(true);
		expect(wrapper.text()).toContain("Нет операций по этому счёту");
	});

	it("stats show 0 income", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".text-income").text()).toContain("+0");
	});

	it("stats show 0 expense", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".text-expense").text()).toContain("-0");
	});
});

// ─── transactions list ────────────────────────────────────────────────────────

describe("AccountDetailView – transactions list", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("renders tx-row when transactions exist", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx()]);
		await nextTick();
		expect(wrapper.find(".tx-row").exists()).toBe(true);
	});

	it("hides empty-state when transactions exist", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx()]);
		await nextTick();
		expect(wrapper.find(".empty").exists()).toBe(false);
	});

	it("income tx has + prefix in amount", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "income", amount: 100 })]);
		await nextTick();
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^\+/);
	});

	it("expense tx has - prefix in amount", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "expense", amount: 100 })]);
		await nextTick();
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^-/);
	});

	it("transfer tx has ↔ prefix in amount", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "transfer", amount: 100 })]);
		await nextTick();
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^↔/);
	});

	it("shows tx date in meta", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ date: "2026-06-15" })]);
		await nextTick();
		expect(wrapper.find(".tx-row__meta").text()).toContain("2026-06-15");
	});

	it("shows comment when non-empty", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ comment: "lunch" })]);
		await nextTick();
		expect(wrapper.find(".tx-row__meta").text()).toContain("lunch");
	});

	it("does not show · separator when comment is empty", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ comment: "" })]);
		await nextTick();
		expect(wrapper.find(".tx-row__meta").text()).not.toContain("·");
	});
});

// ─── transactions sort ────────────────────────────────────────────────────────

describe("AccountDetailView – transactions sort", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("sorts by date descending", async () => {
		const { wrapper } = await mountView();
		const older = makeTx({ id: "t1", date: "2026-06-01", time: "10:00" });
		const newer = makeTx({ id: "t2", date: "2026-06-10", time: "10:00" });
		useTransactionsStore()._cache.set("2026-06", [older, newer]);
		await nextTick();
		const rows = wrapper.findAll(".tx-row__meta");
		expect(rows[0].text()).toContain("2026-06-10");
		expect(rows[1].text()).toContain("2026-06-01");
	});

	it("sorts by time descending when dates are equal", async () => {
		const { wrapper } = await mountView();
		const early = makeTx({ id: "t1", date: "2026-06-10", time: "08:00", amount: 111 });
		const late = makeTx({ id: "t2", date: "2026-06-10", time: "18:00", amount: 999 });
		useTransactionsStore()._cache.set("2026-06", [early, late]);
		await nextTick();
		const rows = wrapper.findAll(".tx-row__amount");
		expect(rows[0].text()).toContain("999");
		expect(rows[1].text()).toContain("111");
	});
});

// ─── category display ─────────────────────────────────────────────────────────

describe("AccountDetailView – category display", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("shows ↔ icon when categoryId is null", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ categoryId: null })]);
		await nextTick();
		expect(wrapper.find(".tx-row__icon").text()).toBe("↔");
	});

	it("shows 'Перевод' name when categoryId is null", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ categoryId: null })]);
		await nextTick();
		expect(wrapper.find(".tx-row__name").text()).toBe("Перевод");
	});

	it("shows category name when categoryId is set", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-1", name: "Food" })];
		useTransactionsStore()._cache.set("2026-06", [makeTx({ categoryId: "cat-1" })]);
		await nextTick();
		expect(wrapper.find(".tx-row__name").text()).toBe("Food");
	});

	it("shows first 2 chars of category icon when categoryId is set", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-1", icon: "AB_more" })];
		useTransactionsStore()._cache.set("2026-06", [makeTx({ categoryId: "cat-1" })]);
		await nextTick();
		expect(wrapper.find(".tx-row__icon").text()).toBe("AB");
	});
});

// ─── stats row ────────────────────────────────────────────────────────────────

describe("AccountDetailView – stats row", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("sums income amounts", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [
			makeTx({ id: "t1", type: "income", amount: 1000 }),
			makeTx({ id: "t2", type: "income", amount: 2000 })
		]);
		await nextTick();
		expect(wrapper.find(".text-income").text()).toContain("3");
	});

	it("sums expense amounts", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [
			makeTx({ id: "t1", type: "expense", amount: 500 }),
			makeTx({ id: "t2", type: "expense", amount: 500 })
		]);
		await nextTick();
		expect(wrapper.find(".text-expense").text()).toContain("1");
	});

	it("excludes transfers from income total", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "transfer", amount: 9999 })]);
		await nextTick();
		expect(wrapper.find(".text-income").text()).toContain("+0");
	});

	it("excludes transfers from expense total", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "transfer", amount: 9999 })]);
		await nextTick();
		expect(wrapper.find(".text-expense").text()).toContain("-0");
	});
});

// ─── archiveAccount ───────────────────────────────────────────────────────────

describe("AccountDetailView – archiveAccount", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("does not call deleteAccount when user cancels confirm", async () => {
		(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
		const deleteSpy = vi.spyOn(useAccountsStore(), "deleteAccount").mockImplementation(async () => {});
		const { wrapper } = await mountView();
		const archiveBtn = wrapper.findAll("button").find((b) => b.text().includes("Архивировать"));
		await archiveBtn!.trigger("click");
		await flushPromises();
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("calls deleteAccount with account id when user confirms", async () => {
		const deleteSpy = vi.spyOn(useAccountsStore(), "deleteAccount").mockImplementation(async () => {});
		const { wrapper } = await mountView();
		const archiveBtn = wrapper.findAll("button").find((b) => b.text().includes("Архивировать"));
		await archiveBtn!.trigger("click");
		await flushPromises();
		expect(deleteSpy).toHaveBeenCalledWith("acc-1");
	});

	it("calls router.back() after successful archive", async () => {
		vi.spyOn(useAccountsStore(), "deleteAccount").mockImplementation(async () => {});
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		const archiveBtn = wrapper.findAll("button").find((b) => b.text().includes("Архивировать"));
		await archiveBtn!.trigger("click");
		await flushPromises();
		expect(backSpy).toHaveBeenCalled();
	});
});

// ─── navigation ──────────────────────────────────────────────────────────────

describe("AccountDetailView – navigation", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useAccountsStore().accounts = [makeAccount()];
	});

	it("back button calls router.back()", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find(".back-btn").trigger("click");
		expect(backSpy).toHaveBeenCalled();
	});

	it("Добавить операцию button navigates to /transactions/add", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		const addBtn = wrapper.findAll("button").find((b) => b.text().includes("Добавить"));
		await addBtn!.trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/add");
	});

	it("clicking tx-row navigates to /transactions/:id", async () => {
		const { wrapper, router } = await mountView();
		useTransactionsStore()._cache.set("2026-06", [makeTx({ id: "tx-42" })]);
		await nextTick();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".tx-row").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-42");
	});
});
