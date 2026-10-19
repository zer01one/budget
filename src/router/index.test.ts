import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn()
}));

import { useSettingsStore } from "@/stores/settings.store";
import router from "@/router";

function makeStore({ isLoaded = true, vaultPath = null as string | null } = {}) {
	return {
		isLoaded,
		settings: { vaultPath },
		load: vi.fn().mockResolvedValue(undefined),
		applyTheme: vi.fn()
	};
}

describe("router", () => {
	let store: ReturnType<typeof makeStore>;

	beforeEach(async () => {
		store = makeStore({ isLoaded: true, vaultPath: "/vault" });
		vi.mocked(useSettingsStore).mockReturnValue(store as any);
		// Navigate to a neutral route so no test starts from the same target it's about to push.
		// Without this, pushing /dashboard when already on /dashboard is a duplicate navigation
		// and Vue Router skips the guard entirely.
		await router.push("/transactions");
		await router.isReady();
		vi.clearAllMocks();
		store = makeStore({ isLoaded: true, vaultPath: "/vault" });
		vi.mocked(useSettingsStore).mockReturnValue(store as any);
	});

	describe("route configuration", () => {
		it.each([
			"dashboard",
			"transactions",
			"add-transaction",
			"transaction-detail",
			"transaction-edit",
			"accounts",
			"add-account",
			"account-detail",
			"categories",
			"charts",
			"budgets",
			"profile",
			"import"
		])("%s requires vault", (name) => {
			const route = router.getRoutes().find((r) => r.name === name);
			expect(route?.meta?.requiresVault).toBe(true);
		});

		it("setup does not require vault", () => {
			const route = router.getRoutes().find((r) => r.name === "setup");
			expect(route?.meta?.requiresVault).toBe(false);
		});

		it("every named route has a numeric meta.order for slide direction", () => {
			for (const route of router.getRoutes()) {
				if (!route.name) continue;
				expect(typeof route.meta.order, `route ${String(route.name)} must have meta.order`).toBe("number");
			}
		});

		it.each([
			["add-transaction", "transactions"],
			["transaction-detail", "transactions"],
			["transaction-edit", "transaction-detail"],
			["add-account", "accounts"],
			["account-detail", "accounts"],
			["import", "profile"]
		])("%s is deeper than %s (forward slide)", (child, parent) => {
			const childOrder = router.getRoutes().find((r) => r.name === child)!.meta.order as number;
			const parentOrder = router.getRoutes().find((r) => r.name === parent)!.meta.order as number;
			expect(childOrder).toBeGreaterThan(parentOrder);
		});
	});

	describe("beforeEach guard", () => {
		it("calls load() and applyTheme() when settings not loaded", async () => {
			store = makeStore({ isLoaded: false, vaultPath: null });
			vi.mocked(useSettingsStore).mockReturnValue(store as any);

			await router.push("/setup");
			await router.isReady();

			expect(store.load).toHaveBeenCalledOnce();
			expect(store.applyTheme).toHaveBeenCalledOnce();
		});

		it("skips load() when settings already loaded", async () => {
			await router.push("/dashboard");
			await router.isReady();

			expect(store.load).not.toHaveBeenCalled();
			expect(store.applyTheme).not.toHaveBeenCalled();
		});

		it("redirects to setup when vault required but not configured", async () => {
			store = makeStore({ isLoaded: true, vaultPath: null });
			vi.mocked(useSettingsStore).mockReturnValue(store as any);

			await router.push("/dashboard");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("setup");
		});

		it("allows navigation to protected route when vault is configured", async () => {
			await router.push("/dashboard");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("dashboard");
		});

		it("redirects / to dashboard when vault is configured", async () => {
			await router.push("/");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("dashboard");
		});

		it("redirects / to setup when vault is not configured", async () => {
			store = makeStore({ isLoaded: true, vaultPath: null });
			vi.mocked(useSettingsStore).mockReturnValue(store as any);

			await router.push("/");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("setup");
		});

		it("redirects from setup to dashboard when vault is configured", async () => {
			await router.push("/setup");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("dashboard");
		});

		it("allows setup when vault is not configured", async () => {
			store = makeStore({ isLoaded: true, vaultPath: null });
			vi.mocked(useSettingsStore).mockReturnValue(store as any);

			await router.push("/setup");
			await router.isReady();

			expect(router.currentRoute.value.name).toBe("setup");
		});

		it("vault guard applies to all protected routes", async () => {
			store = makeStore({ isLoaded: true, vaultPath: null });
			vi.mocked(useSettingsStore).mockReturnValue(store as any);

			// Move off /transactions first so the first loop iteration is not a duplicate navigation.
			await router.push("/setup");
			await router.isReady();

			for (const name of ["transactions", "accounts", "categories", "charts", "budgets", "profile", "import"]) {
				const route = router.getRoutes().find((r) => r.name === name)!;
				await router.push(route.path.replace(/:.*/, "test-id"));
				await router.isReady();
				expect(router.currentRoute.value.name).toBe("setup");
			}
		});
	});
});
