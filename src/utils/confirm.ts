import { useConfirmDialog } from "@/composables/useConfirmDialog";

export function showConfirm(message: string, options?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
	const { show } = useConfirmDialog();
	return show({ message, ...options });
}
