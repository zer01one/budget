import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import BudgetsView from "@/views/BudgetsView.vue";
import { useBudgetsStore } from "@/stores/budgets.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { BudgetEntry, Category, Transaction } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockNotify } = vi.hoisted(() => ({ mockNotify: vi.fn() }));

vi.mock("@/services/notifications.service", () => ({
	notifyBudgetWarning: mockNotify
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: vi.fn().mockResolvedValue(null)
	}
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

const mockShowConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/utils/confirm", () => ({ showConfirm: mockShowConfirm }));

// ── Global stubs ──────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
});

// ── Constants & fixtures ──────────────────────────────────────────────────────

const CURRENT_MONTH = new Date().toLocaleDateString("en-CA").slice(0, 7);
const [CY, CM] = CURRENT_MONTH.split("-").map(Number);
const PREV_MONTH = new Date(CY, CM - 2).toLocaleDateString("en-CA").slice(0, 7);

function makeBudget(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
	return {
		id: "b-1",
		categoryId: "cat-1",
		month: CURRENT_MONTH,
		limitAmount: 50_000,
		currency: "KZT",
		notifyAt: 80,
		notifyEnabled: true,
		updatedAt: "2026-06-01T00:00:00Z",
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
		icon: "🍔",
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

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 10_000,
		currency: "KZT",
		date: `${CURRENT_MONTH}-10`,
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: `${CURRENT_MONTH}-10T10:00:00Z`,
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────
// AppModal uses <Teleport to="body">. Stub teleport to render content in-place
// so wrapper.find() can locate modal elements without querying document.body.

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
});

const TELEPORT_STUB = { template: "<div><slot/></div>" };

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: BudgetsView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(BudgetsView, {
		global: {
			plugins: [pinia, router],
			stubs: { teleport: TELEPORT_STUB }
		}
	});
	await flushPromises();
	// NOTE: onMounted calls txStore.loadCurrentAndPrevMonth() which mocks loadMonth → null,
	// causing _cache.set(month, []) and overwriting any cache set before mount.
	// Set transaction cache AFTER mountView() for tests that need spend data.
	return wrapper;
}

// ── Render states ─────────────────────────────────────────────────────────────

describe("BudgetsView – render states", () => {
	it("shows empty state when no budgets", async () => {
		const wrapper = await mountView();
		expect(wrapper.find(".empty").exists()).toBe(true);
		expect(wrapper.text()).toContain("Нет бюджетов на этот месяц");
		expect(wrapper.find(".budget-list").exists()).toBe(false);
		expect(wrapper.find(".overview").exists()).toBe(false);
	});

	it("shows budget card and overview when budgets exist", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		expect(wrapper.find(".budget-card").exists()).toBe(true);
		expect(wrapper.find(".overview").exists()).toBe(true);
		expect(wrapper.find(".empty").exists()).toBe(false);
	});

	it("shows category name and icon in budget card", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		expect(wrapper.find(".budget-card__cat-name").text()).toContain("Еда");
		expect(wrapper.find(".budget-card__cat-icon svg").exists()).toBe(true);
	});

	it("falls back to '—' for unknown category", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		const wrapper = await mountView();
		expect(wrapper.find(".budget-card__cat-name").text()).toBe("—");
	});

	it("shows 'Остаток' when spent is zero (under limit)", async () => {
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000 })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		// _cache cleared by loadCurrentAndPrevMonth → spent=0 < 50000 → Остаток
		expect(wrapper.find(".budget-card__remaining").text()).toContain("Остаток");
	});

	it("shows 'Превышен на' when spent exceeds limit", async () => {
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 5_000 })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 10_000 })]);
		await flushPromises();
		expect(wrapper.find(".budget-card__remaining").text()).toContain("Превышен на");
	});

	it("overview numbers reflect totalSpent and totalBudgeted", async () => {
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000 })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 20_000 })]);
		await flushPromises();
		const overview = wrapper.find(".overview__numbers");
		expect(overview.text()).toContain("20");
		expect(overview.text()).toContain("50");
	});

	it("renders multiple budget cards for same month", async () => {
		useBudgetsStore().budgets = [makeBudget({ id: "b-1", categoryId: "cat-1" }), makeBudget({ id: "b-2", categoryId: "cat-2" })];
		useCategoriesStore().categories = [makeCategory(), makeCategory({ id: "cat-2", name: "Транспорт" })];
		const wrapper = await mountView();
		expect(wrapper.findAll(".budget-card")).toHaveLength(2);
	});
});

// ── Month navigation ──────────────────────────────────────────────────────────

describe("BudgetsView – month navigation", () => {
	it("initialises on current month label", async () => {
		const wrapper = await mountView();
		expect(wrapper.find(".month-nav__label").text()).toMatch(/2026/);
	});

	it("next button is disabled on current month", async () => {
		const wrapper = await mountView();
		const [, nextBtn] = wrapper.findAll(".month-nav__btn");
		expect(nextBtn.attributes("disabled")).toBeDefined();
	});

	it("prev button navigates back one month", async () => {
		const wrapper = await mountView();
		const labelBefore = wrapper.find(".month-nav__label").text();
		await wrapper.findAll(".month-nav__btn")[0].trigger("click");
		expect(wrapper.find(".month-nav__label").text()).not.toBe(labelBefore);
	});

	it("next button becomes enabled after going to a past month", async () => {
		const wrapper = await mountView();
		const [prevBtn, nextBtn] = wrapper.findAll(".month-nav__btn");
		await prevBtn.trigger("click");
		expect(nextBtn.attributes("disabled")).toBeUndefined();
	});

	it("next from a past month advances the label", async () => {
		const wrapper = await mountView();
		const [prevBtn, nextBtn] = wrapper.findAll(".month-nav__btn");
		await prevBtn.trigger("click");
		const labelAtPrev = wrapper.find(".month-nav__label").text();
		await nextBtn.trigger("click");
		expect(wrapper.find(".month-nav__label").text()).not.toBe(labelAtPrev);
	});

	it("cannot advance past current month", async () => {
		const wrapper = await mountView();
		const [prevBtn, nextBtn] = wrapper.findAll(".month-nav__btn");
		const currentLabel = wrapper.find(".month-nav__label").text();
		await prevBtn.trigger("click");
		await nextBtn.trigger("click");
		expect(wrapper.find(".month-nav__label").text()).toBe(currentLabel);
		expect(nextBtn.attributes("disabled")).toBeDefined();
	});

	it("switching month filters budget cards to that month only", async () => {
		useBudgetsStore().budgets = [makeBudget({ id: "b-cur", month: CURRENT_MONTH }), makeBudget({ id: "b-prev", month: PREV_MONTH })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		expect(wrapper.findAll(".budget-card")).toHaveLength(1);
		await wrapper.findAll(".month-nav__btn")[0].trigger("click");
		expect(wrapper.findAll(".budget-card")).toHaveLength(1);
	});
});

// ── Add budget ────────────────────────────────────────────────────────────────

describe("BudgetsView – add budget", () => {
	it("add button disabled when no expense categories", async () => {
		const wrapper = await mountView();
		expect(wrapper.find(".budgets-view__header button").attributes("disabled")).toBeDefined();
	});

	it("add button disabled when all categories already have budgets", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()]; // cat-1 already budgeted
		const wrapper = await mountView();
		expect(wrapper.find(".budgets-view__header button").attributes("disabled")).toBeDefined();
	});

	it("add button enabled when a free expense category exists", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		expect(wrapper.find(".budgets-view__header button").attributes("disabled")).toBeUndefined();
	});

	it("archived categories are not counted as available", async () => {
		useCategoriesStore().categories = [makeCategory({ isArchived: true })];
		const wrapper = await mountView();
		expect(wrapper.find(".budgets-view__header button").attributes("disabled")).toBeDefined();
	});

	it("income categories are not available for budgets", async () => {
		useCategoriesStore().categories = [makeCategory({ type: "income" })];
		const wrapper = await mountView();
		expect(wrapper.find(".budgets-view__header button").attributes("disabled")).toBeDefined();
	});

	it("clicking add opens modal with category selector", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".modal-form").exists()).toBe(true);
		expect(wrapper.find("select").exists()).toBe(true);
		expect(wrapper.find(".budget-preview").exists()).toBe(false);
	});

	it("cancel closes modal without saving", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		const cancelBtn = wrapper.findAll("button").find((b) => b.text() === "Отмена")!;
		await cancelBtn.trigger("click");
		expect(wrapper.find(".modal-form").exists()).toBe(false);
	});

	it("empty limit shows validation error", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Создать")!
			.trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
		expect(wrapper.find(".modal-form").exists()).toBe(true);
	});

	it("zero limit shows validation error", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("0");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Создать")!
			.trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("valid form calls addBudget with correct payload and closes modal", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const addSpy = vi.spyOn(useBudgetsStore(), "addBudget").mockResolvedValue(makeBudget());
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("10000");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Создать")!
			.trigger("click");
		await flushPromises();
		expect(addSpy).toHaveBeenCalledOnce();
		expect(addSpy).toHaveBeenCalledWith(
			expect.objectContaining({ categoryId: "cat-1", limitAmount: 10_000, currency: "RUB", month: CURRENT_MONTH })
		);
		expect(wrapper.find(".modal-form").exists()).toBe(false);
	});

	it("comma decimal is accepted as valid limit", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const addSpy = vi.spyOn(useBudgetsStore(), "addBudget").mockResolvedValue(makeBudget());
		const wrapper = await mountView();
		await wrapper.find(".budgets-view__header button").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("5000,50");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Создать")!
			.trigger("click");
		await flushPromises();
		expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ limitAmount: 5000.5 }));
	});

	it("'Создать первый бюджет' in empty state also opens modal", async () => {
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".empty button").trigger("click");
		await flushPromises();
		expect(wrapper.find(".modal-form").exists()).toBe(true);
	});
});

// ── Edit budget ───────────────────────────────────────────────────────────────

describe("BudgetsView – edit budget", () => {
	it("clicking budget card opens modal in edit mode", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		expect(wrapper.find(".modal-form").exists()).toBe(true);
		expect(wrapper.find(".budget-preview").exists()).toBe(true);
		// Edit mode has only the currency <select>; the category <select> is hidden
		expect(wrapper.findAll("select")).toHaveLength(1);
	});

	it("edit modal prefills limitAmount", async () => {
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 75_000 })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe("75000");
	});

	it("edit modal prefills currency", async () => {
		useBudgetsStore().budgets = [makeBudget({ currency: "USD" })];
		useCategoriesStore().categories = [makeCategory()];
		const wrapper = await mountView();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("USD");
	});

	it("edit submit calls updateBudget with new limit", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const updateSpy = vi.spyOn(useBudgetsStore(), "updateBudget").mockResolvedValue();
		const wrapper = await mountView();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("60000");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Сохранить")!
			.trigger("click");
		await flushPromises();
		expect(updateSpy).toHaveBeenCalledWith("b-1", expect.objectContaining({ limitAmount: 60_000 }));
		expect(wrapper.find(".modal-form").exists()).toBe(false);
	});

	it("calls gamificationStore.onBudgetKept when budget kept on a past month", async () => {
		useBudgetsStore().budgets = [makeBudget({ id: "b-past", month: PREV_MONTH })];
		useCategoriesStore().categories = [makeCategory()];
		// No transactions → spent=0 ≤ any positive limit → onBudgetKept fires
		const keptSpy = vi.spyOn(useGamificationStore(), "onBudgetKept").mockImplementation(() => {});
		vi.spyOn(useBudgetsStore(), "updateBudget").mockResolvedValue();
		const wrapper = await mountView();
		await wrapper.findAll(".month-nav__btn")[0].trigger("click"); // navigate to prev month
		await flushPromises();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("50000");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Сохранить")!
			.trigger("click");
		await flushPromises();
		expect(keptSpy).toHaveBeenCalledOnce();
	});

	it("does NOT call onBudgetKept when editing current month budget", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const keptSpy = vi.spyOn(useGamificationStore(), "onBudgetKept").mockImplementation(() => {});
		vi.spyOn(useBudgetsStore(), "updateBudget").mockResolvedValue();
		const wrapper = await mountView();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("50000");
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Сохранить")!
			.trigger("click");
		await flushPromises();
		expect(keptSpy).not.toHaveBeenCalled();
	});

	it("does NOT call onBudgetKept when overspent on past month", async () => {
		useBudgetsStore().budgets = [makeBudget({ id: "b-past", month: PREV_MONTH, limitAmount: 50_000 })];
		useCategoriesStore().categories = [makeCategory()];
		const keptSpy = vi.spyOn(useGamificationStore(), "onBudgetKept").mockImplementation(() => {});
		vi.spyOn(useBudgetsStore(), "updateBudget").mockResolvedValue();
		const wrapper = await mountView();
		// Set spend > new limit
		useTransactionsStore()._cache.set(PREV_MONTH, [makeTx({ date: `${PREV_MONTH}-10`, amount: 60_000 })]);
		await flushPromises();
		await wrapper.findAll(".month-nav__btn")[0].trigger("click");
		await flushPromises();
		await wrapper.find(".budget-card").trigger("click");
		await flushPromises();
		await wrapper.find('input[type="number"]').setValue("40000"); // spent 60k > limit 40k
		await wrapper
			.findAll("button")
			.find((b) => b.text() === "Сохранить")!
			.trigger("click");
		await flushPromises();
		expect(keptSpy).not.toHaveBeenCalled();
	});
});

// ── Delete budget ─────────────────────────────────────────────────────────────

describe("BudgetsView – delete budget", () => {
	it("confirm=true calls deleteBudget", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const deleteSpy = vi.spyOn(useBudgetsStore(), "deleteBudget").mockResolvedValue();
		const wrapper = await mountView();
		await wrapper.find(".budget-card__delete").trigger("click");
		await flushPromises();
		expect(deleteSpy).toHaveBeenCalledWith("b-1");
	});

	it("confirm=false does not call deleteBudget", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		const deleteSpy = vi.spyOn(useBudgetsStore(), "deleteBudget").mockResolvedValue();
		mockShowConfirm.mockResolvedValueOnce(false);
		const wrapper = await mountView();
		await wrapper.find(".budget-card__delete").trigger("click");
		await flushPromises();
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("delete button does not open edit modal (.stop modifier)", async () => {
		useBudgetsStore().budgets = [makeBudget()];
		useCategoriesStore().categories = [makeCategory()];
		vi.spyOn(useBudgetsStore(), "deleteBudget").mockResolvedValue();
		const wrapper = await mountView();
		await wrapper.find(".budget-card__delete").trigger("click");
		expect(wrapper.find(".modal-form").exists()).toBe(false);
	});
});

// ── Budget notifications ──────────────────────────────────────────────────────

describe("BudgetsView – budget notifications watch", () => {
	it("fires notifyBudgetWarning when progress reaches 80%", async () => {
		useCategoriesStore().categories = [makeCategory()];
		await mountView();
		// Set cache AFTER mount (loadCurrentAndPrevMonth overwrites pre-mount cache)
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 40_000 })]);
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: true })];
		await flushPromises();
		expect(mockNotify).toHaveBeenCalledOnce();
		expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ id: "b-1" }), "Еда", 80);
	});

	it("fires notifyBudgetWarning at 100% (overspent)", async () => {
		useCategoriesStore().categories = [makeCategory()];
		await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 60_000 })]);
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: true })];
		await flushPromises();
		expect(mockNotify).toHaveBeenCalledOnce();
	});

	it("does NOT fire when notifyEnabled is false", async () => {
		useCategoriesStore().categories = [makeCategory()];
		await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 40_000 })]);
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: false })];
		await flushPromises();
		expect(mockNotify).not.toHaveBeenCalled();
	});

	it("does NOT fire when spend is below 80%", async () => {
		useCategoriesStore().categories = [makeCategory()];
		await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 30_000 })]);
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: true })];
		await flushPromises();
		expect(mockNotify).not.toHaveBeenCalled();
	});

	it("deduplicates: same budget key notified only once per component instance", async () => {
		useCategoriesStore().categories = [makeCategory()];
		await mountView();
		useTransactionsStore()._cache.set(CURRENT_MONTH, [makeTx({ amount: 40_000 })]);
		// First trigger
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: true })];
		await flushPromises();
		expect(mockNotify).toHaveBeenCalledTimes(1);
		// Trigger watch again with same budget — key already in notifiedBudgets Set
		useBudgetsStore().budgets = [];
		await flushPromises();
		useBudgetsStore().budgets = [makeBudget({ limitAmount: 50_000, notifyEnabled: true })];
		await flushPromises();
		expect(mockNotify).toHaveBeenCalledTimes(1);
	});
});
