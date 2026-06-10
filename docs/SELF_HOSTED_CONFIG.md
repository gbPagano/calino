# Self-Hosted CalDAV Account Configuration

## User Guide

### What is this?

If you self-host Calino, you can preconfigure CalDAV accounts so users don't need to manually enter server URLs, usernames, and passwords. Instead, you encrypt the passwords with a master password, and users just enter that master password once to unlock everything.

### Quick Start (Recommended)

The easiest way to generate a config file is the browser-based setup wizard. No Node.js required.

**1. Open `/setup` in any Calino instance:**

```
http://localhost:8080/setup    # Local Docker
https://calino.io/setup        # Hosted instance
```

The setup wizard runs entirely in your browser — credentials never leave your device.

**2. Add your CalDAV accounts:**

Enter the server URL, username, and password for each account. You can test the connection before adding.

**3. Set a master password:**

This password encrypts your CalDAV credentials. Share it with users who should have access.

**4. Download the config:**

Click "Generate Config" — the encrypted `calino.config.json` downloads automatically.

**5. Place and build:**

```bash
# Copy the downloaded file to the project root
cp ~/Downloads/calino.config.json ./

# Build
docker compose up -d --build
```

The config is baked into the JS bundle at build time. It is **not** served as a separate file.

**6. Tell users the master password.**

When they open Calino, they'll see an unlock prompt. After entering the master password, all preconfigured accounts connect automatically.

### Quick Start (CLI)

If you prefer the command line or need to automate config generation:

**1. Encrypt your CalDAV password:**

```bash
node scripts/encrypt-password.mjs --master "choose-a-master-password" --password "your-caldav-password"
```

This outputs a JSON blob. Keep the master password safe — you'll share it with users.

**2. Create `calino.config.json` in the project root:**

```json
{
  "version": 1,
  "accounts": [
    {
      "name": "Personal",
      "url": "https://caldav.example.com/dav.php",
      "username": "your-username",
      "password": { "ciphertext": "...", "iv": "...", "salt": "..." }
    }
  ]
}
```

**3. Build:**

```bash
docker compose up -d --build
```

### User Experience

1. Open Calino → master password prompt appears (blurred background)
2. Enter master password → accounts connect, calendars load
3. Done. The master password is remembered in the browser (encrypted in localStorage).
4. On refresh → no prompt, accounts are still connected.
5. Clear browser data → prompt appears again.
6. Lock icon in settings dropdown → clears master password, prompt appears on next load.

### Lock

When preconfigured accounts are active, a lock icon appears in the settings dropdown (next to "All settings"). Clicking it:

- Removes the encrypted master password from localStorage
- Clears decrypted credentials from memory
- Shows the master password prompt on next page load

The lock does **not** disconnect active CalDAV sessions in the current tab — it prevents future access until the master password is re-entered.

### Brute-Force Protection

The master password prompt limits attempts to 5 before blocking for 1 minute. Failed attempts are tracked per browser session (sessionStorage).

### Security

| What | Where | Contains |
|------|-------|----------|
| JS bundle | Server (minified) | Encrypted passwords, server URLs, usernames (hidden in minified code) |
| localStorage | User's browser | Master password (encrypted with app-level key) |
| Memory (Zustand) | User's browser tab | Decrypted CalDAV passwords |

- The config is baked into the JS bundle at build time. It's not served as a separate file.
- Server URLs and usernames are in minified JavaScript — not casually readable, but not truly secret. Don't put anything in the config you wouldn't put in a public README. The master password protects the CalDAV passwords only.
- The master password is encrypted at rest in localStorage using AES-256-GCM (same as CalDAV credentials). Plaintext never touches persistent storage.
- Decrypted CalDAV passwords exist only in memory and are re-derived from the master password + config on each page load.
- Brute-force protection: 5 attempts, then 1-minute cooldown.

### Multiple Accounts

You can add as many accounts as needed. Each has its own encrypted password:

```json
{
  "version": 1,
  "accounts": [
    { "name": "Personal", "url": "...", "username": "user1", "password": { ... } },
    { "name": "Work", "url": "...", "username": "user2", "password": { ... } }
  ]
}
```

### Docker Compose Example

```yaml
services:
  calino:
    build:
      context: .
    ports:
      - "3000:8080"
    restart: unless-stopped
```

Place `calino.config.json` in the project root before running `docker compose up -d --build`. The config is baked into the bundle during the build step.

### CORS Requirement

The browser connects directly to your CalDAV server. Your server must allow cross-origin requests. See `docs/CORS_PROXY.md` for details.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Prompt doesn't appear | Ensure `calino.config.json` exists in project root during build. Check build logs for `[build] Loaded calino.config.json`. |
| "Wrong password" | The master password must match the one used to encrypt. Re-encrypt if needed. |
| Accounts don't connect | Check browser console. Server URL must be reachable and CORS-enabled. |
| Prompt keeps appearing | Don't clear browser localStorage. The master password is stored there. |

---

## Technical Reference (for coding agents)

### Architecture Overview

```
calino.config.json          localStorage              Zustand store
(project root, build-time)  (master password)          (decrypted passwords)
        │                          │                          │
        ▼                          │                          │
    vite.config.ts                  │                          │
    (Vite define at build)          │                          │
        │                          │                          │
        ▼                          │                          │
    JS bundle                       │                          │
    (__CALINO_CONFIG__)             │                          │
        │                          │                          │
        └──────────┬───────────────┘                          │
                   │                                          │
            configLoader.ts                                   │
            (reads __CALINO_CONFIG__, validates)               │
                   │                                          │
                   ▼                                          │
            configStore.ts                                    │
            (unlock → decrypt → store in memory) ─────────────┘
                   │
                   ▼
            useCalDAV.ts
            (auto-connect: calls addAccount for each preconfigured account)
```

### File Map

| File | Role |
|------|------|
| `vite.config.ts` | Reads `calino.config.json` at build time, injects as `__CALINO_CONFIG__` via `define` |
| `src/lib/crypto.ts` | `encryptWithMasterPassword()`, `decryptWithMasterPassword()`, `encryptPassword()`, `decryptPassword()` — PBKDF2 + AES-256-GCM |
| `src/lib/configLoader.ts` | Reads `__CALINO_CONFIG__` global, validates schema, caches result |
| `src/store/configStore.ts` | Zustand store: master password (encrypted at rest), decrypted credentials, unlock/lock actions |
| `src/features/settings/components/MasterPasswordPrompt.tsx` | Modal UI for master password entry (with brute-force protection) |
| `src/features/caldav/hooks/useCalDAV.ts` | Auto-connect logic (lines ~443–490) |
| `src/features/onboarding/OnboardingModal.tsx` | Hidden when preconfigured accounts exist |
| `src/features/setup/SetupPage.tsx` | Browser-based config generator (`/setup` route) |
| `src/features/setup/SetupPage.module.css` | Setup wizard styles |
| `scripts/encrypt-password.mjs` | CLI tool to encrypt passwords (alternative to `/setup`) |
| `calino.config.example.json` | Template config file |

### Encryption Details

- **Algorithm:** AES-256-GCM
- **Key derivation:** PBKDF2 with 600,000 iterations, SHA-256
- **Salt:** 16 bytes, random per password
- **IV:** 12 bytes, random per password
- **Encoding:** base64url (URL-safe base64 without padding)

The encryption script (`scripts/encrypt-password.mjs`) and the browser (`src/lib/crypto.ts`) use the same algorithm. The browser's `fromBase64()` function handles base64url-to-standard conversion for `atob()`.

### Auto-Connect Flow

1. `App.tsx` mounts → calls `configStore.loadConfigFile()`
2. `loadConfigFile()` fetches `/calino.config.json`, validates, caches
3. If config exists and master password is in localStorage → calls `unlock(storedPassword)`
4. `unlock()` decrypts all account passwords → sets `isUnlocked = true`
5. `useCalDAV` effect watches `isUnlocked` → triggers auto-connect
6. Auto-connect iterates config accounts sequentially (not concurrently!)
7. For each account: calls `addAccount()` which discovers server, tests connection, saves credentials, fetches calendars and events

### Critical: Sequential Auto-Connect

The auto-connect loop **must** run sequentially (`await` in a `for` loop), not concurrently. The reason:

`saveCredentials()` in `src/features/caldav/client/credentials.ts` does a read-modify-write on localStorage:
```typescript
const stored = getAllStoredCredentials()  // read
stored.push(newCredential)                // modify
localStorage.setItem(...)                 // write
```

If two `addAccount()` calls run concurrently, they read the same state, both push, and the last write clobbers the first credential. This causes "Credentials not found" errors when enabling settings sync.

### Module-Level Guard

`autoConnectDone` is a **module-level** variable (not a `useRef`), because `useCalDAV()` is called in 14+ components. Each hook instance would have its own ref, causing auto-connect to run 14 times. The module-level variable is shared across all instances.

### Onboarding Modal

`OnboardingModal.tsx` checks `hasPreconfiguredAccounts` from `configStore`. If true, it returns `null` — the onboarding wizard is hidden since the user doesn't need to manually add a CalDAV account.

### Config Validation

`configLoader.ts` validates the config strictly:
- `version` must be `1`
- `accounts` must be a non-empty array
- Each account needs `name`, `url`, `username` (non-empty strings)
- `password` must have `ciphertext`, `iv`, `salt` (strings) — checked via `isMasterEncryptedData()`
- Invalid accounts are skipped with a warning, not fatal
- Returns `null` if file missing or invalid (silent failure)

### localStorage Keys

| Key | Content |
|-----|---------|
| `calino.masterPassword` | Master password (encrypted with app-level key, `{ iv, data }` JSON) |
| `calino_caldav_credentials` | CalDAV credentials (encrypted with app-level key) |
| `calino_caldav_accounts` | Account metadata (server URL, credential ID, etc.) |

Both the master password and CalDAV credentials are encrypted with the same app-level key (`APP_SECRET` in `crypto.ts`). Plaintext never touches localStorage.

### Rate Limiting Keys (localStorage)

| Key | Content |
|-----|---------|
| `calino.masterPassword.attempts` | Failed unlock attempt count (shared across tabs, reset on success or after cooldown) |
| `calino.masterPassword.blockedUntil` | Timestamp when the block expires |

### Testing Locally

```bash
# 1. Encrypt password
node scripts/encrypt-password.mjs --master "test123" --password "your-password"

# 2. Create calino.config.json in project root with the encrypted blob

# 3. Build and run
docker compose up -d --build

# 4. Open http://localhost:8080
# 5. Enter "test123" in the master password prompt
# 6. Accounts should auto-connect
```

To test without config: delete `calino.config.json` from project root before building. The prompt won't appear.

### Known Limitations

- No support for changing master password without re-encrypting all passwords
- Config requires a rebuild to update (it's baked into the JS bundle)
- Preconfigured accounts are read-only in the settings UI (can't delete or edit them)
- Lock does not disconnect active CalDAV sessions in the current tab
