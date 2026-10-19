# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via
[GitHub Security Advisories](https://github.com/zer01one/budget/security/advisories/new). You should get a response within 30 days.

Please include:

- affected platform (Windows / Android) and app version;
- steps to reproduce or a proof of concept;
- the impact you expect (data exposure, data corruption, code execution, etc.).

## Scope

Budget has no backend and makes no network requests: all data is stored as JSON files in a folder chosen by the user. Relevant
issues include, for example:

- reading or writing files outside the selected vault folder;
- data loss or corruption caused by crafted vault or import files;
- script injection through imported data or vault contents;
- weaknesses in the desktop auto-update process.

Issues in the user's cloud sync client (Google Drive, Dropbox, etc.) or on a compromised device are out of scope.
