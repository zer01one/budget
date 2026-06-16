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
		{
			path: "/setup",
			name: "setup",
			component: () => import("@/views/SetupView.vue"),
			meta: { requiresVault: false }
		},
		{
			path: "/dashboard",
			name: "dashboard",
			component: () => import("@/views/DashboardView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/transactions",
			name: "transactions",
			component: () => import("@/views/TransactionsView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/transactions/add",
			name: "add-transaction",
			component: () => import("@/views/AddTransactionView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/transactions/:id",
			name: "transaction-detail",
			component: () => import("@/views/TransactionDetailView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/accounts",
			name: "accounts",
			component: () => import("@/views/AccountsView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/accounts/new",
			name: "add-account",
			component: () => import("@/views/AddAccountView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/accounts/:id",
			name: "account-detail",
			component: () => import("@/views/AccountDetailView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/categories",
			name: "categories",
			component: () => import("@/views/CategoriesView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/charts",
			name: "charts",
			component: () => import("@/views/ChartsView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/budgets",
			name: "budgets",
			component: () => import("@/views/BudgetsView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/profile",
			name: "profile",
			component: () => import("@/views/ProfileView.vue"),
			meta: { requiresVault: true }
		},
		{
			path: "/import",
			name: "import",
			component: () => import("@/views/ImportView.vue"),
			meta: { requiresVault: true }
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
