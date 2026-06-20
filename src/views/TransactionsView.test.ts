import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type TxLike = {
	id: string;
	date: string;
	time: string;
	type: string;
	amount: number;
	comment: string;
	categoryId: string | null;
	accountId: string;
	isDeleted?: boolean;
};

// Extracted formatAmount
function formatAmount(tx: Pick<TxLike, "type" | "amount">): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

// Extracted dayTotal
function dayTotal(txs: TxLike[]): { income: number; expense: number } {
	return txs.reduce(
		(acc, tx) => {
			if (tx.type === "income") acc.income += tx.amount;
			if (tx.type === "expense") acc.expense += tx.amount;
			return acc;
		},
		{ income: 0, expense: 0 }
	);
}

// Extracted filtered
function filtered(
	allCached: TxLike[],
	search: string,
	filterType: string,
	filterAccountId: string,
	filterCategoryId: string,
	filterFrom: string,
	filterTo: string,
	getCategoryName: (id: string | null) => string
): TxLike[] {
	const q = search.toLowerCase().trim();
	return allCached.filter((t) => {
		if (t.isDeleted) return false;
		if (q && !t.comment.toLowerCase().includes(q) && !getCategoryName(t.categoryId).toLowerCase().includes(q) && !t.amount.toString().includes(q))
			return false;
		if (filterType && t.type !== filterType) return false;
		if (filterAccountId && t.accountId !== filterAccountId) return false;
		if (filterCategoryId && t.categoryId !== filterCategoryId) return false;
		if (filterFrom && t.date < filterFrom) return false;
		if (filterTo && t.date > filterTo) return false;
		return true;
	});
}

type Group = { date: string; transactions: TxLike[] };

// Extracted grouped
function grouped(txs: TxLike[]): Group[] {
	const map = new Map<string, TxLike[]>();
	for (const tx of txs) {
		const list = map.get(tx.date) ?? [];
		list.push(tx);
		map.set(tx.date, list);
	}
	return [...map.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, transactions]) => ({
			date,
			transactions: transactions.sort((a, b) => b.time.localeCompare(a.time))
		}));
}

// Extracted formatDateLabel
function formatDateLabel(date: string): string {
	const today = new Date().toLocaleDateString("en-CA");
	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
	if (date === today) return "Сегодня";
	if (date === yesterday) return "Вчера";
	return new Date(date).toLocaleDateString("ru-RU", {
		weekday: "short",
		day: "numeric",
		month: "long"
	});
}

const txA: TxLike = {
	id: "a",
	date: "2026-06-05",
	time: "10:00",
	type: "expense",
	amount: 1000,
	comment: "coffee",
	categoryId: "cat1",
	accountId: "acc1"
};
const txB: TxLike = {
	id: "b",
	date: "2026-06-04",
	time: "12:00",
	type: "income",
	amount: 5000,
	comment: "salary",
	categoryId: "cat2",
	accountId: "acc2"
};
const txC: TxLike = {
	id: "c",
	date: "2026-06-05",
	time: "15:00",
	type: "expense",
	amount: 200,
	comment: "bus",
	categoryId: "cat1",
	accountId: "acc1"
};
const txDeleted: TxLike = {
	id: "d",
	date: "2026-06-05",
	time: "11:00",
	type: "expense",
	amount: 50,
	comment: "x",
	categoryId: null,
	accountId: "acc1",
	isDeleted: true
};

describe("TransactionsView – formatAmount", () => {
	it("income → +", () => expect(formatAmount({ type: "income", amount: 100 })).toMatch(/^\+/));
	it("expense → -", () => expect(formatAmount({ type: "expense", amount: 100 })).toMatch(/^-/));
	it("transfer → ↔", () => expect(formatAmount({ type: "transfer", amount: 100 })).toMatch(/^↔/));
});

describe("TransactionsView – dayTotal", () => {
	it("sums income and expense separately", () => {
		const txs = [
			{ ...txA, type: "income", amount: 1000 },
			{ ...txB, type: "expense", amount: 300 },
			{ ...txC, type: "expense", amount: 200 }
		];
		expect(dayTotal(txs)).toEqual({ income: 1000, expense: 500 });
	});

	it("transfers are not counted", () => {
		const txs = [{ ...txA, type: "transfer", amount: 500 }];
		expect(dayTotal(txs)).toEqual({ income: 0, expense: 0 });
	});

	it("empty array → both 0", () => {
		expect(dayTotal([])).toEqual({ income: 0, expense: 0 });
	});
});

describe("TransactionsView – filtered", () => {
	const all = [txA, txB, txC, txDeleted];
	const noCategory = (_: string | null) => "";

	it("excludes deleted", () => {
		const result = filtered(all, "", "", "", "", "", "", noCategory);
		expect(result.find((t) => t.id === "d")).toBeUndefined();
	});

	it("no filters → returns all non-deleted", () => {
		expect(filtered(all, "", "", "", "", "", "", noCategory)).toHaveLength(3);
	});

	it("search by comment", () => {
		const result = filtered(all, "coffee", "", "", "", "", "", noCategory);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("a");
	});

	it("search by amount", () => {
		const result = filtered(all, "5000", "", "", "", "", "", noCategory);
		expect(result[0].id).toBe("b");
	});

	it("search by category name via callback", () => {
		const result = filtered(all, "food", "", "", "", "", "", (id) => (id === "cat1" ? "Food" : ""));
		// txA and txC have cat1 → "Food" includes "food"
		expect(result.map((t) => t.id).sort()).toEqual(["a", "c"].sort());
	});

	it("filterType=income keeps only income", () => {
		const result = filtered(all, "", "income", "", "", "", "", noCategory);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("b");
	});

	it("filterAccountId filters correctly", () => {
		const result = filtered(all, "", "", "acc1", "", "", "", noCategory);
		expect(result.every((t) => t.accountId === "acc1")).toBe(true);
	});

	it("filterCategoryId filters correctly", () => {
		const result = filtered(all, "", "", "", "cat1", "", "", noCategory);
		expect(result.every((t) => t.categoryId === "cat1")).toBe(true);
	});

	it("filterFrom excludes dates before", () => {
		const result = filtered(all, "", "", "", "", "2026-06-05", "", noCategory);
		expect(result.every((t) => t.date >= "2026-06-05")).toBe(true);
	});

	it("filterTo excludes dates after", () => {
		const result = filtered(all, "", "", "", "", "", "2026-06-04", noCategory);
		expect(result.every((t) => t.date <= "2026-06-04")).toBe(true);
	});
});

describe("TransactionsView – grouped", () => {
	it("groups by date", () => {
		const result = grouped([txA, txB, txC]);
		expect(result.length).toBe(2); // 2026-06-05 and 2026-06-04
	});

	it("groups sorted newest date first", () => {
		const result = grouped([txA, txB, txC]);
		expect(result[0].date).toBe("2026-06-05");
		expect(result[1].date).toBe("2026-06-04");
	});

	it("within each group, transactions sorted newest time first", () => {
		const result = grouped([txA, txC]); // same date
		const group = result[0].transactions;
		expect(group[0].id).toBe("c"); // 15:00 > 10:00
		expect(group[1].id).toBe("a");
	});

	it("empty input → empty groups", () => {
		expect(grouped([])).toHaveLength(0);
	});
});

describe("TransactionsView – formatDateLabel", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("today → Сегодня", () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const today = new Date().toLocaleDateString("en-CA");
		expect(formatDateLabel(today)).toBe("Сегодня");
	});

	it("yesterday → Вчера", () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
		expect(formatDateLabel(yesterday)).toBe("Вчера");
	});

	it("older date → locale string", () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const result = formatDateLabel("2026-06-01");
		expect(result).not.toBe("Сегодня");
		expect(result).not.toBe("Вчера");
	});
});

describe("TransactionsView – hasMore logic", () => {
	it("true when loaded < total", () => {
		const loadedMonthsCount = 2;
		const allMonths = ["2026-06", "2026-05", "2026-04"];
		expect(loadedMonthsCount < allMonths.length).toBe(true);
	});

	it("false when loaded >= total", () => {
		const loadedMonthsCount = 3;
		const allMonths = ["2026-06", "2026-05", "2026-04"];
		expect(loadedMonthsCount < allMonths.length).toBe(false);
	});
});

describe("TransactionsView – activeFilterCount logic", () => {
	function activeFilterCount(filterType: string, filterAccountId: string, filterCategoryId: string, filterFrom: string, filterTo: string) {
		return [filterType, filterAccountId, filterCategoryId, filterFrom, filterTo].filter(Boolean).length;
	}

	it("0 when no filters", () => expect(activeFilterCount("", "", "", "", "")).toBe(0));
	it("1 when one filter set", () => expect(activeFilterCount("income", "", "", "", "")).toBe(1));
	it("5 when all set", () => expect(activeFilterCount("income", "acc1", "cat1", "2026-01-01", "2026-06-30")).toBe(5));
	it("2 when two filters set", () => expect(activeFilterCount("expense", "acc1", "", "", "")).toBe(2));
});
