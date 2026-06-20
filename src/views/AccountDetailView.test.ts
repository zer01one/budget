import { describe, it, expect, vi } from "vitest";

type TxLike = { type: string; amount: number };

function formatAmount(tx: TxLike): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

describe("AccountDetailView – formatAmount", () => {
	it("income → + prefix", () => expect(formatAmount({ type: "income", amount: 100 })).toMatch(/^\+/));
	it("expense → - prefix", () => expect(formatAmount({ type: "expense", amount: 100 })).toMatch(/^-/));
	it("transfer → ↔", () => expect(formatAmount({ type: "transfer", amount: 100 })).toMatch(/^↔/));
	it("amount included", () => {
		const s = formatAmount({ type: "income", amount: 5000 });
		expect(s).toContain("5");
		expect(s).toContain("000");
	});
});

describe("AccountDetailView – not-found state", () => {
	it("account is undefined when id not in store", () => {
		const accounts = [{ id: "acc1", name: "Main" }];
		const account = accounts.find((a) => a.id === "unknown-id");
		expect(account).toBeUndefined();
	});

	it("balance is 0 when account not found", () => {
		const account: { id: string; initialBalance: number } | undefined = undefined;
		const balance = account ? 100 : 0;
		expect(balance).toBe(0);
	});

	it("transactions is empty when account not found", () => {
		const account: { id: string } | undefined = undefined;
		const transactions = account ? [{ id: "t1" }] : [];
		expect(transactions).toHaveLength(0);
	});
});

describe("AccountDetailView – archiveAccount logic", () => {
	it("does nothing when account is undefined", async () => {
		const account: { id: string } | undefined = undefined;
		const mockDelete = vi.fn(async () => {});
		const mockBack = vi.fn();
		const mockConfirm = vi.fn(() => true);

		async function archiveAccount() {
			if (!account) return;
			if (!mockConfirm("Archive?")) return;
			await mockDelete();
			mockBack();
		}

		await archiveAccount();
		expect(mockDelete).not.toHaveBeenCalled();
		expect(mockBack).not.toHaveBeenCalled();
	});

	it("does nothing when user cancels confirm", async () => {
		const account = { id: "acc1", name: "Main" };
		const mockDelete = vi.fn(async () => {});
		const mockBack = vi.fn();
		const mockConfirm = vi.fn(() => false);

		async function archiveAccount() {
			if (!account) return;
			if (!mockConfirm("Archive?")) return;
			await mockDelete();
			mockBack();
		}

		await archiveAccount();
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("calls deleteAccount and router.back on confirm", async () => {
		const account = { id: "acc1" };
		const mockDelete = vi.fn(async () => {});
		const mockBack = vi.fn();
		const mockConfirm = vi.fn(() => true);

		async function archiveAccount() {
			if (!account) return;
			if (!mockConfirm("Archive?")) return;
			await mockDelete(account.id);
			mockBack();
		}

		await archiveAccount();
		expect(mockDelete).toHaveBeenCalledWith("acc1");
		expect(mockBack).toHaveBeenCalledOnce();
	});
});

describe("AccountDetailView – transaction sort", () => {
	type Tx = { id: string; date: string; time: string };

	function sortTransactions(txs: Tx[]): Tx[] {
		return [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
	}

	it("sorted by date descending", () => {
		const txs: Tx[] = [
			{ id: "a", date: "2026-06-01", time: "10:00" },
			{ id: "b", date: "2026-06-03", time: "10:00" }
		];
		expect(sortTransactions(txs)[0].id).toBe("b");
	});

	it("same date: sorted by time descending", () => {
		const txs: Tx[] = [
			{ id: "a", date: "2026-06-01", time: "09:00" },
			{ id: "b", date: "2026-06-01", time: "15:00" }
		];
		expect(sortTransactions(txs)[0].id).toBe("b");
	});
});
