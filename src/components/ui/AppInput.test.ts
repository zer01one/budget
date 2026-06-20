import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppInput from "./AppInput.vue";

describe("AppInput – value binding", () => {
	it("input value reflects modelValue", () => {
		const w = mount(AppInput, { props: { modelValue: "hello" } });
		expect((w.find("input").element as HTMLInputElement).value).toBe("hello");
	});

	it("empty string modelValue", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect((w.find("input").element as HTMLInputElement).value).toBe("");
	});

	it("emits update:modelValue on user input", async () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		await w.find("input").setValue("typed");
		expect(w.emitted("update:modelValue")?.[0]).toEqual(["typed"]);
	});

	it("emits updated value not the old prop value", async () => {
		const w = mount(AppInput, { props: { modelValue: "old" } });
		await w.find("input").setValue("new");
		expect(w.emitted("update:modelValue")?.[0][0]).toBe("new");
	});
});

describe("AppInput – label", () => {
	it("renders label text when provided", () => {
		const w = mount(AppInput, { props: { modelValue: "", label: "Name" } });
		expect(w.find("label").text()).toBe("Name");
	});

	it("hides label element when not provided", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect(w.find("label").exists()).toBe(false);
	});
});

describe("AppInput – type", () => {
	it("default type is text", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect(w.find("input").attributes("type")).toBe("text");
	});

	it("type=number sets number type", () => {
		const w = mount(AppInput, { props: { modelValue: "", type: "number" } });
		expect(w.find("input").attributes("type")).toBe("number");
	});

	it("type=password sets password type", () => {
		const w = mount(AppInput, { props: { modelValue: "", type: "password" } });
		expect(w.find("input").attributes("type")).toBe("password");
	});
});

describe("AppInput – placeholder", () => {
	it("sets placeholder attribute", () => {
		const w = mount(AppInput, { props: { modelValue: "", placeholder: "Enter value" } });
		expect(w.find("input").attributes("placeholder")).toBe("Enter value");
	});

	it("no placeholder by default", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect(w.find("input").attributes("placeholder")).toBeUndefined();
	});
});

describe("AppInput – disabled", () => {
	it("disabled=true disables the input", () => {
		const w = mount(AppInput, { props: { modelValue: "", disabled: true } });
		expect((w.find("input").element as HTMLInputElement).disabled).toBe(true);
	});

	it("disabled=false (default) input is enabled", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect((w.find("input").element as HTMLInputElement).disabled).toBe(false);
	});
});

describe("AppInput – error", () => {
	it("shows error message", () => {
		const w = mount(AppInput, { props: { modelValue: "", error: "Required!" } });
		expect(w.find(".field__error").text()).toBe("Required!");
	});

	it("adds error class to input", () => {
		const w = mount(AppInput, { props: { modelValue: "", error: "Bad" } });
		expect(w.find("input").classes()).toContain("field__input--error");
	});

	it("no error class when no error", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect(w.find("input").classes()).not.toContain("field__input--error");
	});
});

describe("AppInput – hint", () => {
	it("shows hint when no error", () => {
		const w = mount(AppInput, { props: { modelValue: "", hint: "Helpful tip" } });
		expect(w.find(".field__hint").text()).toBe("Helpful tip");
	});

	it("error takes priority over hint", () => {
		const w = mount(AppInput, { props: { modelValue: "", hint: "Tip", error: "Error" } });
		expect(w.find(".field__error").exists()).toBe(true);
		expect(w.find(".field__hint").exists()).toBe(false);
	});

	it("neither error nor hint when both absent", () => {
		const w = mount(AppInput, { props: { modelValue: "" } });
		expect(w.find(".field__error").exists()).toBe(false);
		expect(w.find(".field__hint").exists()).toBe(false);
	});
});
