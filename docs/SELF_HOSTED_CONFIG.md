# Self-Hosted CalDAV Account Configuration

## User Guide

### What is this?

If you self-host Calino, you can preconfigure CalDAV accounts so users don't need to manually enter server URLs, usernames, and passwords. Instead, you encrypt the passwords with a master password, and users just enter that master password once to unlock everything.

### Quick Start

**1. Encrypt your CalDAV password:**

```bash
node scripts/encrypt-password.mjs --master "choose-a-master-password" --password "your-caldav-password"
```

This outputs a JSON blob. Keep the master password safe — you'll share it with users.

**2. Create `calino.config.json`:**

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

**3. Serve the file:**

- **Docker Compose** — uncomment the volume mount in `docker-compose.yml`
- **Docker run** — `-v ./calino.config.json:/srv/calino.config.json:ro`
- **Development** — place in `public/`

**4. Tell users the master password.**

When they open Calino, they'll see a unlock prompt. After entering the master password, all preconfigured accounts connect automatically.

### User Experience

1. Open Calino → master password prompt appears
2. Enter master password → accounts connect, calendars load
3. Done. The master password is remembered in the browser (localStorage).
4. On refresh → no prompt, accounts are still connected.
5. Clear browser data → prompt appears again.

### Security

| What | Where | Contains |
|------|-------|----------|
| `calino.config.json` | Server (static file) | Encrypted passwords only |
| localStorage | User's browser | Master password (plain text) |
| Memory (Zustand) | User's browser tab | Decrypted CalDAV passwords |

- The config file is safe to commit to a repo — it only has encrypted blobs.
- The master password is in the user's browser. If someone has access to the browser, they can already see everything.
- Decrypted CalDAV passwords exist only in memory and are re-derived from the master password + config on each page load.

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
    image: ghcr.io/ivan-malinovski/calino:latest
    ports:
      - "3000:8080"
    volumes:
      - ./calino.config.json:/srv/calino.config.json:ro
    restart: unless-stopped
```

### CORS Requirement

The browser connects directly to your CalDAV server. Your server must allow cross-origin requests. See `docs/CORS_PROXY.md` for details.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Prompt doesn't appear | Check that `calino.config.json` is served at `/calino.config.json` (open it in browser) |
| "Wrong password" | The master password must match the one used to encrypt. Re-encrypt if needed. |
| Accounts don't connect | Check browser console. Server URL must be reachable and CORS-enabled. |
| Prompt keeps appearing | Don't clear browser localStorage. The master password is stored there. |

---

## Technical Reference (for coding agents)

### Architecture Overview

```
calino.config.json          localStorage              Zustand store
(encrypted blobs)           (master password)          (decrypted passwords)
        │                          │                          │
        └──────────┬───────────────┘                          │
                   │                                          │
            configLoader.ts                                   │
            (fetch + validate)                                │
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
| `src/lib/crypto.ts` | `encryptWithMasterPassword()`, `decryptWithMasterPassword()`, `deriveKeyFromPassword()` — PBKDF2 + AES-256-GCM |
| `src/lib/configLoader.ts` | Fetches `/calino.config.json`, validates schema, caches result |
| `src/store/configStore.ts` | Zustand store: master password, decrypted credentials, unlock/lock actions |
| `src/features/settings/components/MasterPasswordPrompt.tsx` | Modal UI for master password entry |
| `src/features/caldav/hooks/useCalDAV.ts` | Auto-connect logic (lines ~443–490) |
| `src/features/onboarding/OnboardingModal.tsx` | Hidden when preconfigured accounts exist |
| `scripts/encrypt-password.mjs` | CLI tool to encrypt passwords |
| `calino.config.example.json` | Template config file |

### Encryption Details

- **Algorithm:** AES-256-GCM
- **Key derivation:** PBKDF2 with 100,000 iterations, SHA-256
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
| `calino.masterPassword` | Master password (plain text) |
| `calino_caldav_credentials` | CalDAV credentials (encrypted with app-level key) |
| `calino_caldav_accounts` | Account metadata (server URL, credential ID, etc.) |

The CalDAV credentials are encrypted with a separate app-level key (`APP_SECRET` in `crypto.ts`), not the master password. This is the existing behavior — preconfigured accounts go through the same `saveCredentials()` path as manually added accounts.

### Testing Locally

```bash
# 1. Encrypt password
node scripts/encrypt-password.mjs --master "test123" --password "your-password"

# 2. Create calino.config.json with the encrypted blob

# 3. Run with Docker
docker compose up -d --build

# 4. Open http://localhost:8080
# 5. Enter "test123" in the master password prompt
# 6. Accounts should auto-connect
```

### Known Limitations

- Master password is stored in plain text in localStorage (same as existing CalDAV credentials)
- No "lock" button in the UI — once unlocked, stays unlocked until browser data is cleared
- No support for changing master password without re-encrypting all passwords
- Config file is static — changing it requires a page reload
- Preconfigured accounts are read-only in the settings UI (can't delete or edit them)
