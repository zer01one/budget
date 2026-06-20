import { describe, it, expect } from "vitest";

// ── Pure function tests (extracted logic) ───────────────────────────────────

function formatAmount(tx: { type: string; amount: number }): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

function formatCurrency(amount: number): string {
	return amount.toLocaleString("ru-RU");
}

function formatDate(date: string): string {
	const today = new Date().toLocaleDateString("en-CA");
	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
	if (date === today) return "Сегодня";
	if (date === yesterday) return "Вчера";
	const d = new Date(date);
	return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

describe("DashboardView – formatAmount", () => {
	it("income → + prefix", () => {
		expect(formatAmount({ type: "income", amount: 5000 })).toMatch(/^\+/);
	});

	it("expense → - prefix", () => {
		expect(formatAmount({ type: "expense", amount: 1000 })).toMatch(/^-/);
	});

	it("transfer → ↔ prefix", () => {
		expect(formatAmount({ type: "transfer", amount: 200 })).toMatch(/^↔/);
	});

	it("amount is formatted with locale ru-RU", () => {
		// 1500 → "1 500" in ru-RU locale
		const result = formatAmount({ type: "income", amount: 1500 });
		expect(result).toContain("500");
	});
});

describe("DashboardView – formatCurrency", () => {
	it("formats 0 as 0", () => expect(formatCurrency(0)).toBe("0"));
	it("formats 1000 with thousands separator", () => {
		const s = formatCurrency(1000);
		expect(s).toContain("1");
		expect(s).toContain("000");
	});
});

describe("DashboardView – formatDate", () => {
	it("returns Сегодня for today", () => {
		const today = new Date().toLocaleDateString("en-CA");
		expect(formatDate(today)).toBe("Сегодня");
	});

	it("returns Вчера for yesterday", () => {
		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
		expect(formatDate(yesterday)).toBe("Вчера");
	});

	it("returns locale date for older dates", () => {
		const result = formatDate("2025-01-15");
		expect(result).not.toBe("Сегодня");
		expect(result).not.toBe("Вчера");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("DashboardView – savingsRate (pure logic)", () => {
	function savingsRate(income: number, expenses: number): number {
		if (income === 0) return 0;
		return Math.round(((income - expenses) / income) * 100);
	}

	it("0 when income is 0", () => expect(savingsRate(0, 0)).toBe(0));
	it("0 when income is 0 with expenses", () => expect(savingsRate(0, 500)).toBe(0));
	it("100 when expenses is 0", () => expect(savingsRate(1000, 0)).toBe(100));
	it("50 when expenses = income / 2", () => expect(savingsRate(1000, 500)).toBe(50));
	it("negative when expenses > income", () => expect(savingsRate(500, 1000)).toBe(-100));
	it("rounds to nearest integer", () => expect(savingsRate(1000, 333)).toBe(67));
});

describe("DashboardView – recentTransactions (pure logic)", () => {
	type Tx = { date: string; time: string; id: string };

	function recentTransactions(txs: Tx[]): Tx[] {
		return [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5);
	}

	it("returns at most 5", () => {
		const txs = Array.from({ length: 10 }, (_, i) => ({
			date: "2026-06-01",
			time: `0${i}:00`,
			id: `t${i}`
		}));
		expect(recentTransactions(txs)).toHaveLength(5);
	});

	it("sorts by date descending", () => {
		const txs = [
			{ date: "2026-06-01", time: "10:00", id: "a" },
			{ date: "2026-06-03", time: "10:00", id: "b" },
			{ date: "2026-06-02", time: "10:00", id: "c" }
		];
		const result = recentTransactions(txs);
		expect(result[0].id).toBe("b");
		expect(result[1].id).toBe("c");
		expect(result[2].id).toBe("a");
	});

	it("same date sorts by time descending", () => {
		const txs = [
			{ date: "2026-06-01", time: "09:00", id: "a" },
			{ date: "2026-06-01", time: "15:00", id: "b" }
		];
		const result = recentTransactions(txs);
		expect(result[0].id).toBe("b");
	});

	it("returns all when fewer than 5", () => {
		const txs = [{ date: "2026-06-01", time: "10:00", id: "a" }];
		expect(recentTransactions(txs)).toHaveLength(1);
	});

	it("empty array returns empty", () => {
		expect(recentTransactions([])).toHaveLength(0);
	});
});
