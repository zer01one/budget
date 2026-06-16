# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (browser only — no FS APIs)
npm run dev:tauri    # Tauri desktop dev (requires Rust + MSVC Build Tools on Windows)
npm run build        # vue-tsc type-check + vite build
npm run typecheck    # vue-tsc only, no emit
npm run build:android  # vite build + cap sync android
npm run cap:sync     # npx cap sync (after native plugin changes)
```

First run of `dev:tauri` takes 5–10 min (Rust dependency compilation). Subsequent runs: ~30s.

For Android live dev: uncomment the `server.url` block in `capacitor.config.ts` pointing to your local IP, then run `dev:android` + `cap run android`.

## Architecture

### Dual-platform, offline-first

No backend. Data lives as JSON files in a user-chosen folder (vault). Sync is handled entirely by the OS cloud client (Google Drive, Dropbox, etc.) — we never touch the network.

Two runtime targets share one Vue codebase:
- **Tauri 2.x** — Windows desktop (`src-tauri/`)
- **Capacitor 7.x** — Android (`android/`)

### File system adapter pattern

All vault I/O goes through `IFileSystemAdapter` (`src/services/filesystem/IFileSystemAdapter.ts`). Never import platform-specific code directly — always use the adapter:

```ts
import { getFileSystemAdapter } from '@/services/filesystem'
const fs = await getFileSystemAdapter()  // returns TauriAdapter or CapacitorAdapter
```

`getFileSystemAdapter()` is async and cached (singleton). Uses dynamic imports so Vite bundles the adapters into separate chunks.

**TauriAdapter** (`tauri.adapter.ts`): uses `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`. Atomic writes via `.tmp` rename.

**CapacitorAdapter** (`capacitor.adapter.ts`): uses the custom `VaultFilePlugin` Kotlin plugin (`android/app/src/main/java/com/budget/app/VaultFilePlugin.kt`) for SAF tree URI navigation. Regular `@capacitor/filesystem` is only used for `exportFile()`. Vault URI stored in `@capacitor/preferences`.

### Vault file structure

```
{vault}/
  metadata.json        # deviceId, schemaVersion
  accounts.json
  categories.json
  budgets.json
  gamification.json
  transactions/
    2026-06.json       # one file per month
    2026-05.json
```

App settings (vaultPath, theme, notifications) are stored locally outside the vault: Tauri plugin-store (`settings.json`) on desktop, `@capacitor/preferences` on Android.

### State management

Pinia stores in `src/stores/`. Each store owns loading from and saving to the vault file via a service in `src/services/data/`.

**Transactions store** is month-partitioned: `_cache: Map<YYYY-MM, Transaction[]>`. `allCached` is a computed flat array of all loaded months. On startup, only current + previous month are loaded. Additional months load on demand (load-more in TransactionsView).

**Conflict detection**: `transactionsService.loadMonth()` compares file `modifiedAt` vs cached timestamp — if drift is detected, merges by `updatedAt` per entity and sets `lastConflict` on the store. AppShell displays a banner.

### ID generation

`crypto.randomUUID()` everywhere — no external uuid package.

### `addTransaction` signature

```ts
addTransaction(input: Omit<Transaction, 'id' | 'updatedAt' | 'deviceId' | 'version' | 'isDeleted'>)
```
The store fills in `id`, `isDeleted: false`, `updatedAt`, `deviceId`, and `version: 1`.

### Recurring transactions

`Transaction.isRecurring = true` + `recurringRule: 'daily' | 'weekly' | 'monthly'` marks a **template**. Children have `recurringParentId` set. On each app start, `processRecurringTransactions()` (`src/composables/useRecurring.ts`) spawns all missing child occurrences up to today (max 366 iterations per template).

### ECharts

Tree-shaken setup in `main.ts` — only `PieChart, BarChart, LineChart, CanvasRenderer` etc. are registered via `use([...])`. Custom dark theme registered as `'budget-dark'` — always pass `theme="budget-dark"` to `<VChart>`.

### Notifications

`src/services/notifications.service.ts` — Capacitor-only (`@capacitor/local-notifications`). All functions are no-ops on Tauri (guarded by `Capacitor.isNativePlatform()`). Budget threshold alerts fire via a `watch` in `BudgetsView`.

### Tauri auto-updater

`src/composables/useUpdater.ts` — silently checks on startup, shows a banner in `AppShell` if update is available. The updater `endpoints` array in `tauri.conf.json` is empty — fill in before shipping.

## Key constraints

- **No backend, no network calls** — any suggestion involving a server or HTTP API is wrong for this project.
- **Platform adapters are mandatory** — never call `@tauri-apps/plugin-fs` or `@capacitor/filesystem` directly from views/stores; always go through `getFileSystemAdapter()`.
- **Dynamic imports for adapters** — static imports of `tauri.adapter` or `capacitor.adapter` defeat code splitting and cause `INEFFECTIVE_DYNAMIC_IMPORT` warnings.
- **Capacitor Android SAF** — `@capacitor/filesystem` cannot navigate inside SAF tree URIs from `FilePicker.pickDirectory()`. The custom `VaultFilePlugin.kt` handles this.
- Dates use `en-CA` locale for `YYYY-MM-DD` format: `new Date().toLocaleDateString('en-CA')`.
- No external ID libraries — use `crypto.randomUUID()`.
- Vite base is `'/'` for Tauri, `'./'` for Capacitor (controlled by `CAPACITOR_BUILD` env var).
