import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { nextTick } from "vue";
import DashboardView from "@/views/DashboardView.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { Transaction, Account, Category } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockLoadMonth } = vi.hoisted(() => ({
	mockLoadMonth: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: mockLoadMonth,
		listMonths: vi.fn().mockResolvedValue([])
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

// ── Globals ───────────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
	mockLoadMonth.mockResolvedValue(null);
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MONTH = "2026-06";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 1000,
		currency: "KZT",
		date: "2026-06-01",
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-01T10:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Основной",
		type: "bank",
		currency: "KZT",
		initialBalance: 0,
		color: "#7C3AED",
		icon: "bank",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeCat(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Еда",
		type: "expense",
		color: "#FF0000",
		icon: "AB",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: DashboardView },
			{ path: "/transactions/add", component: { template: "<div/>" } },
			{ path: "/transactions", component: { template: "<div/>" } },
			{ path: "/transactions/:id", component: { template: "<div/>" } }
		]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(DashboardView, {
		global: { plugins: [pinia, router] }
	});
	await flushPromises();
	return { wrapper, router };
}

async function setCache(month: string, txs: Transaction[]) {
	useTransactionsStore()._cache.set(month, txs);
	await nextTick();
}

// ── Pure function tests (extracted logic) ───────────────────────────────────

function formatAmount(tx: { type: string; amount: number }): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

function formatCurrency(amount: number): string {
	return amount.toLocaleString("ru-RU");
}

function formatDate(date: string): string {
	const today = new Date().toLocaleDateString("en-CA");
	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
	if (date === today) return "Сегодня";
	if (date === yesterday) return "Вчера";
	const d = new Date(date);
	return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

describe("DashboardView – formatAmount", () => {
	it("income → + prefix", () => {
		expect(formatAmount({ type: "income", amount: 5000 })).toMatch(/^\+/);
	});

	it("expense → - prefix", () => {
		expect(formatAmount({ type: "expense", amount: 1000 })).toMatch(/^-/);
	});

	it("transfer → ↔ prefix", () => {
		expect(formatAmount({ type: "transfer", amount: 200 })).toMatch(/^↔/);
	});

	it("amount is formatted with locale ru-RU", () => {
		const result = formatAmount({ type: "income", amount: 1500 });
		expect(result).toContain("500");
	});
});

describe("DashboardView – formatCurrency", () => {
	it("formats 0 as 0", () => expect(formatCurrency(0)).toBe("0"));
	it("formats 1000 with thousands separator", () => {
		const s = formatCurrency(1000);
		expect(s).toContain("1");
		expect(s).toContain("000");
	});
});

describe("DashboardView – formatDate", () => {
	it("returns Сегодня for today", () => {
		const today = new Date().toLocaleDateString("en-CA");
		expect(formatDate(today)).toBe("Сегодня");
	});

	it("returns Вчера for yesterday", () => {
		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
		expect(formatDate(yesterday)).toBe("Вчера");
	});

	it("returns locale date for older dates", () => {
		const result = formatDate("2025-01-15");
		expect(result).not.toBe("Сегодня");
		expect(result).not.toBe("Вчера");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("DashboardView – savingsRate (pure logic)", () => {
	function savingsRate(income: number, expenses: number): number {
		if (income === 0) return 0;
		return Math.round(((income - expenses) / income) * 100);
	}

	it("0 when income is 0", () => expect(savingsRate(0, 0)).toBe(0));
	it("0 when income is 0 with expenses", () => expect(savingsRate(0, 500)).toBe(0));
	it("100 when expenses is 0", () => expect(savingsRate(1000, 0)).toBe(100));
	it("50 when expenses = income / 2", () => expect(savingsRate(1000, 500)).toBe(50));
	it("negative when expenses > income", () => expect(savingsRate(500, 1000)).toBe(-100));
	it("rounds to nearest integer", () => expect(savingsRate(1000, 333)).toBe(67));
});

describe("DashboardView – recentTransactions (pure logic)", () => {
	type Tx = { date: string; time: string; id: string };

	function recentTransactions(txs: Tx[]): Tx[] {
		return [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5);
	}

	it("returns at most 5", () => {
		const txs = Array.from({ length: 10 }, (_, i) => ({
			date: "2026-06-01",
			time: `0${i}:00`,
			id: `t${i}`
		}));
		expect(recentTransactions(txs)).toHaveLength(5);
	});

	it("sorts by date descending", () => {
		const txs = [
			{ date: "2026-06-01", time: "10:00", id: "a" },
			{ date: "2026-06-03", time: "10:00", id: "b" },
			{ date: "2026-06-02", time: "10:00", id: "c" }
		];
		const result = recentTransactions(txs);
		expect(result[0].id).toBe("b");
		expect(result[1].id).toBe("c");
		expect(result[2].id).toBe("a");
	});

	it("same date sorts by time descending", () => {
		const txs = [
			{ date: "2026-06-01", time: "09:00", id: "a" },
			{ date: "2026-06-01", time: "15:00", id: "b" }
		];
		const result = recentTransactions(txs);
		expect(result[0].id).toBe("b");
	});

	it("returns all when fewer than 5", () => {
		const txs = [{ date: "2026-06-01", time: "10:00", id: "a" }];
		expect(recentTransactions(txs)).toHaveLength(1);
	});

	it("empty array returns empty", () => {
		expect(recentTransactions([])).toHaveLength(0);
	});
});

// ── Component: rendering ──────────────────────────────────────────────────────

describe("DashboardView – rendering", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("renders .dashboard container", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".dashboard").exists()).toBe(true);
	});

	it("shows Общий баланс label", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".dashboard__balance-label").text()).toBe("Общий баланс");
	});

	it("shows Добавить button", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".app-btn").text()).toContain("Добавить");
	});

	it("calls loadCurrentAndPrevMonth on mount (2 months loaded)", async () => {
		await mountView();
		expect(mockLoadMonth).toHaveBeenCalledTimes(2);
		expect(mockLoadMonth).toHaveBeenCalledWith(MONTH);
	});

	it("renders 3 summary cards", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".summary-card")).toHaveLength(3);
	});

	it("renders Последние операции section header", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".section-header__title").text()).toBe("Последние операции");
	});
});

// ── Component: totalBalance ───────────────────────────────────────────────────

describe("DashboardView – totalBalance", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("shows 0 with no accounts", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".dashboard__balance").text()).toBe("0");
	});

	it("shows initialBalance of a single active account (no transactions)", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount({ id: "a1", initialBalance: 3000 })];
		await nextTick();
		expect(wrapper.find(".dashboard__balance").text()).toContain("3");
	});

	it("sums balances of multiple active accounts", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [makeAccount({ id: "a1", initialBalance: 1000 }), makeAccount({ id: "a2", initialBalance: 2000 })];
		await nextTick();
		// 3000 in ru-RU locale → "3 000"
		expect(wrapper.find(".dashboard__balance").text()).toContain("3");
	});

	it("excludes archived accounts from total", async () => {
		const { wrapper } = await mountView();
		useAccountsStore().accounts = [
			makeAccount({ id: "a1", initialBalance: 500 }),
			makeAccount({ id: "a2", initialBalance: 99999, isArchived: true })
		];
		await nextTick();
		expect(wrapper.find(".dashboard__balance").text()).not.toContain("99999");
	});
});

// ── Component: summary cards ──────────────────────────────────────────────────

describe("DashboardView – summary cards", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("income card shows month income total", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 50000 })]);
		expect(wrapper.findAll(".summary-card")[0].find(".summary-card__value").text()).toContain("50");
	});

	it("expense card shows month expense total", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 12000 })]);
		expect(wrapper.findAll(".summary-card")[1].find(".summary-card__value").text()).toContain("12");
	});

	it("savings rate shows 0% when no income", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, []);
		expect(wrapper.findAll(".summary-card")[2].find(".summary-card__value").text()).toBe("0%");
	});

	it("savings rate card has text-income class when rate >= 0", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 5000 })]);
		expect(wrapper.findAll(".summary-card")[2].find(".summary-card__value").classes()).toContain("text-income");
	});

	it("savings rate card has text-expense class when rate < 0", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 1000 }), makeTx({ id: "e1", type: "expense", amount: 5000 })]);
		expect(wrapper.findAll(".summary-card")[2].find(".summary-card__value").classes()).toContain("text-expense");
	});
});

// ── Component: streak banner ──────────────────────────────────────────────────

describe("DashboardView – streak banner", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("hidden when currentStreak === 0", async () => {
		const { wrapper } = await mountView();
		// checkDailyStreak returns early when lastLoggedDate is null → streak stays 0
		expect(wrapper.find(".streak-banner").exists()).toBe(false);
	});

	it("shown when currentStreak > 0", async () => {
		const { wrapper } = await mountView();
		useGamificationStore().state.currentStreak = 5;
		await nextTick();
		expect(wrapper.find(".streak-banner").exists()).toBe(true);
	});

	it("shows streak count in days", async () => {
		const { wrapper } = await mountView();
		useGamificationStore().state.currentStreak = 7;
		await nextTick();
		expect(wrapper.find(".streak-banner__count").text()).toContain("7");
	});

	it("shows XP in banner label", async () => {
		const { wrapper } = await mountView();
		useGamificationStore().state.currentStreak = 3;
		useGamificationStore().state.xp = 150;
		await nextTick();
		expect(wrapper.find(".streak-banner__label").text()).toContain("150");
	});
});

// ── Component: recent transactions – empty state ──────────────────────────────

describe("DashboardView – recent transactions empty state", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("shows empty state and hides list when no transactions", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, []);
		expect(wrapper.find(".dashboard__empty").exists()).toBe(true);
		expect(wrapper.find(".tx-list").exists()).toBe(false);
	});
});

// ── Component: recent transactions – list ─────────────────────────────────────

describe("DashboardView – recent transactions list", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("shows tx-list and hides empty state when transactions exist", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx()]);
		expect(wrapper.find(".tx-list").exists()).toBe(true);
		expect(wrapper.find(".dashboard__empty").exists()).toBe(false);
	});

	it("renders at most 5 rows", async () => {
		const { wrapper } = await mountView();
		const txs = Array.from({ length: 8 }, (_, i) => makeTx({ id: `t${i}` }));
		await setCache(MONTH, txs);
		expect(wrapper.findAll(".tx-row")).toHaveLength(5);
	});

	it("shows category icon when category found", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", icon: "food" })];
		await setCache(MONTH, [makeTx({ categoryId: "cat-1" })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows fallback icon when categoryId is null", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ categoryId: null })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows fallback icon when category not found", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ categoryId: "ghost" })]);
		expect(wrapper.find(".tx-row__icon svg").exists()).toBe(true);
	});

	it("shows category name when category found", async () => {
		const { wrapper } = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", name: "Транспорт" })];
		await setCache(MONTH, [makeTx({ categoryId: "cat-1" })]);
		expect(wrapper.find(".tx-row__name").text()).toBe("Транспорт");
	});

	it("shows Перевод when categoryId is null", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ categoryId: null })]);
		expect(wrapper.find(".tx-row__name").text()).toBe("Перевод");
	});

	it("shows Перевод when category not found", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ categoryId: "ghost" })]);
		expect(wrapper.find(".tx-row__name").text()).toBe("Перевод");
	});

	it("shows comment when present", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ comment: "Обед с коллегами" })]);
		expect(wrapper.find(".tx-row__meta").text()).toBe("Обед с коллегами");
	});

	it("shows Сегодня when comment is empty and date is today", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ comment: "", date: "2026-06-15" })]);
		expect(wrapper.find(".tx-row__meta").text()).toBe("Сегодня");
	});

	it("shows Вчера when comment is empty and date is yesterday", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ comment: "", date: "2026-06-14" })]);
		expect(wrapper.find(".tx-row__meta").text()).toBe("Вчера");
	});

	it("amount has + prefix for income", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ type: "income", amount: 1000 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^\+/);
	});

	it("amount has - prefix for expense", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ type: "expense", amount: 1000 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^-/);
	});

	it("amount element has text-income class for income", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ type: "income" })]);
		expect(wrapper.find(".tx-row__amount").classes()).toContain("text-income");
	});

	it("amount element has text-expense class for expense", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ type: "expense" })]);
		expect(wrapper.find(".tx-row__amount").classes()).toContain("text-expense");
	});

	it("amount has ↔ prefix for transfer", async () => {
		const { wrapper } = await mountView();
		await setCache(MONTH, [makeTx({ type: "transfer", amount: 500 })]);
		expect(wrapper.find(".tx-row__amount").text()).toMatch(/^↔/);
	});
});

// ── Component: navigation ─────────────────────────────────────────────────────

describe("DashboardView – navigation", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("Добавить button navigates to /transactions/add", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".app-btn").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/add");
	});

	it("Все → button navigates to /transactions", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".section-header__link").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions");
	});

	it("clicking tx row navigates to /transactions/:id", async () => {
		const { wrapper, router } = await mountView();
		await setCache(MONTH, [makeTx({ id: "tx-999" })]);
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find(".tx-row").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-999");
	});
});
