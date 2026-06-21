import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGamificationStore } from "./gamification.store";
import { LEVEL_THRESHOLDS } from "@/types";
import type { Achievement } from "@/types";

const { mockReadJson, mockWriteJson } = vi.hoisted(() => ({
	mockReadJson: vi.fn(() => Promise.resolve(null)),
	mockWriteJson: vi.fn(() => Promise.resolve())
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn(() => Promise.resolve({ readJson: mockReadJson, writeJson: mockWriteJson }))
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "device-test" } }))
}));

function makeAch(key: Achievement["key"]): Achievement {
	return { key, unlockedAt: null, progress: 0, notifiedAt: null };
}

function allAchievements(): Achievement[] {
	return (["first_transaction", "streak_7", "streak_30", "budget_keeper", "century", "category_master"] as const).map(makeAch);
}

function setToday(dateStr: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(`${dateStr}T12:00:00.000Z`));
}

describe("gamification store", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mockReadJson.mockReset().mockResolvedValue(null);
		mockWriteJson.mockReset().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── load ─────────────────────────────────────────────────────────────────────

	describe("load", () => {
		it("keeps default state when file is absent (null)", async () => {
			const store = useGamificationStore();
			await store.load();
			expect(store.state.xp).toBe(0);
			expect(store.state.level).toBe("novice");
			expect(store.state.achievements).toEqual([]);
		});

		it("reads from 'gamification.json'", async () => {
			const store = useGamificationStore();
			await store.load();
			expect(mockReadJson).toHaveBeenCalledWith("gamification.json");
		});

		it("restores full state from file", async () => {
			const saved = {
				xp: 1500,
				level: "practitioner",
				currentStreak: 5,
				longestStreak: 12,
				lastLoggedDate: "2026-06-20",
				achievements: [{ key: "first_transaction", unlockedAt: "2026-01-01T00:00:00Z", progress: 100, notifiedAt: null }],
				totalTransactions: 80,
				categoriesCreated: 3,
				budgetsKept: 2,
				updatedAt: "2026-06-20T10:00:00Z",
				deviceId: "dev-abc",
				version: 7
			};
			mockReadJson.mockResolvedValueOnce({ data: { gamification: saved } });
			const store = useGamificationStore();
			await store.load();
			expect(store.state.xp).toBe(1500);
			expect(store.state.level).toBe("practitioner");
			expect(store.state.currentStreak).toBe(5);
			expect(store.state.totalTransactions).toBe(80);
		});
	});

	// ── persist ───────────────────────────────────────────────────────────────────

	describe("persist", () => {
		it("writes to 'gamification.json'", async () => {
			const store = useGamificationStore();
			await store.persist();
			expect(mockWriteJson).toHaveBeenCalledWith("gamification.json", { gamification: expect.objectContaining({ xp: 0 }) });
		});

		it("stamps deviceId from settings store", async () => {
			const store = useGamificationStore();
			await store.persist();
			expect(store.state.deviceId).toBe("device-test");
		});

		it("increments version on each call", async () => {
			const store = useGamificationStore();
			const v0 = store.state.version;
			await store.persist();
			expect(store.state.version).toBe(v0 + 1);
			await store.persist();
			expect(store.state.version).toBe(v0 + 2);
		});

		it("updates updatedAt to a valid ISO timestamp", async () => {
			const store = useGamificationStore();
			await store.persist();
			expect(store.state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});
	});

	// ── computed: levelLabel ──────────────────────────────────────────────────────

	describe("levelLabel", () => {
		it("returns the correct Russian label for each level", () => {
			const store = useGamificationStore();
			const cases: [string, string][] = [
				["novice", "Новичок"],
				["apprentice", "Ученик"],
				["practitioner", "Практик"],
				["expert", "Эксперт"],
				["master", "Мастер"]
			];
			for (const [level, label] of cases) {
				store.state.level = level as any;
				expect(store.levelLabel).toBe(label);
			}
		});
	});

	// ── computed: nextLevel ───────────────────────────────────────────────────────

	describe("nextLevel", () => {
		it.each([
			["novice", "apprentice"],
			["apprentice", "practitioner"],
			["practitioner", "expert"],
			["expert", "master"]
		])("%s → %s", (current, next) => {
			const store = useGamificationStore();
			store.state.level = current as any;
			expect(store.nextLevel).toBe(next);
		});

		it("master → null (max level)", () => {
			const store = useGamificationStore();
			store.state.level = "master";
			expect(store.nextLevel).toBeNull();
		});
	});

	// ── computed: xpToNextLevel ────────────────────────────────────────────────────

	describe("xpToNextLevel", () => {
		it("returns remaining XP from novice with 200 xp", () => {
			const store = useGamificationStore();
			store.state.xp = 200;
			expect(store.xpToNextLevel).toBe(LEVEL_THRESHOLDS.apprentice - 200);
		});

		it("returns full gap when at level start threshold", () => {
			const store = useGamificationStore();
			store.state.level = "apprentice";
			store.state.xp = LEVEL_THRESHOLDS.apprentice;
			expect(store.xpToNextLevel).toBe(LEVEL_THRESHOLDS.practitioner - LEVEL_THRESHOLDS.apprentice);
		});

		it("returns 0 at master level", () => {
			const store = useGamificationStore();
			store.state.level = "master";
			store.state.xp = LEVEL_THRESHOLDS.master;
			expect(store.xpToNextLevel).toBe(0);
		});
	});

	// ── computed: levelProgress ────────────────────────────────────────────────────

	describe("levelProgress", () => {
		it("returns 0 at start of novice", () => {
			const store = useGamificationStore();
			expect(store.levelProgress).toBe(0);
		});

		it("returns 50 at midpoint of novice→apprentice band", () => {
			const store = useGamificationStore();
			store.state.xp = 250;
			expect(store.levelProgress).toBeCloseTo(50);
		});

		it("approaches 100 near the top of a band", () => {
			const store = useGamificationStore();
			store.state.xp = 499;
			expect(store.levelProgress).toBeCloseTo((499 / 500) * 100);
		});

		it("returns 0 at master with exact threshold XP (sentinel next = current+1)", () => {
			const store = useGamificationStore();
			store.state.level = "master";
			store.state.xp = LEVEL_THRESHOLDS.master;
			expect(store.levelProgress).toBe(0);
		});
	});

	// ── unlockAchievement (exercised via public actions) ──────────────────────────

	describe("unlockAchievement", () => {
		it("sets unlockedAt and progress=100 on the achievement", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.onBudgetKept();
			const ach = store.state.achievements.find((a) => a.key === "budget_keeper")!;
			expect(ach.unlockedAt).not.toBeNull();
			expect(ach.progress).toBe(100);
		});

		it("adds XP_PER_ACHIEVEMENT (100) when unlocking", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.xp = 0;
			// onBudgetKept: +25 XP_BUDGET_KEPT + 100 XP_PER_ACHIEVEMENT
			store.onBudgetKept();
			expect(store.state.xp).toBe(125);
		});

		it("pushes unlocked achievement to pendingToasts", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.onBudgetKept();
			expect(store.pendingToasts).toHaveLength(1);
			expect(store.pendingToasts[0].key).toBe("budget_keeper");
		});

		it("is a no-op when achievement is already unlocked", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.achievements.find((a) => a.key === "budget_keeper")!.unlockedAt = "2026-01-01T00:00:00Z";
			store.state.xp = 0;
			store.onBudgetKept(); // +25 XP_BUDGET_KEPT, no XP_PER_ACHIEVEMENT, no toast
			expect(store.state.xp).toBe(25);
			expect(store.pendingToasts).toHaveLength(0);
		});

		it("is a no-op when achievement key is absent from achievements list", () => {
			const store = useGamificationStore();
			store.state.achievements = [];
			store.state.xp = 0;
			store.onBudgetKept(); // addXp(25) still runs, unlockAchievement returns early
			expect(store.state.xp).toBe(25);
			expect(store.pendingToasts).toHaveLength(0);
		});
	});

	// ── checkDailyStreak ──────────────────────────────────────────────────────────

	describe("checkDailyStreak", () => {
		it("is a no-op when lastLoggedDate is null", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = null;
			store.state.currentStreak = 3;
			store.checkDailyStreak();
			expect(store.state.currentStreak).toBe(3);
		});

		it("is a no-op when lastLoggedDate equals today", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-21";
			store.state.currentStreak = 3;
			store.checkDailyStreak();
			expect(store.state.currentStreak).toBe(3);
		});

		it("increments streak by 1 when gap is exactly 1 day", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 4;
			store.checkDailyStreak();
			expect(store.state.currentStreak).toBe(5);
		});

		it("adds XP_PER_DAY_STREAK (5) when streak continues", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.xp = 0;
			store.checkDailyStreak();
			expect(store.state.xp).toBe(5);
		});

		it("updates longestStreak when current streak exceeds it", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 10;
			store.state.longestStreak = 10;
			store.checkDailyStreak();
			expect(store.state.longestStreak).toBe(11);
		});

		it("does not decrease longestStreak when current is below it", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 4;
			store.state.longestStreak = 20;
			store.checkDailyStreak();
			expect(store.state.longestStreak).toBe(20);
		});

		it("resets streak to 0 when gap is >1 day", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-18";
			store.state.currentStreak = 5;
			store.checkDailyStreak();
			expect(store.state.currentStreak).toBe(0);
		});

		it("does not add streak XP when gap is >1 day", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.lastLoggedDate = "2026-06-18";
			store.state.xp = 0;
			store.checkDailyStreak();
			expect(store.state.xp).toBe(0);
		});

		it("unlocks streak_7 and adds bonus XP when streak reaches 7", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 6;
			store.state.xp = 0;
			store.checkDailyStreak();
			// +5 (streak XP) + 50 (streak_7 bonus) + 100 (achievement XP)
			expect(store.state.xp).toBe(155);
			expect(store.state.achievements.find((a) => a.key === "streak_7")?.unlockedAt).not.toBeNull();
		});

		it("unlocks streak_30 and adds bonus XP when streak reaches 30", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 29;
			store.state.xp = 0;
			store.checkDailyStreak();
			// +5 (streak XP) + 100 (streak_30 bonus) + 100 (achievement XP)
			expect(store.state.xp).toBe(205);
			expect(store.state.achievements.find((a) => a.key === "streak_30")?.unlockedAt).not.toBeNull();
		});

		it("does not fire streak milestones at other streak counts", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.lastLoggedDate = "2026-06-20";
			store.state.currentStreak = 5;
			store.state.xp = 0;
			store.checkDailyStreak();
			expect(store.state.xp).toBe(5); // only XP_PER_DAY_STREAK
			expect(store.pendingToasts).toHaveLength(0);
		});
	});

	// ── onTransactionAdded ────────────────────────────────────────────────────────

	describe("onTransactionAdded", () => {
		it("increments totalTransactions", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.onTransactionAdded({} as any);
			expect(store.state.totalTransactions).toBe(1);
		});

		it("sets lastLoggedDate to today", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.onTransactionAdded({} as any);
			expect(store.state.lastLoggedDate).toBe("2026-06-21");
		});

		it("adds XP_PER_TRANSACTION (10) XP", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.xp = 0;
			store.onTransactionAdded({} as any);
			expect(store.state.xp).toBe(10);
		});

		it("does not change currentStreak (streak logic reads lastLoggedDate after it is set to today)", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.currentStreak = 5;
			store.state.lastLoggedDate = "2026-06-20";
			store.onTransactionAdded({} as any);
			expect(store.state.currentStreak).toBe(5);
		});

		it("unlocks first_transaction at totalTransactions === 1", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 0;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "first_transaction")?.unlockedAt).not.toBeNull();
		});

		it("does not unlock first_transaction when totalTransactions is not 1", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 1;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "first_transaction")?.unlockedAt).toBeNull();
		});

		it("unlocks century at totalTransactions === 100", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 99;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "century")?.unlockedAt).not.toBeNull();
		});

		it("does not unlock century before 100 transactions", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 98;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "century")?.unlockedAt).toBeNull();
		});

		it("updates century progress for non-unlocked achievement", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 49;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "century")?.progress).toBe(50);
		});

		it("caps century progress at 100", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.totalTransactions = 999;
			store.onTransactionAdded({} as any);
			expect(store.state.achievements.find((a) => a.key === "century")?.progress).toBe(100);
		});

		it("does not update century progress when already unlocked", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			const centuryAch = store.state.achievements.find((a) => a.key === "century")!;
			centuryAch.unlockedAt = "2026-01-01T00:00:00Z";
			centuryAch.progress = 100;
			store.state.totalTransactions = 50;
			store.onTransactionAdded({} as any);
			expect(centuryAch.progress).toBe(100);
		});

		it("promotes level when XP crosses threshold", () => {
			setToday("2026-06-21");
			const store = useGamificationStore();
			store.state.xp = 490;
			store.state.level = "novice";
			store.onTransactionAdded({} as any);
			expect(store.state.level).toBe("apprentice");
		});
	});

	// ── onCategoryCreated ─────────────────────────────────────────────────────────

	describe("onCategoryCreated", () => {
		it("increments categoriesCreated", () => {
			const store = useGamificationStore();
			store.onCategoryCreated();
			expect(store.state.categoriesCreated).toBe(1);
		});

		it("unlocks category_master at exactly 10 categories", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.categoriesCreated = 9;
			store.onCategoryCreated();
			expect(store.state.achievements.find((a) => a.key === "category_master")?.unlockedAt).not.toBeNull();
		});

		it("does not unlock category_master before 10", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.categoriesCreated = 8;
			store.onCategoryCreated();
			expect(store.state.achievements.find((a) => a.key === "category_master")?.unlockedAt).toBeNull();
		});

		it("does not re-unlock category_master when already unlocked", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.achievements.find((a) => a.key === "category_master")!.unlockedAt = "2026-01-01T00:00:00Z";
			store.state.categoriesCreated = 10;
			const xpBefore = store.state.xp;
			store.onCategoryCreated();
			expect(store.state.xp).toBe(xpBefore);
			expect(store.pendingToasts).toHaveLength(0);
		});
	});

	// ── onBudgetKept ──────────────────────────────────────────────────────────────

	describe("onBudgetKept", () => {
		it("increments budgetsKept", () => {
			const store = useGamificationStore();
			store.onBudgetKept();
			expect(store.state.budgetsKept).toBe(1);
		});

		it("adds XP_BUDGET_KEPT (25) XP even without an achievements list", () => {
			const store = useGamificationStore();
			store.state.xp = 0;
			store.state.achievements = [];
			store.onBudgetKept();
			expect(store.state.xp).toBe(25);
		});

		it("adds 125 total XP when budget_keeper is newly unlocked (25 + 100)", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.xp = 0;
			store.onBudgetKept();
			expect(store.state.xp).toBe(125);
		});

		it("unlocks budget_keeper achievement", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.onBudgetKept();
			expect(store.state.achievements.find((a) => a.key === "budget_keeper")?.unlockedAt).not.toBeNull();
		});
	});

	// ── popToast ──────────────────────────────────────────────────────────────────

	describe("popToast", () => {
		it("returns null when no toasts pending", () => {
			const store = useGamificationStore();
			expect(store.popToast()).toBeNull();
		});

		it("returns the first pending toast and removes it from the queue", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.onBudgetKept();
			const toast = store.popToast();
			expect(toast?.key).toBe("budget_keeper");
			expect(store.pendingToasts).toHaveLength(0);
		});

		it("returns null after all toasts have been popped", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.onBudgetKept();
			store.popToast();
			expect(store.popToast()).toBeNull();
		});

		it("returns toasts in FIFO order", () => {
			const store = useGamificationStore();
			store.state.achievements = allAchievements();
			store.state.categoriesCreated = 9;
			store.onCategoryCreated(); // unlocks category_master first
			store.onBudgetKept(); // unlocks budget_keeper second
			expect(store.popToast()?.key).toBe("category_master");
			expect(store.popToast()?.key).toBe("budget_keeper");
			expect(store.popToast()).toBeNull();
		});
	});
});
