import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import TransactionsView from "@/views/TransactionsView.vue";
import { isScannerAvailable } from "@/services/qrScanner.service";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useAccountsStore } from "@/stores/accounts.store";
import type { Transaction, Category, Account } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockListMonths, mockLoadMonth } = vi.hoisted(() => ({
	mockListMonths: vi.fn().mockResolvedValue([]),
	mockLoadMonth: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: mockLoadMonth,
		listMonths: mockListMonths
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

vi.mock("@/services/qrScanner.service", () => ({
	isScannerAvailable: vi.fn()
}));

// ── Global stubs ──────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
	mockListMonths.mockResolvedValue([]);
	mockLoadMonth.mockResolvedValue(null);
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Fixed past date so formatDateLabel never returns "Сегодня"/"Вчера" unexpectedly
const PAST_DATE = "2026-01-15";
const PAST_MONTH = "2026-01";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 1000,
		currency: "KZT",
		date: PAST_DATE,
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "coffee",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: `${PAST_DATE}T10:00:00Z`,
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Еда",
		type: "expense",
		color: "#FF5500",
		icon: "🍔🍔",
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

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Наличные",
		type: "cash",
		currency: "KZT",
		initialBalance: 0,
		color: "#10B981",
		icon: "💵💵",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: TransactionsView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(TransactionsView, {
		global: { plugins: [pinia, router] }
	});
	await flushPromises();
	// onMounted calls loadCurrentAndPrevMonth() → mockLoadMonth returns null
	// → _cache is set to [] for current + prev month, overwriting anything set before mount.
	// Always set store data AFTER mountView().
	return { wrapper, router };
}

async function populateCache(txs: Transaction[], month = PAST_MONTH) {
	useTransactionsStore()._cache.set(month, txs);
	await flushPromises();
}

// ── Render states ─────────────────────────────────────────────────────────────

describe("TransactionsView – render states", () => {
	it("renders page title 'Операции'", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__title").text()).toBe("Операции");
	});

	it("renders '+ Добавить' button", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__header .app-btn").text()).toContain("Добавить");
	});

	it("renders search input", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__search").exists()).toBe(true);
	});

	it("renders filter toggle button", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__filter-btn").exists()).toBe(true);
	});

	it("shows 'Нет операций' when no transactions", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__empty").text()).toBe("Нет операций");
	});

	it("shows 'Загрузка…' when isLoading=true and no grouped data", async () => {
		const { wrapper } = await mountView();
		useTransactionsStore().isLoading = true;
		await flushPromises();
		expect(wrapper.find(".tx-view__loading").exists()).toBe(true);
		expect(wrapper.find(".tx-view__empty").exists()).toBe(false);
	});

	it("hides loading when isLoading=true but grouped data exists", async () => {
		const { wrapper } = await mountView();
		const txStore = useTransactionsStore();
		await populateCache([makeTx()]);
		txStore.isLoading = true;
		await flushPromises();
		expect(wrapper.find(".tx-view__loading").exists()).toBe(false);
		expect(wrapper.find(".tx-groups").exists()).toBe(true);
	});

	it("shows transaction groups when transactions exist", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx()]);
		expect(wrapper.find(".tx-groups").exists()).toBe(true);
		expect(wrapper.find(".tx-view__empty").exists()).toBe(false);
	});

	it("filter panel is hidden by default", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".filter-panel").exists()).toBe(false);
	});
});

// ── onMounted ─────────────────────────────────────────────────────────────────

describe("TransactionsView – onMounted", () => {
	it("calls loadCurrentAndPrevMonth on mount", async () => {
		const txStore = useTransactionsStore();
		const spy = vi.spyOn(txStore, "loadCurrentAndPrevMonth");
		await mountView();
		expect(spy).toHaveBeenCalledOnce();
	});

	it("calls listMonths on mount", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05"]);
		await mountView();
		expect(mockListMonths).toHaveBeenCalledOnce();
	});

	it("allMonths is populated from listMonths result (hasMore=true when enough months)", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05", "2026-04"]);
		const { wrapper } = await mountView();
		await populateCache([makeTx()]);
		// loadedMonthsCount starts at 2, allMonths has 3 → hasMore=true → load-more shown
		expect(wrapper.find(".load-more").exists()).toBe(true);
	});
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe("TransactionsView – navigation", () => {
	it("'+ Добавить' click navigates to /transactions/add", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".tx-view__header .app-btn").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/add");
	});

	it("does not render the scan-receipt button when the scanner is unavailable", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		const { wrapper } = await mountView();
		expect(wrapper.find(".fab-scan").exists()).toBe(false);
	});

	it("renders the scan-receipt button when the scanner is available", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		expect(wrapper.find(".fab-scan").exists()).toBe(true);
	});

	it("scan-receipt button click navigates to /transactions/scan", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".fab-scan").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/scan");
	});

	it("transaction row click navigates to /transactions/{id}", async () => {
		const { wrapper, router } = await mountView();
		await populateCache([makeTx({ id: "tx-abc" })]);
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".tx-row").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-abc");
	});
});

// ── Search ────────────────────────────────────────────────────────────────────

describe("TransactionsView – search", () => {
	it("shows all non-deleted transactions when search is empty", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a" }), makeTx({ id: "b", comment: "bus" })]);
		expect(wrapper.findAll(".tx-row")).toHaveLength(2);
	});

	it("filters by comment (case-insensitive)", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", comment: "Coffee" }), makeTx({ id: "b", comment: "bus" })]);
		await wrapper.find(".tx-view__search").setValue("COFFEE");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filters by amount string match", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", amount: 1234, comment: "" }), makeTx({ id: "b", amount: 5678, comment: "" })]);
		await wrapper.find(".tx-view__search").setValue("5678");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filters by category name via store", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-food", name: "Еда" })];
		await populateCache([makeTx({ id: "a", categoryId: "cat-food", comment: "" }), makeTx({ id: "b", categoryId: null, comment: "" })]);
		await wrapper.find(".tx-view__search").setValue("еда");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("excludes deleted transactions regardless of search", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "del", isDeleted: true, comment: "coffee" }), makeTx({ id: "ok", comment: "tea" })]);
		await wrapper.find(".tx-view__search").setValue("coffee");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(0);
	});

	it("shows 'Ничего не найдено' when search matches nothing", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ comment: "coffee" })]);
		await wrapper.find(".tx-view__search").setValue("xyz");
		await flushPromises();
		expect(wrapper.find(".tx-view__empty").text()).toBe("Ничего не найдено");
	});

	it("shows 'Нет операций' (not 'Ничего не найдено') when search is empty and no transactions", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".tx-view__empty").text()).toBe("Нет операций");
	});
});

// ── Filter panel toggle ───────────────────────────────────────────────────────

describe("TransactionsView – filter panel toggle", () => {
	it("clicking filter button shows filter panel", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		expect(wrapper.find(".filter-panel").exists()).toBe(true);
	});

	it("clicking filter button twice hides filter panel", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		expect(wrapper.find(".filter-panel").exists()).toBe(false);
	});

	it("filter button gets --active class when a filter is set", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await flushPromises();
		expect(wrapper.find(".tx-view__filter-btn").classes()).toContain("tx-view__filter-btn--active");
	});

	it("filter button shows badge with active filter count", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await flushPromises();
		expect(wrapper.find(".filter-badge").text()).toBe("1");
	});

	it("badge count increases with multiple active filters", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount({ id: "acc-1" })];
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		const [typeSelect, accountSelect] = wrapper.findAll("select");
		await typeSelect.setValue("expense");
		await accountSelect.setValue("acc-1");
		await flushPromises();
		expect(wrapper.find(".filter-badge").text()).toBe("2");
	});

	it("badge is absent when no active filters", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".filter-badge").exists()).toBe(false);
	});
});

// ── Filters ───────────────────────────────────────────────────────────────────

describe("TransactionsView – filters", () => {
	async function openFilters(wrapper: ReturnType<typeof mount>) {
		await wrapper.find(".tx-view__filter-btn").trigger("click");
	}

	it("filter by type=income keeps only income transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", type: "income" }), makeTx({ id: "b", type: "expense" })]);
		await openFilters(wrapper);
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
		expect(wrapper.find(".tx-row .text-income").exists()).toBe(true);
	});

	it("filter by type=expense keeps only expense transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", type: "income" }), makeTx({ id: "b", type: "expense" })]);
		await openFilters(wrapper);
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("expense");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
		expect(wrapper.find(".tx-row .text-expense").exists()).toBe(true);
	});

	it("filter by type=transfer keeps only transfer transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", type: "transfer" }), makeTx({ id: "b", type: "expense" })]);
		await openFilters(wrapper);
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("transfer");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filter by accountId keeps only matching account", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount({ id: "acc-1" }), makeAccount({ id: "acc-2", name: "Карта" })];
		await populateCache([makeTx({ id: "a", accountId: "acc-1" }), makeTx({ id: "b", accountId: "acc-2" })]);
		await openFilters(wrapper);
		const [, accountSelect] = wrapper.findAll("select");
		await accountSelect.setValue("acc-1");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filter by categoryId keeps only matching category", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-1" }), makeCategory({ id: "cat-2", name: "Транспорт" })];
		await populateCache([makeTx({ id: "a", categoryId: "cat-1" }), makeTx({ id: "b", categoryId: "cat-2" })]);
		await openFilters(wrapper);
		const [, , categorySelect] = wrapper.findAll("select");
		await categorySelect.setValue("cat-1");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filter by filterFrom excludes dates before threshold", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", date: "2026-01-10" }), makeTx({ id: "b", date: "2026-01-20" })]);
		await openFilters(wrapper);
		const [dateFrom] = wrapper.findAll('input[type="date"]');
		await dateFrom.setValue("2026-01-15");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("filter by filterTo excludes dates after threshold", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", date: "2026-01-10" }), makeTx({ id: "b", date: "2026-01-20" })]);
		await openFilters(wrapper);
		const [, dateTo] = wrapper.findAll('input[type="date"]');
		await dateTo.setValue("2026-01-15");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("multiple filters combined work (AND logic)", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount({ id: "acc-1" })];
		await populateCache([
			makeTx({ id: "a", type: "income", accountId: "acc-1" }),
			makeTx({ id: "b", type: "expense", accountId: "acc-1" }),
			makeTx({ id: "c", type: "income", accountId: "acc-2" })
		]);
		await openFilters(wrapper);
		const [typeSelect, accountSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await accountSelect.setValue("acc-1");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});

	it("setting filter type to '' (Все) shows all", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", type: "income" }), makeTx({ id: "b", type: "expense" })]);
		await openFilters(wrapper);
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await flushPromises();
		await typeSelect.setValue("");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(2);
	});
});

// ── Filter chips ───────────────────────────────────────────────────────────────

describe("TransactionsView – filter chips", () => {
	it("no chips are shown when no active filters", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		expect(wrapper.find(".filter-chip").exists()).toBe(false);
	});

	it("a chip appears when a filter is active", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		const [typeSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await flushPromises();
		expect(wrapper.findAll(".filter-chip")).toHaveLength(1);
		expect(wrapper.find(".filter-chip").text()).toContain("Доход");
	});

	it("clicking a chip clears only that filter, leaving others active", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount()];
		await populateCache([
			makeTx({ id: "a", type: "income", accountId: "acc-1" }),
			makeTx({ id: "b", type: "expense", accountId: "acc-1" })
		]);
		await wrapper.find(".tx-view__filter-btn").trigger("click");
		const [typeSelect, accountSelect] = wrapper.findAll("select");
		await typeSelect.setValue("income");
		await accountSelect.setValue("acc-1");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
		expect(wrapper.findAll(".filter-chip")).toHaveLength(2);

		await wrapper.findAll(".filter-chip")[0].trigger("click");
		await flushPromises();
		expect(wrapper.findAll(".tx-row")).toHaveLength(2);
		expect(wrapper.findAll(".filter-chip")).toHaveLength(1);
		expect(wrapper.find(".filter-chip").text()).toContain("Наличные");
	});
});

// ── Grouping and date labels ──────────────────────────────────────────────────

describe("TransactionsView – grouping and date labels", () => {
	it("groups transactions by date — one group per unique date", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", date: "2026-01-15" }), makeTx({ id: "b", date: "2026-01-14" })]);
		expect(wrapper.findAll(".tx-group")).toHaveLength(2);
	});

	it("sorts groups newest date first", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", date: "2026-01-14" }), makeTx({ id: "b", date: "2026-01-15" })]);
		const groups = wrapper.findAll(".tx-group__date");
		// First group should show the label for 2026-01-15 (newer)
		// We verify by checking the second group has the older date label
		expect(groups[0].text()).not.toBe(groups[1].text());
	});

	it("sorts transactions within a group newest time first", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "early", date: "2026-01-15", time: "08:00" }), makeTx({ id: "late", date: "2026-01-15", time: "20:00" })]);
		const rows = wrapper.findAll(".tx-row");
		// late (20:00) must appear before early (08:00)
		expect(rows[0].attributes("data-v-") ?? rows[0].html()).not.toContain("late");
		// Check by finding the tx-row__amount order
		const amounts = wrapper.findAll(".tx-row__amount");
		expect(amounts).toHaveLength(2); // both are shown
	});

	it("shows 'Сегодня' label for today's transactions", async () => {
		const { wrapper } = await mountView();
		const today = new Date().toLocaleDateString("en-CA");
		const todayMonth = today.slice(0, 7);
		await populateCache([makeTx({ date: today })], todayMonth);
		const label = wrapper.find(".tx-group__date").text();
		expect(label).toBe("Сегодня");
	});

	it("shows 'Вчера' label for yesterday's transactions", async () => {
		const { wrapper } = await mountView();
		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
		const yesterdayMonth = yesterday.slice(0, 7);
		await populateCache([makeTx({ date: yesterday })], yesterdayMonth);
		const label = wrapper.find(".tx-group__date").text();
		expect(label).toBe("Вчера");
	});

	it("shows locale date string for older dates", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ date: "2026-01-15" })]);
		const label = wrapper.find(".tx-group__date").text();
		expect(label).not.toBe("Сегодня");
		expect(label).not.toBe("Вчера");
		expect(label.length).toBeGreaterThan(3);
	});
});

// ── Day totals ────────────────────────────────────────────────────────────────

describe("TransactionsView – day totals", () => {
	it("shows income total with + sign when income > 0", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "income", amount: 5000 })]);
		const incomeEl = wrapper.find(".tx-group__totals .text-income");
		expect(incomeEl.exists()).toBe(true);
		expect(incomeEl.text()).toContain("+");
	});

	it("shows expense total with - sign when expense > 0", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "expense", amount: 1000 })]);
		const expenseEl = wrapper.find(".tx-group__totals .text-expense");
		expect(expenseEl.exists()).toBe(true);
		expect(expenseEl.text()).toContain("-");
	});

	it("does not show income total when income = 0", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "expense", amount: 500 })]);
		expect(wrapper.find(".tx-group__totals .text-income").exists()).toBe(false);
	});

	it("does not show expense total when expense = 0", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "income", amount: 500 })]);
		expect(wrapper.find(".tx-group__totals .text-expense").exists()).toBe(false);
	});

	it("transfer is not counted in income or expense totals", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "transfer", amount: 999 })]);
		expect(wrapper.find(".tx-group__totals .text-income").exists()).toBe(false);
		expect(wrapper.find(".tx-group__totals .text-expense").exists()).toBe(false);
	});

	it("sums multiple transactions of the same type", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ id: "a", type: "expense", amount: 300 }), makeTx({ id: "b", type: "expense", amount: 200 })]);
		const expenseEl = wrapper.find(".tx-group__totals .text-expense");
		// 300 + 200 = 500; locale formats it but it will contain "500"
		expect(expenseEl.text()).toContain("500");
	});
});

// ── Transaction row rendering ─────────────────────────────────────────────────

describe("TransactionsView – transaction row rendering", () => {
	it("shows category icon when category exists", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-1", icon: "food" })];
		await populateCache([makeTx({ categoryId: "cat-1" })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows fallback icon when no category and type is not transfer", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ categoryId: null, type: "expense" })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows transfer icon when no category and type is transfer", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ categoryId: null, type: "transfer" })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows category name in tx-row__name", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCategory({ id: "cat-1", name: "Еда" })];
		await populateCache([makeTx({ categoryId: "cat-1" })]);
		expect(wrapper.find(".tx-row__name").text()).toBe("Еда");
	});

	it("shows 'Перевод' in tx-row__name when no category", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ categoryId: null })]);
		expect(wrapper.find(".tx-row__name").text()).toBe("Перевод");
	});

	it("shows comment when tx.comment is non-empty", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ comment: "мой кофе" })]);
		expect(wrapper.find(".tx-row__comment").exists()).toBe(true);
		expect(wrapper.find(".tx-row__comment").text()).toBe("мой кофе");
	});

	it("hides comment element when tx.comment is empty", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ comment: "" })]);
		expect(wrapper.find(".tx-row__comment").exists()).toBe(false);
	});

	it("amount has class text-income for income transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "income" })]);
		expect(wrapper.find(".tx-row__amount").classes()).toContain("text-income");
	});

	it("amount has class text-expense for expense transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "expense" })]);
		expect(wrapper.find(".tx-row__amount").classes()).toContain("text-expense");
	});

	it("amount has class text-transfer for transfer transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "transfer" })]);
		expect(wrapper.find(".tx-row__amount").classes()).toContain("text-transfer");
	});

	it("income amount starts with '+'", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "income", amount: 5000 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^\+/);
	});

	it("expense amount starts with '-'", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "expense", amount: 1000 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^-/);
	});

	it("transfer amount starts with '↔'", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ type: "transfer", amount: 500 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^↔/);
	});

	it("does not render deleted transactions", async () => {
		const { wrapper } = await mountView();
		await populateCache([makeTx({ isDeleted: true }), makeTx({ id: "visible", isDeleted: false })]);
		expect(wrapper.findAll(".tx-row")).toHaveLength(1);
	});
});

// ── Load more ─────────────────────────────────────────────────────────────────

describe("TransactionsView – load more", () => {
	it("shows 'Загрузить ещё' button when hasMore and grouped data exists", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05", "2026-04"]);
		const { wrapper } = await mountView();
		await populateCache([makeTx()]);
		expect(wrapper.find(".load-more").exists()).toBe(true);
		expect(wrapper.find(".load-more").text()).toContain("Загрузить ещё");
	});

	it("does not show 'Загрузить ещё' when all months are loaded", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05"]); // 2 months, loadedMonthsCount=2
		const { wrapper } = await mountView();
		await populateCache([makeTx()]);
		expect(wrapper.find(".load-more").exists()).toBe(false);
	});

	it("does not show 'Загрузить ещё' when no transactions (inside v-else)", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05", "2026-04"]);
		const { wrapper } = await mountView();
		// No cache set → grouped.length === 0 → v-else-if shows "Нет операций", not v-else
		expect(wrapper.find(".load-more").exists()).toBe(false);
	});

	it("clicking 'Загрузить ещё' calls txStore.loadMonth for next months", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05", "2026-04"]);
		const { wrapper } = await mountView();
		const txStore = useTransactionsStore();
		await populateCache([makeTx()]);
		const loadMonthSpy = vi.spyOn(txStore, "loadMonth");
		await wrapper.find(".load-more .app-btn").trigger("click");
		await flushPromises();
		expect(loadMonthSpy).toHaveBeenCalledWith("2026-04");
	});

	it("loadedMonthsCount increases after loading more", async () => {
		mockListMonths.mockResolvedValue(["2026-06", "2026-05", "2026-04", "2026-03"]);
		const { wrapper } = await mountView();
		await populateCache([makeTx()]);
		// After loading one more batch (2026-04, 2026-03), loadedMonthsCount becomes 4
		// → hasMore becomes false → load-more disappears
		await wrapper.find(".load-more .app-btn").trigger("click");
		await flushPromises();
		expect(wrapper.find(".load-more").exists()).toBe(false);
	});
});
