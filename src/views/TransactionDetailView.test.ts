import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import TransactionDetailView from "@/views/TransactionDetailView.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Transaction, Account, Category } from "@/types";

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: vi.fn().mockResolvedValue(null)
	}
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 5000,
		currency: "KZT",
		date: "2026-06-15",
		time: "14:30",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "Lunch",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-15T14:30:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Cash",
		type: "cash",
		currency: "KZT",
		initialBalance: 0,
		color: "#ffffff",
		icon: "cash",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Food",
		type: "expense",
		color: "#ff0000",
		icon: "🍔",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

async function mountView(txId = "tx-1") {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/:id", component: TransactionDetailView }]
	});
	router.push(`/${txId}`);
	await router.isReady();
	const wrapper = mount(TransactionDetailView, {
		global: { plugins: [pinia, router] }
	});
	return { wrapper, router };
}

// ── Not found ─────────────────────────────────────────────────────────────────

describe("TransactionDetailView – not found", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows not-found message when id does not match", async () => {
		const { wrapper } = await mountView("unknown-id");
		expect(wrapper.find(".detail-view__not-found").exists()).toBe(true);
		expect(wrapper.text()).toContain("не найдена");
	});

	it("hides Изменить button when not found", async () => {
		const { wrapper } = await mountView("unknown-id");
		expect(wrapper.find(".detail-view__edit-btn").exists()).toBe(false);
	});
});

// ── View mode – expense ───────────────────────────────────────────────────────

describe("TransactionDetailView – view mode expense", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	it("shows minus sign for expense", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").text()).toContain("-");
	});

	it("shows amount value", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").text()).toContain("5");
	});

	it("shows currency code", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").text()).toContain("KZT");
	});

	it("shows type label Расход", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Расход");
	});

	it("shows category name", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Food");
	});

	it("shows account name", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Cash");
	});

	it("shows comment", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Lunch");
	});

	it("shows time in date row", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("14:30");
	});

	it("hides comment row when comment is empty", async () => {
		const txStore = useTransactionsStore();
		txStore._cache.set("2026-06", [makeTx({ comment: "" })]);
		const { wrapper } = await mountView();
		const labels = wrapper.findAll(".detail-row__label").map((el) => el.text());
		expect(labels).not.toContain("Комментарий");
	});

	it("hides toAccount row for non-transfer", async () => {
		const { wrapper } = await mountView();
		const labels = wrapper.findAll(".detail-row__label").map((el) => el.text());
		expect(labels).not.toContain("Куда");
	});

	it("shows Изменить button", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-view__edit-btn").text()).toBe("Изменить");
	});

	it("shows delete button", async () => {
		const { wrapper } = await mountView();
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Удалить"));
		expect(btn?.exists()).toBe(true);
	});
});

// ── View mode – income ────────────────────────────────────────────────────────

describe("TransactionDetailView – view mode income", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx({ type: "income", categoryId: "cat-income" })]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory({ id: "cat-income", type: "income", name: "Salary" })];
	});

	it("shows plus sign", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").text()).toContain("+");
	});

	it("shows type label Доход", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Доход");
	});
});

// ── View mode – transfer ──────────────────────────────────────────────────────

describe("TransactionDetailView – view mode transfer", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx({ type: "transfer", toAccountId: "acc-2", categoryId: null })]);
		accountsStore.accounts = [makeAccount(), makeAccount({ id: "acc-2", name: "Savings" })];
		categoriesStore.categories = [];
	});

	it("shows ↔ sign", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").text()).toContain("↔");
	});

	it("shows type label Перевод", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Перевод");
	});

	it("shows toAccount row", async () => {
		const { wrapper } = await mountView();
		const labels = wrapper.findAll(".detail-row__label").map((el) => el.text());
		expect(labels).toContain("Куда");
	});

	it("shows toAccount name", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-rows").text()).toContain("Savings");
	});
});

// ── Header ────────────────────────────────────────────────────────────────────

describe("TransactionDetailView – header", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	it("back button shows Назад in view mode", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-view__back").text()).toContain("Назад");
	});

	it("Изменить visible in view mode", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-view__edit-btn").exists()).toBe(true);
	});

	it("back button shows Отмена in edit mode", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(wrapper.find(".detail-view__back").text()).toContain("Отмена");
	});

	it("Изменить hidden in edit mode", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(wrapper.find(".detail-view__edit-btn").exists()).toBe(false);
	});

	it("Редактирование label in edit mode", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(wrapper.find(".detail-view__mode").text()).toBe("Редактирование");
	});

	it("back button in view mode calls router.back", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find(".detail-view__back").trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});
});

// ── startEdit prefills form ───────────────────────────────────────────────────

describe("TransactionDetailView – startEdit", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	it("shows edit form after Изменить click", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(wrapper.find(".add-tx__form").exists()).toBe(true);
	});

	it("amount input prefilled", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect((wrapper.find("input[type='number']").element as HTMLInputElement).value).toBe("5000");
	});

	it("expense type tab active", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(wrapper.find(".type-tab--active").text()).toBe("Расход");
	});

	it("date input prefilled", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect((wrapper.find("input[type='date']").element as HTMLInputElement).value).toBe("2026-06-15");
	});

	it("time input prefilled", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect((wrapper.find("input[type='time']").element as HTMLInputElement).value).toBe("14:30");
	});

	it("category preselected in grid", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		const active = wrapper.find(".cat-item--active");
		expect(active.exists()).toBe(true);
		expect(active.text()).toContain("Food");
	});
});

// ── Type tab switching ────────────────────────────────────────────────────────

describe("TransactionDetailView – type tab switching", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount(), makeAccount({ id: "acc-2", name: "Bank" })];
		categoriesStore.categories = [makeCategory(), makeCategory({ id: "cat-income", type: "income", name: "Salary" })];
	});

	async function openEdit() {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		return wrapper;
	}

	it("income tab activates on click", async () => {
		const wrapper = await openEdit();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		expect(wrapper.find(".type-tab--active").text()).toBe("Доход");
	});

	it("income tab shows income categories", async () => {
		const wrapper = await openEdit();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		expect(wrapper.find(".cat-grid").text()).toContain("Salary");
	});

	it("transfer tab hides category grid", async () => {
		const wrapper = await openEdit();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		expect(wrapper.find(".cat-grid").exists()).toBe(false);
	});

	it("transfer tab shows toAccount field", async () => {
		const wrapper = await openEdit();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		expect(wrapper.text()).toContain("Счёт назначения");
	});

	it("switching type clears selected category", async () => {
		const wrapper = await openEdit();
		expect(wrapper.find(".cat-item--active").exists()).toBe(true);
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Расход")!
			.trigger("click");
		expect(wrapper.find(".cat-item--active").exists()).toBe(false);
	});
});

// ── saveEdit validation ───────────────────────────────────────────────────────

describe("TransactionDetailView – saveEdit validation", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	async function openEdit() {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		return wrapper;
	}

	function saveBtn(wrapper: ReturnType<typeof mount>) {
		return wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
	}

	it("shows amount error for empty amount", async () => {
		const wrapper = await openEdit();
		await wrapper.find("input[type='number']").setValue("");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows amount error for zero", async () => {
		const wrapper = await openEdit();
		await wrapper.find("input[type='number']").setValue("0");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows amount error for negative", async () => {
		const wrapper = await openEdit();
		await wrapper.find("input[type='number']").setValue("-100");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows account error when no account selected", async () => {
		const wrapper = await openEdit();
		await wrapper.find("select").setValue("");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Выберите счёт");
	});

	it("shows toAccount error for transfer without toAccount", async () => {
		const wrapper = await openEdit();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Выберите счёт назначения");
	});

	it("shows category error for expense without category", async () => {
		const wrapper = await openEdit();
		// Switch type twice to clear pre-selected category
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Расход")!
			.trigger("click");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Выберите категорию");
	});

	it("stays in edit mode after validation failure", async () => {
		const wrapper = await openEdit();
		await wrapper.find("input[type='number']").setValue("");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.find(".add-tx__form").exists()).toBe(true);
	});
});

// ── saveEdit success ──────────────────────────────────────────────────────────

describe("TransactionDetailView – saveEdit success", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	it("returns to view mode after save", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
		await btn.trigger("click");
		await flushPromises();
		expect(wrapper.find(".add-tx__form").exists()).toBe(false);
		expect(wrapper.find(".detail-view__content").exists()).toBe(true);
	});

	it("updates amount in store", async () => {
		const txStore = useTransactionsStore();
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		await wrapper.find("input[type='number']").setValue("9999");
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
		await btn.trigger("click");
		await flushPromises();
		expect(txStore.allCached.find((t) => t.id === "tx-1")?.amount).toBe(9999);
	});

	it("transfer save sets toAccountId and nullifies categoryId", async () => {
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		accountsStore.accounts = [makeAccount(), makeAccount({ id: "acc-2", name: "Bank" })];
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		// toAccount select is the second select
		const selects = wrapper.findAll("select");
		await selects[1].setValue("acc-2");
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
		await btn.trigger("click");
		await flushPromises();
		const updated = txStore.allCached.find((t) => t.id === "tx-1");
		expect(updated?.type).toBe("transfer");
		expect(updated?.toAccountId).toBe("acc-2");
		expect(updated?.categoryId).toBeNull();
	});
});

// ── deleteTx ─────────────────────────────────────────────────────────────────

describe("TransactionDetailView – deleteTx", () => {
	let confirmMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		confirmMock = vi.fn();
		vi.stubGlobal("confirm", confirmMock);
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("marks tx as deleted when confirmed", async () => {
		confirmMock.mockReturnValue(true);
		const txStore = useTransactionsStore();
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		await flushPromises();
		expect(txStore.allCached.find((t) => t.id === "tx-1")?.isDeleted).toBe(true);
	});

	it("calls router.back after deletion", async () => {
		confirmMock.mockReturnValue(true);
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		await flushPromises();
		expect(backSpy).toHaveBeenCalledOnce();
	});

	it("does not delete when cancelled", async () => {
		confirmMock.mockReturnValue(false);
		const txStore = useTransactionsStore();
		const { wrapper } = await mountView();
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		expect(txStore.allCached.find((t) => t.id === "tx-1")?.isDeleted).toBe(false);
	});

	it("does not call router.back when cancelled", async () => {
		confirmMock.mockReturnValue(false);
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back");
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		expect(backSpy).not.toHaveBeenCalled();
	});
});

// ── cancel edit ───────────────────────────────────────────────────────────────

describe("TransactionDetailView – cancel edit", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const txStore = useTransactionsStore();
		const accountsStore = useAccountsStore();
		const categoriesStore = useCategoriesStore();
		txStore._cache.set("2026-06", [makeTx()]);
		accountsStore.accounts = [makeAccount()];
		categoriesStore.categories = [makeCategory()];
	});

	it("back button in edit mode returns to view mode", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		await wrapper.find(".detail-view__back").trigger("click");
		expect(wrapper.find(".add-tx__form").exists()).toBe(false);
		expect(wrapper.find(".detail-view__content").exists()).toBe(true);
	});

	it("Отмена button in form returns to view mode", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		const cancelBtn = wrapper.findAll("button").find((b) => b.text() === "Отмена")!;
		await cancelBtn.trigger("click");
		expect(wrapper.find(".add-tx__form").exists()).toBe(false);
		expect(wrapper.find(".detail-view__content").exists()).toBe(true);
	});
});
