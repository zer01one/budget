import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import AddTransactionView from "./AddTransactionView.vue";
import AppDatePicker from "@/components/ui/AppDatePicker.vue";
import ScanReceiptModal from "@/components/ScanReceiptModal.vue";
import { isScannerAvailable } from "@/services/qrScanner.service";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { Account, Category, Transaction } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
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

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

vi.mock("@/services/qrScanner.service", () => ({
	isScannerAvailable: vi.fn(() => false),
	scanReceiptQr: vi.fn(),
	scanReceiptQrFromImage: vi.fn()
}));

// ─── factories ────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Cash",
		type: "cash",
		currency: "KZT",
		initialBalance: 0,
		color: "#7C3AED",
		icon: "💵",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "d",
		version: 1,
		...overrides
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Food",
		type: "expense",
		color: "#f00",
		icon: "AB",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "d",
		version: 1,
		...overrides
	};
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 100,
		currency: "KZT",
		date: "2026-06-21",
		time: "12:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "",
		tags: [],
		isRecurring: false,
		recurringRule: undefined,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-21T12:00:00Z",
		deviceId: "d",
		version: 1,
		...overrides
	};
}

// ─── setup ────────────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
	useAccountsStore().accounts = [
		makeAccount({ id: "acc-1", name: "Cash", currency: "KZT" }),
		makeAccount({ id: "acc-2", name: "Card", currency: "USD" })
	];
	useCategoriesStore().categories = [
		makeCategory({ id: "cat-exp", name: "Food", type: "expense" }),
		makeCategory({ id: "cat-inc", name: "Salary", type: "income" })
	];
});

afterEach(() => {
	vi.clearAllMocks();
});

async function mountView(query: Record<string, string> = {}) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: AddTransactionView }]
	});
	router.push({ path: "/", query });
	await router.isReady();
	const wrapper = mount(AddTransactionView, {
		global: { plugins: [pinia, router] }
	});
	await flushPromises();
	return { wrapper, router };
}

// ─── initial render ───────────────────────────────────────────────────────────

describe("AddTransactionView – initial render", () => {
	it("renders the component", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx").exists()).toBe(true);
	});

	it("shows Новая операция title", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__title").text()).toBe("Новая операция");
	});

	it("expense tab is active, income and transfer are not", async () => {
		const { wrapper } = await mountView();
		const tabs = wrapper.findAll(".type-tab");
		expect(tabs[0].classes()).toContain("type-tab--active"); // expense
		expect(tabs[1].classes()).not.toContain("type-tab--active"); // income
		expect(tabs[2].classes()).not.toContain("type-tab--active"); // transfer
	});

	it("tab labels are Расход / Доход / Перевод", async () => {
		const { wrapper } = await mountView();
		const tabs = wrapper.findAll(".type-tab");
		expect(tabs[0].text()).toBe("Расход");
		expect(tabs[1].text()).toBe("Доход");
		expect(tabs[2].text()).toBe("Перевод");
	});

	it("category grid is shown for expense type", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".cat-grid").exists()).toBe(true);
	});

	it("recurring section is shown for expense type", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".recurring-row").exists()).toBe(true);
	});

	it("to-account field is not shown for expense type", async () => {
		const { wrapper } = await mountView();
		const labels = wrapper.findAll(".field__label").map((l) => l.text());
		expect(labels).not.toContain("Счёт назначения");
	});

	it("currency shown is KZT for first account (acc-1)", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".amount-field__currency").text()).toBe("KZT");
	});

	it("account select is pre-selected to first active account", async () => {
		const { wrapper } = await mountView();
		const select = wrapper.find("select.field__select");
		expect((select.element as HTMLSelectElement).value).toBe("acc-1");
	});

	it("account options list both active accounts", async () => {
		const { wrapper } = await mountView();
		const options = wrapper.find("select.field__select").findAll("option");
		const values = options.map((o) => (o.element as HTMLOptionElement).value);
		expect(values).toContain("acc-1");
		expect(values).toContain("acc-2");
	});

	it("expense categories are shown in cat-grid", async () => {
		const { wrapper } = await mountView();
		const items = wrapper.findAll(".cat-item");
		expect(items).toHaveLength(1); // only cat-exp
		expect(items[0].find(".cat-item__name").text()).toBe("Food");
	});

	it("no validation errors shown on initial render", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".field-error")).toHaveLength(0);
	});

	it("recurring toggle is off by default", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".toggle").classes()).not.toContain("toggle--on");
	});

	it("rule-tabs not shown when isRecurring is false", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".rule-tabs").exists()).toBe(false);
	});

	it("no cat-item is active initially", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".cat-item--active")).toHaveLength(0);
	});
});

// ─── type tabs ────────────────────────────────────────────────────────────────

describe("AddTransactionView – type tabs", () => {
	it("clicking income tab makes it active", async () => {
		const { wrapper } = await mountView();
		const tabs = wrapper.findAll(".type-tab");
		await tabs[1].trigger("click");
		expect(tabs[1].classes()).toContain("type-tab--active");
		expect(tabs[0].classes()).not.toContain("type-tab--active");
	});

	it("clicking income tab shows income categories", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[1].trigger("click");
		const items = wrapper.findAll(".cat-item");
		expect(items).toHaveLength(1);
		expect(items[0].find(".cat-item__name").text()).toBe("Salary");
	});

	it("clicking income tab clears selected categoryId", async () => {
		const { wrapper } = await mountView();
		// first select an expense category
		await wrapper.find(".cat-item").trigger("click");
		expect(wrapper.find(".cat-item--active").exists()).toBe(true);
		// switch to income — should clear categoryId
		await wrapper.findAll(".type-tab")[1].trigger("click");
		expect(wrapper.findAll(".cat-item--active")).toHaveLength(0);
	});

	it("clicking transfer tab makes it active", async () => {
		const { wrapper } = await mountView();
		const tabs = wrapper.findAll(".type-tab");
		await tabs[2].trigger("click");
		expect(tabs[2].classes()).toContain("type-tab--active");
	});

	it("clicking transfer tab shows to-account field", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click");
		const labels = wrapper.findAll(".field__label").map((l) => l.text());
		expect(labels).toContain("Счёт назначения");
	});

	it("clicking transfer tab hides category grid", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click");
		expect(wrapper.find(".cat-grid").exists()).toBe(false);
	});

	it("clicking transfer tab hides recurring section", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click");
		expect(wrapper.find(".recurring-row").exists()).toBe(false);
	});

	it("switching back from transfer to expense shows category and recurring", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		await wrapper.findAll(".type-tab")[0].trigger("click"); // expense
		expect(wrapper.find(".cat-grid").exists()).toBe(true);
		expect(wrapper.find(".recurring-row").exists()).toBe(true);
	});

	it("switching from transfer to income clears categoryId (no active cat)", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		await wrapper.findAll(".type-tab")[1].trigger("click"); // income
		expect(wrapper.findAll(".cat-item--active")).toHaveLength(0);
	});
});

// ─── account select ───────────────────────────────────────────────────────────

describe("AddTransactionView – account select", () => {
	it("selecting acc-2 updates currency to USD", async () => {
		const { wrapper } = await mountView();
		const select = wrapper.find("select.field__select");
		await select.setValue("acc-2");
		expect(wrapper.find(".amount-field__currency").text()).toBe("USD");
	});

	it("selecting empty account shows RUB fallback currency", async () => {
		const { wrapper } = await mountView();
		const select = wrapper.find("select.field__select");
		await select.setValue("");
		expect(wrapper.find(".amount-field__currency").text()).toBe("RUB");
	});

	it("archived accounts are not listed", async () => {
		useAccountsStore().accounts = [
			makeAccount({ id: "acc-1", name: "Cash", isArchived: false }),
			makeAccount({ id: "acc-arch", name: "Archived", isArchived: true })
		];
		const { wrapper } = await mountView();
		const options = wrapper.find("select.field__select").findAll("option");
		const values = options.map((o) => (o.element as HTMLOptionElement).value);
		expect(values).not.toContain("acc-arch");
	});
});

// ─── to-account (transfer) ────────────────────────────────────────────────────

describe("AddTransactionView – to-account field (transfer)", () => {
	async function switchToTransfer() {
		const { wrapper, router } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click");
		return { wrapper, router };
	}

	it("to-account select excludes the selected from-account", async () => {
		const { wrapper } = await switchToTransfer();
		const selects = wrapper.findAll("select.field__select");
		// selects[0] = from-account, selects[1] = to-account
		const toOptions = selects[1].findAll("option");
		const toValues = toOptions.map((o) => (o.element as HTMLOptionElement).value);
		// acc-1 is selected as from-account, should not appear in to-account options
		expect(toValues).not.toContain("acc-1");
		expect(toValues).toContain("acc-2");
	});

	it("to-account options include other active accounts", async () => {
		const { wrapper } = await switchToTransfer();
		const selects = wrapper.findAll("select.field__select");
		const toOptions = selects[1].findAll("option");
		const toValues = toOptions.map((o) => (o.element as HTMLOptionElement).value);
		expect(toValues).toContain("acc-2");
	});
});

// ─── category grid ────────────────────────────────────────────────────────────

describe("AddTransactionView – category grid", () => {
	it("clicking a category marks it as active", async () => {
		const { wrapper } = await mountView();
		const item = wrapper.find(".cat-item");
		await item.trigger("click");
		expect(item.classes()).toContain("cat-item--active");
	});

	it("clicking another category switches active state", async () => {
		useCategoriesStore().categories = [
			makeCategory({ id: "cat-1", name: "Food", type: "expense" }),
			makeCategory({ id: "cat-2", name: "Transport", type: "expense" })
		];
		const { wrapper } = await mountView();
		const items = wrapper.findAll(".cat-item");
		await items[0].trigger("click");
		await items[1].trigger("click");
		expect(items[0].classes()).not.toContain("cat-item--active");
		expect(items[1].classes()).toContain("cat-item--active");
	});

	it("category icon is shown", async () => {
		useCategoriesStore().categories = [makeCategory({ icon: "food", type: "expense" })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".cat-item__icon svg").exists()).toBe(true);
	});

	it("category with no icon renders empty icon span", async () => {
		useCategoriesStore().categories = [makeCategory({ icon: "", type: "expense" })];
		const { wrapper } = await mountView();
		expect(wrapper.find(".cat-item__icon").text()).toBe("");
	});

	it("no category items shown when store has none for the type", async () => {
		useCategoriesStore().categories = [];
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".cat-item")).toHaveLength(0);
	});
});

// ─── recurring toggle ─────────────────────────────────────────────────────────

describe("AddTransactionView – recurring toggle", () => {
	it("clicking toggle enables recurring and shows rule-tabs", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		expect(wrapper.find(".toggle").classes()).toContain("toggle--on");
		expect(wrapper.find(".rule-tabs").exists()).toBe(true);
	});

	it("clicking toggle twice hides rule-tabs", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		await wrapper.find(".toggle").trigger("click");
		expect(wrapper.find(".rule-tabs").exists()).toBe(false);
		expect(wrapper.find(".toggle").classes()).not.toContain("toggle--on");
	});

	it("monthly rule is active by default when recurring enabled", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		const ruleTabs = wrapper.findAll(".rule-tab");
		expect(ruleTabs[2].classes()).toContain("rule-tab--active"); // monthly
		expect(ruleTabs[0].classes()).not.toContain("rule-tab--active");
		expect(ruleTabs[1].classes()).not.toContain("rule-tab--active");
	});

	it("clicking daily rule tab makes it active", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		const ruleTabs = wrapper.findAll(".rule-tab");
		await ruleTabs[0].trigger("click");
		expect(ruleTabs[0].classes()).toContain("rule-tab--active");
		expect(ruleTabs[2].classes()).not.toContain("rule-tab--active");
	});

	it("clicking weekly rule tab makes it active", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		const ruleTabs = wrapper.findAll(".rule-tab");
		await ruleTabs[1].trigger("click");
		expect(ruleTabs[1].classes()).toContain("rule-tab--active");
	});

	it("rule tab labels are Каждый день / Каждую неделю / Каждый месяц", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".toggle").trigger("click");
		const ruleTabs = wrapper.findAll(".rule-tab");
		expect(ruleTabs[0].text()).toBe("Каждый день");
		expect(ruleTabs[1].text()).toBe("Каждую неделю");
		expect(ruleTabs[2].text()).toBe("Каждый месяц");
	});

	it("recurring section is hidden when type is transfer", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		expect(wrapper.find(".toggle").exists()).toBe(false);
	});
});

// ─── back button ─────────────────────────────────────────────────────────────

describe("AddTransactionView – back button", () => {
	it("clicking back button calls router.back()", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find(".add-tx__back").trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});
});

// ─── validation errors ────────────────────────────────────────────────────────

describe("AddTransactionView – validation errors on submit", () => {
	async function clickSubmit(wrapper: ReturnType<typeof mount>) {
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
	}

	it("shows amount error when amount is empty", async () => {
		const { wrapper } = await mountView();
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Введите положительную сумму")).toBe(true);
	});

	it("shows amount error for zero", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("0");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Введите положительную сумму")).toBe(true);
	});

	it("negative sign is stripped from input, no amount error shown", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("-10");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Введите положительную сумму")).toBe(false);
	});

	it("shows amount error for non-numeric string", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("abc");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Введите положительную сумму")).toBe(true);
	});

	it("shows account error when accountId is empty", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("select.field__select").setValue("");
		await wrapper.find(".amount-field__input").setValue("100");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Выберите счёт")).toBe(true);
	});

	it("shows category error for expense without category", async () => {
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		// don't select category
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Выберите категорию")).toBe(true);
	});

	it("shows category error for income without category", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[1].trigger("click"); // income
		await wrapper.find(".amount-field__input").setValue("100");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Выберите категорию")).toBe(true);
	});

	it("shows toAccount error for transfer without toAccount", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		await wrapper.find(".amount-field__input").setValue("100");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").some((e) => e.text() === "Выберите счёт назначения")).toBe(true);
	});

	it("multiple errors can be shown simultaneously", async () => {
		const { wrapper } = await mountView();
		// empty amount AND no category
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field-error").map((e) => e.text());
		expect(errors).toContain("Введите положительную сумму");
		expect(errors).toContain("Выберите категорию");
	});

	it("errors are cleared on re-submit with valid data", async () => {
		vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		// trigger errors
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error").length).toBeGreaterThan(0);
		// now fill valid data
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field-error")).toHaveLength(0);
	});

	it("transfer does not require category — no category error", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		await wrapper.find(".amount-field__input").setValue("100");
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field-error").map((e) => e.text());
		expect(errors).not.toContain("Выберите категорию");
	});
});

// ─── submit – expense ─────────────────────────────────────────────────────────

describe("AddTransactionView – submit expense", () => {
	async function submitExpense(wrapper: ReturnType<typeof mount>) {
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click"); // select cat-exp
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
	}

	it("calls addTransaction with correct expense payload", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await submitExpense(wrapper);

		expect(addSpy).toHaveBeenCalledOnce();
		const arg = addSpy.mock.calls[0][0];
		expect(arg.type).toBe("expense");
		expect(arg.amount).toBe(100);
		expect(arg.currency).toBe("KZT");
		expect(arg.accountId).toBe("acc-1");
		expect(arg.toAccountId).toBeNull();
		expect(arg.categoryId).toBe("cat-exp");
		expect(arg.tags).toEqual([]);
		expect(arg.isRecurring).toBe(false);
		expect(arg.recurringRule).toBeUndefined();
		expect(arg.recurringParentId).toBeNull();
	});

	it("calls gamificationStore.onTransactionAdded with the returned tx", async () => {
		const tx = makeTx({ id: "tx-abc" });
		vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(tx);
		const gamSpy = vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await submitExpense(wrapper);
		expect(gamSpy).toHaveBeenCalledWith(tx);
	});

	it("calls router.back() after successful submit", async () => {
		vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await submitExpense(wrapper);
		expect(backSpy).toHaveBeenCalledOnce();
	});

	it("comma→dot conversion happens in onAmountInput; submit parses amount as-is", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		// onAmountInput converts "," to "." before storing in the ref;
		// setting the ref directly with "5,5" bypasses that and submit calls parseFloat as-is → 5
		(wrapper.vm as any).$.setupState.amount = "5,5";
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].amount).toBe(5);
	});

	it("comment is trimmed before submit", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		// set comment with whitespace via AppInput
		const commentInput = wrapper.find("input[placeholder='Необязательно']");
		await commentInput.setValue("  hello  ");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].comment).toBe("hello");
	});

	it("uses currency of selected account, not hardcoded KZT", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		// switch to acc-2 (USD)
		await wrapper.find("select.field__select").setValue("acc-2");
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].currency).toBe("USD");
	});

	it("isRecurring true with daily rule when toggle enabled and daily selected", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".toggle").trigger("click"); // enable recurring
		await wrapper.findAll(".rule-tab")[0].trigger("click"); // daily
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		const arg = addSpy.mock.calls[0][0];
		expect(arg.isRecurring).toBe(true);
		expect(arg.recurringRule).toBe("daily");
	});

	it("isRecurring true with weekly rule", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".toggle").trigger("click");
		await wrapper.findAll(".rule-tab")[1].trigger("click"); // weekly
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].recurringRule).toBe("weekly");
	});

	it("isRecurring true with monthly rule (default)", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".toggle").trigger("click"); // monthly by default
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		const arg = addSpy.mock.calls[0][0];
		expect(arg.isRecurring).toBe(true);
		expect(arg.recurringRule).toBe("monthly");
	});

	it("recurringRule is undefined when isRecurring is false", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await submitExpense(wrapper);
		expect(addSpy.mock.calls[0][0].recurringRule).toBeUndefined();
	});
});

// ─── submit – income ──────────────────────────────────────────────────────────

describe("AddTransactionView – submit income", () => {
	it("calls addTransaction with income type and income categoryId", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx({ type: "income" }));
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[1].trigger("click"); // income
		await wrapper.find(".amount-field__input").setValue("200");
		await wrapper.find(".cat-item").trigger("click"); // cat-inc
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		const arg = addSpy.mock.calls[0][0];
		expect(arg.type).toBe("income");
		expect(arg.categoryId).toBe("cat-inc");
		expect(arg.toAccountId).toBeNull();
	});
});

// ─── submit – transfer ────────────────────────────────────────────────────────

describe("AddTransactionView – submit transfer", () => {
	it("calls addTransaction with transfer type, toAccountId set, categoryId null", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx({ type: "transfer" }));
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.findAll(".type-tab")[2].trigger("click"); // transfer
		await wrapper.find(".amount-field__input").setValue("300");
		const selects = wrapper.findAll("select.field__select");
		await selects[1].setValue("acc-2"); // set toAccountId
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		const arg = addSpy.mock.calls[0][0];
		expect(arg.type).toBe("transfer");
		expect(arg.toAccountId).toBe("acc-2");
		expect(arg.categoryId).toBeNull();
		expect(arg.isRecurring).toBe(false);
		expect(arg.recurringRule).toBeUndefined();
	});
});

// ─── submit – double submit prevention ───────────────────────────────────────

describe("AddTransactionView – double submit prevention", () => {
	it("does not call addTransaction twice if clicked while submitting", async () => {
		let resolve: (tx: Transaction) => void;
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockReturnValue(
			new Promise<Transaction>((r) => {
				resolve = r;
			})
		);
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		// first click
		wrapper.find(".app-btn").trigger("click");
		// second click (while first is in flight)
		await wrapper.find(".app-btn").trigger("click");
		// resolve the promise
		resolve!(makeTx());
		await flushPromises();
		expect(addSpy).toHaveBeenCalledTimes(1);
	});

	it("submit button is disabled while submitting", async () => {
		let resolve: (tx: Transaction) => void;
		vi.spyOn(useTransactionsStore(), "addTransaction").mockReturnValue(
			new Promise<Transaction>((r) => {
				resolve = r;
			})
		);
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		// button should be disabled (loading=true → disabled attr on AppButton)
		expect((wrapper.find(".app-btn").element as HTMLButtonElement).disabled).toBe(true);
		resolve!(makeTx());
		await flushPromises();
	});

	it("isSubmitting resets to false after successful submit", async () => {
		vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect((wrapper.find(".app-btn").element as HTMLButtonElement).disabled).toBe(false);
	});
});

// ─── date / time defaults ─────────────────────────────────────────────────────

describe("AddTransactionView – date and time defaults", () => {
	it("date field is initialized to today in en-CA format", async () => {
		const { wrapper } = await mountView();
		const today = new Date().toLocaleDateString("en-CA");
		expect(wrapper.findComponent(AppDatePicker).props("modelValue")).toBe(today);
	});

	it("time field is initialized to current time (HH:MM format)", async () => {
		const { wrapper } = await mountView();
		const timeInput = wrapper.find("input[type='time']");
		const val = (timeInput.element as HTMLInputElement).value;
		// just check it matches HH:MM format
		expect(val).toMatch(/^\d{2}:\d{2}$/);
	});
});

// ─── receipt scan modal ───────────────────────────────────────────────────────

describe("AddTransactionView – receipt scan modal", () => {
	const PARSED = {
		amount: 1234.56,
		date: "2026-07-07",
		time: "15:30",
		type: "expense" as const,
		fn: "1111",
		fd: "2222",
		fp: "3333"
	};
	const RECEIPT_TAG = "receipt:1111:2222:3333";
	const RECEIPT_COMMENT = "Чек от 07.07.2026 15:30";

	it("does not render the scan button when the scanner is unavailable", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__scan-btn").exists()).toBe(false);
	});

	it("renders the scan button when the scanner is available", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__scan-btn").exists()).toBe(true);
	});

	it("modal is not shown initially", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		expect(wrapper.findComponent(ScanReceiptModal).exists()).toBe(false);
	});

	it("clicking the scan button opens the modal", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		await wrapper.find(".add-tx__scan-btn").trigger("click");
		expect(wrapper.findComponent(ScanReceiptModal).exists()).toBe(true);
	});

	it("modal close event hides the modal", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		await wrapper.find(".add-tx__scan-btn").trigger("click");
		wrapper.findComponent(ScanReceiptModal).vm.$emit("close");
		await wrapper.vm.$nextTick();
		expect(wrapper.findComponent(ScanReceiptModal).exists()).toBe(false);
	});

	async function applyScan(wrapper: ReturnType<typeof mount>) {
		await wrapper.find(".add-tx__scan-btn").trigger("click");
		wrapper.findComponent(ScanReceiptModal).vm.$emit("apply", PARSED, RECEIPT_TAG);
		await wrapper.vm.$nextTick();
	}

	it("apply fills amount, date, time and comment and closes the modal", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		await applyScan(wrapper);
		const state = (wrapper.vm as any).$.setupState;
		expect(state.amount).toBe("1234.56");
		expect(state.date).toBe("2026-07-07");
		expect(state.time).toBe("15:30");
		expect(state.comment).toBe(RECEIPT_COMMENT);
		expect(wrapper.findComponent(ScanReceiptModal).exists()).toBe(false);
	});

	it("apply switches the type tab according to the receipt", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		await wrapper.find(".add-tx__scan-btn").trigger("click");
		wrapper.findComponent(ScanReceiptModal).vm.$emit("apply", { ...PARSED, type: "income" }, RECEIPT_TAG);
		await wrapper.vm.$nextTick();
		expect(wrapper.findAll(".type-tab")[1].classes()).toContain("type-tab--active");
	});

	it("submit after apply includes the receipt tag in tags", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await applyScan(wrapper);
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].tags).toEqual([RECEIPT_TAG]);
		expect(addSpy.mock.calls[0][0].comment).toBe(RECEIPT_COMMENT);
	});

	it("tags is an empty array on submit without a scan", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].tags).toEqual([]);
	});
});

// ─── no active accounts edge case ─────────────────────────────────────────────

describe("AddTransactionView – no active accounts", () => {
	it("accountId defaults to empty when no accounts in store", async () => {
		useAccountsStore().accounts = [];
		const { wrapper } = await mountView();
		const select = wrapper.find("select.field__select");
		expect((select.element as HTMLSelectElement).value).toBe("");
	});

	it("currency shows RUB fallback when no account selected", async () => {
		useAccountsStore().accounts = [];
		const { wrapper } = await mountView();
		expect(wrapper.find(".amount-field__currency").text()).toBe("RUB");
	});

	it("submit without account shows account error", async () => {
		useAccountsStore().accounts = [];
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		const errors = wrapper.findAll(".field-error").map((e) => e.text());
		expect(errors).toContain("Выберите счёт");
	});
});

// ─── save FAB and scan button highlight ───────────────────────────────────────

describe("AddTransactionView – save FAB and scan button highlight", () => {
	it("save button carries the add-tx__save class (mobile FAB styles hook)", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".app-btn").classes()).toContain("add-tx__save");
	});

	it("save button still submits (single button for desktop and mobile)", async () => {
		const addSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
		vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
		const { wrapper } = await mountView();
		await wrapper.find(".amount-field__input").setValue("100");
		await wrapper.find(".cat-item").trigger("click");
		await wrapper.find(".add-tx__save").trigger("click");
		await flushPromises();
		expect(addSpy).toHaveBeenCalledOnce();
	});

	it("scan button renders a QR icon", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__scan-btn svg").exists()).toBe(true);
	});

	it("scan button keeps its label text", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-tx__scan-btn").text()).toBe("Сканировать чек");
	});
});
