import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import AccountsView from "./AccountsView.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import type { Account, Transaction } from "@/types";

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

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Наличные",
		type: "cash",
		currency: "KZT",
		initialBalance: 1000,
		color: "#4caf50",
		icon: "AB_extra",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00.000Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "income",
		amount: 500,
		currency: "KZT",
		date: "2026-06-01",
		time: "12:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: null,
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-01T00:00:00.000Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: AccountsView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(AccountsView, { global: { plugins: [pinia, router] } });
	return { wrapper, router };
}

describe("AccountsView", () => {
	describe("empty state", () => {
		it("shows empty message when no active accounts", async () => {
			const { wrapper } = await mountView();
			expect(wrapper.find(".accounts-view__empty").exists()).toBe(true);
			expect(wrapper.find(".accounts-view__empty").text()).toContain("Нет счетов");
		});

		it("does not render any account cards when empty", async () => {
			const { wrapper } = await mountView();
			expect(wrapper.findAll(".account-card")).toHaveLength(0);
		});

		it("does not show empty message when accounts exist", async () => {
			useAccountsStore().accounts = [makeAccount()];
			const { wrapper } = await mountView();
			expect(wrapper.find(".accounts-view__empty").exists()).toBe(false);
		});
	});

	describe("account list rendering", () => {
		it("renders a card for each active account", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "a1" }), makeAccount({ id: "a2" })];
			const { wrapper } = await mountView();
			expect(wrapper.findAll(".account-card")).toHaveLength(2);
		});

		it("excludes archived accounts", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "a1", isArchived: false }), makeAccount({ id: "a2", isArchived: true })];
			const { wrapper } = await mountView();
			expect(wrapper.findAll(".account-card")).toHaveLength(1);
		});

		it("displays account name", async () => {
			useAccountsStore().accounts = [makeAccount({ name: "Кошелёк" })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__name").text()).toBe("Кошелёк");
		});

		it("displays account type", async () => {
			useAccountsStore().accounts = [makeAccount({ type: "savings" })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__type").text()).toBe("savings");
		});

		it("displays icon sliced to 2 characters", async () => {
			useAccountsStore().accounts = [makeAccount({ icon: "AB_extra" })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__icon").text()).toBe("AB");
		});

		it("renders empty icon when icon is undefined", async () => {
			useAccountsStore().accounts = [makeAccount({ icon: undefined as unknown as string })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__icon").text()).toBe("");
		});
	});

	describe("balance calculation via getBalance", () => {
		it("shows initial balance when no transactions", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-1", initialBalance: 5000, currency: "KZT" })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__balance").text()).toContain("5 000");
		});

		it("adds income transactions to balance", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-1", initialBalance: 1000, currency: "KZT" })];
			useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "income", amount: 200 })]);
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__balance").text()).toContain("1 200");
		});

		it("subtracts expense transactions from balance", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-1", initialBalance: 1000, currency: "KZT" })];
			useTransactionsStore()._cache.set("2026-06", [makeTx({ type: "expense", amount: 300 })]);
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__balance").text()).toContain("700");
		});

		it("adds incoming transfer to balance", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-1", initialBalance: 0, currency: "KZT" })];
			useTransactionsStore()._cache.set("2026-06", [
				makeTx({ id: "tx-t", accountId: "acc-other", toAccountId: "acc-1", type: "transfer", amount: 400 })
			]);
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__balance").text()).toContain("400");
		});

		it("displays currency in balance", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-1", initialBalance: 50, currency: "USD" })];
			const { wrapper } = await mountView();
			expect(wrapper.find(".account-card__balance").text()).toContain("USD");
		});
	});

	describe("navigation", () => {
		it('navigates to /accounts/new on "Добавить" click', async () => {
			const { wrapper, router } = await mountView();
			vi.spyOn(router, "push");
			await wrapper.find("button").trigger("click");
			expect(router.push).toHaveBeenCalledWith("/accounts/new");
		});

		it("navigates to /accounts/:id on card click", async () => {
			useAccountsStore().accounts = [makeAccount({ id: "acc-42" })];
			const { wrapper, router } = await mountView();
			vi.spyOn(router, "push");
			await wrapper.find(".account-card").trigger("click");
			expect(router.push).toHaveBeenCalledWith("/accounts/acc-42");
		});
	});
});
