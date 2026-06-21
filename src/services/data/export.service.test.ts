import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transactionsToCSV, exportTransactionsCSV, exportVaultJSON } from "./export.service";
import type { Transaction, Account, Category } from "@/types";

const { mockExportFile, mockGetFs } = vi.hoisted(() => ({
	mockExportFile: vi.fn(),
	mockGetFs: vi.fn()
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: mockGetFs
}));

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

// ── exportTransactionsCSV ─────────────────────────────────────────────────────

describe("exportTransactionsCSV", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
		mockExportFile.mockResolvedValue(undefined);
		mockGetFs.mockResolvedValue({ exportFile: mockExportFile });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("calls exportFile with text/csv mime type", async () => {
		await exportTransactionsCSV([], [], []);
		expect(mockExportFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), "text/csv;charset=utf-8");
	});

	it("filename matches budget-export-<date>.csv pattern", async () => {
		await exportTransactionsCSV([], [], []);
		const expectedDate = new Date().toLocaleDateString("en-CA");
		expect(mockExportFile).toHaveBeenCalledWith(`budget-export-${expectedDate}.csv`, expect.any(String), expect.any(String));
	});

	it("CSV content is passed to exportFile", async () => {
		await exportTransactionsCSV([makeTx({ comment: "unique-marker" })], [makeAccount()], [makeCategory()]);
		const csv: string = mockExportFile.mock.calls[0][1];
		expect(csv).toContain("unique-marker");
	});

	it("no date filter — all non-deleted transactions are exported", async () => {
		const txs = [makeTx({ id: "1" }), makeTx({ id: "2", isDeleted: true }), makeTx({ id: "3" })];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()]);
		const lines: string[] = mockExportFile.mock.calls[0][1].split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(3); // header + 2 non-deleted
	});

	it("fromDate filters out earlier transactions", async () => {
		const txs = [makeTx({ id: "1", date: "2026-01-01" }), makeTx({ id: "2", date: "2026-06-01" })];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()], "2026-03-01");
		const csv: string = mockExportFile.mock.calls[0][1];
		expect(csv).not.toContain("2026-01-01");
		expect(csv).toContain("2026-06-01");
	});

	it("toDate filters out later transactions", async () => {
		const txs = [makeTx({ id: "1", date: "2026-01-01" }), makeTx({ id: "2", date: "2026-06-01" })];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()], undefined, "2026-03-01");
		const csv: string = mockExportFile.mock.calls[0][1];
		expect(csv).toContain("2026-01-01");
		expect(csv).not.toContain("2026-06-01");
	});

	it("both fromDate and toDate — keeps only transactions in range", async () => {
		const txs = [
			makeTx({ id: "1", date: "2026-01-01" }),
			makeTx({ id: "2", date: "2026-03-15" }),
			makeTx({ id: "3", date: "2026-06-01" })
		];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()], "2026-03-01", "2026-04-30");
		const csv: string = mockExportFile.mock.calls[0][1];
		expect(csv).not.toContain("2026-01-01");
		expect(csv).toContain("2026-03-15");
		expect(csv).not.toContain("2026-06-01");
	});

	it("fromDate === toDate — keeps only that exact date (inclusive both ends)", async () => {
		const txs = [makeTx({ id: "1", date: "2026-03-15" }), makeTx({ id: "2", date: "2026-03-16" })];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()], "2026-03-15", "2026-03-15");
		const lines: string[] = mockExportFile.mock.calls[0][1].split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(2); // header + 1
		expect(lines[1]).toContain("2026-03-15");
	});

	it("date-filtered result still excludes deleted transactions", async () => {
		const txs = [makeTx({ id: "1", date: "2026-03-15", isDeleted: true }), makeTx({ id: "2", date: "2026-03-15" })];
		await exportTransactionsCSV(txs, [makeAccount()], [makeCategory()], "2026-03-01", "2026-04-30");
		const lines: string[] = mockExportFile.mock.calls[0][1].split("\r\n").filter(Boolean);
		expect(lines).toHaveLength(2); // header + 1 non-deleted
	});
});

// ── exportVaultJSON ───────────────────────────────────────────────────────────

describe("exportVaultJSON", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
		mockExportFile.mockResolvedValue(undefined);
		mockGetFs.mockResolvedValue({ exportFile: mockExportFile });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("calls exportFile with application/json mime type", async () => {
		await exportVaultJSON([]);
		expect(mockExportFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), "application/json");
	});

	it("filename matches budget-transactions-<date>.json pattern", async () => {
		await exportVaultJSON([]);
		const expectedDate = new Date().toLocaleDateString("en-CA");
		expect(mockExportFile).toHaveBeenCalledWith(`budget-transactions-${expectedDate}.json`, expect.any(String), expect.any(String));
	});

	it("JSON contains exportedAt as ISO string matching current time", async () => {
		await exportVaultJSON([]);
		const json = JSON.parse(mockExportFile.mock.calls[0][1]);
		expect(json.exportedAt).toBe(new Date().toISOString());
	});

	it("JSON contains transactions array with all passed transactions", async () => {
		const txs = [makeTx({ id: "tx-a" }), makeTx({ id: "tx-b" })];
		await exportVaultJSON(txs);
		const json = JSON.parse(mockExportFile.mock.calls[0][1]);
		expect(json.transactions).toHaveLength(2);
		expect(json.transactions[0].id).toBe("tx-a");
		expect(json.transactions[1].id).toBe("tx-b");
	});

	it("empty transactions array produces valid JSON with empty array", async () => {
		await exportVaultJSON([]);
		const json = JSON.parse(mockExportFile.mock.calls[0][1]);
		expect(json.transactions).toEqual([]);
	});

	it("JSON is pretty-printed with 2-space indent", async () => {
		await exportVaultJSON([]);
		const raw: string = mockExportFile.mock.calls[0][1];
		expect(raw).toContain("\n  ");
	});

	it("transactions in JSON are not filtered — includes deleted", async () => {
		const txs = [makeTx({ id: "1", isDeleted: false }), makeTx({ id: "2", isDeleted: true })];
		await exportVaultJSON(txs);
		const json = JSON.parse(mockExportFile.mock.calls[0][1]);
		expect(json.transactions).toHaveLength(2);
	});
});
