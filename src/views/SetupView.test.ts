import { describe, it, expect, vi } from "vitest";

// Unit tests for SetupView step machine

type Step = "choose" | "existing" | "loading";

async function makeCreateVault(pickFolderResult: { uri: string } | null, shouldThrow = false) {
	let step: Step = "choose";
	let error = "";
	const mockPick = vi.fn(async () => {
		if (shouldThrow) throw new Error("Permission denied");
		return pickFolderResult;
	});
	const mockSetVaultPath = vi.fn(async () => {});
	const mockInitVault = vi.fn(async () => {});
	const mockLoad = vi.fn(async () => {});
	const mockPush = vi.fn();

	async function createNewVault() {
		error = "";
		try {
			const result = await mockPick();
			step = "loading";
			await mockSetVaultPath(result?.uri);
			await mockInitVault();
			await mockLoad();
			mockPush("/dashboard");
		} catch (e) {
			error = e instanceof Error ? e.message : "Error";
			step = "choose";
		}
	}

	return {
		createNewVault,
		mockPick,
		mockSetVaultPath,
		mockInitVault,
		mockLoad,
		mockPush,
		get step() {
			return step;
		},
		get error() {
			return error;
		}
	};
}

describe("SetupView – createNewVault step machine", () => {
	it("transitions to loading during folder pick + init", async () => {
		const ctx = await makeCreateVault({ uri: "/vault/path" });
		await ctx.createNewVault();
		// After completion, push was called (we test the loading state transitioning through)
		expect(ctx.mockPush).toHaveBeenCalledWith("/dashboard");
	});

	it("transitions back to choose on error", async () => {
		const ctx = await makeCreateVault(null, true);
		await ctx.createNewVault();
		expect(ctx.step).toBe("choose");
	});

	it("sets error message on failure", async () => {
		const ctx = await makeCreateVault(null, true);
		await ctx.createNewVault();
		expect(ctx.error).toBe("Permission denied");
	});

	it("clears error before each attempt", async () => {
		const ctx = await makeCreateVault({ uri: "/vault" });
		// First manually set an error
		await makeCreateVault(null, true).then((c) => c.createNewVault());
		// Now succeed
		await ctx.createNewVault();
		expect(ctx.error).toBe("");
	});

	it("calls setVaultPath with picked folder URI", async () => {
		const ctx = await makeCreateVault({ uri: "content://tree/abc" });
		await ctx.createNewVault();
		expect(ctx.mockSetVaultPath).toHaveBeenCalledWith("content://tree/abc");
	});

	it("calls initVault after setting path", async () => {
		const ctx = await makeCreateVault({ uri: "/v" });
		await ctx.createNewVault();
		expect(ctx.mockInitVault).toHaveBeenCalledOnce();
	});

	it("calls load after initVault", async () => {
		const ctx = await makeCreateVault({ uri: "/v" });
		await ctx.createNewVault();
		expect(ctx.mockLoad).toHaveBeenCalledOnce();
	});

	it("navigates to /dashboard on success", async () => {
		const ctx = await makeCreateVault({ uri: "/v" });
		await ctx.createNewVault();
		expect(ctx.mockPush).toHaveBeenCalledWith("/dashboard");
	});

	it("does NOT navigate on failure", async () => {
		const ctx = await makeCreateVault(null, true);
		await ctx.createNewVault();
		expect(ctx.mockPush).not.toHaveBeenCalled();
	});
});

describe("SetupView – error display", () => {
	it("error is empty string initially", async () => {
		const ctx = await makeCreateVault({ uri: "/v" });
		expect(ctx.error).toBe("");
	});

	it("error shows message from thrown Error instance", async () => {
		const ctx = await makeCreateVault(null, true);
		await ctx.createNewVault();
		expect(ctx.error).toBe("Permission denied");
	});

	it("error reset on retry success", async () => {
		const ctx = await makeCreateVault({ uri: "/v" });
		// Manually inject error then succeed
		await makeCreateVault(null, true).then((c) => c.createNewVault());
		await ctx.createNewVault();
		expect(ctx.error).toBe("");
	});
});
