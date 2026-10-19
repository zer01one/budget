import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import AppTimePicker from "./AppTimePicker.vue";

beforeAll(() => {
	// jsdom does not implement element scrolling
	Element.prototype.scrollTo = vi.fn();
});

let wrapper: VueWrapper | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = "";
});

function mountPicker(modelValue = "12:00", extra: Record<string, unknown> = {}) {
	wrapper = mount(AppTimePicker, {
		props: { modelValue, ...extra },
		attachTo: document.body
	});
	return wrapper;
}

function textInput(w: VueWrapper) {
	return w.find("input.app-time__input");
}

// ─── display ──────────────────────────────────────────────────────────────────

describe("AppTimePicker – editable input display", () => {
	it("renders a visible text input with modelValue", () => {
		const w = mountPicker("14:30");
		expect((textInput(w).element as HTMLInputElement).value).toBe("14:30");
	});

	it("updates text when modelValue prop changes", async () => {
		const w = mountPicker("14:30");
		await w.setProps({ modelValue: "09:15" });
		expect((textInput(w).element as HTMLInputElement).value).toBe("09:15");
	});

	it("keeps the hidden native time input in sync (view-test contract)", () => {
		const w = mountPicker("14:30");
		const native = w.find("input[type='time']");
		expect((native.element as HTMLInputElement).value).toBe("14:30");
	});

	it("change on hidden native input still emits update:modelValue", async () => {
		const w = mountPicker("14:30");
		const native = w.find("input[type='time']");
		await native.setValue("08:00");
		await native.trigger("change");
		const emitted = w.emitted("update:modelValue");
		expect(emitted?.at(-1)).toEqual(["08:00"]);
	});

	it("disabled prop disables the text input", () => {
		const w = mountPicker("14:30", { disabled: true });
		expect(textInput(w).attributes("disabled")).toBeDefined();
	});
});

// ─── typing ───────────────────────────────────────────────────────────────────

describe("AppTimePicker – typing a time", () => {
	it("formats 4 digits into HH:MM and emits", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("1430");
		expect((textInput(w).element as HTMLInputElement).value).toBe("14:30");
		expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["14:30"]);
	});

	it("does not emit on partial input", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("14");
		expect(w.emitted("update:modelValue")).toBeUndefined();
		expect((textInput(w).element as HTMLInputElement).value).toBe("14");
	});

	it("auto-pads a leading digit greater than 2 (9 → 09:)", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("9");
		expect((textInput(w).element as HTMLInputElement).value).toBe("09");
	});

	it("930 completes to 09:30 and emits", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("930");
		expect((textInput(w).element as HTMLInputElement).value).toBe("09:30");
		expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["09:30"]);
	});

	it("clamps out-of-range values (2999 → 23:59)", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("2999");
		expect((textInput(w).element as HTMLInputElement).value).toBe("23:59");
		expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["23:59"]);
	});

	it("ignores non-digit characters", async () => {
		const w = mountPicker("12:00");
		await textInput(w).setValue("ab1c4de30");
		expect((textInput(w).element as HTMLInputElement).value).toBe("14:30");
		expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["14:30"]);
	});

	it("reverts to modelValue on blur with incomplete input", async () => {
		const w = mountPicker("12:00");
		const input = textInput(w);
		await input.setValue("14");
		await input.trigger("blur");
		expect((input.element as HTMLInputElement).value).toBe("12:00");
	});

	it("Escape reverts the text to modelValue", async () => {
		const w = mountPicker("12:00");
		const input = textInput(w);
		await input.setValue("14");
		await input.trigger("keydown", { key: "Escape" });
		expect((input.element as HTMLInputElement).value).toBe("12:00");
	});
});

// ─── popup ────────────────────────────────────────────────────────────────────

describe("AppTimePicker – popup interaction with input", () => {
	it("focusing the input opens the popup", async () => {
		const w = mountPicker("12:00");
		await textInput(w).trigger("focus");
		expect(document.body.querySelector(".app-time__popup")).not.toBeNull();
	});

	it("blur closes the popup", async () => {
		const w = mountPicker("12:00");
		const input = textInput(w);
		await input.trigger("focus");
		await input.trigger("blur");
		expect(document.body.querySelector(".app-time__popup")).toBeNull();
	});

	it("Enter commits a complete time and closes the popup", async () => {
		const w = mountPicker("12:00");
		const input = textInput(w);
		await input.trigger("focus");
		await input.setValue("0815");
		await input.trigger("keydown", { key: "Enter" });
		expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["08:15"]);
		expect(document.body.querySelector(".app-time__popup")).toBeNull();
	});

	it("does not open the popup when disabled", async () => {
		const w = mountPicker("12:00", { disabled: true });
		await textInput(w).trigger("focus");
		expect(document.body.querySelector(".app-time__popup")).toBeNull();
	});
});
