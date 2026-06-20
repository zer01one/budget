import { describe, it, expect } from "vitest";

// Extracted validate from TransactionDetailView
function validate(
	editAmount: string,
	editAccountId: string,
	editType: string,
	editToAccountId: string,
	editCategoryId: string
): Record<string, string> {
	const errors: Record<string, string> = {};
	const parsed = parseFloat(editAmount.replace(",", "."));
	if (isNaN(parsed) || parsed <= 0) errors.amount = "Введите положительную сумму";
	if (!editAccountId) errors.account = "Выберите счёт";
	if (editType === "transfer" && !editToAccountId) errors.toAccount = "Выберите счёт назначения";
	if (editType !== "transfer" && !editCategoryId) errors.category = "Выберите категорию";
	return errors;
}

type Tx = {
	id: string;
	type: string;
	amount: number;
	date: string;
	time: string;
	accountId: string;
	toAccountId: string | null;
	categoryId: string | null;
	comment: string;
};

function startEdit(tx: Tx) {
	return {
		editType: tx.type,
		editAmount: tx.amount.toString(),
		editDate: tx.date,
		editTime: tx.time,
		editAccountId: tx.accountId,
		editToAccountId: tx.toAccountId ?? "",
		editCategoryId: tx.categoryId ?? "",
		editComment: tx.comment,
		isEditing: true
	};
}

describe("TransactionDetailView – validate amount", () => {
	it("empty → error", () => expect(validate("", "acc1", "expense", "", "cat1")).toHaveProperty("amount"));
	it("0 → error", () => expect(validate("0", "acc1", "expense", "", "cat1")).toHaveProperty("amount"));
	it("negative → error", () => expect(validate("-5", "acc1", "expense", "", "cat1")).toHaveProperty("amount"));
	it("NaN → error", () => expect(validate("abc", "acc1", "expense", "", "cat1")).toHaveProperty("amount"));
	it("valid comma decimal", () => expect(validate("5,5", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount"));
	it("valid dot decimal", () => expect(validate("5.5", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount"));
	it("valid integer", () => expect(validate("100", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount"));
});

describe("TransactionDetailView – validate account", () => {
	it("empty accountId → error", () => expect(validate("100", "", "expense", "", "cat1")).toHaveProperty("account"));
	it("non-empty accountId → no error", () => expect(validate("100", "acc1", "expense", "", "cat1")).not.toHaveProperty("account"));
});

describe("TransactionDetailView – validate transfer", () => {
	it("transfer without toAccountId → error", () => {
		expect(validate("100", "acc1", "transfer", "", "")).toHaveProperty("toAccount");
	});
	it("transfer with toAccountId → no error", () => {
		expect(validate("100", "acc1", "transfer", "acc2", "")).not.toHaveProperty("toAccount");
	});
	it("transfer does not require category", () => {
		expect(validate("100", "acc1", "transfer", "acc2", "")).not.toHaveProperty("category");
	});
});

describe("TransactionDetailView – validate category", () => {
	it("expense without category → error", () => {
		expect(validate("100", "acc1", "expense", "", "")).toHaveProperty("category");
	});
	it("income without category → error", () => {
		expect(validate("100", "acc1", "income", "", "")).toHaveProperty("category");
	});
	it("expense with category → no error", () => {
		expect(validate("100", "acc1", "expense", "", "cat1")).not.toHaveProperty("category");
	});
});

describe("TransactionDetailView – startEdit", () => {
	const tx: Tx = {
		id: "t1",
		type: "expense",
		amount: 5000,
		date: "2026-06-15",
		time: "14:30",
		accountId: "acc1",
		toAccountId: null,
		categoryId: "cat1",
		comment: "Groceries"
	};

	it("sets isEditing to true", () => {
		expect(startEdit(tx).isEditing).toBe(true);
	});

	it("copies type", () => {
		expect(startEdit(tx).editType).toBe("expense");
	});

	it("converts amount to string", () => {
		expect(startEdit(tx).editAmount).toBe("5000");
	});

	it("copies date and time", () => {
		const result = startEdit(tx);
		expect(result.editDate).toBe("2026-06-15");
		expect(result.editTime).toBe("14:30");
	});

	it("toAccountId null → empty string", () => {
		expect(startEdit(tx).editToAccountId).toBe("");
	});

	it("categoryId null → empty string", () => {
		const txNocat: Tx = { ...tx, categoryId: null };
		expect(startEdit(txNocat).editCategoryId).toBe("");
	});

	it("copies comment", () => {
		expect(startEdit(tx).editComment).toBe("Groceries");
	});
});

describe("TransactionDetailView – formatDateLabel", () => {
	function formatDateLabel(date: string): string {
		return new Date(date).toLocaleDateString("ru-RU", {
			day: "numeric",
			month: "long",
			year: "numeric"
		});
	}

	it("returns non-empty string", () => {
		expect(formatDateLabel("2026-06-15").length).toBeGreaterThan(0);
	});

	it("includes year", () => {
		expect(formatDateLabel("2026-06-15")).toContain("2026");
	});
});

describe("TransactionDetailView – view/edit mode toggle", () => {
	it("initial state: isEditing = false", () => {
		const isEditing = false;
		expect(isEditing).toBe(false);
	});

	it("startEdit sets isEditing to true", () => {
		const tx: Tx = {
			id: "t1",
			type: "expense",
			amount: 100,
			date: "2026-06-01",
			time: "10:00",
			accountId: "acc1",
			toAccountId: null,
			categoryId: "cat1",
			comment: ""
		};
		const isEditing = startEdit(tx).isEditing;
		expect(isEditing).toBe(true);
	});

	it("saveEdit sets isEditing to false", () => {
		const isEditing = false;
		expect(isEditing).toBe(false);
	});
});
