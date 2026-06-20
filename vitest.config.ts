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
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			reportsDirectory: "./coverage",
			include: ["src/**/*.{ts,vue}"],
			exclude: ["src/main.ts", "src/**/*.d.ts", "src/services/filesystem/tauri.adapter.ts", "src/services/filesystem/capacitor.adapter.ts"]
		}
	}
});
