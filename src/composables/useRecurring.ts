import { useTransactionsStore } from "@/stores/transactions.store";

function addDays(dateStr: string, n: number): string {
	const d = new Date(dateStr);
	d.setDate(d.getDate() + n);
	return d.toLocaleDateString("en-CA");
}

function nextOccurrence(lastDate: string, rule: "daily" | "weekly" | "monthly"): string {
	if (rule === "daily") return addDays(lastDate, 1);
	if (rule === "weekly") return addDays(lastDate, 7);
	// monthly: same day next month
	const [y, m, d] = lastDate.split("-").map(Number);
	const next = new Date(y, m, d); // m is already 0-indexed after +1
	return next.toLocaleDateString("en-CA");
}

export async function processRecurringTransactions(): Promise<void> {
	const txStore = useTransactionsStore();
	const today = new Date().toLocaleDateString("en-CA");

	// Find all recurring templates (root templates have recurringParentId = null, isRecurring = true)
	const templates = txStore.allCached.filter((t) => t.isRecurring && !t.recurringParentId && !t.isDeleted && t.recurringRule);

	for (const template of templates) {
		const rule = template.recurringRule!;

		// Find the latest child transaction for this template
		const children = txStore.allCached
			.filter((t) => t.recurringParentId === template.id && !t.isDeleted)
			.sort((a, b) => b.date.localeCompare(a.date));

		let cursor = children.length > 0 ? children[0].date : template.date;

		// Spawn all missing occurrences up to today
		let safety = 0;
		while (safety < 366) {
			const next = nextOccurrence(cursor, rule);
			if (next > today) break;
			cursor = next;
			safety++;

			await txStore.addTransaction({
				type: template.type,
				amount: template.amount,
				currency: template.currency,
				date: next,
				time: template.time,
				accountId: template.accountId,
				toAccountId: template.toAccountId,
				categoryId: template.categoryId,
				comment: template.comment,
				tags: template.tags,
				isRecurring: true,
				recurringParentId: template.id,
				recurringRule: undefined
			});
		}
	}
}
