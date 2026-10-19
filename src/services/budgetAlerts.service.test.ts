import { describe, it, expect, beforeEach } from "vitest";
import { wasBudgetAlertSent, markBudgetAlertSent, ALERTS_STORAGE_KEY } from "./budgetAlerts.service";
import type { BudgetEntry } from "@/types";

const CURRENT_MONTH = new Date().toLocaleDateString("en-CA").slice(0, 7);

function makeBudget(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
	return {
		id: "b-1",
		month: CURRENT_MONTH,
		categoryId: "cat-1",
		limitAmount: 50_000,
		currency: "KZT",
		notifyAt: 80,
		notifyEnabled: true,
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

beforeEach(() => {
	localStorage.clear();
});

describe("budgetAlerts.service – dedup", () => {
	it("wasBudgetAlertSent returns false when nothing was marked", () => {
		expect(wasBudgetAlertSent(makeBudget(), 80)).toBe(false);
	});

	it("returns true after markBudgetAlertSent for same budget and threshold", () => {
		markBudgetAlertSent(makeBudget(), 80);
		expect(wasBudgetAlertSent(makeBudget(), 80)).toBe(true);
	});

	it("distinguishes thresholds 80 and 100", () => {
		markBudgetAlertSent(makeBudget(), 80);
		expect(wasBudgetAlertSent(makeBudget(), 100)).toBe(false);
	});

	it("distinguishes budget ids", () => {
		markBudgetAlertSent(makeBudget({ id: "b-1" }), 80);
		expect(wasBudgetAlertSent(makeBudget({ id: "b-2" }), 80)).toBe(false);
	});
});

describe("budgetAlerts.service – persistence", () => {
	it("writes marked alerts to localStorage", () => {
		markBudgetAlertSent(makeBudget(), 80);
		const stored = JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY)!) as string[];
		expect(stored).toContain(`${CURRENT_MONTH}:b-1:80`);
	});

	it("reads alerts persisted by a previous session", () => {
		localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify([`${CURRENT_MONTH}:b-1:100`]));
		expect(wasBudgetAlertSent(makeBudget(), 100)).toBe(true);
	});

	it("prunes alerts of past months when marking", () => {
		localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(["2020-01:b-old:80"]));
		markBudgetAlertSent(makeBudget(), 80);
		const stored = JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY)!) as string[];
		expect(stored).not.toContain("2020-01:b-old:80");
		expect(stored).toContain(`${CURRENT_MONTH}:b-1:80`);
	});

	it("tolerates corrupted storage content", () => {
		localStorage.setItem(ALERTS_STORAGE_KEY, "{not-json");
		expect(wasBudgetAlertSent(makeBudget(), 80)).toBe(false);
		markBudgetAlertSent(makeBudget(), 80);
		expect(wasBudgetAlertSent(makeBudget(), 80)).toBe(true);
	});
});
