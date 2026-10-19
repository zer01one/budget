import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ ignores: ["dist/**", "node_modules/**", "android/**", "src-tauri/target/**"] },

	{ files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
	tseslint.configs.recommended,
	// Scope Vue rules to .vue files only — flat/essential has rule configs without files restriction
	// which crash when ESLint processes CSS files with language: "css/css"
	...pluginVue.configs["flat/essential"].map((c) => (c.files ? c : { ...c, files: ["**/*.vue"] })),
	{ files: ["**/*.vue"], languageOptions: { parserOptions: { parser: tseslint.parser } } },

	// Allow _underscore-prefixed params (intentional unused interface stubs)
	{
		files: ["**/*.{ts,mts,cts,vue}"],
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			// TypeScript already reports undefined identifiers; no-undef misfires on DOM types like AddEventListenerOptions
			"no-undef": "off"
		}
	},

	// Test files: allow `any` for partial mocks and Vue internal setup state access
	{
		files: ["**/*.test.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off"
		}
	},

	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"],
		rules: {
			"css/no-invalid-properties": ["error", { allowUnknownVariables: true }],
			// :has() is supported by all target webviews (WebView2, Android System WebView — Chromium 105+)
			"css/use-baseline": ["error", { allowSelectors: ["has"] }]
		}
	}
]);
