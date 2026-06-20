import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppModal from "./AppModal.vue";

// Stub Teleport to render content inline
const TeleportStub = { template: "<div><slot /></div>" };

function mountModal(props = {}, slots = {}) {
	return mount(AppModal, {
		props,
		slots,
		global: { stubs: { Teleport: TeleportStub } }
	});
}

describe("AppModal – title", () => {
	it("renders title when provided", () => {
		const w = mountModal({ title: "Edit Account" });
		expect(w.find(".modal__title").text()).toBe("Edit Account");
	});

	it("no header when title omitted", () => {
		const w = mountModal();
		expect(w.find(".modal__header").exists()).toBe(false);
	});
});

describe("AppModal – close button", () => {
	it("close button emits close", async () => {
		const w = mountModal({ title: "Test" });
		await w.find(".modal__close").trigger("click");
		expect(w.emitted("close")).toBeTruthy();
	});

	it("close button only present when title provided", () => {
		const w = mountModal();
		expect(w.find(".modal__close").exists()).toBe(false);
	});
});

describe("AppModal – overlay click", () => {
	it("clicking overlay emits close", async () => {
		const w = mountModal({ title: "T" });
		await w.find(".modal-overlay").trigger("click");
		expect(w.emitted("close")).toBeTruthy();
	});
});

describe("AppModal – Escape key", () => {
	it("Escape key emits close", async () => {
		const w = mountModal({ title: "T" });
		await document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(w.emitted("close")).toBeTruthy();
	});

	it("non-Escape key does not emit close", async () => {
		const w = mountModal({ title: "T" });
		await document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(w.emitted("close")).toBeFalsy();
	});

	it("event listener is removed on unmount", async () => {
		const w = mountModal({ title: "T" });
		w.unmount();
		const before = w.emitted("close")?.length ?? 0;
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(w.emitted("close")?.length ?? 0).toBe(before);
	});
});

describe("AppModal – size", () => {
	it("default size is md", () => {
		const w = mountModal();
		expect(w.find(".modal--md").exists()).toBe(true);
	});

	it("size=sm applies modal--sm class", () => {
		const w = mountModal({ size: "sm" });
		expect(w.find(".modal--sm").exists()).toBe(true);
	});

	it("size=lg applies modal--lg class", () => {
		const w = mountModal({ size: "lg" });
		expect(w.find(".modal--lg").exists()).toBe(true);
	});
});

describe("AppModal – slots", () => {
	it("renders default slot in body", () => {
		const w = mountModal({}, { default: "<p class='test-body'>Body</p>" });
		expect(w.find(".test-body").exists()).toBe(true);
	});

	it("renders footer slot when provided", () => {
		const w = mountModal({}, { footer: "<button class='save-btn'>Save</button>" });
		expect(w.find(".modal__footer").exists()).toBe(true);
		expect(w.find(".save-btn").exists()).toBe(true);
	});

	it("no footer section without footer slot", () => {
		const w = mountModal({}, { default: "content" });
		expect(w.find(".modal__footer").exists()).toBe(false);
	});
});

describe("AppModal – role", () => {
	it("dialog has role=dialog", () => {
		const w = mountModal();
		expect(w.find('[role="dialog"]').exists()).toBe(true);
	});
});
