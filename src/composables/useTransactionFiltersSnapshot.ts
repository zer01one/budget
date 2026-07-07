import type { TransactionType } from "@/types";

export interface FiltersSnapshot {
	search: string;
	showFilters: boolean;
	filterType: TransactionType | "";
	filterAccountId: string;
	filterCategoryId: string;
	filterFrom: string;
	filterTo: string;
}

// Module-level so filter state survives TransactionsView being unmounted while the
// user is on the transaction detail/add screen — only written on route leave, so it
// stays untouched (and thus irrelevant) when tests mount/unmount the view directly.
let snapshot: FiltersSnapshot | null = null;

export function getFiltersSnapshot(): FiltersSnapshot | null {
	return snapshot;
}

export function setFiltersSnapshot(next: FiltersSnapshot): void {
	snapshot = next;
}
