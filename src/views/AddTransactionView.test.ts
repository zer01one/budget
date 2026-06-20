import { describe, it, expect } from "vitest";

// Extracted validate logic matching AddTransactionView
function validate(amount: string, accountId: string, type: string, toAccountId: string, categoryId: string): Record<string, string> {
	const errors: Record<string, string> = {};
	const parsed = parseFloat(amount.replace(",", "."));
	if (isNaN(parsed) || parsed <= 0) errors.amount = "Введите положительную сумму";
	if (!accountId) errors.account = "Выберите счёт";
	if (type === "transfer" && !toAccountId) errors.toAccount = "Выберите счёт назначения";
	if (type !== "transfer" && !categoryId) errors.category = "Выберите категорию";
	return errors;
}

function isValid(amount: string, accountId: string, type: string, toAccountId: string, categoryId: string) {
	return Object.keys(validate(amount, accountId, type, toAccountId, categoryId)).length === 0;
}

describe("AddTransactionView – validate amount", () => {
	it("empty string → error", () => {
		expect(validate("", "acc1", "expense", "", "cat1")).toHaveProperty("amount");
	});

	it("0 → error", () => {
		expect(validate("0", "acc1", "expense", "", "cat1")).toHaveProperty("amount");
	});

	it("negative → error", () => {
		expect(validate("-5", "acc1", "expense", "", "cat1")).toHaveProperty("amount");
	});

	it("non-numeric → error", () => {
		expect(validate("abc", "acc1", "expense", "", "cat1")).toHaveProperty("amount");
	});

	it("valid decimal with comma", () => {
		expect(validate("5,5", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount");
	});

	it("valid decimal with dot", () => {
		expect(validate("5.5", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount");
	});

	it("valid integer", () => {
		expect(validate("100", "acc1", "expense", "", "cat1")).not.toHaveProperty("amount");
	});
});

describe("AddTransactionView – validate accountId", () => {
	it("empty accountId → error", () => {
		expect(validate("100", "", "expense", "", "cat1")).toHaveProperty("account");
	});

	it("non-empty accountId → no error", () => {
		expect(validate("100", "acc1", "expense", "", "cat1")).not.toHaveProperty("account");
	});
});

describe("AddTransactionView – validate transfer", () => {
	it("transfer without toAccountId → error", () => {
		const errors = validate("100", "acc1", "transfer", "", "");
		expect(errors).toHaveProperty("toAccount");
	});

	it("transfer with toAccountId → no toAccount error", () => {
		const errors = validate("100", "acc1", "transfer", "acc2", "");
		expect(errors).not.toHaveProperty("toAccount");
	});

	it("transfer does not require categoryId", () => {
		const errors = validate("100", "acc1", "transfer", "acc2", "");
		expect(errors).not.toHaveProperty("category");
	});
});

describe("AddTransactionView – validate category (non-transfer)", () => {
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

describe("AddTransactionView – validate all valid", () => {
	it("valid expense → no errors", () => {
		expect(isValid("100", "acc1", "expense", "", "cat1")).toBe(true);
	});

	it("valid income → no errors", () => {
		expect(isValid("200", "acc1", "income", "", "cat1")).toBe(true);
	});

	it("valid transfer → no errors", () => {
		expect(isValid("300", "acc1", "transfer", "acc2", "")).toBe(true);
	});
});
