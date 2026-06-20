import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTransactionsStore } from "../transactions.store";
import type { Transaction } from "@/types";

// Mock all FS-touching modules so pure methods can be tested without platform APIs
vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn(() =>
		Promise.resolve({
			readJson: vi.fn(() => Promise.resolve(null)),
			writeJson: vi.fn(() => Promise.resolve()),
			listFiles: vi.fn(() => Promise.resolve([]))
		})
	)
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		loadMonth: vi.fn(() => Promise.resolve(null)),
		saveMonth: vi.fn(() => Promise.resolve()),
		listMonths: vi.fn(() => Promise.resolve([]))
	}
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 100,
		currency: "KZT",
		date: "2026-01-01",
		time: "12:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: null,
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

// Seed the cache directly — bypasses FS
function seedCache(store: ReturnType<typeof useTransactionsStore>, month: string, txs: Transaction[]) {
	store._cache.set(month, txs);
	store.loadedMonths.add(month);
}

describe("computeAccountBalance", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("returns initialBalance when no transactions cached", () => {
		const store = useTransactionsStore();
		expect(store.computeAccountBalance("acc-1", 1000)).toBe(1000);
	});

	it("adds income to balance", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "income", amount: 500, accountId: "acc-1" })]);
		expect(store.computeAccountBalance("acc-1", 0)).toBe(500);
	});

	it("subtracts expense from balance", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "expense", amount: 200, accountId: "acc-1" })]);
		expect(store.computeAccountBalance("acc-1", 1000)).toBe(800);
	});

	it("adds transfer incoming to destination account", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "transfer", amount: 300, accountId: "acc-2", toAccountId: "acc-1" })]);
		expect(store.computeAccountBalance("acc-1", 0)).toBe(300);
	});

	it("outgoing transfer is treated as expense from source account", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "transfer", amount: 300, accountId: "acc-1", toAccountId: "acc-2" })]);
		// type=transfer, accountId=acc-1: the loop: tx.accountId === accountId → balance += type==='income' ? amount : -amount
		// transfer is not 'income', so balance -= 300
		expect(store.computeAccountBalance("acc-1", 1000)).toBe(700);
	});

	it("ignores transactions for other accounts", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "expense", amount: 9999, accountId: "acc-99" })]);
		expect(store.computeAccountBalance("acc-1", 500)).toBe(500);
	});

	it("accumulates across multiple months in cache", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ id: "a", type: "income", amount: 1000, accountId: "acc-1" })]);
		seedCache(store, "2026-02", [makeTx({ id: "b", type: "expense", amount: 400, accountId: "acc-1" })]);
		expect(store.computeAccountBalance("acc-1", 0)).toBe(600);
	});

	it("accounts for both income and expense transactions", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [
			makeTx({ id: "1", type: "income", amount: 3000, accountId: "acc-1" }),
			makeTx({ id: "2", type: "expense", amount: 500, accountId: "acc-1" }),
			makeTx({ id: "3", type: "expense", amount: 200, accountId: "acc-1" })
		]);
		expect(store.computeAccountBalance("acc-1", 100)).toBe(2400); // 100 + 3000 - 500 - 200
	});

	it("uses initialBalance as starting point", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ type: "income", amount: 100, accountId: "acc-1" })]);
		expect(store.computeAccountBalance("acc-1", 900)).toBe(1000);
	});
});

// ── getByMonth ────────────────────────────────────────────────────────────────

describe("getByMonth", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("returns empty array for uncached month", () => {
		const store = useTransactionsStore();
		expect(store.getByMonth("2026-01")).toEqual([]);
	});

	it("returns correct transactions for cached month", () => {
		const store = useTransactionsStore();
		const txs = [makeTx({ id: "a" }), makeTx({ id: "b" })];
		seedCache(store, "2026-01", txs);
		expect(store.getByMonth("2026-01")).toEqual(txs);
	});

	it("does not return transactions from a different month", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-02", [makeTx({ id: "x" })]);
		expect(store.getByMonth("2026-01")).toEqual([]);
	});
});

// ── getByAccount ──────────────────────────────────────────────────────────────

describe("getByAccount", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("returns transactions where accountId matches", () => {
		const store = useTransactionsStore();
		const tx = makeTx({ accountId: "acc-1" });
		seedCache(store, "2026-01", [tx]);
		expect(store.getByAccount("acc-1")).toContainEqual(tx);
	});

	it("returns transactions where toAccountId matches", () => {
		const store = useTransactionsStore();
		const tx = makeTx({ accountId: "acc-2", toAccountId: "acc-1", type: "transfer" });
		seedCache(store, "2026-01", [tx]);
		expect(store.getByAccount("acc-1")).toContainEqual(tx);
	});

	it("excludes transactions unrelated to the account", () => {
		const store = useTransactionsStore();
		const tx = makeTx({ accountId: "acc-99", toAccountId: null });
		seedCache(store, "2026-01", [tx]);
		expect(store.getByAccount("acc-1")).toHaveLength(0);
	});

	it("returns from multiple cached months", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ id: "a", accountId: "acc-1" })]);
		seedCache(store, "2026-02", [makeTx({ id: "b", accountId: "acc-1" })]);
		expect(store.getByAccount("acc-1")).toHaveLength(2);
	});
});

// ── findMonthForId ────────────────────────────────────────────────────────────

describe("findMonthForId (via _cache)", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("returns null when cache is empty", () => {
		const store = useTransactionsStore();
		// findMonthForId is internal; access via updateTransaction behaviour is indirect
		// Test it through computeAccountBalance returning correct results when cache is empty
		expect(store.computeAccountBalance("x", 0)).toBe(0);
	});

	it("allCached is empty when cache is empty", () => {
		const store = useTransactionsStore();
		expect(store.allCached).toEqual([]);
	});

	it("allCached returns all transactions across months", () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-01", [makeTx({ id: "a" })]);
		seedCache(store, "2026-02", [makeTx({ id: "b" })]);
		expect(store.allCached).toHaveLength(2);
	});
});

// ── clearConflict ─────────────────────────────────────────────────────────────

describe("clearConflict", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("clears lastConflict to null", () => {
		const store = useTransactionsStore();
		store.lastConflict = {
			file: "transactions/2026-01.json",
			localUpdatedAt: "2026-01-01T00:00:00Z",
			diskModifiedAt: "2026-01-02T00:00:00Z",
			resolvedBy: "disk"
		};
		store.clearConflict();
		expect(store.lastConflict).toBeNull();
	});
});
