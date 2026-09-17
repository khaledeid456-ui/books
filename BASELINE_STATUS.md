# Phase 0 — preparation only; acceptance gate NOT passed

Upstream: https://github.com/frappe/books/releases/tag/v0.36.0
Pinned commit: `2f028f42be70a1dbd45bd4c6483d57df2fc64805`.
Branch: `custom`. Application sources and lockfile are unmodified.

The actual host is macOS arm64, not Windows. The user selected the most suitable
alternative; Windows GitHub Actions was chosen. Windows interactive installer
testing remains outstanding even if the cloud build succeeds.

Completed preparation:

- Cloned stable source to `books-stable`; a full upstream clone also exists in
  sibling `books-baseline` (not the customization working directory).
- Read the stable README, package scripts, builder config, and existing CI.
- Downloaded official Node 20.18.1 to `/private/tmp` and checked its SHA-256 against
  the official SHASUMS256.txt. System Node 22.11.0 was not changed.
- Installed isolated Yarn Classic 1.22.22 and started frozen-lockfile installation.
- Prepared `.github/workflows/windows-baseline.yml`. It builds the unmodified
  upstream commit on Windows 2022, targets unsigned NSIS x64, and uploads fallback
  installers with checksums. The workflow has NOT run or been validated on CI.

Pending:

- Local dependency installation was still downloading Electron at last inspection;
  its initial better-sqlite3 binary exists, but Electron rebuild is not verified.
- `yarn dev` has NOT run. Production build has NOT run.
- No Windows installer exists; no fallback has been preserved yet.
- GitHub connector recognizes the account, but offers no fork-creation operation.
  Browser is at GitHub sign-in; user must sign in before fork creation and CI setup.
- Actual English/Arabic app names, company/appId, and branding/logo.png are missing.
- All later phases remain unstarted. Use Alexandria locally when phase 3 is reached.

Resume locally using these isolated tools (temporary paths may need restoration):

```sh
export PATH=/private/tmp/node-v20.18.1-darwin-arm64/bin:/private/tmp/books-corepack/v1/yarn/1.22.22/bin:$PATH
yarn install --frozen-lockfile --cache-folder /private/tmp/books-yarn-cache
yarn dev
```

Inspect the current installation process before starting another one. If node-gyp
rejects default Python 3.14, use the available `/usr/bin/python3` (3.9.6) for the
locked node-gyp 9 instead of upgrading dependencies. The Windows workflow pins
Python 3.11 for the same reason.

After GitHub login: create the authorized fork, publish the `custom` preparation
branch, run the baseline workflow, inspect logs, download and verify its artifact
into `fallback/`, and verify local app startup. Only then record phase 0 as passed
and start rebranding. This preparation commit is not a successful phase checkpoint.
