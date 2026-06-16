import { Capacitor } from "@capacitor/core";
import type { IFileSystemAdapter } from "./IFileSystemAdapter";

let _adapter: IFileSystemAdapter | null = null;

export async function getFileSystemAdapter(): Promise<IFileSystemAdapter> {
	if (_adapter) return _adapter;

	if (Capacitor.isNativePlatform()) {
		const { CapacitorAdapter } = await import("./capacitor.adapter");
		_adapter = new CapacitorAdapter();
	} else {
		const { TauriAdapter } = await import("./tauri.adapter");
		_adapter = new TauriAdapter();
	}
	return _adapter;
}

export type { IFileSystemAdapter, FolderPickerResult, FileReadResult } from "./IFileSystemAdapter";

export async function setVaultPath(path: string): Promise<void> {
	if (Capacitor.isNativePlatform()) {
		const { setCapacitorVaultUri } = await import("./capacitor.adapter");
		setCapacitorVaultUri(path);
	} else {
		const { setTauriVaultPath } = await import("./tauri.adapter");
		setTauriVaultPath(path);
	}
}
