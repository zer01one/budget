import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Transaction, ConflictInfo } from "@/types";
import { transactionsService } from "@/services/data/transactions.service";
import { useSettingsStore } from "./settings.store";
import { useAccountsStore } from "./accounts.store";

export const useTransactionsStore = defineStore("transactions", () => {
	const _cache = ref<Map<string, Transaction[]>>(new Map());
	const loadedMonths = ref<Set<string>>(new Set());
	const isLoading = ref(false);
	const lastConflict = ref<ConflictInfo | null>(null);

	const allCached = computed((): Transaction[] => [..._cache.value.values()].flat());

	function getByMonth(month: string): Transaction[] {
		return _cache.value.get(month) ?? [];
	}

	function getByAccount(accountId: string): Transaction[] {
		return allCached.value.filter((t) => !t.isDeleted && (t.accountId === accountId || t.toAccountId === accountId));
	}

	async function loadMonth(month: string): Promise<void> {
		if (loadedMonths.value.has(month)) return;
		isLoading.value = true;
		try {
			const result = await transactionsService.loadMonth(month);
			_cache.value.set(month, result?.transactions ?? []);
			if (result?.conflict) lastConflict.value = result.conflict;
			loadedMonths.value.add(month);
		} finally {
			isLoading.value = false;
		}
	}

	async function loadCurrentAndPrevMonth(): Promise<void> {
		const now = new Date();
		const current = now.toLocaleDateString("en-CA").slice(0, 7);
		const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("en-CA").slice(0, 7);
		await Promise.all([loadMonth(current), loadMonth(prev)]);
	}

	async function loadAllMonths(): Promise<void> {
		const months = await transactionsService.listMonths();
		await Promise.all(months.map(loadMonth));
	}

	function txDeltaForAccount(tx: Transaction, accountId: string): number {
		if (tx.isDeleted) return 0;
		if (tx.accountId === accountId) return tx.type === "income" ? tx.amount : -tx.amount;
		if (tx.toAccountId === accountId && tx.type === "transfer") return tx.amount;
		return 0;
	}

	async function addTransaction(input: Omit<Transaction, "id" | "updatedAt" | "deviceId" | "version" | "isDeleted">): Promise<Transaction> {
		const settingsStore = useSettingsStore();
		const accountsStore = useAccountsStore();
		const now = new Date().toISOString();
		const tx: Transaction = {
			...input,
			id: crypto.randomUUID(),
			isDeleted: false,
			updatedAt: now,
			deviceId: settingsStore.settings.deviceId,
			version: 1
		};
		const month = tx.date.slice(0, 7);
		await loadMonth(month);
		const existing = _cache.value.get(month) ?? [];
		_cache.value.set(month, [...existing, tx]);
		await transactionsService.saveMonth(month, _cache.value.get(month)!);
		await accountsStore.adjustBalance(tx.accountId, txDeltaForAccount(tx, tx.accountId));
		if (tx.toAccountId) await accountsStore.adjustBalance(tx.toAccountId, txDeltaForAccount(tx, tx.toAccountId));
		return tx;
	}

	async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
		const settingsStore = useSettingsStore();
		const accountsStore = useAccountsStore();
		const month = findMonthForId(id);
		if (!month) return;
		const list = _cache.value.get(month) ?? [];
		const idx = list.findIndex((t) => t.id === id);
		if (idx === -1) return;
		const oldTx = list[idx];
		const updated = {
			...oldTx,
			...patch,
			updatedAt: new Date().toISOString(),
			deviceId: settingsStore.settings.deviceId,
			version: oldTx.version + 1
		};
		const newList = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
		_cache.value.set(month, newList);
		await transactionsService.saveMonth(month, newList);
		const affected = new Set([oldTx.accountId, updated.accountId, oldTx.toAccountId, updated.toAccountId].filter(Boolean) as string[]);
		for (const accId of affected) {
			const delta = txDeltaForAccount(updated, accId) - txDeltaForAccount(oldTx, accId);
			if (delta !== 0) await accountsStore.adjustBalance(accId, delta);
		}
	}

	async function deleteTransaction(id: string): Promise<void> {
		await updateTransaction(id, { isDeleted: true });
	}

	function findMonthForId(id: string): string | null {
		for (const [month, list] of _cache.value) {
			if (list.find((t) => t.id === id)) return month;
		}
		return null;
	}

	function computeAccountBalance(accountId: string, initialBalance: number): number {
		let balance = initialBalance;
		for (const tx of allCached.value) {
			if (tx.isDeleted) continue;
			if (tx.accountId === accountId) {
				balance += tx.type === "income" ? tx.amount : -tx.amount;
			}
			if (tx.toAccountId === accountId && tx.type === "transfer") {
				balance += tx.amount;
			}
		}
		return balance;
	}

	function clearConflict(): void {
		lastConflict.value = null;
	}

	return {
		_cache,
		loadedMonths,
		isLoading,
		lastConflict,
		allCached,
		getByMonth,
		getByAccount,
		loadMonth,
		loadCurrentAndPrevMonth,
		loadAllMonths,
		addTransaction,
		updateTransaction,
		deleteTransaction,
		computeAccountBalance,
		clearConflict
	};
});
