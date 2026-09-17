# Phase 0 — passed

Upstream: https://github.com/frappe/books/releases/tag/v0.36.0
Pinned commit: `2f028f42be70a1dbd45bd4c6483d57df2fc64805`.
Branch: `custom`. Application sources and lockfile are unmodified.

The actual host is macOS arm64, not Windows. The user selected the most suitable
alternative; Windows GitHub Actions was chosen. Windows interactive installer
testing remains outstanding even if the cloud build succeeds.

Completed and verified:

- Cloned stable source to `books-stable`; a full upstream clone also exists in
  sibling `books-baseline` (not the customization working directory).
- Read the stable README, package scripts, builder config, and existing CI.
- Downloaded official Node 20.18.1 to `/private/tmp` and checked its SHA-256 against
  the official SHASUMS256.txt. System Node 22.11.0 was not changed.
- Installed isolated Yarn Classic 1.22.22 with the frozen lockfile. Electron rebuild
  completed successfully, including better-sqlite3.
- Ran `yarn dev` and visually verified the unmodified Frappe Books welcome screen.
- Ran the production source build (`yarn build --nopackage`) successfully.
- Ran `.github/workflows/windows-baseline.yml` on GitHub Actions Windows 2022.
  Run 35173454773 completed successfully in 2m 40s.
- Downloaded the artifact (GitHub digest
  `f54c5f117b89fde9b9b5504948d5a62bbe1c20ef711f2056dae7fc234ff82460`).
- Preserved the fallback installer at
  `fallback/Frappe Books-v0.36.0-windows-x64.exe` (75,769,225 bytes).
- Verified the installer is an NSIS PE executable and its SHA-256 is
  `ed52744f05fe7b5f7cfea7e5726c929a000346fa80fd5b4a59caca689ee08ab7`.

Environment limitation:

- The host is macOS arm64, so the Windows installer could not be launched
  interactively. Compilation and NSIS packaging were performed by a real Windows
  Server 2022 GitHub runner. Windows installation QA remains outstanding.

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

Phase 1 may begin. The default values selected for the unresolved placeholders are
Techflow, تك فلو, نقطة البيع, and `com.techflow.techflow`. Use Alexandria locally
when phase 3 is reached. A replacement `branding/logo.png` still needs to be
generated or supplied before icon replacement.
