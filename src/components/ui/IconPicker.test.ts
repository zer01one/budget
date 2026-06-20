import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import IconPicker, { ICON_EMOJI, iconToEmoji } from "./IconPicker.vue";

// 19 default category icons (matches CATEGORY_ICONS in the component)
const CATEGORY_ICONS = [
	"food",
	"transport",
	"home",
	"health",
	"clothes",
	"entertainment",
	"phone",
	"education",
	"shopping",
	"sport",
	"subscription",
	"salary",
	"freelance",
	"investment",
	"gift",
	"travel",
	"fuel",
	"pet",
	"other"
];

describe("iconToEmoji – pure function", () => {
	it("wallet → 👛", () => expect(iconToEmoji("wallet")).toBe("👛"));
	it("food → 🍽", () => expect(iconToEmoji("food")).toBe("🍽"));
	it("home → 🏠", () => expect(iconToEmoji("home")).toBe("🏠"));
	it("transport → 🚌", () => expect(iconToEmoji("transport")).toBe("🚌"));
	it("unknown key → ⬡", () => expect(iconToEmoji("nonexistent")).toBe("⬡"));
	it("empty string → ⬡", () => expect(iconToEmoji("")).toBe("⬡"));
});

describe("ICON_EMOJI map", () => {
	it("has more than 20 entries", () => {
		expect(Object.keys(ICON_EMOJI).length).toBeGreaterThan(20);
	});

	it("all values are non-empty strings", () => {
		for (const v of Object.values(ICON_EMOJI)) {
			expect(typeof v).toBe("string");
			expect(v.length).toBeGreaterThan(0);
		}
	});
});

describe("IconPicker – default icons", () => {
	it("renders 19 icon items by default", () => {
		const w = mount(IconPicker, { props: { modelValue: "food" } });
		expect(w.findAll(".icon-item")).toHaveLength(19);
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

	it("emitted value is the icon key (first item = food)", async () => {
		const w = mount(IconPicker, { props: { modelValue: "" } });
		await w.findAll(".icon-item")[0].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe(CATEGORY_ICONS[0]); // 'food'
	});

	it("clicking second item emits 'transport'", async () => {
		const w = mount(IconPicker, { props: { modelValue: "" } });
		await w.findAll(".icon-item")[1].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe("transport");
	});

	it("clicking custom icon emits that icon's key", async () => {
		const w = mount(IconPicker, { props: { modelValue: "", icons: ["wallet", "bank"] } });
		await w.findAll(".icon-item")[1].trigger("click");
		expect(w.emitted("update:modelValue")![0][0]).toBe("bank");
	});
});
