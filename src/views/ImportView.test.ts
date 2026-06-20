import { describe, it, expect } from "vitest";

type ImportPreviewRow = { valid: boolean; [key: string]: unknown };

// Extracted goPreview validation
function goPreview(mappingDate: string, mappingAmount: string, mappingAccountId: string): string {
	if (!mappingDate || !mappingAmount) return "Укажите колонки Дата и Сумма";
	if (!mappingAccountId) return "Выберите счёт для импорта";
	return "";
}

// Extracted validCount/errorCount
function validCount(rows: ImportPreviewRow[]): number {
	return rows.filter((r) => r.valid).length;
}

function errorCount(rows: ImportPreviewRow[]): number {
	return rows.filter((r) => !r.valid).length;
}

describe("ImportView – goPreview validation", () => {
	it("no error when all required fields set", () => {
		expect(goPreview("date_col", "amount_col", "acc1")).toBe("");
	});

	it("error when date column missing", () => {
		expect(goPreview("", "amount_col", "acc1")).toBe("Укажите колонки Дата и Сумма");
	});

	it("error when amount column missing", () => {
		expect(goPreview("date_col", "", "acc1")).toBe("Укажите колонки Дата и Сумма");
	});

	it("error when both date and amount missing", () => {
		expect(goPreview("", "", "acc1")).toBe("Укажите колонки Дата и Сумма");
	});

	it("error when accountId missing", () => {
		expect(goPreview("date_col", "amount_col", "")).toBe("Выберите счёт для импорта");
	});

	it("date/amount error takes priority over accountId error", () => {
		expect(goPreview("", "", "")).toBe("Укажите колонки Дата и Сумма");
	});
});

describe("ImportView – validCount", () => {
	it("counts valid rows", () => {
		const rows: ImportPreviewRow[] = [{ valid: true }, { valid: false }, { valid: true }];
		expect(validCount(rows)).toBe(2);
	});

	it("0 when no valid rows", () => {
		expect(validCount([{ valid: false }, { valid: false }])).toBe(0);
	});

	it("counts all when all valid", () => {
		const rows = Array.from({ length: 5 }, () => ({ valid: true }));
		expect(validCount(rows)).toBe(5);
	});

	it("0 for empty array", () => {
		expect(validCount([])).toBe(0);
	});
});

describe("ImportView – errorCount", () => {
	it("counts invalid rows", () => {
		const rows: ImportPreviewRow[] = [{ valid: true }, { valid: false }, { valid: false }];
		expect(errorCount(rows)).toBe(2);
	});

	it("0 when all valid", () => {
		expect(errorCount([{ valid: true }, { valid: true }])).toBe(0);
	});

	it("counts all when all invalid", () => {
		const rows = Array.from({ length: 3 }, () => ({ valid: false }));
		expect(errorCount(rows)).toBe(3);
	});
});

describe("ImportView – validCount + errorCount sum", () => {
	it("validCount + errorCount = total rows", () => {
		const rows: ImportPreviewRow[] = [{ valid: true }, { valid: false }, { valid: true }, { valid: false }, { valid: true }];
		expect(validCount(rows) + errorCount(rows)).toBe(rows.length);
	});
});

describe("ImportView – step machine logic", () => {
	type Step = "pick" | "map" | "preview" | "done";

	function stepAfterPick(success: boolean, csvOk: boolean): Step {
		if (!success) return "pick";
		if (!csvOk) return "pick";
		return "map";
	}

	it("advances to map on successful file pick with valid CSV", () => {
		expect(stepAfterPick(true, true)).toBe("map");
	});

	it("stays at pick on file pick failure", () => {
		expect(stepAfterPick(false, true)).toBe("pick");
	});

	it("stays at pick when CSV cannot be parsed", () => {
		expect(stepAfterPick(true, false)).toBe("pick");
	});

	it("preview step after goPreview with no error", () => {
		const error = goPreview("date", "amount", "acc1");
		const step: Step = error ? "map" : "preview";
		expect(step).toBe("preview");
	});

	it("stays at map step when goPreview returns error", () => {
		const error = goPreview("", "amount", "acc1");
		const step: Step = error ? "map" : "preview";
		expect(step).toBe("map");
	});
});
