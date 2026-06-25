import { ref } from "vue";

interface ConfirmOptions {
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
	resolve: (value: boolean) => void;
}

const pending = ref<PendingConfirm | null>(null);

export function useConfirmDialog() {
	function show(options: ConfirmOptions): Promise<boolean> {
		return new Promise((resolve) => {
			pending.value = { ...options, resolve };
		});
	}

	function confirm() {
		pending.value?.resolve(true);
		pending.value = null;
	}

	function cancel() {
		pending.value?.resolve(false);
		pending.value = null;
	}

	return { pending, show, confirm, cancel };
}
