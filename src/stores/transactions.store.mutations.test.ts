import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTransactionsStore } from "./transactions.store";
import type { Transaction } from "@/types";

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

const mockAdjustBalance = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/stores/accounts.store", () => ({
	useAccountsStore: vi.fn(() => ({ adjustBalance: mockAdjustBalance }))
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "device-x" } }))
}));

type AddInput = Omit<Transaction, "id" | "updatedAt" | "deviceId" | "version" | "isDeleted">;

function makeInput(overrides: Partial<AddInput> = {}): AddInput {
	return {
		type: "expense",
		amount: 100,
		currency: "KZT",
		date: "2026-06-15",
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "coffee",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		...overrides
	};
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		isDeleted: false,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...makeInput(),
		...overrides
	};
}

function seedCache(store: ReturnType<typeof useTransactionsStore>, month: string, txs: Transaction[]) {
	store._cache.set(month, txs);
	store.loadedMonths.add(month);
}

// в”Ђв”Ђ addTransaction в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("addTransaction", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mockAdjustBalance.mockClear();
	});

	it("returns a transaction with isDeleted=false", async () => {
		const store = useTransactionsStore();
		const result = await store.addTransaction(makeInput());
		expect(result.isDeleted).toBe(false);
	});

	it("assigns a non-empty UUID id", async () => {
		const store = useTransactionsStore();
		const result = await store.addTransaction(makeInput());
		expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("sets version to 1", async () => {
		const store = useTransactionsStore();
		const result = await store.addTransaction(makeInput());
		expect(result.version).toBe(1);
	});

	it("sets deviceId from settings store", async () => {
		const store = useTransactionsStore();
		const result = await store.addTransaction(makeInput());
		expect(result.deviceId).toBe("device-x");
	});

	it("sets updatedAt to a valid ISO timestamp", async () => {
		const store = useTransactionsStore();
		const result = await store.addTransaction(makeInput());
		expect(() => new Date(result.updatedAt)).not.toThrow();
		expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
	});

	it("preserves all input fields", async () => {
		const store = useTransactionsStore();
		const input = makeInput({
			type: "income",
			amount: 500,
			currency: "USD",
			date: "2026-03-01",
			time: "08:00",
			accountId: "acc-99",
			comment: "bonus",
			tags: ["work"]
		});
		const result = await store.addTransaction(input);
		expect(result.type).toBe("income");
		expect(result.amount).toBe(500);
		expect(result.currency).toBe("USD");
		expect(result.date).toBe("2026-03-01");
		expect(result.time).toBe("08:00");
		expect(result.accountId).toBe("acc-99");
		expect(result.comment).toBe("bonus");
		expect(result.tags).toEqual(["work"]);
	});

	it("adds transaction to the correct month cache", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		await store.addTransaction(makeInput({ date: "2026-06-15" }));
		expect(store.getByMonth("2026-06")).toHaveLength(1);
	});

	it("routes transaction to the month derived from its date", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-03", []);
		await store.addTransaction(makeInput({ date: "2026-03-20" }));
		expect(store.getByMonth("2026-03")).toHaveLength(1);
		expect(store.getByMonth("2026-06")).toHaveLength(0);
	});

	it("each call generates a unique id", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		const a = await store.addTransaction(makeInput());
		const b = await store.addTransaction(makeInput());
		expect(a.id).not.toBe(b.id);
	});

	it("returned transaction appears in allCached", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		const result = await store.addTransaction(makeInput());
		expect(store.allCached.map((t) => t.id)).toContain(result.id);
	});

	it("appends to existing transactions in the same month", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "existing" })]);
		await store.addTransaction(makeInput({ date: "2026-06-20" }));
		expect(store.getByMonth("2026-06")).toHaveLength(2);
	});

	it("does not affect other months' caches", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "june-tx" })]);
		seedCache(store, "2026-05", [makeTx({ id: "may-tx" })]);
		await store.addTransaction(makeInput({ date: "2026-06-10" }));
		expect(store.getByMonth("2026-05")).toHaveLength(1);
	});

	it("calls adjustBalance with negative delta for expense", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		await store.addTransaction(makeInput({ type: "expense", amount: 200, accountId: "acc-1" }));
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", -200);
	});

	it("calls adjustBalance with positive delta for income", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		await store.addTransaction(makeInput({ type: "income", amount: 500, accountId: "acc-1" }));
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", 500);
	});

	it("calls adjustBalance for both accounts on transfer", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", []);
		await store.addTransaction(makeInput({ type: "transfer", amount: 300, accountId: "acc-1", toAccountId: "acc-2" }));
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", -300);
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-2", 300);
	});
});

// в”Ђв”Ђ updateTransaction в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("updateTransaction", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("updates the specified field", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", comment: "old" })]);
		await store.updateTransaction("tx-1", { comment: "new" });
		expect(store.getByMonth("2026-06")[0].comment).toBe("new");
	});

	it("bumps version by 1", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", version: 3 })]);
		await store.updateTransaction("tx-1", { comment: "x" });
		expect(store.getByMonth("2026-06")[0].version).toBe(4);
	});

	it("sets deviceId from settings store", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", deviceId: "old" })]);
		await store.updateTransaction("tx-1", { comment: "x" });
		expect(store.getByMonth("2026-06")[0].deviceId).toBe("device-x");
	});

	it("updates updatedAt", async () => {
		const store = useTransactionsStore();
		const old = "2020-01-01T00:00:00Z";
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", updatedAt: old })]);
		await store.updateTransaction("tx-1", { comment: "x" });
		expect(store.getByMonth("2026-06")[0].updatedAt).not.toBe(old);
	});

	it("preserves fields not in patch", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", amount: 500, currency: "USD" })]);
		await store.updateTransaction("tx-1", { comment: "changed" });
		const tx = store.getByMonth("2026-06")[0];
		expect(tx.amount).toBe(500);
		expect(tx.currency).toBe("USD");
	});

	it("does nothing when id not found", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", comment: "original" })]);
		await store.updateTransaction("missing", { comment: "changed" });
		expect(store.getByMonth("2026-06")[0].comment).toBe("original");
	});

	it("does not affect other transactions in same month", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "a", comment: "a" }), makeTx({ id: "b", comment: "b" })]);
		await store.updateTransaction("a", { comment: "updated" });
		expect(store.getByMonth("2026-06").find((t) => t.id === "b")?.comment).toBe("b");
	});

	it("finds and updates transaction across different cached months", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-05", [makeTx({ id: "may-tx", comment: "old" })]);
		seedCache(store, "2026-06", [makeTx({ id: "june-tx", comment: "other" })]);
		await store.updateTransaction("may-tx", { comment: "updated" });
		expect(store.getByMonth("2026-05").find((t) => t.id === "may-tx")?.comment).toBe("updated");
		expect(store.getByMonth("2026-06").find((t) => t.id === "june-tx")?.comment).toBe("other");
	});
});

// в”Ђв”Ђ deleteTransaction в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("deleteTransaction", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("sets isDeleted to true", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", isDeleted: false })]);
		await store.deleteTransaction("tx-1");
		expect(store.getByMonth("2026-06")[0].isDeleted).toBe(true);
	});

	it("keeps the transaction in the cache (soft delete)", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1" })]);
		await store.deleteTransaction("tx-1");
		expect(store.getByMonth("2026-06")).toHaveLength(1);
	});

	it("bumps version", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", version: 2 })]);
		await store.deleteTransaction("tx-1");
		expect(store.getByMonth("2026-06")[0].version).toBe(3);
	});

	it("does not affect other transactions", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "a" }), makeTx({ id: "b" })]);
		await store.deleteTransaction("a");
		expect(store.getByMonth("2026-06").find((t) => t.id === "b")?.isDeleted).toBe(false);
	});

	it("does nothing for unknown id", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", isDeleted: false })]);
		await store.deleteTransaction("nope");
		expect(store.getByMonth("2026-06")[0].isDeleted).toBe(false);
	});
});

// в”Ђв”Ђ loadCurrentAndPrevMonth в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("loadCurrentAndPrevMonth", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("loads exactly 2 months into loadedMonths", async () => {
		const store = useTransactionsStore();
		await store.loadCurrentAndPrevMonth();
		expect(store.loadedMonths.size).toBe(2);
	});

	it("does not re-load already cached months", async () => {
		const { transactionsService } = await import("@/services/data/transactions.service");
		vi.mocked(transactionsService.loadMonth).mockClear();
		const store = useTransactionsStore();
		// pre-seed both months so they're already in loadedMonths
		const now = new Date();
		const current = now.toLocaleDateString("en-CA").slice(0, 7);
		store.loadedMonths.add(current);
		const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const prev = prevDate.toLocaleDateString("en-CA").slice(0, 7);
		store.loadedMonths.add(prev);
		await store.loadCurrentAndPrevMonth();
		expect(transactionsService.loadMonth).not.toHaveBeenCalled();
	});
});

// ── updateTransaction – balance adjustments ───────────────────────────────────

describe("updateTransaction – balance adjustments", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mockAdjustBalance.mockClear();
	});

	it("adjusts balance when amount increases", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", type: "expense", amount: 100, accountId: "acc-1" })]);
		await store.updateTransaction("tx-1", { amount: 200 });
		// old delta: -100, new delta: -200, diff: -100
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", -100);
	});

	it("adjusts balance when type changes from income to expense", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", type: "income", amount: 500, accountId: "acc-1" })]);
		await store.updateTransaction("tx-1", { type: "expense" });
		// old delta: +500, new delta: -500, diff: -1000
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", -1000);
	});

	it("does not call adjustBalance when only comment changes", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", type: "expense", amount: 100, accountId: "acc-1" })]);
		await store.updateTransaction("tx-1", { comment: "updated" });
		expect(mockAdjustBalance).not.toHaveBeenCalled();
	});

	it("reverses both accounts when transfer is soft-deleted", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [
			makeTx({ id: "tx-1", type: "transfer", amount: 300, accountId: "acc-1", toAccountId: "acc-2", isDeleted: false })
		]);
		await store.updateTransaction("tx-1", { isDeleted: true });
		// from account: old -300, new 0 → +300
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", 300);
		// to account: old +300, new 0 → -300
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-2", -300);
	});
});

// ── deleteTransaction – balance reversal ──────────────────────────────────────

describe("deleteTransaction – balance reversal", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mockAdjustBalance.mockClear();
	});

	it("reverses expense on delete", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", type: "expense", amount: 150, accountId: "acc-1" })]);
		await store.deleteTransaction("tx-1");
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", 150);
	});

	it("reverses income on delete", async () => {
		const store = useTransactionsStore();
		seedCache(store, "2026-06", [makeTx({ id: "tx-1", type: "income", amount: 400, accountId: "acc-1" })]);
		await store.deleteTransaction("tx-1");
		expect(mockAdjustBalance).toHaveBeenCalledWith("acc-1", -400);
	});
});
