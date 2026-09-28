# Telegram controls

## Platforms (`/menu` → Platforms)
Toggle which Solana launchpads the bot listens to:
- pump.fun
- Raydium LaunchLab / LetsBonk
- Meteora DBC / Believe
- Moonshot
- Boop.fun

## Safety toggles
- **Block mint authority** — ON by default; turn OFF to allow mintable tokens
- **Block creator rugs** — ON by default when GoPlus flags creator history
- **Min market cap** — default **0 (off)**; set e.g. 10000 to require $10k MC
- **Max single holder %** — default 25; **0 = off**
- **Max high ownership %** — default 80; **0 = off**
- **Max dev % / top10 %** — classic filters; set high (99) to loosen

## Telegram Mini App (optional)
Set env `DASHBOARD_WEBAPP_URL` (or `DASHBOARD_URL`) to your HTTPS dashboard URL.
Menu shows **Open control panel** which opens as a Telegram Web App when tapped.

Requirements: public HTTPS page; for full Mini App features register the domain with @BotFather → Bot Settings → Menu Button / Web App.
