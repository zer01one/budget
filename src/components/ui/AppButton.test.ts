import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppButton from "./AppButton.vue";

describe("AppButton – slot", () => {
	it("renders slot text", () => {
		const w = mount(AppButton, { slots: { default: "Click me" } });
		expect(w.text()).toBe("Click me");
	});

	it("renders HTML slot content", () => {
		const w = mount(AppButton, { slots: { default: "<span class='icon'>★</span>" } });
		expect(w.find(".icon").exists()).toBe(true);
	});
});

describe("AppButton – variant", () => {
	it("default variant is primary", () => {
		const w = mount(AppButton);
		expect(w.classes()).toContain("app-btn--primary");
	});

	it("variant=danger", () => {
		const w = mount(AppButton, { props: { variant: "danger" } });
		expect(w.classes()).toContain("app-btn--danger");
	});

	it("variant=secondary", () => {
		const w = mount(AppButton, { props: { variant: "secondary" } });
		expect(w.classes()).toContain("app-btn--secondary");
	});

	it("variant=ghost", () => {
		const w = mount(AppButton, { props: { variant: "ghost" } });
		expect(w.classes()).toContain("app-btn--ghost");
	});
});

describe("AppButton – size", () => {
	it("default size is md", () => {
		const w = mount(AppButton);
		expect(w.classes()).toContain("app-btn--md");
	});

	it("size=sm", () => {
		const w = mount(AppButton, { props: { size: "sm" } });
		expect(w.classes()).toContain("app-btn--sm");
	});

	it("size=lg", () => {
		const w = mount(AppButton, { props: { size: "lg" } });
		expect(w.classes()).toContain("app-btn--lg");
	});
});

describe("AppButton – fullWidth", () => {
	it("fullWidth=true adds full class", () => {
		const w = mount(AppButton, { props: { fullWidth: true } });
		expect(w.classes()).toContain("app-btn--full");
	});

	it("fullWidth omitted → no full class", () => {
		const w = mount(AppButton);
		expect(w.classes()).not.toContain("app-btn--full");
	});
});

describe("AppButton – loading", () => {
	it("loading=true shows spinner", () => {
		const w = mount(AppButton, { props: { loading: true } });
		expect(w.find(".app-btn__spinner").exists()).toBe(true);
	});

	it("loading=false hides spinner", () => {
		const w = mount(AppButton, { props: { loading: false } });
		expect(w.find(".app-btn__spinner").exists()).toBe(false);
	});

	it("loading=true adds loading class", () => {
		const w = mount(AppButton, { props: { loading: true } });
		expect(w.classes()).toContain("app-btn--loading");
	});

	it("loading=true sets disabled attribute", () => {
		const w = mount(AppButton, { props: { loading: true } });
		const btn = w.find("button");
		expect(btn.element.disabled).toBe(true);
	});
});

describe("AppButton – disabled", () => {
	it("disabled=true sets disabled attribute", () => {
		const w = mount(AppButton, { props: { disabled: true } });
		expect(w.find("button").element.disabled).toBe(true);
	});

	it("disabled=false (default) button is enabled", () => {
		const w = mount(AppButton);
		expect(w.find("button").element.disabled).toBe(false);
	});

	it("neither disabled nor loading → enabled", () => {
		const w = mount(AppButton, { props: { disabled: false, loading: false } });
		expect(w.find("button").element.disabled).toBe(false);
	});
});
