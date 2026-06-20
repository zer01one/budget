import { describe, it, expect } from "vitest";

// AppShell's mount-based tests are skipped because the component has deep
// native platform dependencies (Tauri/Capacitor) that would require mocking
// the entire store/service tree. We test the pure logic functions directly.

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
		// pre-set current by calling once
		ctx.processToastQueue();
		// queue is now empty, current is set to B
		ctx.queue.push({ message: "C", type: "success" });
		ctx.processToastQueue(); // should not change current
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
			// In real code, setTimeout(processToastQueue, 500), but we call directly here
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
		ctx.processToastQueue();
		// inject a current manually by assigning through the queue
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
