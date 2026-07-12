import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import EditTransactionView from "@/views/EditTransactionView.vue";
import AppDatePicker from "@/components/ui/AppDatePicker.vue";
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

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
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
		routes: [{ path: "/:id/edit", component: EditTransactionView }]
	});
	router.push(`/${txId}/edit`);
	await router.isReady();
	const wrapper = mount(EditTransactionView, {
		global: { plugins: [pinia, router] }
	});
	return { wrapper, router };
}

function seedStores() {
	const txStore = useTransactionsStore();
	const accountsStore = useAccountsStore();
	const categoriesStore = useCategoriesStore();
	txStore._cache.set("2026-06", [makeTx()]);
	accountsStore.accounts = [makeAccount()];
	categoriesStore.categories = [makeCategory()];
}

// ── Not found ─────────────────────────────────────────────────────────────────

describe("EditTransactionView – not found", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows not-found message when id does not match", async () => {
		const { wrapper } = await mountView("unknown-id");
		expect(wrapper.find(".edit-tx__not-found").exists()).toBe(true);
		expect(wrapper.text()).toContain("не найдена");
	});

	it("hides the form when not found", async () => {
		const { wrapper } = await mountView("unknown-id");
		expect(wrapper.find(".add-tx__form").exists()).toBe(false);
	});
});

// ── Header ────────────────────────────────────────────────────────────────────

describe("EditTransactionView – header", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		seedStores();
	});

	it("shows Редактирование title", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".edit-tx__title").text()).toBe("Редактирование");
	});

	it("back button shows Отмена and calls router.back", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		const backBtn = wrapper.find(".edit-tx__back");
		expect(backBtn.text()).toContain("Отмена");
		await backBtn.trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});
});

// ── Prefill ───────────────────────────────────────────────────────────────────

describe("EditTransactionView – prefill", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		seedStores();
	});

	it("shows the edit form", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__form").exists()).toBe(true);
	});

	it("amount input prefilled", async () => {
		const { wrapper } = await mountView();
		expect((wrapper.find("input[type='number']").element as HTMLInputElement).value).toBe("5000");
	});

	it("expense type tab active", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".type-tab--active").text()).toBe("Расход");
	});

	it("date picker prefilled", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findComponent(AppDatePicker).props("modelValue")).toBe("2026-06-15");
	});

	it("time input prefilled", async () => {
		const { wrapper } = await mountView();
		expect((wrapper.find("input[type='time']").element as HTMLInputElement).value).toBe("14:30");
	});

	it("category preselected in grid", async () => {
		const { wrapper } = await mountView();
		const active = wrapper.find(".cat-item--active");
		expect(active.exists()).toBe(true);
		expect(active.text()).toContain("Food");
	});
});

// ── Type tab switching ────────────────────────────────────────────────────────

describe("EditTransactionView – type tab switching", () => {
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

	it("income tab activates on click", async () => {
		const { wrapper } = await mountView();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		expect(wrapper.find(".type-tab--active").text()).toBe("Доход");
	});

	it("income tab shows income categories", async () => {
		const { wrapper } = await mountView();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Доход")!
			.trigger("click");
		expect(wrapper.find(".cat-grid").text()).toContain("Salary");
	});

	it("transfer tab hides category grid", async () => {
		const { wrapper } = await mountView();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		expect(wrapper.find(".cat-grid").exists()).toBe(false);
	});

	it("transfer tab shows toAccount field", async () => {
		const { wrapper } = await mountView();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		expect(wrapper.text()).toContain("Счёт назначения");
	});

	it("switching type clears selected category", async () => {
		const { wrapper } = await mountView();
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

// ── Validation ────────────────────────────────────────────────────────────────

describe("EditTransactionView – validation", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		seedStores();
	});

	function saveBtn(wrapper: ReturnType<typeof mount>) {
		return wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
	}

	it("shows amount error for empty amount", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[type='number']").setValue("");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows amount error for zero", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[type='number']").setValue("0");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows amount error for negative", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[type='number']").setValue("-100");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Введите положительную сумму");
	});

	it("shows account error when no account selected", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("select").setValue("");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Выберите счёт");
	});

	it("shows toAccount error for transfer without toAccount", async () => {
		const { wrapper } = await mountView();
		await wrapper
			.findAll(".type-tab")
			.find((t) => t.text() === "Перевод")!
			.trigger("click");
		await saveBtn(wrapper).trigger("click");
		expect(wrapper.text()).toContain("Выберите счёт назначения");
	});

	it("shows category error for expense without category", async () => {
		const { wrapper } = await mountView();
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

	it("does not navigate back after validation failure", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back");
		await wrapper.find("input[type='number']").setValue("");
		await saveBtn(wrapper).trigger("click");
		await flushPromises();
		expect(backSpy).not.toHaveBeenCalled();
		expect(wrapper.find(".add-tx__form").exists()).toBe(true);
	});
});

// ── Save success ──────────────────────────────────────────────────────────────

describe("EditTransactionView – save success", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		seedStores();
	});

	it("calls router.back after save", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		const btn = wrapper.findAll("button").find((b) => b.text().includes("Сохранить"))!;
		await btn.trigger("click");
		await flushPromises();
		expect(backSpy).toHaveBeenCalledOnce();
	});

	it("updates amount in store", async () => {
		const txStore = useTransactionsStore();
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
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
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
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

// ── Cancel ────────────────────────────────────────────────────────────────────

describe("EditTransactionView – cancel", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		seedStores();
	});

	it("Отмена button in form calls router.back without saving", async () => {
		const txStore = useTransactionsStore();
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[type='number']").setValue("7777");
		const cancelBtn = wrapper.findAll("button").find((b) => b.text() === "Отмена" && b.classes().includes("app-btn"))!;
		await cancelBtn.trigger("click");
		await flushPromises();
		expect(backSpy).toHaveBeenCalledOnce();
		expect(txStore.allCached.find((t) => t.id === "tx-1")?.amount).toBe(5000);
	});
});
