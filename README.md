# Wisdom in Proverbs

Teaching reference series for Hiturn Media Group. Eight self-contained HTML sections plus a series index.

**Live site:** https://wisdomproverbs.pages.dev/  
**Repository:** https://github.com/Daveflyon/wisdomproverbs  
**Deploy:** Cloudflare Pages (automatic on push to `main`)

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Series index and entry point |
| `wisdom-proverbs-s1-what-wisdom-is.html` | Section 1 (locked template) |
| `wisdom-proverbs-s2-what-wisdom-has.html` | Section 2 |
| `wisdom-proverbs-s3-what-wisdom-requires.html` | Section 3 |
| `wisdom-proverbs-s4-what-wisdom-speaks.html` | Section 4 |
| `wisdom-proverbs-s5-what-wisdom-gives.html` | Section 5 |
| `wisdom-proverbs-s6-folly-contrast.html` | Section 6 |
| `wisdom-proverbs-s7-across-domains.html` | Section 7 |
| `wisdom-proverbs-s8-nt-connections.html` | Section 8 |
| `favicon.svg` | Site favicon |

Static HTML only. No build step.

---

## Local workspace

In the parent Cursor workspace, this git repo lives in `wisdom-proverbs-files/`. Edit files here, then commit and push to `main` to publish.

**Default workflow:** after meaningful changes, commit and push to `main` so Cloudflare Pages deploys automatically.

---

## Cloudflare Pages setup

Use these settings in the Cloudflare dashboard.

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Open **Workers & Pages** and select the **wisdomproverbs** project.
3. Open **Settings** → **Build** (or **Build configuration**).
4. Confirm:

| Setting | Value |
|---------|-------|
| Git repository | `Daveflyon/wisdomproverbs` |
| Production branch | `main` |
| Build command | *(empty / none)* |
| Build output directory | `/` |

HTML files are at the repo root. Do not set the output directory to a subfolder.

### First-time connection

If the project is not linked yet:

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub and select `Daveflyon/wisdomproverbs`.
3. Framework preset: **None**.
4. Build command: blank. Output directory: `/`.
5. **Save and Deploy**.

### Verify a deploy

1. Open the **Deployments** tab.
2. Latest deployment should show **Success**.
3. Check https://wisdomproverbs.pages.dev/ and spot-check a section page.

### Custom domain (optional)

**Settings** → **Custom domains** → **Set up a custom domain**, then follow Cloudflare DNS instructions.

---

## GitHub and security

### Do not store tokens in the repo

Never commit personal access tokens, passwords, or credential URLs in markdown, HTML, or scripts.

### If a token was exposed

1. GitHub → profile **Settings** → **Developer settings**.
2. **Personal access tokens** → **Tokens (classic)** or **Fine-grained tokens**.
3. Find and **Revoke** the compromised token.
4. In Cloudflare, **Retry deployment** to confirm the Cloudflare ↔ GitHub integration still works (it uses its own app connection, not your PAT).

### Safer git authentication

- **Git Credential Manager** (Windows default), or
- **SSH keys** (`git@github.com:Daveflyon/wisdomproverbs.git`), or
- A fine-grained token stored only in the OS credential store — not in project files.

---

## Publishing changes

```powershell
cd wisdom-proverbs-files
git add -A
git status
git commit -m "Describe the change"
git push origin main
```

Cloudflare Pages rebuilds within a few minutes. Netlify is no longer used.

---

## Spec and handoff docs

Project structure, colour, and content rules: see `CLAUDE.md` in the parent workspace (or `CLAUDE_archived.md` if the active spec is not present).

Session handoff notes: `WIP-NEW-CHAT-PROMPT.md` in the parent workspace.
