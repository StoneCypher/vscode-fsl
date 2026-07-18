# Publishing vscode-fsl to the VS Code Marketplace

A one-time-setup-plus-repeatable-steps runbook for taking `vscode-fsl` live on
the Visual Studio Code Marketplace. Everything here is a **human-only** step —
it needs a real Microsoft/Azure DevOps account and a browser session, so none
of it can be automated by an agent. This file is the reference for doing it
once, and the note at the bottom covers every publish after the first.

## 1. Create an Azure DevOps Personal Access Token (PAT)

The Marketplace publisher flow and `vsce` (the VS Code Extension CLI) both
authenticate through Azure DevOps, not GitHub.

1. Sign in (or create a free account) at <https://dev.azure.com>.
2. Click your profile icon (top right) → **Personal access tokens**.
3. **New Token**:
   - **Name:** something recognizable, e.g. `vscode-fsl-marketplace`.
   - **Organization:** **All accessible organizations** (a PAT scoped to a
     single org will not authorize the Marketplace publish call, which is a
     cross-org resource).
   - **Scopes:** **Custom defined** → expand **Marketplace** → check
     **Manage**. This is the only scope needed; do not grant more.
   - **Expiration:** your choice, but note the date — an expired PAT is the
     most common cause of a publish suddenly failing months later.
4. Copy the token immediately; Azure DevOps only shows it once. Store it in a
   password manager, not in the repo or in a shell history file.

## 2. Create the Marketplace publisher

1. Go to <https://marketplace.visualstudio.com/manage> and sign in with the
   same Microsoft account used for the PAT.
2. Create a new publisher with **ID exactly `StoneCypher`**.

   This must match `package.json`'s `"publisher"` field byte-for-byte — the
   Marketplace publisher ID and the manifest's `publisher` are the same
   string, not just related. If the publisher is created under any other ID
   (a slug Azure DevOps auto-suggests, a different capitalization, etc.),
   either recreate the publisher under `StoneCypher` or update
   `package.json`'s `publisher` field to match whatever was actually created
   — do not let the two drift apart, `vsce publish` will reject the mismatch.
3. Fill in a display name and (optionally) an icon/description for the
   publisher profile itself — this is separate from the per-extension icon
   already wired up in `package.json`.

## 3. Log in with vsce

From the repo root:

```
npx vsce login StoneCypher
```

This prompts for the PAT from step 1 and caches it locally (in vsce's own
config, outside the repo) so subsequent `vsce publish` calls don't ask again
on this machine.

## 4. Capture the README screenshot

The Marketplace listing page renders `README.md` directly, and right now its
"Screenshot" section is a pending-placeholder (see `base_README.md`) — fix
that before publishing:

1. Open this repo in VS Code and press **F5** to launch the Extension
   Development Host.
2. In the host window, open `samples/demo.md` and switch to the Markdown
   preview (`Ctrl+Shift+V` / `Cmd+Shift+V`).
3. Once a live `fsl` fence is rendered as the interactive state-machine IDE,
   capture a screenshot of the preview pane and save it as
   `images/screenshot.png` in the repo root.
4. In `base_README.md`, delete the pending-placeholder line and uncomment the
   `![...](images/screenshot.png)` line sitting next to it in the HTML
   comment.
5. Regenerate `README.md` from the edited template:
   ```
   npm run update_madlibs
   ```
6. Commit `images/screenshot.png` and the regenerated `README.md` /
   `base_README.md` together.

`images/screenshot.png` does not need a `.vscodeignore` allow-rule — the
Marketplace renders `README.md`'s images straight from the GitHub-hosted repo
content, not from inside the packaged VSIX. (`images/icon.png` is different:
that one *is* read from inside the VSIX, and is already allow-listed.)

## 5. Publish

```
npx vsce publish
```

This packages the extension (equivalent to `vsce package`) and uploads it
under the version currently in `package.json`. First publish creates the
listing; every publish after that updates it in place.

## 6. The listing URL

Once the first publish finishes, the extension is live at:

```
https://marketplace.visualstudio.com/items?itemName=StoneCypher.vscode-fsl
```

(`itemName` is always `<publisher>.<name>`, taken straight from
`package.json`.) It can take a few minutes for the Marketplace's search index
to pick up a brand-new listing even after the page above resolves.

## 7. Optional: Open VSX (second registry)

Open VSX (<https://open-vsx.org>) is the extension registry used by
VS Code-compatible editors that don't ship Microsoft's proprietary Marketplace
client (Code - OSS builds, VSCodium, Gitpod, etc.). Publishing there is
optional and independent of the steps above — it uses its own CLI and its own
token, not the Azure DevOps PAT:

1. Create an account/publisher namespace at <https://open-vsx.org>.
2. Generate an access token from the user settings page there.
3. From the repo root:
   ```
   npx ovsx publish -p <open-vsx-token>
   ```
   (`ovsx` reads the same packaged VSIX shape as `vsce`; no separate build
   step is needed.)

## Future publishes

Every publish after the first is just:

1. Bump the version (`package.json` **and** `package-lock.json` — run
   `npm install --package-lock-only` after hand-editing the version so the
   lockfile doesn't drift, a mismatch a prior review already caught once).
2. `npm run build` (full profile) to regenerate `dist/`, the README madlibs,
   and the vendored jssm grammar.
3. `npx vsce publish`.

Alternatively, `.github/workflows/ci.yml`'s release job already has a
Marketplace-publish step wired in — **fully commented out**. Once a
`VSCE_PAT` secret (an Azure DevOps PAT, scoped as in step 1 above) is added to
the repo's GitHub Actions secrets, uncommenting that step makes every tagged
release publish to the Marketplace automatically. Leave it disabled until
that secret exists and you've deliberately decided to turn on auto-publish.
