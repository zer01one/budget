import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Extracted pure logic from ChartsView

function prevMonth(current: string): string {
	const [y, m] = current.split("-").map(Number);
	const d = new Date(y, m - 2);
	return d.toLocaleDateString("en-CA").slice(0, 7);
}

function nextMonth(current: string): string {
	const [y, m] = current.split("-").map(Number);
	const d = new Date(y, m);
	const now = new Date().toLocaleDateString("en-CA").slice(0, 7);
	const next = d.toLocaleDateString("en-CA").slice(0, 7);
	if (next <= now) return next;
	return current;
}

function isCurrentMonth(selected: string): boolean {
	return selected === new Date().toLocaleDateString("en-CA").slice(0, 7);
}

function formatMonthLabel(ym: string): string {
	const [y, m] = ym.split("-").map(Number);
	return new Date(y, m - 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function last6Months(selectedMonth: string): string[] {
	const result: string[] = [];
	const [y, m] = selectedMonth.split("-").map(Number);
	for (let i = 5; i >= 0; i--) {
		const d = new Date(y, m - 1 - i);
		result.push(d.toLocaleDateString("en-CA").slice(0, 7));
	}
	return result;
}

type TxLike = { date: string; type: string; amount: number; isDeleted?: boolean };

function summary(txs: TxLike[]): { income: number; expense: number; net: number } {
	const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
	const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
	return { income, expense, net: income - expense };
}

describe("ChartsView – prevMonth", () => {
	it("Jan → previous Dec", () => expect(prevMonth("2026-01")).toBe("2025-12"));
	it("Jun → May", () => expect(prevMonth("2026-06")).toBe("2026-05"));
	it("Mar → Feb", () => expect(prevMonth("2026-03")).toBe("2026-02"));
	it("Dec → Nov", () => expect(prevMonth("2026-12")).toBe("2026-11"));
});

describe("ChartsView – nextMonth", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("advances month when not in future", () => {
		vi.setSystemTime(new Date("2026-06-15"));
		expect(nextMonth("2026-05")).toBe("2026-06");
	});

	it("stays on current month (cannot advance to future)", () => {
		vi.setSystemTime(new Date("2026-06-15"));
		expect(nextMonth("2026-06")).toBe("2026-06");
	});

	it("Dec → Jan of next year when not future", () => {
		vi.setSystemTime(new Date("2027-06-01"));
		expect(nextMonth("2026-12")).toBe("2027-01");
	});

	it("stays when advancing would exceed current month", () => {
		vi.setSystemTime(new Date("2026-05-01"));
		expect(nextMonth("2026-05")).toBe("2026-05");
	});
});

describe("ChartsView – isCurrentMonth", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("true for current month", () => {
		vi.setSystemTime(new Date("2026-06-15"));
		expect(isCurrentMonth("2026-06")).toBe(true);
	});

	it("false for past month", () => {
		vi.setSystemTime(new Date("2026-06-15"));
		expect(isCurrentMonth("2026-05")).toBe(false);
	});

	it("false for future month", () => {
		vi.setSystemTime(new Date("2026-06-15"));
		expect(isCurrentMonth("2026-07")).toBe(false);
	});
});

describe("ChartsView – formatMonthLabel", () => {
	it("returns non-empty string", () => {
		expect(formatMonthLabel("2026-06").length).toBeGreaterThan(0);
	});

	it("includes year", () => {
		expect(formatMonthLabel("2026-06")).toContain("2026");
	});
});

describe("ChartsView – last6Months", () => {
	it("returns exactly 6 months", () => {
		expect(last6Months("2026-06")).toHaveLength(6);
	});

	it("last item is the selected month", () => {
		const months = last6Months("2026-06");
		expect(months[5]).toBe("2026-06");
	});

	it("first item is 5 months before", () => {
		const months = last6Months("2026-06");
		expect(months[0]).toBe("2026-01");
	});

	it("spans year boundary correctly", () => {
		const months = last6Months("2026-03");
		expect(months[0]).toBe("2025-10");
		expect(months[5]).toBe("2026-03");
	});

	it("months are in ascending order", () => {
		const months = last6Months("2026-06");
		for (let i = 1; i < months.length; i++) {
			expect(months[i] > months[i - 1]).toBe(true);
		}
	});
});

describe("ChartsView – summary", () => {
	it("sums income correctly", () => {
		const txs = [
			{ date: "2026-06-01", type: "income", amount: 100 },
			{ date: "2026-06-01", type: "income", amount: 200 }
		];
		expect(summary(txs).income).toBe(300);
	});

	it("sums expenses correctly", () => {
		const txs = [
			{ date: "2026-06-01", type: "expense", amount: 50 },
			{ date: "2026-06-01", type: "expense", amount: 80 }
		];
		expect(summary(txs).expense).toBe(130);
	});

	it("net = income - expense", () => {
		const txs = [
			{ date: "2026-06-01", type: "income", amount: 1000 },
			{ date: "2026-06-01", type: "expense", amount: 300 }
		];
		expect(summary(txs).net).toBe(700);
	});

	it("net is negative when expenses > income", () => {
		const txs = [
			{ date: "2026-06-01", type: "income", amount: 100 },
			{ date: "2026-06-01", type: "expense", amount: 500 }
		];
		expect(summary(txs).net).toBe(-400);
	});

	it("all zero for empty array", () => {
		expect(summary([])).toEqual({ income: 0, expense: 0, net: 0 });
	});

	it("transfers are not counted in income or expense", () => {
		const txs = [{ date: "2026-06-01", type: "transfer", amount: 1000 }];
		expect(summary(txs)).toEqual({ income: 0, expense: 0, net: 0 });
	});
});
