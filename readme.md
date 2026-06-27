# Budget

[English](#english) · [Русский](#русский)

---

<a name="english"></a>

A personal finance app that runs on **Windows desktop** and **Android** — with no backend, no account, no cloud dependency. Your data lives in a folder you choose; sync happens through whatever cloud client you already use (Google Drive, Dropbox, OneDrive).

Built with Vue 3, Tauri 2, and Capacitor 8.

---

## Features

- **Transactions** — add income, expenses, and transfers; browse by month with infinite scroll
- **Accounts** — cash, bank card, savings, investments, crypto — each with its own currency and color
- **Budgets** — set a spending limit per category per month; get alerts when you're close
- **Categories** — hierarchical income/expense/transfer categories, fully customizable
- **Charts** — pie, bar, and line charts for spending analysis
- **Recurring transactions** — daily, weekly, or monthly templates that auto-generate occurrences
- **Import** — bring in transactions from an external file
- **Offline-first sync** — data is plain JSON files in your vault folder; drop it in a synced cloud folder and it just works across devices
- **Conflict resolution** — if the same vault is opened on two devices simultaneously, the app auto-merges by `updatedAt` timestamp

---

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | Vue 3 + TypeScript |
| State | Pinia |
| Desktop | Tauri 2.x (Windows) |
| Mobile | Capacitor 8 (Android) |
| Build | Vite |
| Charts | Apache ECharts 6 via vue-echarts |
| Icons | Phosphor Icons |
| Tests | Vitest |

---

## Getting started

### Prerequisites

- **Node.js** 18+ and npm
- **For desktop (Tauri):** Rust toolchain + [MSVC Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) on Windows
- **For Android:** Android Studio + NDK, Capacitor CLI (`npm i -g @capacitor/cli`)

### Install dependencies

```bash
npm install
```

### Run in browser (fastest, no native features)

```bash
npm run dev
```

Opens at `http://localhost:5173`. File system calls are stubbed — good for UI work.

### Run as desktop app (Tauri)

```bash
npm run dev:tauri
```

> First run takes **5–10 minutes** while Rust compiles all dependencies. Subsequent runs are ~30 seconds.

### Run on Android device

1. Uncomment the `server.url` block in `capacitor.config.ts` and set your local IP
2. Connect a device with USB debugging enabled
3. Run:

```bash
npm run dev:android
npx cap run android
```

---

## Build for production

```bash
# Desktop (produces an MSI/NSIS installer in src-tauri/target/release/bundle/)
npm run build:tauri

# Android (produces an APK/AAB via Android Studio)
npm run build:android
```

---

## Project structure

```
src/
  views/          # 13 route-level pages (Dashboard, Transactions, Budgets, …)
  stores/         # Pinia stores — one per domain (accounts, transactions, budgets, …)
  services/
    filesystem/   # Platform adapter (IFileSystemAdapter → Tauri or Capacitor impl)
    data/         # Vault read/write services per entity
  components/
    ui/           # Reusable UI primitives (Button, Input, Modal, DatePicker, …)
    layout/       # AppShell, BottomNav (mobile), SideNav (desktop)
  composables/    # useRecurring, useUpdater, …
  types/          # Shared TypeScript types

src-tauri/        # Rust/Tauri desktop shell
android/          # Capacitor Android project + custom VaultFilePlugin (Kotlin/SAF)
```

### Vault file layout

The app stores everything as human-readable JSON in a folder you pick:

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

Put this folder inside Google Drive / Dropbox and it syncs automatically across devices.

### Platform adapter

All file I/O goes through a single interface so views and stores never touch platform APIs directly:

```ts
import { getFileSystemAdapter } from '@/services/filesystem'
const fs = await getFileSystemAdapter()  // returns TauriAdapter or CapacitorAdapter
await fs.writeFile('accounts.json', JSON.stringify(data))
```

---

## Running tests

```bash
npx vitest run          # run all tests once
npx vitest              # watch mode
npx vitest run --coverage
```

---

## App settings storage

Settings (vault path, theme, notifications) are stored **outside** the vault so they survive vault switches:

| Platform | Storage |
|---|---|
| Desktop | Tauri plugin-store (`settings.json` in app data dir) |
| Android | `@capacitor/preferences` |

---

## License

MIT

---

<a name="русский"></a>

# Budget

Приложение для личных финансов, которое работает на **Windows** и **Android** — без бэкенда, без аккаунта, без привязки к облаку. Данные хранятся в папке на ваш выбор; синхронизация происходит через облачный клиент, который вы уже используете (Google Drive, Dropbox, OneDrive).

Стек: Vue 3, Tauri 2, Capacitor 8.

---

## Возможности

- **Транзакции** — доходы, расходы и переводы; просмотр по месяцам с подгрузкой
- **Счета** — наличные, карта, сбережения, инвестиции, крипто — каждый со своей валютой и цветом
- **Бюджеты** — лимит трат по категории на месяц с уведомлениями при приближении к порогу
- **Категории** — иерархические категории доходов/расходов/переводов, полностью настраиваемые
- **Графики** — круговые, столбчатые и линейные диаграммы для анализа расходов
- **Регулярные транзакции** — шаблоны с правилом (ежедневно/еженедельно/ежемесячно), дочерние записи создаются автоматически
- **Импорт** — загрузка транзакций из внешнего файла
- **Offline-first синхронизация** — данные хранятся как обычные JSON-файлы в папке хранилища; положите её в облачную папку — и она синхронизируется между устройствами автоматически
- **Разрешение конфликтов** — если хранилище открыто на двух устройствах одновременно, приложение сливает изменения по полю `updatedAt`

---

## Технологии

| Слой | Технология |
|---|---|
| UI-фреймворк | Vue 3 + TypeScript |
| Состояние | Pinia |
| Десктоп | Tauri 2.x (Windows) |
| Мобильный | Capacitor 8 (Android) |
| Сборка | Vite |
| Графики | Apache ECharts 6 через vue-echarts |
| Иконки | Phosphor Icons |
| Тесты | Vitest |

---

## Быстрый старт

### Необходимое окружение

- **Node.js** 18+ и npm
- **Для десктопа (Tauri):** Rust toolchain + [MSVC Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) на Windows
- **Для Android:** Android Studio + NDK, Capacitor CLI (`npm i -g @capacitor/cli`)

### Установка зависимостей

```bash
npm install
```

### Запуск в браузере (быстро, без нативных функций)

```bash
npm run dev
```

Откроется `http://localhost:5173`. Файловая система заглушена — удобно для работы с UI.

### Запуск как десктопное приложение (Tauri)

```bash
npm run dev:tauri
```

> Первый запуск занимает **5–10 минут** — Rust компилирует зависимости. Последующие — ~30 секунд.

### Запуск на Android-устройстве

1. Раскомментируйте блок `server.url` в `capacitor.config.ts` и укажите локальный IP
2. Подключите устройство с включённой отладкой по USB
3. Запустите:

```bash
npm run dev:android
npx cap run android
```

---

## Сборка для продакшна

```bash
# Десктоп (MSI/NSIS-установщик в src-tauri/target/release/bundle/)
npm run build:tauri

# Android (APK/AAB через Android Studio)
npm run build:android
```

---

## Структура проекта

```
src/
  views/          # 13 страниц-маршрутов (Dashboard, Transactions, Budgets, …)
  stores/         # Pinia-сторы — один на домен (accounts, transactions, budgets, …)
  services/
    filesystem/   # Адаптер платформы (IFileSystemAdapter → Tauri или Capacitor)
    data/         # Сервисы чтения/записи хранилища по сущностям
  components/
    ui/           # Переиспользуемые компоненты (Button, Input, Modal, DatePicker, …)
    layout/       # AppShell, BottomNav (мобильный), SideNav (десктоп)
  composables/    # useRecurring, useUpdater, …
  types/          # Общие TypeScript-типы

src-tauri/        # Rust/Tauri оболочка десктопа
android/          # Capacitor Android-проект + VaultFilePlugin (Kotlin/SAF)
```

### Структура хранилища

Все данные хранятся как читаемые JSON-файлы в выбранной папке:

```
{vault}/
  metadata.json        # deviceId, schemaVersion
  accounts.json
  categories.json
  budgets.json
  gamification.json
  transactions/
    2026-06.json       # один файл на месяц
    2026-05.json
```

Положите эту папку в Google Drive или Dropbox — и данные автоматически синхронизируются между устройствами.

### Адаптер платформы

Всё файловое I/O проходит через единый интерфейс, чтобы представления и сторы никогда не обращались к нативным API напрямую:

```ts
import { getFileSystemAdapter } from '@/services/filesystem'
const fs = await getFileSystemAdapter()  // возвращает TauriAdapter или CapacitorAdapter
await fs.writeFile('accounts.json', JSON.stringify(data))
```

---

## Запуск тестов

```bash
npx vitest run          # один прогон
npx vitest              # режим наблюдения
npx vitest run --coverage
```

---

## Хранение настроек приложения

Настройки (путь к хранилищу, тема, уведомления) хранятся **вне** хранилища, чтобы переживать его смену:

| Платформа | Хранилище |
|---|---|
| Десктоп | Tauri plugin-store (`settings.json` в директории данных приложения) |
| Android | `@capacitor/preferences` |

---

## Лицензия

MIT
