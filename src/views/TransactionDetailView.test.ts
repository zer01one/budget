import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { PhArrowsLeftRight } from "@phosphor-icons/vue";
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

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

const mockShowConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/utils/confirm", () => ({ showConfirm: mockShowConfirm }));

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

	it("shows arrows icon", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-amount").findComponent(PhArrowsLeftRight).exists()).toBe(true);
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

	it("back button shows Назад", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-view__back").text()).toContain("Назад");
	});

	it("Изменить button is visible", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".detail-view__edit-btn").exists()).toBe(true);
	});

	it("back button calls router.back", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find(".detail-view__back").trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});

	it("Изменить navigates to the edit page", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push").mockResolvedValue(undefined);
		await wrapper.find(".detail-view__edit-btn").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-1/edit");
	});
});

// ── deleteTx ─────────────────────────────────────────────────────────────────

describe("TransactionDetailView – deleteTx", () => {
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


	it("marks tx as deleted when confirmed", async () => {
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
		mockShowConfirm.mockResolvedValueOnce(false);
		const txStore = useTransactionsStore();
		const { wrapper } = await mountView();
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		expect(txStore.allCached.find((t) => t.id === "tx-1")?.isDeleted).toBe(false);
	});

	it("does not call router.back when cancelled", async () => {
		mockShowConfirm.mockResolvedValueOnce(false);
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back");
		await wrapper
			.findAll("button")
			.find((b) => b.text().includes("Удалить"))!
			.trigger("click");
		expect(backSpy).not.toHaveBeenCalled();
	});
});
