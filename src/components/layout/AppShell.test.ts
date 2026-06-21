import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref, nextTick } from "vue";
import AppShell from "./AppShell.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { useBootstrap } from "@/composables/useBootstrap";
import { useUpdater } from "@/composables/useUpdater";
import type { UpdateInfo } from "@/composables/useUpdater";

vi.mock("@/composables/useBootstrap", () => ({ useBootstrap: vi.fn() }));
vi.mock("@/composables/useHotkeys", () => ({ useHotkeys: vi.fn() }));
vi.mock("@/composables/useUpdater", () => ({ useUpdater: vi.fn() }));

const STUBS = {
	SideNav: { template: '<div class="stub-sidenav" />' },
	BottomNav: { template: '<div class="stub-bottomnav" />' },
	AppToast: {
		template: '<div class="stub-toast" @click="$emit(\'dismiss\')" />',
		props: ["message", "type"],
		emits: ["dismiss"]
	},
	teleport: { template: "<div><slot/></div>" }
};

describe("AppShell – mount", () => {
	let pinia: ReturnType<typeof createPinia>;
	let mockBootstrap: ReturnType<typeof vi.fn>;
	let mockCheckForUpdates: ReturnType<typeof vi.fn>;
	let mockInstallUpdate: ReturnType<typeof vi.fn>;
	let mockDismissUpdate: ReturnType<typeof vi.fn>;
	let mockUpdateAvailable: ReturnType<typeof ref<UpdateInfo | null>>;
	let mockIsInstalling: ReturnType<typeof ref<boolean>>;

	beforeAll(() => {
		vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
	});

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);

		mockBootstrap = vi.fn().mockResolvedValue(undefined);
		mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
		mockInstallUpdate = vi.fn().mockResolvedValue(undefined);
		mockDismissUpdate = vi.fn();
		mockUpdateAvailable = ref(null);
		mockIsInstalling = ref(false);

		vi.mocked(useBootstrap).mockReturnValue({ bootstrap: mockBootstrap } as unknown as ReturnType<typeof useBootstrap>);
		vi.mocked(useUpdater).mockReturnValue({
			updateAvailable: mockUpdateAvailable,
			isInstalling: mockIsInstalling,
			updateError: ref(""),
			checkForUpdates: mockCheckForUpdates,
			installUpdate: mockInstallUpdate,
			dismissUpdate: mockDismissUpdate
		} as ReturnType<typeof useUpdater>);

		Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true, writable: true });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	async function mountShell(slotHtml = "") {
		const wrapper = mount(AppShell, {
			global: { plugins: [pinia], stubs: STUBS },
			slots: slotHtml ? { default: `<div class="slot-content">${slotHtml}</div>` } : undefined
		});
		await flushPromises();
		return wrapper;
	}

	// ── Layout ────────────────────────────────────────────────────────────────
	describe("layout", () => {
		it("shows SideNav and hides BottomNav on desktop", async () => {
			const wrapper = await mountShell();
			expect(wrapper.find(".stub-sidenav").exists()).toBe(true);
			expect(wrapper.find(".stub-bottomnav").exists()).toBe(false);
		});

		it("hides SideNav and shows BottomNav on mobile", async () => {
			Object.defineProperty(window, "innerWidth", { value: 375, configurable: true, writable: true });
			const wrapper = await mountShell();
			expect(wrapper.find(".stub-sidenav").exists()).toBe(false);
			expect(wrapper.find(".stub-bottomnav").exists()).toBe(true);
		});

		it("switches to mobile layout on resize", async () => {
			const wrapper = await mountShell();
			expect(wrapper.find(".stub-sidenav").exists()).toBe(true);

			Object.defineProperty(window, "innerWidth", { value: 375, configurable: true, writable: true });
			window.dispatchEvent(new Event("resize"));
			await nextTick();

			expect(wrapper.find(".stub-sidenav").exists()).toBe(false);
			expect(wrapper.find(".stub-bottomnav").exists()).toBe(true);
		});

		it("switches to desktop layout on resize", async () => {
			Object.defineProperty(window, "innerWidth", { value: 375, configurable: true, writable: true });
			const wrapper = await mountShell();
			expect(wrapper.find(".stub-bottomnav").exists()).toBe(true);

			Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true, writable: true });
			window.dispatchEvent(new Event("resize"));
			await nextTick();

			expect(wrapper.find(".stub-sidenav").exists()).toBe(true);
			expect(wrapper.find(".stub-bottomnav").exists()).toBe(false);
		});

		it("renders slot content", async () => {
			const wrapper = await mountShell("Hello");
			expect(wrapper.find(".shell__content .slot-content").exists()).toBe(true);
		});
	});

	// ── Update banner ─────────────────────────────────────────────────────────
	describe("update banner", () => {
		it("hidden when updateAvailable is null", async () => {
			const wrapper = await mountShell();
			expect(wrapper.find(".update-banner").exists()).toBe(false);
		});

		it("shows with version when updateAvailable is set before mount", async () => {
			mockUpdateAvailable.value = { version: "2.1.0", body: "fixes" };
			const wrapper = await mountShell();
			expect(wrapper.find(".update-banner").exists()).toBe(true);
			expect(wrapper.find(".update-banner").text()).toContain("2.1.0");
		});

		it("appears reactively when updateAvailable changes after mount", async () => {
			const wrapper = await mountShell();
			expect(wrapper.find(".update-banner").exists()).toBe(false);

			mockUpdateAvailable.value = { version: "3.0.0", body: "" };
			await nextTick();

			expect(wrapper.find(".update-banner").exists()).toBe(true);
			expect(wrapper.find(".update-banner").text()).toContain("3.0.0");
		});

		it("install button shows 'Установить' and is enabled by default", async () => {
			mockUpdateAvailable.value = { version: "2.1.0", body: "" };
			const wrapper = await mountShell();
			const btn = wrapper.find(".update-banner__install");
			expect(btn.text()).toBe("Установить");
			expect((btn.element as HTMLButtonElement).disabled).toBe(false);
		});

		it("install button shows 'Установка…' and is disabled while installing", async () => {
			mockUpdateAvailable.value = { version: "2.1.0", body: "" };
			mockIsInstalling.value = true;
			const wrapper = await mountShell();
			const btn = wrapper.find(".update-banner__install");
			expect(btn.text()).toBe("Установка…");
			expect((btn.element as HTMLButtonElement).disabled).toBe(true);
		});

		it("calls installUpdate on install button click", async () => {
			mockUpdateAvailable.value = { version: "2.1.0", body: "" };
			const wrapper = await mountShell();
			await wrapper.find(".update-banner__install").trigger("click");
			expect(mockInstallUpdate).toHaveBeenCalledOnce();
		});

		it("calls dismissUpdate on dismiss button click", async () => {
			mockUpdateAvailable.value = { version: "2.1.0", body: "" };
			const wrapper = await mountShell();
			await wrapper.find(".update-banner__dismiss").trigger("click");
			expect(mockDismissUpdate).toHaveBeenCalledOnce();
		});
	});

	// ── Conflict banner ───────────────────────────────────────────────────────
	describe("conflict banner", () => {
		it("hidden when lastConflict is null", async () => {
			const wrapper = await mountShell();
			expect(wrapper.find(".conflict-banner").exists()).toBe(false);
		});

		it("shows with filename when lastConflict is set", async () => {
			const txStore = useTransactionsStore();
			txStore.lastConflict = {
				file: "2026-06.json",
				localUpdatedAt: "2026-06-01T00:00:00.000Z",
				diskModifiedAt: "2026-06-02T00:00:00.000Z",
				resolvedBy: "disk"
			};
			const wrapper = await mountShell();
			expect(wrapper.find(".conflict-banner").exists()).toBe(true);
			expect(wrapper.find(".conflict-banner").text()).toContain("2026-06.json");
		});

		it("appears reactively when lastConflict changes after mount", async () => {
			const txStore = useTransactionsStore();
			const wrapper = await mountShell();
			expect(wrapper.find(".conflict-banner").exists()).toBe(false);

			txStore.lastConflict = {
				file: "2026-05.json",
				localUpdatedAt: "2026-05-01T00:00:00.000Z",
				diskModifiedAt: "2026-05-02T00:00:00.000Z",
				resolvedBy: "local"
			};
			await nextTick();
			expect(wrapper.find(".conflict-banner").exists()).toBe(true);
		});

		it("calls clearConflict on close button click", async () => {
			const txStore = useTransactionsStore();
			txStore.lastConflict = {
				file: "2026-06.json",
				localUpdatedAt: "",
				diskModifiedAt: "",
				resolvedBy: "disk"
			};
			const clearSpy = vi.spyOn(txStore, "clearConflict");
			const wrapper = await mountShell();
			await wrapper.find(".conflict-banner button").trigger("click");
			expect(clearSpy).toHaveBeenCalledOnce();
		});

		it("disappears reactively after clearConflict", async () => {
			const txStore = useTransactionsStore();
			txStore.lastConflict = {
				file: "2026-06.json",
				localUpdatedAt: "",
				diskModifiedAt: "",
				resolvedBy: "disk"
			};
			const wrapper = await mountShell();
			expect(wrapper.find(".conflict-banner").exists()).toBe(true);

			txStore.clearConflict();
			await nextTick();
			expect(wrapper.find(".conflict-banner").exists()).toBe(false);
		});
	});

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	describe("lifecycle", () => {
		it("calls bootstrap on mount", async () => {
			await mountShell();
			expect(mockBootstrap).toHaveBeenCalledOnce();
		});

		it("calls checkForUpdates on mount", async () => {
			await mountShell();
			expect(mockCheckForUpdates).toHaveBeenCalledOnce();
		});
	});

	// ── Toast system ──────────────────────────────────────────────────────────
	describe("toast system", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		async function mountShellFake() {
			const wrapper = mount(AppShell, {
				global: { plugins: [pinia], stubs: STUBS }
			});
			await flushPromises();
			return wrapper;
		}

		it("shows AppToast when gamification achievement fires via interval", async () => {
			const wrapper = await mountShellFake();

			const gamStore = useGamificationStore();
			gamStore.pendingToasts.push({ key: "first_transaction", unlockedAt: "2026-01-01T00:00:00.000Z", progress: 0, notifiedAt: null });

			vi.advanceTimersByTime(500);
			await nextTick();

			expect(wrapper.find(".stub-toast").exists()).toBe(true);
		});

		it("does not show toast for unknown achievement key", async () => {
			const wrapper = await mountShellFake();

			const gamStore = useGamificationStore();
			gamStore.pendingToasts.push({ key: "unknown_key" as never, unlockedAt: "2026-01-01T00:00:00.000Z", progress: 0, notifiedAt: null });

			vi.advanceTimersByTime(500);
			await nextTick();

			expect(wrapper.find(".stub-toast").exists()).toBe(false);
		});

		it("dismissing toast clears currentToast", async () => {
			const wrapper = await mountShellFake();

			const gamStore = useGamificationStore();
			gamStore.pendingToasts.push({ key: "first_transaction", unlockedAt: "2026-01-01T00:00:00.000Z", progress: 0, notifiedAt: null });

			vi.advanceTimersByTime(500);
			await nextTick();
			expect(wrapper.find(".stub-toast").exists()).toBe(true);

			await wrapper.find(".stub-toast").trigger("click");
			await nextTick();
			expect(wrapper.find(".stub-toast").exists()).toBe(false);
		});

		it("second toast appears after first is dismissed and next interval fires", async () => {
			const wrapper = await mountShellFake();
			const gamStore = useGamificationStore();

			gamStore.pendingToasts.push({ key: "first_transaction", unlockedAt: "2026-01-01T00:00:00.000Z", progress: 0, notifiedAt: null });
			vi.advanceTimersByTime(500);
			await nextTick();
			expect(wrapper.find(".stub-toast").exists()).toBe(true);

			gamStore.pendingToasts.push({ key: "century", unlockedAt: "2026-01-02T00:00:00.000Z", progress: 0, notifiedAt: null });
			await wrapper.find(".stub-toast").trigger("click");
			await nextTick();
			expect(wrapper.find(".stub-toast").exists()).toBe(false);

			vi.advanceTimersByTime(500);
			await nextTick();
			expect(wrapper.find(".stub-toast").exists()).toBe(true);
		});
	});
});

// ── Pure logic tests ──────────────────────────────────────────────────────────

describe("AppShell – processToastQueue (pure logic)", () => {
	type Toast = { message: string; type: "success" | "info" };

	function makeQueue(items: Toast[]) {
		const queue: Toast[] = [...items];
		let current: Toast | null = null;

		function processToastQueue() {
			if (current || queue.length === 0) return;
			current = queue.shift()!;
		}

		return {
			queue,
			get current() {
				return current;
			},
			processToastQueue
		};
	}

	it("does nothing when queue is empty", () => {
		const ctx = makeQueue([]);
		ctx.processToastQueue();
		expect(ctx.current).toBeNull();
	});

	it("shifts first item to current", () => {
		const ctx = makeQueue([
			{ message: "A", type: "success" },
			{ message: "B", type: "info" }
		]);
		ctx.processToastQueue();
		expect(ctx.current).toEqual({ message: "A", type: "success" });
		expect(ctx.queue).toHaveLength(1);
	});

	it("does nothing when current is already set", () => {
		const ctx = makeQueue([{ message: "B", type: "info" }]);
		ctx.processToastQueue();
		ctx.queue.push({ message: "C", type: "success" });
		ctx.processToastQueue();
		expect(ctx.current?.message).toBe("B");
	});

	it("clears queue as items are processed one by one", () => {
		const ctx = makeQueue([
			{ message: "A", type: "success" },
			{ message: "B", type: "info" },
			{ message: "C", type: "success" }
		]);
		ctx.processToastQueue();
		expect(ctx.queue).toHaveLength(2);
		expect(ctx.current?.message).toBe("A");
	});
});

describe("AppShell – onToastDismiss (pure logic)", () => {
	type Toast = { message: string; type: "success" | "info" };

	function makeSystem(queuedItems: Toast[] = []) {
		const queue: Toast[] = [...queuedItems];
		let current: Toast | null = null;

		function processToastQueue() {
			if (current || queue.length === 0) return;
			current = queue.shift()!;
		}

		function onToastDismiss() {
			current = null;
			processToastQueue();
		}

		return {
			queue,
			get current() {
				return current;
			},
			processToastQueue,
			onToastDismiss
		};
	}

	it("sets current to null on dismiss", () => {
		const ctx = makeSystem([]);
		ctx.queue.push({ message: "X", type: "info" });
		ctx.processToastQueue();
		expect(ctx.current?.message).toBe("X");
		ctx.onToastDismiss();
		expect(ctx.current).toBeNull();
	});

	it("processes next item in queue after dismiss", () => {
		const ctx = makeSystem([
			{ message: "First", type: "success" },
			{ message: "Second", type: "info" }
		]);
		ctx.processToastQueue();
		expect(ctx.current?.message).toBe("First");
		ctx.onToastDismiss();
		expect(ctx.current?.message).toBe("Second");
	});

	it("current stays null after dismiss with empty queue", () => {
		const ctx = makeSystem([{ message: "Only", type: "success" }]);
		ctx.processToastQueue();
		ctx.onToastDismiss();
		expect(ctx.current).toBeNull();
	});
});

describe("AppShell – isDesktop logic", () => {
	function isDesktop(width: number): boolean {
		return width >= 900;
	}

	it("true at exactly 900", () => expect(isDesktop(900)).toBe(true));
	it("true above 900", () => expect(isDesktop(1440)).toBe(true));
	it("false below 900", () => expect(isDesktop(899)).toBe(false));
	it("false at mobile width 375", () => expect(isDesktop(375)).toBe(false));
});

describe("AppShell – gamification toast message format", () => {
	it("formats achievement toast with XP suffix", () => {
		const info = { name: "Первый шаг" };
		const msg = `🏆 ${info.name} — +100 XP`;
		expect(msg).toContain("🏆");
		expect(msg).toContain("Первый шаг");
		expect(msg).toContain("+100 XP");
	});
});
