import { getFileSystemAdapter } from "@/services/filesystem";
import type { VaultMetadata, VaultMetadataFile, AccountsFile, CategoriesFile, GamificationFile, BudgetsFile } from "@/types";
import { DEFAULT_CATEGORIES, LEVEL_THRESHOLDS } from "@/types";

const APP_VERSION = "0.1.0";
const SCHEMA_VERSION = 1;

export const vaultService = {
	async readMetadata(): Promise<VaultMetadata | null> {
		const fs = await getFileSystemAdapter();
		const result = await fs.readJson<VaultMetadataFile>("metadata.json");
		return result?.data.metadata ?? null;
	},

	async initNewVault(deviceId: string): Promise<void> {
		const fs = await getFileSystemAdapter();
		const now = new Date().toISOString();

		const metadata: VaultMetadataFile = {
			metadata: {
				appVersion: APP_VERSION,
				schemaVersion: SCHEMA_VERSION,
				deviceId,
				createdAt: now,
				vaultName: "Мои финансы",
				updatedAt: now,
				version: 1
			}
		};
		await fs.writeJson("metadata.json", metadata);

		// Seed default categories
		const categories = DEFAULT_CATEGORIES.map((seed, i) => ({
			id: crypto.randomUUID(),
			name: seed.name,
			type: seed.type,
			color: seed.color,
			icon: seed.icon,
			parentId: null,
			isSystem: true,
			isArchived: false,
			sortOrder: i,
			updatedAt: now,
			deviceId,
			version: 1
		}));
		const categoriesFile: CategoriesFile = { categories };
		await fs.writeJson("categories.json", categoriesFile);

		const accountsFile: AccountsFile = { accounts: [] };
		await fs.writeJson("accounts.json", accountsFile);

		const budgetsFile: BudgetsFile = { budgets: [] };
		await fs.writeJson("budgets.json", budgetsFile);

		const gamificationFile: GamificationFile = {
			gamification: {
				xp: 0,
				level: "novice",
				currentStreak: 0,
				longestStreak: 0,
				lastLoggedDate: null,
				achievements: [
					{ key: "first_transaction", unlockedAt: null, progress: 0, notifiedAt: null },
					{ key: "streak_7", unlockedAt: null, progress: 0, notifiedAt: null },
					{ key: "streak_30", unlockedAt: null, progress: 0, notifiedAt: null },
					{ key: "budget_keeper", unlockedAt: null, progress: 0, notifiedAt: null },
					{ key: "century", unlockedAt: null, progress: 0, notifiedAt: null },
					{ key: "category_master", unlockedAt: null, progress: 0, notifiedAt: null }
				],
				totalTransactions: 0,
				categoriesCreated: 0,
				budgetsKept: 0,
				updatedAt: now,
				deviceId,
				version: 1
			}
		};
		await fs.writeJson("gamification.json", gamificationFile);
	},

	computeLevel(xp: number): import("@/types").Level {
		const thresholds = Object.entries(LEVEL_THRESHOLDS).sort((a, b) => b[1] - a[1]);
		for (const [level, threshold] of thresholds) {
			if (xp >= threshold) return level as import("@/types").Level;
		}
		return "novice";
	}
};
