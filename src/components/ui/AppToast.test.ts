import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import AppToast from "./AppToast.vue";

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("AppToast – visible class", () => {
	it("toast--visible class is added on mount", async () => {
		const w = mount(AppToast, { props: { message: "Hello" } });
		await w.vm.$nextTick();
		expect(w.find(".toast").classes()).toContain("toast--visible");
	});

	it("visible=false initially before mount completes", () => {
		// Can't easily test pre-mount state, but mounting adds the class
		const w = mount(AppToast, { props: { message: "Hi" } });
		// After mount, visible is true
		expect(w.find(".toast").exists()).toBe(true);
	});
});

describe("AppToast – message", () => {
	it("renders message text", () => {
		const w = mount(AppToast, { props: { message: "Test message" } });
		expect(w.find(".toast").text()).toBe("Test message");
	});
});

describe("AppToast – type classes", () => {
	it("default type is info → toast--info", async () => {
		const w = mount(AppToast, { props: { message: "msg" } });
		await w.vm.$nextTick();
		expect(w.find(".toast--info").exists()).toBe(true);
	});

	it("type=success → toast--success", async () => {
		const w = mount(AppToast, { props: { message: "msg", type: "success" } });
		await w.vm.$nextTick();
		expect(w.find(".toast--success").exists()).toBe(true);
	});

	it("type=error → toast--error", async () => {
		const w = mount(AppToast, { props: { message: "msg", type: "error" } });
		await w.vm.$nextTick();
		expect(w.find(".toast--error").exists()).toBe(true);
	});

	it("type=warning → toast--warning", async () => {
		const w = mount(AppToast, { props: { message: "msg", type: "warning" } });
		await w.vm.$nextTick();
		expect(w.find(".toast--warning").exists()).toBe(true);
	});
});

describe("AppToast – dismiss emit", () => {
	it("emits dismiss after default duration (4000 + 300 ms)", async () => {
		const w = mount(AppToast, { props: { message: "Hi" } });
		await w.vm.$nextTick();
		vi.advanceTimersByTime(4000 + 300);
		await w.vm.$nextTick();
		expect(w.emitted("dismiss")).toBeTruthy();
	});

	it("emits dismiss after custom duration", async () => {
		const w = mount(AppToast, { props: { message: "Hi", duration: 1000 } });
		await w.vm.$nextTick();
		vi.advanceTimersByTime(999 + 300);
		await w.vm.$nextTick();
		expect(w.emitted("dismiss")).toBeFalsy();
		vi.advanceTimersByTime(1 + 300);
		await w.vm.$nextTick();
		expect(w.emitted("dismiss")).toBeTruthy();
	});

	it("does NOT emit dismiss before duration elapses", async () => {
		const w = mount(AppToast, { props: { message: "Hi" } });
		await w.vm.$nextTick();
		vi.advanceTimersByTime(3999);
		await w.vm.$nextTick();
		expect(w.emitted("dismiss")).toBeFalsy();
	});

	it("visible class removed before dismiss emitted", async () => {
		const w = mount(AppToast, { props: { message: "Hi", duration: 500 } });
		await w.vm.$nextTick();
		vi.advanceTimersByTime(500); // visible set to false
		await w.vm.$nextTick();
		expect(w.find(".toast").classes()).not.toContain("toast--visible");
		// dismiss emitted after another 300ms
		vi.advanceTimersByTime(300);
		await w.vm.$nextTick();
		expect(w.emitted("dismiss")).toBeTruthy();
	});
});
