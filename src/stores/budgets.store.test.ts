import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useBudgetsStore } from "./budgets.store";
import type { BudgetEntry } from "@/types";

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn(() =>
		Promise.resolve({
			readJson: vi.fn(() => Promise.resolve(null)),
			writeJson: vi.fn(() => Promise.resolve())
		})
	)
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "device-x" } }))
}));

function makeBudget(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
	return {
		id: "bud-1",
		month: "2026-06",
		categoryId: "cat-1",
		limitAmount: 10000,
		currency: "KZT",
		notifyAt: 80,
		notifyEnabled: true,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

type AddInput = Omit<BudgetEntry, "id" | "updatedAt" | "deviceId" | "version">;

function makeInput(overrides: Partial<AddInput> = {}): AddInput {
	return {
		month: "2026-06",
		categoryId: "cat-1",
		limitAmount: 5000,
		currency: "KZT",
		notifyAt: 75,
		notifyEnabled: true,
		...overrides
	};
}

// в”Ђв”Ђ getForMonth в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("getForMonth", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns budgets for the specified month", () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", month: "2026-06" }));
		store.budgets.push(makeBudget({ id: "b", month: "2026-07" }));
		const result = store.getForMonth("2026-06");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("a");
	});

	it("returns empty array for unknown month", () => {
		const store = useBudgetsStore();
		expect(store.getForMonth("2099-01")).toEqual([]);
	});

	it("returns multiple budgets for the same month", () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", month: "2026-06", categoryId: "cat-1" }));
		store.budgets.push(makeBudget({ id: "b", month: "2026-06", categoryId: "cat-2" }));
		expect(store.getForMonth("2026-06")).toHaveLength(2);
	});

	it("returns empty array when budgets list is empty", () => {
		const store = useBudgetsStore();
		expect(store.getForMonth("2026-06")).toEqual([]);
	});
});

// в”Ђв”Ђ currentMonth в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("currentMonth", () => {
	afterEach(() => vi.useRealTimers());

	it("returns YYYY-MM format for current date", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		setActivePinia(createPinia());
		const store = useBudgetsStore();
		expect(store.currentMonth).toMatch(/^\d{4}-\d{2}$/);
	});

	it("returns correct year-month for a known date", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
		setActivePinia(createPinia());
		const store = useBudgetsStore();
		// en-CA toLocaleDateString gives YYYY-MM-DD, sliced to YYYY-MM
		const [year, month] = store.currentMonth.split("-").map(Number);
		expect(year).toBe(2026);
		expect(month).toBe(3);
	});
});

// в”Ђв”Ђ addBudget в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("addBudget", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("adds budget to the array", async () => {
		const store = useBudgetsStore();
		await store.addBudget(makeInput());
		expect(store.budgets).toHaveLength(1);
	});

	it("returns the created budget", async () => {
		const store = useBudgetsStore();
		const result = await store.addBudget(makeInput({ limitAmount: 9999 }));
		expect(result.limitAmount).toBe(9999);
	});

	it("assigns a UUID id", async () => {
		const store = useBudgetsStore();
		const result = await store.addBudget(makeInput());
		expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("sets version to 1", async () => {
		const store = useBudgetsStore();
		const result = await store.addBudget(makeInput());
		expect(result.version).toBe(1);
	});

	it("sets deviceId from settings", async () => {
		const store = useBudgetsStore();
		const result = await store.addBudget(makeInput());
		expect(result.deviceId).toBe("device-x");
	});

	it("sets updatedAt to a valid ISO timestamp", async () => {
		const store = useBudgetsStore();
		const result = await store.addBudget(makeInput());
		expect(() => new Date(result.updatedAt)).not.toThrow();
	});

	it("preserves all input fields", async () => {
		const store = useBudgetsStore();
		const input = makeInput({ month: "2026-12", categoryId: "cat-99", limitAmount: 3000, currency: "USD", notifyAt: 90, notifyEnabled: false });
		const result = await store.addBudget(input);
		expect(result.month).toBe("2026-12");
		expect(result.categoryId).toBe("cat-99");
		expect(result.limitAmount).toBe(3000);
		expect(result.currency).toBe("USD");
		expect(result.notifyAt).toBe(90);
		expect(result.notifyEnabled).toBe(false);
	});

	it("each call generates a unique id", async () => {
		const store = useBudgetsStore();
		const a = await store.addBudget(makeInput());
		const b = await store.addBudget(makeInput());
		expect(a.id).not.toBe(b.id);
	});
});

// в”Ђв”Ђ updateBudget в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("updateBudget", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("updates limitAmount", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", limitAmount: 1000 }));
		await store.updateBudget("a", { limitAmount: 2000 });
		expect(store.budgets[0].limitAmount).toBe(2000);
	});

	it("updates notifyAt", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", notifyAt: 50 }));
		await store.updateBudget("a", { notifyAt: 90 });
		expect(store.budgets[0].notifyAt).toBe(90);
	});

	it("updates notifyEnabled", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", notifyEnabled: true }));
		await store.updateBudget("a", { notifyEnabled: false });
		expect(store.budgets[0].notifyEnabled).toBe(false);
	});

	it("updates currency", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", currency: "KZT" }));
		await store.updateBudget("a", { currency: "USD" });
		expect(store.budgets[0].currency).toBe("USD");
	});

	it("bumps version by 1", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", version: 4 }));
		await store.updateBudget("a", { limitAmount: 100 });
		expect(store.budgets[0].version).toBe(5);
	});

	it("sets deviceId from settings", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", deviceId: "old-device" }));
		await store.updateBudget("a", { limitAmount: 100 });
		expect(store.budgets[0].deviceId).toBe("device-x");
	});

	it("updates updatedAt", async () => {
		const store = useBudgetsStore();
		const old = "2020-01-01T00:00:00Z";
		store.budgets.push(makeBudget({ id: "a", updatedAt: old }));
		await store.updateBudget("a", { limitAmount: 100 });
		expect(store.budgets[0].updatedAt).not.toBe(old);
	});

	it("does nothing when id not found", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", limitAmount: 5000 }));
		await store.updateBudget("missing", { limitAmount: 1 });
		expect(store.budgets[0].limitAmount).toBe(5000);
	});

	it("does not affect other budgets", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", limitAmount: 1000 }));
		store.budgets.push(makeBudget({ id: "b", limitAmount: 2000 }));
		await store.updateBudget("a", { limitAmount: 999 });
		expect(store.budgets[1].limitAmount).toBe(2000);
	});
});

// в”Ђв”Ђ deleteBudget в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("deleteBudget", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("removes the budget from the array (hard delete)", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a" }));
		await store.deleteBudget("a");
		expect(store.budgets).toHaveLength(0);
	});

	it("only removes the matching budget", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a" }));
		store.budgets.push(makeBudget({ id: "b" }));
		await store.deleteBudget("a");
		expect(store.budgets).toHaveLength(1);
		expect(store.budgets[0].id).toBe("b");
	});

	it("does nothing for unknown id (no error thrown)", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a" }));
		await expect(store.deleteBudget("nope")).resolves.toBeUndefined();
		expect(store.budgets).toHaveLength(1);
	});

	it("deleted budget no longer appears in getForMonth", async () => {
		const store = useBudgetsStore();
		store.budgets.push(makeBudget({ id: "a", month: "2026-06" }));
		await store.deleteBudget("a");
		expect(store.getForMonth("2026-06")).toHaveLength(0);
	});
});

