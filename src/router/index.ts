import { createRouter, createWebHashHistory } from "vue-router";
import { useSettingsStore } from "@/stores/settings.store";

const router = createRouter({
	// Hash history works in Tauri (file:// protocol) and Capacitor
	history: createWebHashHistory(),
	routes: [
		{
			path: "/",
			redirect: "/dashboard"
		},
		// meta.order defines slide direction between screens: navigating to a higher
		// order slides forward, to a lower one — back. Fractional values are child
		// screens of the integer section (e.g. 2.x opens from /transactions).
		{
			path: "/setup",
			name: "setup",
			component: () => import("@/views/SetupView.vue"),
			meta: { requiresVault: false, order: 0 }
		},
		{
			path: "/dashboard",
			name: "dashboard",
			component: () => import("@/views/DashboardView.vue"),
			meta: { requiresVault: true, order: 1 }
		},
		{
			path: "/transactions",
			name: "transactions",
			component: () => import("@/views/TransactionsView.vue"),
			meta: { requiresVault: true, order: 2 }
		},
		{
			path: "/transactions/add",
			name: "add-transaction",
			component: () => import("@/views/AddTransactionView.vue"),
			meta: { requiresVault: true, order: 2.4 }
		},
		{
			path: "/transactions/:id",
			name: "transaction-detail",
			component: () => import("@/views/TransactionDetailView.vue"),
			meta: { requiresVault: true, order: 2.6 }
		},
		{
			path: "/transactions/:id/edit",
			name: "transaction-edit",
			component: () => import("@/views/EditTransactionView.vue"),
			meta: { requiresVault: true, order: 2.7 }
		},
		{
			path: "/accounts",
			name: "accounts",
			component: () => import("@/views/AccountsView.vue"),
			meta: { requiresVault: true, order: 3 }
		},
		{
			path: "/accounts/new",
			name: "add-account",
			component: () => import("@/views/AddAccountView.vue"),
			meta: { requiresVault: true, order: 3.4 }
		},
		{
			path: "/accounts/:id",
			name: "account-detail",
			component: () => import("@/views/AccountDetailView.vue"),
			meta: { requiresVault: true, order: 3.6 }
		},
		{
			path: "/categories",
			name: "categories",
			component: () => import("@/views/CategoriesView.vue"),
			meta: { requiresVault: true, order: 4 }
		},
		{
			path: "/charts",
			name: "charts",
			component: () => import("@/views/ChartsView.vue"),
			meta: { requiresVault: true, order: 5 }
		},
		{
			path: "/budgets",
			name: "budgets",
			component: () => import("@/views/BudgetsView.vue"),
			meta: { requiresVault: true, order: 6 }
		},
		{
			path: "/profile",
			name: "profile",
			component: () => import("@/views/ProfileView.vue"),
			meta: { requiresVault: true, order: 7 }
		},
		{
			path: "/import",
			name: "import",
			component: () => import("@/views/ImportView.vue"),
			meta: { requiresVault: true, order: 7.5 }
		}
	]
});

router.beforeEach(async (to) => {
	const settingsStore = useSettingsStore();
	if (!settingsStore.isLoaded) {
		await settingsStore.load();
		settingsStore.applyTheme();
	}

	const requiresVault = to.meta.requiresVault !== false;
	const hasVault = !!settingsStore.settings.vaultPath;

	if (requiresVault && !hasVault) {
		return { name: "setup" };
	}
	if (to.name === "setup" && hasVault) {
		return { name: "dashboard" };
	}
});

export default router;
