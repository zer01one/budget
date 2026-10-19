# Contributing

Thanks for your interest in Budget! Bug reports, ideas and pull requests are welcome.

## Getting started

Requirements:

- Node.js 22+
- For the desktop app: Rust toolchain and, on Windows, MSVC Build Tools (see [Tauri prerequisites](https://tauri.app/start/prerequisites/))
- For the Android app: Android Studio with JDK 21

```bash
npm ci
npm run dev          # browser only, no file system access
npm run dev:tauri    # desktop app (first run compiles Rust deps, 5–10 min)
npm run cap:run      # build and run on an Android device/emulator
```

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same commands on every pull request.

## Guidelines

- **Tests first.** New features and bug fixes come with tests (Vitest + Vue Test Utils). Test files live next to the code:
  `Foo.vue` → `Foo.test.ts`.
- **No backend, no network calls.** Data lives in the user's vault folder; sync is handled by the user's cloud client.
- **File access goes through the adapter.** Use `getFileSystemAdapter()` from `@/services/filesystem`; never call
  `@tauri-apps/plugin-fs` or `@capacitor/filesystem` directly from views or stores.
- **IDs** are generated with `crypto.randomUUID()`; no extra ID libraries.
- **Formatting** follows `.prettierrc` (tabs, double quotes, 150 columns).
- Keep pull requests focused: one feature or fix per PR. For larger changes, open an issue first to discuss the approach.

## Pull requests

- Branch from `master` and target `master`.
- Pull requests are squash-merged, so the PR title becomes the commit message — make it short and descriptive.
- For UI changes, attach screenshots (desktop and/or mobile).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
