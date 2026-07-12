import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FabContainer from "./FabContainer.vue";

describe("FabContainer", () => {
	it("renders slot content inside the fab block", () => {
		const wrapper = mount(FabContainer, {
			slots: { default: '<button class="inner-btn">X</button>' },
		});
		expect(wrapper.classes()).toContain("fab-container");
		expect(wrapper.find(".inner-btn").exists()).toBe(true);
	});

	it("keeps children DOM order (первый слот-элемент — верхний в колонке)", () => {
		const wrapper = mount(FabContainer, {
			slots: { default: '<i id="top"></i><i id="bottom"></i>' },
		});
		const kids = wrapper.element.children;
		expect(kids[0].id).toBe("top");
		expect(kids[1].id).toBe("bottom");
	});
});
