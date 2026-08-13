# Settings and secrets

CapitalGains stores non-secret runtime config (friction bps, risk defaults, promote thresholds, Daily Limit, control floor weight, exploration allotment) in the local SQLite `config` table via the engine store.

## Where secrets live

API keys (**Cursor** and **market-data**) are **not** written to git, `.env` (tracked), or the SQLite database.

They are stored in an **OS-encrypted** file under Electron `app.getPath('userData')`:

```
<userData>/secrets/keys.enc.json
```

Encryption uses Electron **`safeStorage`** (OS keychain / DPAPI / Keychain Services). The file on disk only contains ciphertext (base64). Settings UI exposes whether a key is present (`hasCursorApiKey` / `hasMarketDataKey`) and never returns the raw secret to the renderer after save.

If `safeStorage.isEncryptionAvailable()` is false, secret writes fail rather than falling back to plaintext.
