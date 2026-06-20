import { describe, it, expect } from "vitest";
import { transactionsToCSV } from "../export.service";
import type { Transaction, Account, Category } from "@/types";

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Cash",
		type: "cash",
		currency: "KZT",
		initialBalance: 0,
		color: "#fff",
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
		color: "#f00",
		icon: "food",
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
		categoryId: "cat-1",
		comment: "coffee",
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

// ── header ────────────────────────────────────────────────────────────────────

describe("transactionsToCSV – header", () => {
	it("first line is the correct header", () => {
		const csv = transactionsToCSV([], [], []);
		const firstLine = csv.split("\r\n")[0];
		expect(firstLine).toBe("Дата,Время,Тип,Сумма,Валюта,Счёт,Категория,Комментарий");
	});

	it("returns only header when no transactions", () => {
		const csv = transactionsToCSV([], [], []);
		const lines = csv.split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(1);
	});
});

// ── filtering ─────────────────────────────────────────────────────────────────

describe("transactionsToCSV – filtering", () => {
	it("excludes deleted transactions", () => {
		const tx = makeTx({ isDeleted: true });
		const csv = transactionsToCSV([tx], [makeAccount()], [makeCategory()]);
		const lines = csv.split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(1); // only header
	});

	it("includes non-deleted transactions", () => {
		const tx = makeTx({ isDeleted: false });
		const csv = transactionsToCSV([tx], [makeAccount()], [makeCategory()]);
		const lines = csv.split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(2);
	});

	it("mixes deleted and non-deleted, only exports non-deleted", () => {
		const txs = [makeTx({ id: "1", isDeleted: false }), makeTx({ id: "2", isDeleted: true }), makeTx({ id: "3", isDeleted: false })];
		const lines = transactionsToCSV(txs, [makeAccount()], [makeCategory()]).split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(3); // header + 2 non-deleted
	});
});

// ── sorting ───────────────────────────────────────────────────────────────────

describe("transactionsToCSV – sorting", () => {
	it("sorts rows by date ascending", () => {
		const txs = [makeTx({ id: "a", date: "2026-03-01", time: "10:00" }), makeTx({ id: "b", date: "2026-01-01", time: "10:00" })];
		const lines = transactionsToCSV(txs, [makeAccount()], [makeCategory()]).split("\r\n").filter(Boolean);
		expect(lines[1].startsWith("2026-01-01")).toBe(true);
		expect(lines[2].startsWith("2026-03-01")).toBe(true);
	});

	it("sorts same-date rows by time ascending", () => {
		const txs = [makeTx({ id: "a", date: "2026-01-01", time: "15:00" }), makeTx({ id: "b", date: "2026-01-01", time: "09:00" })];
		const lines = transactionsToCSV(txs, [makeAccount()], [makeCategory()]).split("\r\n").filter(Boolean);
		const row1 = lines[1].split(",");
		const row2 = lines[2].split(",");
		expect(row1[1]).toBe("09:00");
		expect(row2[1]).toBe("15:00");
	});
});

// ── type labels ───────────────────────────────────────────────────────────────

describe("transactionsToCSV – type labels", () => {
	it("labels expense as Расход", () => {
		const csv = transactionsToCSV([makeTx({ type: "expense" })], [makeAccount()], [makeCategory()]);
		expect(csv).toContain("Расход");
	});

	it("labels income as Доход", () => {
		const csv = transactionsToCSV([makeTx({ type: "income" })], [makeAccount()], [makeCategory()]);
		expect(csv).toContain("Доход");
	});

	it("labels transfer as Перевод", () => {
		const csv = transactionsToCSV([makeTx({ type: "transfer" })], [makeAccount()], [makeCategory()]);
		expect(csv).toContain("Перевод");
	});
});

// ── amount sign ───────────────────────────────────────────────────────────────

describe("transactionsToCSV – amount sign", () => {
	it("expense amount is negative", () => {
		const lines = transactionsToCSV([makeTx({ type: "expense", amount: 500 })], [makeAccount()], [makeCategory()]).split("\r\n");
		const cells = lines[1].split(",");
		expect(Number(cells[3])).toBe(-500);
	});

	it("income amount is positive", () => {
		const lines = transactionsToCSV([makeTx({ type: "income", amount: 500 })], [makeAccount()], [makeCategory()]).split("\r\n");
		const cells = lines[1].split(",");
		expect(Number(cells[3])).toBe(500);
	});

	it("transfer amount is positive", () => {
		const lines = transactionsToCSV([makeTx({ type: "transfer", amount: 500 })], [makeAccount()], [makeCategory()]).split("\r\n");
		const cells = lines[1].split(",");
		expect(Number(cells[3])).toBe(500);
	});
});

// ── name resolution ───────────────────────────────────────────────────────────

describe("transactionsToCSV – name resolution", () => {
	it("resolves account name", () => {
		const acc = makeAccount({ id: "acc-1", name: "Wallet" });
		const csv = transactionsToCSV([makeTx({ accountId: "acc-1" })], [acc], [makeCategory()]);
		expect(csv).toContain("Wallet");
	});

	it("falls back to account id when account not found", () => {
		const csv = transactionsToCSV([makeTx({ accountId: "unknown-acc" })], [], [makeCategory()]);
		expect(csv).toContain("unknown-acc");
	});

	it("resolves category name", () => {
		const cat = makeCategory({ id: "cat-1", name: "Groceries" });
		const csv = transactionsToCSV([makeTx({ categoryId: "cat-1" })], [makeAccount()], [cat]);
		expect(csv).toContain("Groceries");
	});

	it("uses empty string when category is null", () => {
		const lines = transactionsToCSV([makeTx({ categoryId: null })], [makeAccount()], []).split("\r\n");
		const cells = lines[1].split(",");
		expect(cells[6]).toBe("");
	});

	it("uses empty string when categoryId not found in category list", () => {
		const lines = transactionsToCSV([makeTx({ categoryId: "missing" })], [makeAccount()], []).split("\r\n");
		const cells = lines[1].split(",");
		expect(cells[6]).toBe("");
	});
});

// ── CSV escaping ──────────────────────────────────────────────────────────────

describe("transactionsToCSV – CSV escaping", () => {
	it("wraps field in quotes when it contains a comma", () => {
		const cat = makeCategory({ id: "cat-1", name: "Food, Drinks" });
		const csv = transactionsToCSV([makeTx()], [makeAccount()], [cat]);
		expect(csv).toContain('"Food, Drinks"');
	});

	it("escapes double-quotes inside a field", () => {
		const tx = makeTx({ comment: 'say "hi"' });
		const csv = transactionsToCSV([tx], [makeAccount()], [makeCategory()]);
		expect(csv).toContain('"say ""hi"""');
	});

	it("wraps field in quotes when it contains a newline", () => {
		const tx = makeTx({ comment: "line1\nline2" });
		const csv = transactionsToCSV([tx], [makeAccount()], [makeCategory()]);
		expect(csv).toContain('"line1\nline2"');
	});

	it("does not quote plain strings", () => {
		const tx = makeTx({ comment: "simple" });
		const lines = transactionsToCSV([tx], [makeAccount()], [makeCategory()]).split("\r\n");
		const cells = lines[1].split(",");
		expect(cells[7]).toBe("simple");
	});
});

// ── line endings ──────────────────────────────────────────────────────────────

describe("transactionsToCSV – line endings", () => {
	it("uses CRLF as line separator", () => {
		const csv = transactionsToCSV([makeTx()], [makeAccount()], [makeCategory()]);
		expect(csv).toContain("\r\n");
		expect(csv.split("\r\n").length).toBeGreaterThan(1);
	});
});
