import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import FabContainer from "./FabContainer.vue";

// FabContainer teleports to body so route-transition transforms on the view
// root don't hijack its position:fixed — query document.body, not the wrapper.

let wrapper: VueWrapper | undefined;

afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
});

describe("FabContainer", () => {
	it("teleports the fab block to body and renders slot content", () => {
		wrapper = mount(FabContainer, {
			slots: { default: '<button class="inner-btn">X</button>' },
		});
		const fab = document.body.querySelector(".fab-container");
		expect(fab).toBeTruthy();
		expect(fab!.querySelector(".inner-btn")).toBeTruthy();
	});

	it("removes the fab block from body on unmount", () => {
		wrapper = mount(FabContainer, {
			slots: { default: '<button class="inner-btn">X</button>' },
		});
		wrapper.unmount();
		wrapper = undefined;
		expect(document.body.querySelector(".fab-container")).toBeNull();
	});

	it("keeps children DOM order (первый слот-элемент — верхний в колонке)", () => {
		wrapper = mount(FabContainer, {
			slots: { default: '<i id="top"></i><i id="bottom"></i>' },
		});
		const kids = document.body.querySelector(".fab-container")!.children;
		expect(kids[0].id).toBe("top");
		expect(kids[1].id).toBe("bottom");
	});
});
