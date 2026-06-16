import { Capacitor } from "@capacitor/core";
import type { BudgetEntry } from "@/types";

// Lazy-load LocalNotifications only on native platform
async function getNotifications() {
	if (!Capacitor.isNativePlatform()) return null;
	const { LocalNotifications } = await import("@capacitor/local-notifications");
	return LocalNotifications;
}

export async function requestNotificationPermission(): Promise<boolean> {
	const ln = await getNotifications();
	if (!ln) return false;
	const status = await ln.requestPermissions();
	return status.display === "granted";
}

// ── Daily reminder ────────────────────────────────────────────────────────────

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
	const ln = await getNotifications();
	if (!ln) return;

	const [hours, minutes] = timeStr.split(":").map(Number);

	// Cancel previous daily reminder
	await ln.cancel({ notifications: [{ id: 1 }] });

	const now = new Date();
	let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
	if (next <= now) next.setDate(next.getDate() + 1);

	await ln.schedule({
		notifications: [
			{
				id: 1,
				title: "Budget",
				body: "Не забудьте записать сегодняшние расходы 💰",
				schedule: {
					at: next,
					repeats: true,
					every: "day"
				},
				smallIcon: "ic_notification",
				sound: undefined
			}
		]
	});
}

export async function cancelDailyReminder(): Promise<void> {
	const ln = await getNotifications();
	if (!ln) return;
	await ln.cancel({ notifications: [{ id: 1 }] });
}

// ── Budget alerts ─────────────────────────────────────────────────────────────

export async function notifyBudgetWarning(budget: BudgetEntry, categoryName: string, pct: number): Promise<void> {
	const ln = await getNotifications();
	if (!ln) return;

	const id = 2000 + (parseInt(budget.id.slice(-4), 16) % 1000);
	const exceeded = pct >= 100;

	await ln.schedule({
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
