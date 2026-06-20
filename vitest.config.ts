import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
	plugins: [vue()],
	test: {
		globals: true,
		environment: "happy-dom",
		alias: {
			"@": resolve(__dirname, "src")
		}
	}
});
