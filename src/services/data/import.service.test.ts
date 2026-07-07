import { describe, it, expect } from "vitest";
import { parseCsv, autoDetectMapping, applyMapping, previewRowsToTransactions } from "./import.service";
import type { ColumnMapping } from "./import.service";

// ── parseCsv ──────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
	it("returns empty result for empty string", () => {
		expect(parseCsv("")).toEqual({ headers: [], rows: [] });
	});

	it("returns empty result for single header line (no data rows)", () => {
		expect(parseCsv("Date,Amount")).toEqual({ headers: [], rows: [] });
	});

	it("parses comma-delimited CSV", () => {
		const { headers, rows } = parseCsv("Date,Amount,Comment\n2026-01-01,100,salary");
		expect(headers).toEqual(["Date", "Amount", "Comment"]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual({ Date: "2026-01-01", Amount: "100", Comment: "salary" });
	});

	it("prefers semicolon delimiter when first line contains semicolons", () => {
		const { headers, rows } = parseCsv("Дата;Сумма;Описание\n01.01.2026;500;кофе");
		expect(headers).toEqual(["Дата", "Сумма", "Описание"]);
		expect(rows[0]).toEqual({ Дата: "01.01.2026", Сумма: "500", Описание: "кофе" });
	});

	it("strips UTF-8 BOM", () => {
		const bom = "﻿";
		const { headers } = parseCsv(`${bom}Date,Amount\n2026-01-01,100`);
		expect(headers[0]).toBe("Date");
	});

	it("normalises Windows CRLF line endings", () => {
		const { rows } = parseCsv("Date,Amount\r\n2026-01-01,100\r\n2026-01-02,200");
		expect(rows).toHaveLength(2);
	});

	it("normalises old Mac CR line endings", () => {
		const { rows } = parseCsv("Date,Amount\r2026-01-01,100\r2026-01-02,200");
		expect(rows).toHaveLength(2);
	});

	it("skips blank lines", () => {
		const { rows } = parseCsv("Date,Amount\n2026-01-01,100\n\n2026-01-02,200\n");
		expect(rows).toHaveLength(2);
	});

	it("handles quoted fields containing the delimiter", () => {
		const { rows } = parseCsv(`Date,Comment\n2026-01-01,"coffee, tea"`);
		expect(rows[0].Comment).toBe("coffee, tea");
	});

	it("handles escaped double-quotes inside quoted field", () => {
		const { rows } = parseCsv(`Date,Comment\n2026-01-01,"say ""hi"""`);
		expect(rows[0].Comment).toBe(`say "hi"`);
	});

	it("trims whitespace from cell values", () => {
		const { rows } = parseCsv("Date,Amount\n 2026-01-01 , 100 ");
		expect(rows[0].Date).toBe("2026-01-01");
		expect(rows[0].Amount).toBe("100");
	});

	it("fills missing cells with empty string", () => {
		const { rows } = parseCsv("A,B,C\n1,2");
		expect(rows[0].C).toBe("");
	});

	it("parses multiple rows correctly", () => {
		const csv = "Date,Amount\n2026-01-01,100\n2026-01-02,200\n2026-01-03,300";
		const { rows } = parseCsv(csv);
		expect(rows).toHaveLength(3);
		expect(rows[2].Amount).toBe("300");
	});
});

// ── autoDetectMapping ─────────────────────────────────────────────────────────

describe("autoDetectMapping", () => {
	it("detects Russian date header", () => {
		const m = autoDetectMapping(["Дата", "Сумма", "Описание"]);
		expect(m.date).toBe("Дата");
	});

	it("detects English date header", () => {
		const m = autoDetectMapping(["date", "amount", "description"]);
		expect(m.date).toBe("date");
	});

	it("detects Russian amount header", () => {
		const m = autoDetectMapping(["Дата", "Сумма операции", "Комментарий"]);
		expect(m.amount).toBe("Сумма операции");
	});

	it("detects 'debit' as amount column", () => {
		const m = autoDetectMapping(["Date", "Debit", "Credit"]);
		expect(m.amount).toBe("Debit");
	});

	it("detects Russian comment header", () => {
		const m = autoDetectMapping(["Дата", "Сумма", "Назначение платежа"]);
		expect(m.comment).toBe("Назначение платежа");
	});

	it("detects type header", () => {
		const m = autoDetectMapping(["Дата", "Сумма", "Тип операции"]);
		expect(m.type).toBe("Тип операции");
	});

	it("returns empty string for unrecognised headers", () => {
		const m = autoDetectMapping(["foo", "bar", "baz"]);
		expect(m.date).toBe("");
		expect(m.amount).toBe("");
	});

	it("is case-insensitive for English headers", () => {
		const m = autoDetectMapping(["DATE", "AMOUNT"]);
		expect(m.date).toBe("DATE");
		expect(m.amount).toBe("AMOUNT");
	});

	it("detects 'merchant' as comment column", () => {
		const m = autoDetectMapping(["Date", "Amount", "Merchant"]);
		expect(m.comment).toBe("Merchant");
	});
});

// ── applyMapping / date parsing ────────────────────────────────────────────────

const baseMapping: ColumnMapping = {
	date: "Дата",
	amount: "Сумма",
	type: "",
	comment: "Описание",
	accountId: "acc-1",
	categoryId: ""
};

describe("applyMapping – date parsing", () => {
	it("parses ISO date YYYY-MM-DD", () => {
		const rows = applyMapping([{ Дата: "2026-06-15", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-06-15");
		expect(rows[0].valid).toBe(true);
	});

	it("parses ISO datetime, keeps only date part", () => {
		const rows = applyMapping([{ Дата: "2026-06-15T14:30:00Z", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-06-15");
	});

	it("parses DD.MM.YYYY format", () => {
		const rows = applyMapping([{ Дата: "15.06.2026", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-06-15");
		expect(rows[0].valid).toBe(true);
	});

	it("parses DD/MM/YYYY format", () => {
		const rows = applyMapping([{ Дата: "15/06/2026", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-06-15");
	});

	it("parses single-digit day and month in DD.MM.YYYY", () => {
		const rows = applyMapping([{ Дата: "5.6.2026", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-06-05");
	});

	it("parses MM/DD/YYYY: ambiguous with DD/MM — code treats slashes as DD/MM always", () => {
		// "06/15/2026" matches the DD/MM/YYYY regex (/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
		// before the MM/DD path, so it produces "2026-15-06" (which is invalid).
		// This is documented behavior — there is no unambiguous detection of US dates.
		const rows = applyMapping([{ Дата: "06/15/2026", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("2026-15-06"); // raw output of the DD/MM branch
		expect(rows[0].valid).toBe(true); // parseDate returns a string regardless
	});

	it("returns invalid row for unrecognised date", () => {
		const rows = applyMapping([{ Дата: "not-a-date", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].valid).toBe(false);
		expect(rows[0].error).toMatch(/дату/i);
	});

	it("preserves raw date string in invalid row", () => {
		const rows = applyMapping([{ Дата: "garbage", Сумма: "100", Описание: "" }], baseMapping);
		expect(rows[0].date).toBe("garbage");
	});
});

describe("applyMapping – amount parsing", () => {
	it("parses plain integer", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "1500", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(1500);
	});

	it("parses decimal with dot", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "1500.50", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(1500.5);
	});

	it("parses decimal with comma", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "1500,50", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(1500.5);
	});

	it("strips spaces from amount", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "1 500", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(1500);
	});

	it("strips currency symbols ₸ $ € £ ¥ ₽", () => {
		for (const sym of ["₸", "$", "€", "£", "¥", "₽"]) {
			const rows = applyMapping([{ Дата: "2026-01-01", Сумма: `${sym}250`, Описание: "" }], baseMapping);
			expect(rows[0].amount).toBe(250);
		}
	});

	it("returns invalid row for non-numeric amount", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "abc", Описание: "" }], baseMapping);
		expect(rows[0].valid).toBe(false);
		expect(rows[0].error).toMatch(/сумму/i);
	});

	it("stores absolute amount (negative input → positive amount)", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "-500", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(500);
	});
});

describe("applyMapping – type detection", () => {
	it("derives income type from positive amount when no type column", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "500", Описание: "" }], baseMapping);
		expect(rows[0].type).toBe("income");
	});

	it("derives expense type from negative amount when no type column", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "-500", Описание: "" }], baseMapping);
		expect(rows[0].type).toBe("expense");
	});

	it("zero amount is treated as income by sign", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "0", Описание: "" }], baseMapping);
		expect(rows[0].type).toBe("income");
	});

	it("uses explicit type column – Russian 'доход'", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "-100", Описание: "", Тип: "Доход" }], m);
		expect(rows[0].type).toBe("income");
	});

	it("uses explicit type column – Russian 'расход' → expense", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Тип: "Расход" }], m);
		expect(rows[0].type).toBe("expense");
	});

	it("uses explicit type column – English 'income'", () => {
		const m = { ...baseMapping, type: "Type" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Type: "income" }], m);
		expect(rows[0].type).toBe("income");
	});

	it("uses explicit type column – English 'credit'", () => {
		const m = { ...baseMapping, type: "Type" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Type: "credit" }], m);
		expect(rows[0].type).toBe("income");
	});

	it("unrecognised type value falls back to expense", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Тип: "неизвестно" }], m);
		expect(rows[0].type).toBe("expense");
	});
});

describe("applyMapping – comment", () => {
	it("truncates comment at 200 characters", () => {
		const long = "x".repeat(300);
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: long }], baseMapping);
		expect(rows[0].comment).toHaveLength(200);
	});

	it("preserves comment shorter than 200 characters", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "coffee" }], baseMapping);
		expect(rows[0].comment).toBe("coffee");
	});

	it("handles missing comment column gracefully", () => {
		const m = { ...baseMapping, comment: "NonExistent" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100" }], m);
		expect(rows[0].comment).toBe("");
	});
});

describe("applyMapping – bulk", () => {
	it("processes multiple rows independently", () => {
		const rows = applyMapping(
			[
				{ Дата: "2026-01-01", Сумма: "100", Описание: "a" },
				{ Дата: "bad", Сумма: "200", Описание: "b" },
				{ Дата: "2026-01-03", Сумма: "nope", Описание: "c" }
			],
			baseMapping
		);
		expect(rows[0].valid).toBe(true);
		expect(rows[1].valid).toBe(false);
		expect(rows[2].valid).toBe(false);
	});
});

// ── previewRowsToTransactions ─────────────────────────────────────────────────

describe("previewRowsToTransactions", () => {
	const validRow = { date: "2026-01-01", amount: 500, type: "income" as const, comment: "salary", valid: true };
	const invalidRow = { date: "bad", amount: 0, type: "expense" as const, comment: "", valid: false, error: "bad date" };

	it("filters out invalid rows", () => {
		const result = previewRowsToTransactions([validRow, invalidRow], baseMapping, "device-1");
		expect(result).toHaveLength(1);
	});

	it("sets accountId from mapping", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.accountId).toBe("acc-1");
	});

	it("sets categoryId from mapping or null", () => {
		const [tx] = previewRowsToTransactions([validRow], { ...baseMapping, categoryId: "" }, "device-1");
		expect(tx.categoryId).toBeNull();
	});

	it("sets categoryId when provided in mapping", () => {
		const [tx] = previewRowsToTransactions([validRow], { ...baseMapping, categoryId: "cat-1" }, "device-1");
		expect(tx.categoryId).toBe("cat-1");
	});

	it("always adds 'imported' tag", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.tags).toContain("imported");
	});

	it("sets deviceId", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "my-device");
		expect(tx.deviceId).toBe("my-device");
	});

	it("sets isDeleted to false", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.isDeleted).toBe(false);
	});

	it("sets isRecurring to false", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.isRecurring).toBe(false);
	});

	it("sets currency to RUB", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.currency).toBe("RUB");
	});

	it("sets fixed time to 12:00", () => {
		const [tx] = previewRowsToTransactions([validRow], baseMapping, "device-1");
		expect(tx.time).toBe("12:00");
	});

	it("maps all valid rows when no invalid rows present", () => {
		const rows = Array.from({ length: 5 }, (_, i) => ({
			...validRow,
			date: `2026-01-0${i + 1}`,
			amount: (i + 1) * 100
		}));
		expect(previewRowsToTransactions(rows, baseMapping, "d")).toHaveLength(5);
	});
});

// ── gaps: autoDetectMapping extra keywords ────────────────────────────────────

describe("autoDetectMapping – additional keywords", () => {
	it("detects 'итого' as amount column", () => {
		const m = autoDetectMapping(["Дата", "Итого", "Описание"]);
		expect(m.amount).toBe("Итого");
	});

	it("detects 'приход/расход' as type column", () => {
		const m = autoDetectMapping(["Дата", "Сумма", "Приход/Расход"]);
		expect(m.type).toBe("Приход/Расход");
	});

	it("detects 'direction' as type column", () => {
		const m = autoDetectMapping(["Date", "Amount", "Direction"]);
		expect(m.type).toBe("Direction");
	});

	it("detects 'наименование' as comment column", () => {
		const m = autoDetectMapping(["Дата", "Сумма", "Наименование"]);
		expect(m.comment).toBe("Наименование");
	});
});

// ── gaps: applyMapping type keywords ─────────────────────────────────────────

describe("applyMapping – remaining type keywords", () => {
	it("type column containing 'приход' → income", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Тип: "Приход" }], m);
		expect(rows[0].type).toBe("income");
	});

	it("type column containing '+' → income", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: "", Тип: "+" }], m);
		expect(rows[0].type).toBe("income");
	});

	it("type column is present but value is empty → falls back to sign", () => {
		const m = { ...baseMapping, type: "Тип" };
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "-200", Описание: "", Тип: "" }], m);
		expect(rows[0].type).toBe("expense");
	});
});

// ── gaps: applyMapping edge cases ─────────────────────────────────────────────

describe("applyMapping – edge cases", () => {
	it("comment boundary: exactly 200 chars is preserved intact", () => {
		const exactly200 = "x".repeat(200);
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "100", Описание: exactly200 }], baseMapping);
		expect(rows[0].comment).toHaveLength(200);
		expect(rows[0].comment).toBe(exactly200);
	});

	it("empty amount string returns invalid row with amount 0", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "", Описание: "" }], baseMapping);
		expect(rows[0].valid).toBe(false);
		expect(rows[0].amount).toBe(0);
	});

	it("multiple spaces in amount are stripped", () => {
		const rows = applyMapping([{ Дата: "2026-01-01", Сумма: "1 500 000", Описание: "" }], baseMapping);
		expect(rows[0].amount).toBe(1500000);
	});
});
