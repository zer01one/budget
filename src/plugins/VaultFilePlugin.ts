import { registerPlugin } from "@capacitor/core";

export interface VaultFilePlugin {
	readJson(options: { treeUri: string; relativePath: string }): Promise<{
		exists: boolean;
		json?: string;
		modifiedAt?: number;
	}>;
	writeJson(options: { treeUri: string; relativePath: string; json: string }): Promise<void>;
	listFiles(options: { treeUri: string; relativeDir?: string }): Promise<{ files: string[] }>;
	exists(options: { treeUri: string; relativePath: string }): Promise<{ exists: boolean }>;
	mkdir(options: { treeUri: string; relativePath: string }): Promise<void>;
	persistPermission(options: { treeUri: string }): Promise<void>;
}

export const VaultFile = registerPlugin<VaultFilePlugin>("VaultFile");
