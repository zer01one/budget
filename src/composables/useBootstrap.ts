import { ref } from "vue";
import { useSettingsStore } from "@/stores/settings.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { useBudgetsStore } from "@/stores/budgets.store";
import { setVaultPath } from "@/services/filesystem";
import { processRecurringTransactions } from "@/composables/useRecurring";

const _bootstrapped = ref(false);

export function useBootstrap() {
	const settingsStore = useSettingsStore();
	const accountsStore = useAccountsStore();
	const categoriesStore = useCategoriesStore();
	const txStore = useTransactionsStore();
	const gamificationStore = useGamificationStore();
	const budgetsStore = useBudgetsStore();

	async function bootstrap(): Promise<void> {
		if (_bootstrapped.value) return;
		_bootstrapped.value = true;

		const vaultPath = settingsStore.settings.vaultPath;
		if (!vaultPath) return;

		await setVaultPath(vaultPath);

		await Promise.all([accountsStore.load(), categoriesStore.load(), gamificationStore.load(), budgetsStore.load()]);

		gamificationStore.checkDailyStreak();

		// Preload current + previous month transactions
		await txStore.loadCurrentAndPrevMonth();

		// Spawn any missing recurring transaction occurrences
		await processRecurringTransactions();
	}

	return { bootstrap, bootstrapped: _bootstrapped };
}
