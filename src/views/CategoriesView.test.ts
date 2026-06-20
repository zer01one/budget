import { describe, it, expect } from "vitest";

type Category = {
	id: string;
	name: string;
	type: "expense" | "income";
	isArchived: boolean;
	isSystem?: boolean;
	color: string;
	icon: string;
};

// Extracted displayed filter
function displayed(categories: Category[], activeTab: "expense" | "income"): Category[] {
	return categories.filter((c) => c.type === activeTab && !c.isArchived);
}

// Extracted validate
function validate(name: string): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!name.trim()) errors.name = "Введите название";
	return errors;
}

// Extracted openEdit guard
function canEdit(cat: Category): boolean {
	return !cat.isSystem;
}

const cats: Category[] = [
	{ id: "e1", name: "Food", type: "expense", isArchived: false, color: "#f00", icon: "food" },
	{ id: "e2", name: "Transport", type: "expense", isArchived: false, color: "#0f0", icon: "transport" },
	{ id: "e3", name: "Old", type: "expense", isArchived: true, color: "#00f", icon: "other" },
	{ id: "i1", name: "Salary", type: "income", isArchived: false, color: "#ff0", icon: "salary" },
	{ id: "i2", name: "Gift", type: "income", isArchived: true, color: "#0ff", icon: "gift" }
];

describe("CategoriesView – displayed filter", () => {
	it("expense tab shows only non-archived expense categories", () => {
		const result = displayed(cats, "expense");
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id).sort()).toEqual(["e1", "e2"].sort());
	});

	it("income tab shows only non-archived income categories", () => {
		const result = displayed(cats, "income");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("i1");
	});

	it("archived categories not shown", () => {
		expect(displayed(cats, "expense").find((c) => c.id === "e3")).toBeUndefined();
		expect(displayed(cats, "income").find((c) => c.id === "i2")).toBeUndefined();
	});

	it("empty result when no matching categories", () => {
		expect(displayed([], "expense")).toHaveLength(0);
	});
});

describe("CategoriesView – validate", () => {
	it("empty name → error", () => {
		expect(validate("")).toHaveProperty("name");
	});

	it("whitespace-only name → error", () => {
		expect(validate("   ")).toHaveProperty("name");
	});

	it("valid name → no errors", () => {
		expect(validate("Groceries")).not.toHaveProperty("name");
	});

	it("name with spaces trimmed → valid", () => {
		expect(validate("  Groceries  ")).not.toHaveProperty("name");
	});
});

describe("CategoriesView – openEdit guard", () => {
	it("system category cannot be edited", () => {
		const cat: Category = { id: "sys1", name: "System", type: "expense", isArchived: false, isSystem: true, color: "#000", icon: "other" };
		expect(canEdit(cat)).toBe(false);
	});

	it("non-system category can be edited", () => {
		expect(canEdit(cats[0])).toBe(true);
	});

	it("non-system without isSystem field → can edit", () => {
		const cat: Category = { id: "x", name: "X", type: "expense", isArchived: false, color: "#000", icon: "other" };
		expect(canEdit(cat)).toBe(true);
	});
});
