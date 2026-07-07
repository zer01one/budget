import type { BudgetEntry } from "@/types";

// Дедупликация бюджетных алертов между запусками приложения.
// Ключи вида "YYYY-MM:budgetId:threshold" хранятся в localStorage;
// записи прошлых месяцев вычищаются при каждой записи.

export const ALERTS_STORAGE_KEY = "budget-notified-alerts";

function readKeys(): string[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
	} catch {
		return [];
	}
}

function alertKey(budget: BudgetEntry, threshold: number): string {
	return `${budget.month}:${budget.id}:${threshold}`;
}

export function wasBudgetAlertSent(budget: BudgetEntry, threshold: number): boolean {
	return readKeys().includes(alertKey(budget, threshold));
}

export function markBudgetAlertSent(budget: BudgetEntry, threshold: number): void {
	const currentMonth = new Date().toLocaleDateString("en-CA").slice(0, 7);
	const keys = readKeys().filter((k) => k.slice(0, 7) >= currentMonth);
	const key = alertKey(budget, threshold);
	if (!keys.includes(key)) keys.push(key);
	localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(keys));
}
