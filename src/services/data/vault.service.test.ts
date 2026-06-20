import { describe, it, expect } from "vitest";
import { vaultService } from "./vault.service";

// computeLevel is a pure function вЂ” no FS needed
describe("vaultService.computeLevel", () => {
	it("returns novice at xp=0", () => {
		expect(vaultService.computeLevel(0)).toBe("novice");
	});

	it("stays novice just below apprentice threshold (499)", () => {
		expect(vaultService.computeLevel(499)).toBe("novice");
	});

	it("returns apprentice at xp=500", () => {
		expect(vaultService.computeLevel(500)).toBe("apprentice");
	});

	it("stays apprentice just below practitioner threshold (1499)", () => {
		expect(vaultService.computeLevel(1499)).toBe("apprentice");
	});

	it("returns practitioner at xp=1500", () => {
		expect(vaultService.computeLevel(1500)).toBe("practitioner");
	});

	it("stays practitioner just below expert threshold (2999)", () => {
		expect(vaultService.computeLevel(2999)).toBe("practitioner");
	});

	it("returns expert at xp=3000", () => {
		expect(vaultService.computeLevel(3000)).toBe("expert");
	});

	it("stays expert just below master threshold (5999)", () => {
		expect(vaultService.computeLevel(5999)).toBe("expert");
	});

	it("returns master at xp=6000", () => {
		expect(vaultService.computeLevel(6000)).toBe("master");
	});

	it("stays master well beyond threshold", () => {
		expect(vaultService.computeLevel(99999)).toBe("master");
	});

	it("returns novice for negative xp", () => {
		expect(vaultService.computeLevel(-1)).toBe("novice");
	});

	it("returns novice for xp=1 (still below 500)", () => {
		expect(vaultService.computeLevel(1)).toBe("novice");
	});
});

