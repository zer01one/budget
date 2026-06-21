import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import IconPicker from "./IconPicker.vue";
import { ICON_MAP } from "./AppIcon.vue";

const EXPECTED_CATEGORY_ICONS = [
	"food",
	"coffee",
	"shopping",
	"bag",
	"transport",
	"bus",
	"train",
	"bicycle",
	"travel",
	"fuel",
	"home",
	"electricity",
	"water",
	"wifi",
	"health",
	"medicine",
	"insurance",
	"clothes",
	"beauty",
	"entertainment",
	"tv",
	"music",
	"game",
	"phone",
	"education",
	"book",
	"sport",
	"subscription",
	"salary",
	"freelance",
	"investment",
	"gift",
	"pet",
	"baby",
	"tools",
	"fire",
	"nature",
	"heart",
	"sun",
	"tag",
	"other"
];

describe("ICON_MAP", () => {
	it("has more than 40 entries", () => {
		expect(Object.keys(ICON_MAP).length).toBeGreaterThan(40);
	});

	it("all values are Vue components (objects/functions)", () => {
		for (const v of Object.values(ICON_MAP)) {
			expect(v).toBeTruthy();
			expect(typeof v === "function" || typeof v === "object").toBe(true);
		}
	});

	it("required keys are present", () => {
		const required = ["wallet", "bank", "card", "food", "transport", "home", "other", "transfer"];
		for (const key of required) {
			expect(ICON_MAP).toHaveProperty(key);
		}
	});

	it("unknown key falls back to PhQuestion in AppIcon", async () => {
		const AppIcon = (await import("./AppIcon.vue")).default;
		const w = mount(AppIcon, { props: { name: "nonexistent_key_xyz" } });
		expect(w.find("svg").exists()).toBe(true);
	});
});

describe("IconPicker – default icons", () => {
	it("renders expected number of icon items by default", () => {
		const w = mount(IconPicker, { props: { modelValue: "food" } });
		expect(w.findAll(".icon-item")).toHaveLength(EXPECTED_CATEGORY_ICONS.length);
	});

	it("renders custom icons when icons prop provided", () => {
		const w = mount(IconPicker, { props: { modelValue: "food", icons: ["food", "home"] } });
		expect(w.findAll(".icon-item")).toHaveLength(2);
	});

	it("single custom icon", () => {
		const w = mount(IconPicker, { props: { modelValue: "food", icons: ["wallet"] } });
		expect(w.findAll(".icon-item")).toHaveLength(1);
	});
});

describe("IconPicker – label", () => {
	it("renders label when provided", () => {
		const w = mount(IconPicker, { props: { modelValue: "food", label: "Icon" } });
		expect(w.find("label").text()).toBe("Icon");
	});

	it("no label element when not provided", () => {
		const w = mount(IconPicker, { props: { modelValue: "food" } });
		expect(w.find("label").exists()).toBe(false);
	});
});

describe("IconPicker – active state", () => {
	it("active item has icon-item--active class", () => {
		const w = mount(IconPicker, { props: { modelValue: "food" } });
		expect(w.findAll(".icon-item--active")).toHaveLength(1);
	});

	it("no active class when modelValue not in icons", () => {
		const w = mount(IconPicker, { props: { modelValue: "wallet" } });
		// "wallet" is not in CATEGORY_ICONS
		expect(w.findAll(".icon-item--active")).toHaveLength(0);
	});

	it("active item is the one matching modelValue", () => {
		const w = mount(IconPicker, { props: { modelValue: "home" } });
		const active = w.find(".icon-item--active");
		expect(active.attributes("title")).toBe("home");
	});
});

describe("IconPicker – emit", () => {
	it("clicking an icon emits update:modelValue", async () => {
		const w = mount(IconPicker, { props: { modelValue: "food" } });
		await w.findAll(".icon-item")[0].trigger("click");
		expect(w.emitted("update:modelValue")).toBeTruthy();
	});

	it("emitted value is the first icon key (food)", async () => {
		const w = mount(IconPicker, { props: { modelValue: "" } });
		await w.findAll(".icon-item")[0].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe(EXPECTED_CATEGORY_ICONS[0]); // 'food'
	});

	it("clicking second item emits 'coffee'", async () => {
		const w = mount(IconPicker, { props: { modelValue: "" } });
		await w.findAll(".icon-item")[1].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe("coffee");
	});

	it("clicking custom icon emits that icon's key", async () => {
		const w = mount(IconPicker, { props: { modelValue: "", icons: ["wallet", "bank"] } });
		await w.findAll(".icon-item")[1].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe("bank");
	});
});
