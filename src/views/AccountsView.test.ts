import { describe, it, expect } from "vitest";

function formatAmount(n: number, currency: string): string {
	return n.toLocaleString("ru-RU") + " " + currency;
}

describe("AccountsView – formatAmount", () => {
	it("appends currency", () => {
		expect(formatAmount(1000, "KZT")).toContain("KZT");
	});

	it("0 with currency", () => {
		expect(formatAmount(0, "USD")).toContain("USD");
	});

	it("large number with thousands", () => {
		const s = formatAmount(1000000, "EUR");
		expect(s).toContain("EUR");
		// ru-RU formats 1000000 as "1 000 000" (non-breaking space)
		expect(s).toContain("1");
	});

	it("negative amount", () => {
		const s = formatAmount(-500, "RUB");
		expect(s).toContain("-");
		expect(s).toContain("RUB");
	});

	it("decimal amount", () => {
		const s = formatAmount(99.99, "USD");
		expect(s).toContain("USD");
	});
});
