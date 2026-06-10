# Self-Hosted CalDAV Configuration

For self-hosted deployments, Calino supports preconfiguring CalDAV accounts in a static config file. This allows users to connect to their CalDAV servers without manually entering credentials — they just need to enter a master password once.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  calino.config.json (safe to commit)                    │
│  ├── Encrypted CalDAV passwords                         │
│  └── Server URLs + usernames                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ├── User enters master password                        │
│  ├── PBKDF2 derives decryption key                      │
│  ├── Decrypts CalDAV passwords                          │
│  └── Connects directly to CalDAV servers                │
└─────────────────────────────────────────────────────────┘
```

## Setup

### 1. Create config file

Create `calino.config.json` in your public directory (same level as `index.html`):

```json
{
  "version": 1,
  "accounts": [
    {
      "name": "Personal",
      "url": "https://caldav.example.com/dav.php/calendars/user/personal/",
      "username": "user@example.com",
      "password": {
        "ciphertext": "ENCRYPTED_CIPHERTEXT",
        "iv": "ENCRYPTED_IV",
        "salt": "ENCRYPTED_SALT"
      }
    }
  ]
}
```

### 2. Encrypt your CalDAV passwords

Use the encryption script:

```bash
node scripts/encrypt-password.mjs --master "your-master-password" --password "your-caldav-password"
```

This outputs a JSON blob with `ciphertext`, `iv`, and `salt`. Copy this into your config file.

### 3. Serve the config file

**Development:** Place it in the `public/` directory.

**Static hosting:** Upload `calino.config.json` alongside your built files.

#### Docker

**Option A: Volume mount (recommended)**

Mount the config file into the nginx html directory:

```bash
docker run -d \
  --name calino \
  -p 3000:80 \
  -v /path/to/calino.config.json:/usr/share/nginx/html/calino.config.json:ro \
  ghcr.io/ivan-malinovski/calino:latest
```

**Option B: Docker Compose**

```yaml
services:
  calino:
    image: ghcr.io/ivan-malinovski/calino:latest
    ports:
      - "3000:80"
    volumes:
      - ./calino.config.json:/usr/share/nginx/html/calino.config.json:ro
    restart: unless-stopped
```

**Option C: Custom Dockerfile**

If you need to bake the config into the image:

```dockerfile
FROM ghcr.io/ivan-malinovski/calino:latest
copy calino.config.json /usr/share/nginx/html/calino.config.json
```

Then build and run:

```bash
docker build -t calino-custom .
docker run -d -p 3000:80 calino-custom
```

**Verify:** Open `http://localhost:3000/calino.config.json` in your browser — you should see the JSON. The master password prompt will appear on the main page.

## Security Model

| Layer | Stored | Contains |
|-------|--------|----------|
| Config file | Static file, safe to commit | Encrypted CalDAV passwords |
| localStorage | Browser only | Master password (user's responsibility) |
| Memory (Zustand) | Session only | Decrypted CalDAV passwords |

- **Config file** contains only encrypted blobs — safe to commit to version control
- **Master password** is stored in localStorage — persists across refreshes
- **Decrypted passwords** exist only in memory — cleared on page refresh (re-decrypted from localStorage + config)

## Config Schema

```json
{
  "version": 1,
  "accounts": [
    {
      "name": "string — Display name for the account",
      "url": "string — CalDAV server URL (calendar home)",
      "username": "string — CalDAV username",
      "password": {
        "ciphertext": "string — base64url-encoded encrypted password",
        "iv": "string — base64url-encoded initialization vector",
        "salt": "string — base64url-encoded PBKDF2 salt"
      }
    }
  ]
}
```

## Multiple Accounts

You can configure multiple accounts:

```json
{
  "version": 1,
  "accounts": [
    {
      "name": "Personal",
      "url": "https://caldav.example.com/dav.php/calendars/user/personal/",
      "username": "user@example.com",
      "password": { "ciphertext": "...", "iv": "...", "salt": "..." }
    },
    {
      "name": "Work",
      "url": "https://caldav.work.com/dav.php/calendars/user/work/",
      "username": "employee@work.com",
      "password": { "ciphertext": "...", "iv": "...", "salt": "..." }
    }
  ]
}
```

Each password is encrypted independently with its own salt and IV.

## CORS Requirements

The browser connects directly to your CalDAV server. Your server must have CORS headers:

```
Access-Control-Allow-Origin: https://your-calino-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Depth, Prefer, If-None-Match, If-Match
```

See [CORS_PROXY.md](./CORS_PROXY.md) for details.

## Troubleshooting

**Master password prompt doesn't appear:**
- Ensure `calino.config.json` is accessible at the app root (check browser Network tab)
- Ensure the file is valid JSON with `version: 1`

**"Wrong password" error:**
- The master password must match the one used to encrypt the passwords
- Re-encrypt with the correct master password

**Accounts don't auto-connect:**
- Check browser console for errors
- Ensure the CalDAV URL is correct and accessible
- Ensure CORS headers are configured

**Config file visible to anyone:**
- The config file contains only encrypted blobs
- Without the master password, the encrypted data is useless
- The master password is in the user's browser (localStorage), not in the config file
