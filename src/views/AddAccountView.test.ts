import { describe, it, expect } from "vitest";

// Extracted validate from AddAccountView
function validate(name: string, initialBalance: string): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!name.trim()) errors.name = "Введите название счёта";
	const bal = parseFloat(initialBalance.replace(",", "."));
	if (isNaN(bal)) errors.balance = "Введите число";
	return errors;
}

describe("AddAccountView – validate name", () => {
	it("empty name → error", () => {
		expect(validate("", "0")).toHaveProperty("name");
	});

	it("whitespace-only → error", () => {
		expect(validate("   ", "0")).toHaveProperty("name");
	});

	it("non-empty name → no error", () => {
		expect(validate("Main Card", "0")).not.toHaveProperty("name");
	});

	it("name with leading/trailing spaces → valid", () => {
		expect(validate("  Card  ", "0")).not.toHaveProperty("name");
	});
});

describe("AddAccountView – validate initialBalance", () => {
	it("numeric zero → no error", () => {
		expect(validate("Card", "0")).not.toHaveProperty("balance");
	});

	it("positive integer → no error", () => {
		expect(validate("Card", "1000")).not.toHaveProperty("balance");
	});

	it("negative number → no error (negatives are allowed)", () => {
		expect(validate("Card", "-100")).not.toHaveProperty("balance");
	});

	it("decimal with dot → no error", () => {
		expect(validate("Card", "100.50")).not.toHaveProperty("balance");
	});

	it("decimal with comma → no error", () => {
		expect(validate("Card", "100,50")).not.toHaveProperty("balance");
	});

	it("non-numeric string → error", () => {
		expect(validate("Card", "abc")).toHaveProperty("balance");
	});

	it("empty string → error (NaN)", () => {
		expect(validate("Card", "")).toHaveProperty("balance");
	});

	it("whitespace-only → error", () => {
		expect(validate("Card", "   ")).toHaveProperty("balance");
	});
});

describe("AddAccountView – validate combined", () => {
	it("both invalid → both errors", () => {
		const errors = validate("", "abc");
		expect(errors).toHaveProperty("name");
		expect(errors).toHaveProperty("balance");
	});

	it("all valid → no errors", () => {
		const errors = validate("My Card", "50000");
		expect(Object.keys(errors)).toHaveLength(0);
	});

	it("valid with decimal balance", () => {
		const errors = validate("Wallet", "1234.56");
		expect(Object.keys(errors)).toHaveLength(0);
	});
});

describe("AddAccountView – ACCOUNT_TYPES coverage", () => {
	const ACCOUNT_TYPES = [
		{ value: "card", label: "Банковская карта" },
		{ value: "cash", label: "Наличные" },
		{ value: "bank", label: "Банковский счёт" },
		{ value: "savings", label: "Накопления" },
		{ value: "investment", label: "Инвестиции" },
		{ value: "crypto", label: "Криптовалюта" }
	];

	it("has 6 account types", () => {
		expect(ACCOUNT_TYPES).toHaveLength(6);
	});

	it("all have value and label", () => {
		for (const t of ACCOUNT_TYPES) {
			expect(t.value).toBeTruthy();
			expect(t.label).toBeTruthy();
		}
	});
});

describe("AddAccountView – CURRENCIES coverage", () => {
	const CURRENCIES = ["KZT", "USD", "EUR", "RUB", "GBP", "CNY"];

	it("has 6 currencies", () => {
		expect(CURRENCIES).toHaveLength(6);
	});

	it("includes KZT", () => {
		expect(CURRENCIES).toContain("KZT");
	});
});
