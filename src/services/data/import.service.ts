import type { Transaction } from "@/types";

// ── CSV parsing ───────────────────────────────────────────────────────────────

export interface CsvRow {
	[key: string]: string;
}

export interface ImportColumn {
	key: string; // original header
	label: string; // display label
}

export interface ColumnMapping {
	date: string; // column key for date
	amount: string; // column key for amount
	type: string; // column key for type (optional — derive from sign)
	comment: string; // column key for description/comment
	accountId: string; // fixed account ID (not a column)
	categoryId: string; // fixed category ID (optional)
}

export interface ImportPreviewRow {
	date: string;
	amount: number;
	type: "income" | "expense";
	comment: string;
	valid: boolean;
	error?: string;
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
	// Normalize line endings, strip BOM
	const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = normalized.split("\n").filter((l) => l.trim());
	if (lines.length < 2) return { headers: [], rows: [] };

	// Detect delimiter: comma or semicolon
	const firstLine = lines[0];
	const delimiter = firstLine.includes(";") ? ";" : ",";

	function splitLine(line: string): string[] {
		const result: string[] = [];
		let inQuotes = false;
		let current = "";
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (inQuotes && line[i + 1] === '"') {
					current += '"';
					i++;
				} else inQuotes = !inQuotes;
			} else if (ch === delimiter && !inQuotes) {
				result.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	}

	const headers = splitLine(lines[0]);
	const rows: CsvRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = splitLine(lines[i]);
		if (cells.every((c) => !c)) continue;
		const row: CsvRow = {};
		headers.forEach((h, idx) => {
			row[h] = cells[idx] ?? "";
		});
		rows.push(row);
	}
	return { headers, rows };
}

// Auto-detect column roles from header names
export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
	const lower = headers.map((h) => h.toLowerCase());
	const find = (...keys: string[]) => headers[lower.findIndex((h) => keys.some((k) => h.includes(k)))] ?? "";

	return {
		date: find("дата", "date", "дата операции", "transaction date"),
		amount: find("сумма", "amount", "сумма операции", "debit", "credit", "итого"),
		type: find("тип", "type", "приход/расход", "direction"),
		comment: find("описание", "description", "назначение", "comment", "комментарий", "наименование", "merchant")
	};
}

// Parse a date string in various formats to YYYY-MM-DD
function parseDate(raw: string): string | null {
	raw = raw.trim();
	// ISO: 2026-06-15
	if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
	// DD.MM.YYYY or DD/MM/YYYY
	const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
	if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
	// MM/DD/YYYY
	const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
	return null;
}

function parseAmount(raw: string): number | null {
	// Remove spaces, currency symbols, replace comma decimal
	const cleaned = raw.replace(/[\s₸$€£¥₽]/g, "").replace(",", ".");
	const n = parseFloat(cleaned);
	return isNaN(n) ? null : n;
}

export function applyMapping(rows: CsvRow[], mapping: ColumnMapping): ImportPreviewRow[] {
	return rows.map((row) => {
		const rawDate = row[mapping.date] ?? "";
		const rawAmount = row[mapping.amount] ?? "";
		const rawComment = row[mapping.comment] ?? "";
		const rawType = mapping.type ? (row[mapping.type] ?? "") : "";

		const date = parseDate(rawDate);
		const amount = parseAmount(rawAmount);

		if (!date) return { date: rawDate, amount: 0, type: "expense", comment: rawComment, valid: false, error: "Не удалось распознать дату" };
		if (amount === null) return { date, amount: 0, type: "expense", comment: rawComment, valid: false, error: "Не удалось распознать сумму" };

		let type: "income" | "expense" = "expense";
		if (rawType) {
			const tl = rawType.toLowerCase();
			if (tl.includes("доход") || tl.includes("приход") || tl.includes("income") || tl.includes("credit") || tl.includes("+")) {
				type = "income";
			}
		} else {
			// Derive from sign
			type = amount >= 0 ? "income" : "expense";
		}

		return {
			date,
			amount: Math.abs(amount),
			type,
			comment: rawComment.slice(0, 200),
			valid: true
		};
	});
}

export function previewRowsToTransactions(
	previewRows: ImportPreviewRow[],
	mapping: ColumnMapping,
	deviceId: string
): Omit<Transaction, "id" | "updatedAt" | "version">[] {
	return previewRows
		.filter((r) => r.valid)
		.map((r) => ({
			type: r.type,
			amount: r.amount,
			currency: "KZT",
			date: r.date,
			time: "12:00",
			accountId: mapping.accountId,
			toAccountId: null,
			categoryId: mapping.categoryId || null,
			comment: r.comment,
			tags: ["imported"],
			isRecurring: false,
			recurringParentId: null,
			isDeleted: false,
			deviceId
		}));
}
