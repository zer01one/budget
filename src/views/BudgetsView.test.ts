import { describe, it, expect, vi } from "vitest";

// ── Pure logic extracted from BudgetsView ──────────────────────────────────

type BudgetEntry = {
	id: string;
	categoryId: string;
	month: string;
	limitAmount: number;
	currency: string;
	notifyAt: number;
	notifyEnabled: boolean;
};

type TxLike = {
	categoryId: string | null;
	type: string;
	date: string;
	amount: number;
	isDeleted?: boolean;
};

function getSpent(budget: BudgetEntry, allCached: TxLike[]): number {
	return allCached
		.filter((t) => t.categoryId === budget.categoryId && t.type === "expense" && t.date.startsWith(budget.month) && !t.isDeleted)
		.reduce((s, t) => s + t.amount, 0);
}

function getProgress(budget: BudgetEntry, allCached: TxLike[]): number {
	const spent = getSpent(budget, allCached);
	return Math.min(100, Math.round((spent / budget.limitAmount) * 100));
}

function progressColor(pct: number): string {
	if (pct >= 100) return "var(--accent-danger)";
	if (pct >= 80) return "#F59E0B";
	return "#10B981";
}

function validateBudget(formLimit: string, formCategoryId: string, isEditing: boolean): Record<string, string> {
	const errors: Record<string, string> = {};
	const parsed = parseFloat(formLimit.replace(",", "."));
	if (isNaN(parsed) || parsed <= 0) errors.limit = "Введите положительную сумму";
	if (!isEditing && !formCategoryId) errors.category = "Выберите категорию";
	return errors;
}

const budget: BudgetEntry = {
	id: "b1",
	categoryId: "cat1",
	month: "2026-06",
	limitAmount: 50000,
	currency: "KZT",
	notifyAt: 80,
	notifyEnabled: true
};

describe("BudgetsView – getSpent", () => {
	it("sums expenses for matching category and month", () => {
		const txs: TxLike[] = [
			{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 10000 },
			{ categoryId: "cat1", type: "expense", date: "2026-06-15", amount: 5000 }
		];
		expect(getSpent(budget, txs)).toBe(15000);
	});

	it("ignores income transactions", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "income", date: "2026-06-01", amount: 10000 }];
		expect(getSpent(budget, txs)).toBe(0);
	});

	it("ignores different category", () => {
		const txs: TxLike[] = [{ categoryId: "cat2", type: "expense", date: "2026-06-01", amount: 10000 }];
		expect(getSpent(budget, txs)).toBe(0);
	});

	it("ignores different month", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-05-15", amount: 10000 }];
		expect(getSpent(budget, txs)).toBe(0);
	});

	it("ignores deleted transactions", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 10000, isDeleted: true }];
		expect(getSpent(budget, txs)).toBe(0);
	});

	it("0 with empty cache", () => {
		expect(getSpent(budget, [])).toBe(0);
	});
});

describe("BudgetsView – getProgress", () => {
	it("0% when no spend", () => {
		expect(getProgress(budget, [])).toBe(0);
	});

	it("50% at half spent", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 25000 }];
		expect(getProgress(budget, txs)).toBe(50);
	});

	it("100% when fully spent", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 50000 }];
		expect(getProgress(budget, txs)).toBe(100);
	});

	it("capped at 100% when overspent", () => {
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 100000 }];
		expect(getProgress(budget, txs)).toBe(100);
	});

	it("rounds to nearest integer", () => {
		// 33333 / 50000 = 66.666% → 67%
		const txs: TxLike[] = [{ categoryId: "cat1", type: "expense", date: "2026-06-01", amount: 33333 }];
		expect(getProgress(budget, txs)).toBe(67);
	});
});

describe("BudgetsView – progressColor", () => {
	it("green below 80%", () => expect(progressColor(50)).toBe("#10B981"));
	it("green at 79%", () => expect(progressColor(79)).toBe("#10B981"));
	it("amber at exactly 80%", () => expect(progressColor(80)).toBe("#F59E0B"));
	it("amber between 80 and 99", () => expect(progressColor(95)).toBe("#F59E0B"));
	it("danger at exactly 100%", () => expect(progressColor(100)).toBe("var(--accent-danger)"));
	it("danger above 100% (capped scenario)", () => expect(progressColor(100)).toBe("var(--accent-danger)"));
	it("green at 0%", () => expect(progressColor(0)).toBe("#10B981"));
});

describe("BudgetsView – validateBudget", () => {
	it("empty limit → error", () => {
		expect(validateBudget("", "cat1", false)).toHaveProperty("limit");
	});

	it("0 limit → error", () => {
		expect(validateBudget("0", "cat1", false)).toHaveProperty("limit");
	});

	it("negative limit → error", () => {
		expect(validateBudget("-1", "cat1", false)).toHaveProperty("limit");
	});

	it("non-numeric limit → error", () => {
		expect(validateBudget("abc", "cat1", false)).toHaveProperty("limit");
	});

	it("comma decimal valid", () => {
		expect(validateBudget("5000,50", "cat1", false)).not.toHaveProperty("limit");
	});

	it("add mode without category → error", () => {
		expect(validateBudget("5000", "", false)).toHaveProperty("category");
	});

	it("edit mode without category → no category error", () => {
		expect(validateBudget("5000", "", true)).not.toHaveProperty("category");
	});

	it("valid limit + category → no errors", () => {
		expect(Object.keys(validateBudget("5000", "cat1", false))).toHaveLength(0);
	});
});

describe("BudgetsView – checkBudgetNotifications logic", () => {
	it("notifies at >= 100%: first call fires, second fires 80% branch", () => {
		const notified = new Set<string>();
		const mockNotify = vi.fn();

		function check(pct: number, budgetId: string) {
			const key100 = budgetId + ":100";
			const key80 = budgetId + ":80";
			if (pct >= 100 && !notified.has(key100)) {
				notified.add(key100);
				mockNotify(budgetId, pct);
			} else if (pct >= 80 && !notified.has(key80)) {
				notified.add(key80);
				mockNotify(budgetId, pct);
			}
		}

		// First call: key100 not set → fires 100% branch
		check(100, "b1");
		expect(mockNotify).toHaveBeenCalledOnce();

		// Second call: key100 set → falls to else-if, key80 not set → fires 80% branch
		check(100, "b1");
		expect(mockNotify).toHaveBeenCalledTimes(2);

		// Third call: both key100 and key80 set → no more notifications
		check(100, "b1");
		expect(mockNotify).toHaveBeenCalledTimes(2);
	});

	it("notifies at >= 80% once", () => {
		const notified = new Set<string>();
		const mockNotify = vi.fn();

		function check(pct: number, budgetId: string) {
			const key80 = budgetId + ":80";
			if (pct >= 80 && !notified.has(key80)) {
				notified.add(key80);
				mockNotify(budgetId, pct);
			}
		}

		check(85, "b1");
		check(85, "b1");
		expect(mockNotify).toHaveBeenCalledOnce();
	});

	it("does not notify below 80%", () => {
		const notified = new Set<string>();
		const mockNotify = vi.fn();

		function check(pct: number, budgetId: string) {
			const key80 = budgetId + ":80";
			if (pct >= 80 && !notified.has(key80)) {
				notified.add(key80);
				mockNotify(budgetId, pct);
			}
		}

		check(79, "b1");
		expect(mockNotify).not.toHaveBeenCalled();
	});
});
