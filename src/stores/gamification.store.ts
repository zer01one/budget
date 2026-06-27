import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { GamificationState, GamificationFile, Achievement, AchievementKey, Level, Transaction } from "@/types";
import { LEVEL_THRESHOLDS, LEVEL_LABELS } from "@/types";
import { getFileSystemAdapter } from "@/services/filesystem";
import { useSettingsStore } from "./settings.store";

const XP_PER_TRANSACTION = 10;
const XP_PER_DAY_STREAK = 5;
const XP_PER_ACHIEVEMENT = 100;
const XP_STREAK_7 = 50;
const XP_STREAK_30 = 100;
const XP_BUDGET_KEPT = 25;

const ACHIEVEMENT_LABELS: Record<AchievementKey, { name: string; description: string }> = {
	first_transaction: { name: "Первый шаг", description: "Добавьте первую транзакцию" },
	streak_7: { name: "Неделя дисциплины", description: "7 дней подряд с транзакциями" },
	streak_30: { name: "Железная привычка", description: "30 дней подряд с транзакциями" },
	budget_keeper: { name: "Экономный", description: "Завершите месяц в рамках бюджета" },
	century: { name: "Сотник", description: "Добавьте 100 транзакций" },
	category_master: { name: "Организатор", description: "Создайте 10 категорий" }
};

export { ACHIEVEMENT_LABELS };

let _persistChain: Promise<void> = Promise.resolve();

export const useGamificationStore = defineStore("gamification", () => {
	const state = ref<GamificationState>({
		xp: 0,
		level: "novice",
		currentStreak: 0,
		longestStreak: 0,
		lastLoggedDate: null,
		achievements: [],
		totalTransactions: 0,
		categoriesCreated: 0,
		budgetsKept: 0,
		updatedAt: new Date().toISOString(),
		deviceId: "",
		version: 1
	});

	const pendingToasts = ref<Achievement[]>([]);

	const levelLabel = computed(() => LEVEL_LABELS[state.value.level]);

	const nextLevel = computed((): Level | null => {
		const levels: Level[] = ["novice", "apprentice", "practitioner", "expert", "master"];
		const idx = levels.indexOf(state.value.level);
		return idx < levels.length - 1 ? levels[idx + 1] : null;
	});

	const xpToNextLevel = computed((): number => {
		if (!nextLevel.value) return 0;
		return LEVEL_THRESHOLDS[nextLevel.value] - state.value.xp;
	});

	const levelProgress = computed((): number => {
		const current = LEVEL_THRESHOLDS[state.value.level];
		const next = nextLevel.value ? LEVEL_THRESHOLDS[nextLevel.value] : current + 1;
		return ((state.value.xp - current) / (next - current)) * 100;
	});

	async function load(): Promise<void> {
		const fs = await getFileSystemAdapter();
		const result = await fs.readJson<GamificationFile>("gamification.json");
		if (result) {
			state.value = result.data.gamification;
		}
	}

	async function persist(): Promise<void> {
		_persistChain = _persistChain.catch(() => {}).then(async () => {
			const settingsStore = useSettingsStore();
			const fs = await getFileSystemAdapter();
			state.value.updatedAt = new Date().toISOString();
			state.value.deviceId = settingsStore.settings.deviceId;
			state.value.version += 1;
			await fs.writeJson<GamificationFile>("gamification.json", { gamification: state.value });
		});
		return _persistChain;
	}

	function addXp(amount: number): void {
		state.value.xp += amount;
		state.value.level = computeLevel(state.value.xp);
	}

	function computeLevel(xp: number): Level {
		const entries = Object.entries(LEVEL_THRESHOLDS) as [Level, number][];
		entries.sort((a, b) => b[1] - a[1]);
		for (const [level, threshold] of entries) {
			if (xp >= threshold) return level;
		}
		return "novice";
	}

	function unlockAchievement(key: AchievementKey): void {
		const achievement = state.value.achievements.find((a) => a.key === key);
		if (!achievement || achievement.unlockedAt) return;
		achievement.unlockedAt = new Date().toISOString();
		achievement.progress = 100;
		addXp(XP_PER_ACHIEVEMENT);
		pendingToasts.value.push({ ...achievement });
	}

	function checkStreakMilestones(): void {
		if (state.value.currentStreak === 7) {
			addXp(XP_STREAK_7);
			unlockAchievement("streak_7");
		}
		if (state.value.currentStreak === 30) {
			addXp(XP_STREAK_30);
			unlockAchievement("streak_30");
		}
	}

	function checkDailyStreak(): void {
		const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
		const last = state.value.lastLoggedDate;
		if (!last || last === today) return;

		const lastDate = new Date(last);
		const todayDate = new Date(today);
		const daysDiff = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);

		if (daysDiff === 1) {
			state.value.currentStreak++;
			if (state.value.currentStreak > state.value.longestStreak) {
				state.value.longestStreak = state.value.currentStreak;
			}
			addXp(XP_PER_DAY_STREAK);
			checkStreakMilestones();
		} else if (daysDiff > 1) {
			state.value.currentStreak = 0;
		}
		persist();
	}

	function onTransactionAdded(_tx: Transaction): void {
		const today = new Date().toLocaleDateString("en-CA");

		state.value.totalTransactions++;
		state.value.lastLoggedDate = today;
		addXp(XP_PER_TRANSACTION);

		// Update streak
		const last = state.value.lastLoggedDate;
		if (!last || last !== today) {
			if (last) {
				const lastDate = new Date(last);
				const daysDiff = Math.round((new Date(today).getTime() - lastDate.getTime()) / 86400000);
				if (daysDiff === 1) {
					state.value.currentStreak++;
					if (state.value.currentStreak > state.value.longestStreak) {
						state.value.longestStreak = state.value.currentStreak;
					}
					checkStreakMilestones();
				} else {
					state.value.currentStreak = 1;
				}
			} else {
				state.value.currentStreak = 1;
			}
			state.value.lastLoggedDate = today;
		}

		// Check achievements
		if (state.value.totalTransactions === 1) unlockAchievement("first_transaction");
		if (state.value.totalTransactions === 100) unlockAchievement("century");

		// Update progress on non-unlocked achievements
		const centuryAch = state.value.achievements.find((a) => a.key === "century");
		if (centuryAch && !centuryAch.unlockedAt) {
			centuryAch.progress = Math.min(100, Math.round(state.value.totalTransactions));
		}

		persist();
	}

	function onCategoryCreated(): void {
		state.value.categoriesCreated++;
		if (state.value.categoriesCreated === 10) unlockAchievement("category_master");
		persist();
	}

	function onBudgetKept(): void {
		state.value.budgetsKept++;
		addXp(XP_BUDGET_KEPT);
		unlockAchievement("budget_keeper");
		persist();
	}

	function popToast(): Achievement | null {
		return pendingToasts.value.shift() ?? null;
	}

	return {
		state,
		pendingToasts,
		levelLabel,
		nextLevel,
		xpToNextLevel,
		levelProgress,
		load,
		persist,
		checkDailyStreak,
		onTransactionAdded,
		onCategoryCreated,
		onBudgetKept,
		popToast,
		ACHIEVEMENT_LABELS
	};
});
