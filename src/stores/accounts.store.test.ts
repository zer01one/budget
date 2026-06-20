import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAccountsStore } from "./accounts.store";
import type { Account } from "@/types";

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

type AddInput = Omit<Account, "id" | "updatedAt" | "deviceId" | "version">;

function makeInput(overrides: Partial<AddInput> = {}): AddInput {
	return {
		name: "Wallet",
		type: "cash",
		currency: "KZT",
		initialBalance: 0,
		color: "#aabbcc",
		icon: "wallet",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		...overrides
	};
}

// в”Ђв”Ђ activeAccounts в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("activeAccounts", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns empty array when no accounts", () => {
		const store = useAccountsStore();
		expect(store.activeAccounts).toEqual([]);
	});

	it("returns only non-archived accounts", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "1", isArchived: false }), makeAccount({ id: "2", isArchived: true })];
		expect(store.activeAccounts).toHaveLength(1);
		expect(store.activeAccounts[0].id).toBe("1");
	});

	it("returns all accounts when none archived", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "1" }), makeAccount({ id: "2" }), makeAccount({ id: "3" })];
		expect(store.activeAccounts).toHaveLength(3);
	});

	it("returns empty array when all accounts archived", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ isArchived: true }), makeAccount({ id: "2", isArchived: true })];
		expect(store.activeAccounts).toHaveLength(0);
	});

	it("is reactive вЂ” updates when account is archived", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "1", isArchived: false })];
		expect(store.activeAccounts).toHaveLength(1);
		store.accounts[0].isArchived = true;
		expect(store.activeAccounts).toHaveLength(0);
	});
});

// в”Ђв”Ђ getById в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("getById", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns the account with matching id", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "target" })];
		expect(store.getById("target")?.id).toBe("target");
	});

	it("returns undefined when id not found", () => {
		const store = useAccountsStore();
		expect(store.getById("nope")).toBeUndefined();
	});

	it("returns the correct account among several", () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a" }), makeAccount({ id: "b" }), makeAccount({ id: "c" })];
		expect(store.getById("b")?.id).toBe("b");
	});
});

// в”Ђв”Ђ addAccount в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("addAccount", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("adds the account to the accounts array", async () => {
		const store = useAccountsStore();
		await store.addAccount(makeInput());
		expect(store.accounts).toHaveLength(1);
	});

	it("returns the created account", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput({ name: "Savings" }));
		expect(result.name).toBe("Savings");
	});

	it("assigns a non-empty UUID id", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput());
		expect(result.id).toBeTruthy();
		expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("sets version to 1", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput());
		expect(result.version).toBe(1);
	});

	it("sets deviceId from settings store", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput());
		expect(result.deviceId).toBe("device-x");
	});

	it("sets updatedAt to a valid ISO timestamp", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput());
		expect(() => new Date(result.updatedAt)).not.toThrow();
		expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
	});

	it("preserves all input fields", async () => {
		const store = useAccountsStore();
		const input = makeInput({ name: "Crypto", type: "crypto", currency: "USD", initialBalance: 500, color: "#ff0000", sortOrder: 3, notes: "btc" });
		const result = await store.addAccount(input);
		expect(result.name).toBe("Crypto");
		expect(result.type).toBe("crypto");
		expect(result.currency).toBe("USD");
		expect(result.initialBalance).toBe(500);
		expect(result.color).toBe("#ff0000");
		expect(result.sortOrder).toBe(3);
		expect(result.notes).toBe("btc");
	});

	it("each call generates a unique id", async () => {
		const store = useAccountsStore();
		const a = await store.addAccount(makeInput());
		const b = await store.addAccount(makeInput());
		expect(a.id).not.toBe(b.id);
	});

	it("returned account is the same object that ends up in accounts array", async () => {
		const store = useAccountsStore();
		const result = await store.addAccount(makeInput());
		expect(store.accounts).toContainEqual(result);
	});
});

// в”Ђв”Ђ updateAccount в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("updateAccount", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("updates the specified field", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", name: "Old" })];
		await store.updateAccount("a", { name: "New" });
		expect(store.accounts[0].name).toBe("New");
	});

	it("bumps version by 1", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", version: 3 })];
		await store.updateAccount("a", { color: "#000" });
		expect(store.accounts[0].version).toBe(4);
	});

	it("sets deviceId from settings store", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", deviceId: "old-device" })];
		await store.updateAccount("a", { name: "X" });
		expect(store.accounts[0].deviceId).toBe("device-x");
	});

	it("updates updatedAt", async () => {
		const store = useAccountsStore();
		const old = "2020-01-01T00:00:00Z";
		store.accounts = [makeAccount({ id: "a", updatedAt: old })];
		await store.updateAccount("a", { name: "X" });
		expect(store.accounts[0].updatedAt).not.toBe(old);
	});

	it("does nothing when id not found", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", name: "Unchanged" })];
		await store.updateAccount("missing", { name: "Changed" });
		expect(store.accounts[0].name).toBe("Unchanged");
	});

	it("does not affect other accounts", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", name: "A" }), makeAccount({ id: "b", name: "B" })];
		await store.updateAccount("a", { name: "A-updated" });
		expect(store.accounts[1].name).toBe("B");
	});

	it("preserves fields not in patch", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", currency: "USD", initialBalance: 999 })];
		await store.updateAccount("a", { name: "New" });
		expect(store.accounts[0].currency).toBe("USD");
		expect(store.accounts[0].initialBalance).toBe(999);
	});
});

// в”Ђв”Ђ deleteAccount в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("deleteAccount", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("sets isArchived to true (soft delete)", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a", isArchived: false })];
		await store.deleteAccount("a");
		expect(store.accounts[0].isArchived).toBe(true);
	});

	it("keeps the account in the array (does not hard-delete)", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a" })];
		await store.deleteAccount("a");
		expect(store.accounts).toHaveLength(1);
	});

	it("does not affect other accounts", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a" }), makeAccount({ id: "b" })];
		await store.deleteAccount("a");
		expect(store.accounts.find((x) => x.id === "b")?.isArchived).toBe(false);
	});

	it("deleted account disappears from activeAccounts", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a" })];
		await store.deleteAccount("a");
		expect(store.activeAccounts).toHaveLength(0);
	});

	it("does nothing for unknown id", async () => {
		const store = useAccountsStore();
		store.accounts = [makeAccount({ id: "a" })];
		await store.deleteAccount("nope");
		expect(store.accounts[0].isArchived).toBe(false);
	});
});

