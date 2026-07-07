import { Capacitor } from "@capacitor/core";
import type { BudgetEntry } from "@/types";

// Lazy-load LocalNotifications only on native platform.
// Wrapped in { plugin } to prevent `await` from treating the Capacitor Proxy as a thenable.
async function getNotifications() {
	if (!Capacitor.isNativePlatform()) return null;
	const { LocalNotifications } = await import("@capacitor/local-notifications");
	return { plugin: LocalNotifications };
}

export async function requestNotificationPermission(): Promise<boolean> {
	const notif = await getNotifications();
	if (!notif) return false;
	const status = await notif.plugin.requestPermissions();
	return status.display === "granted";
}

// ── Daily reminder ────────────────────────────────────────────────────────────

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
	const notif = await getNotifications();
	if (!notif) return;

	const [hours, minutes] = timeStr.split(":").map(Number);

	await notif.plugin.cancel({ notifications: [{ id: 1 }] });

	await notif.plugin.schedule({
		notifications: [
			{
				id: 1,
				title: "Budget",
				body: "Не забудьте записать сегодняшние расходы 💰",
				// Только cron-режим `on`: на Android `at` + `repeats: true` повторяет
				// с интервалом (at - now), т.е. уведомления сыплются постоянно.
				schedule: {
					on: { hour: hours, minute: minutes },
					allowWhileIdle: true
				},
				smallIcon: "ic_notification",
				sound: undefined
			}
		]
	});
}

export async function cancelDailyReminder(): Promise<void> {
	const notif = await getNotifications();
	if (!notif) return;
	await notif.plugin.cancel({ notifications: [{ id: 1 }] });
}

// ── Budget alerts ─────────────────────────────────────────────────────────────

export async function notifyBudgetWarning(budget: BudgetEntry, categoryName: string, pct: number): Promise<void> {
	const notif = await getNotifications();
	if (!notif) return;

	const id = 2000 + (parseInt(budget.id.slice(-4), 16) % 1000);
	const exceeded = pct >= 100;

	await notif.plugin.schedule({
		notifications: [
			{
				id,
				title: exceeded ? "⚠ Бюджет превышен" : "🔔 Бюджет заканчивается",
				body: exceeded
					? `«${categoryName}»: лимит ${budget.limitAmount.toLocaleString()} превышен`
					: `«${categoryName}»: использовано ${pct}% из ${budget.limitAmount.toLocaleString()}`,
				schedule: { at: new Date(Date.now() + 1000) },
				smallIcon: "ic_notification",
				sound: undefined
			}
		]
	});
}
