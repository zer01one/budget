import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ColorPicker from "./ColorPicker.vue";

// 16 colors in PALETTE (matches the actual array in the component)
const PALETTE = [
	"#EF4444",
	"#F97316",
	"#F59E0B",
	"#EAB308",
	"#84CC16",
	"#10B981",
	"#14B8A6",
	"#06B6D4",
	"#3B82F6",
	"#6366F1",
	"#8B5CF6",
	"#A855F7",
	"#EC4899",
	"#F43F5E",
	"#6B7280",
	"#0F172A"
];

describe("ColorPicker – swatches", () => {
	it("renders exactly 16 color swatches", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#EF4444" } });
		expect(w.findAll(".color-swatch")).toHaveLength(16);
	});

	it("first swatch has background #EF4444", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#EF4444" } });
		const style = w.findAll(".color-swatch")[0].attributes("style") ?? "";
		expect(style).toContain("#EF4444");
	});

	it("last swatch has background #0F172A", () => {
		const w = mount(ColorPicker, { props: { modelValue: "" } });
		const swatches = w.findAll(".color-swatch");
		const style = swatches[swatches.length - 1].attributes("style") ?? "";
		expect(style).toContain("#0F172A");
	});
});

describe("ColorPicker – active swatch", () => {
	it("active class on matching swatch", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#EF4444" } });
		expect(w.findAll(".color-swatch--active")).toHaveLength(1);
	});

	it("active swatch is the one matching modelValue", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#3B82F6" } });
		const active = w.find(".color-swatch--active");
		expect(active.attributes("style")).toContain("#3B82F6");
	});

	it("no active swatch when modelValue not in palette", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#000000" } });
		expect(w.findAll(".color-swatch--active")).toHaveLength(0);
	});

	it("exactly one active swatch even with valid color", () => {
		const w = mount(ColorPicker, { props: { modelValue: "#10B981" } });
		expect(w.findAll(".color-swatch--active")).toHaveLength(1);
	});
});

describe("ColorPicker – emit", () => {
	it("clicking swatch emits update:modelValue", async () => {
		const w = mount(ColorPicker, { props: { modelValue: "" } });
		await w.findAll(".color-swatch")[0].trigger("click");
		expect(w.emitted("update:modelValue")).toBeTruthy();
	});

	it("emitted value matches the clicked swatch's color", async () => {
		for (let i = 0; i < PALETTE.length; i++) {
			const freshW = mount(ColorPicker, { props: { modelValue: "" } });
			await freshW.findAll(".color-swatch")[i].trigger("click");
			expect(freshW.emitted("update:modelValue")![0][0]).toBe(PALETTE[i]);
		}
	});
});

describe("ColorPicker – label", () => {
	it("renders label when provided", () => {
		const w = mount(ColorPicker, { props: { modelValue: "", label: "Цвет" } });
		expect(w.find("label").text()).toBe("Цвет");
	});

	it("no label element when not provided", () => {
		const w = mount(ColorPicker, { props: { modelValue: "" } });
		expect(w.find("label").exists()).toBe(false);
	});
});
