# Ailee Magic Mirror v0.1 — Product Specification

## Product Vision

Ailee Magic Mirror v0.1 is a **standalone, first-user-validated Magic Mirror** experience. It runs on Raspberry Pi or desktop environments, displaying helpful ambient information without requiring AetherCore or external assistant infrastructure.

This is **v0.1 validation**: get the core display and data rendering experience right before adding complexity.

---

## First User Stories

| Persona | Story |
|--|--|
| Home user | I want to see the date, weather, and calendar events every morning while I get ready. |
| Minimalist | I want one screen that shows only what I need—no notifications, no apps, no clutter. |
| Developer | I want to run a local mirror without signing up for cloud accounts. |
| Tinkerer | I want to swap modules (weather, news, calendar) without touching core code. |

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Top Bar (optional): Date, Time                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Modules (grid or stack):                                             │
│  [ Weather ]  [ News Headlines ]  [ Calendar Preview ]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Browser View /cockpit (bottom half or overlay, if enabled)               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Overlay (configurable): Ailee status, Mic state, Mute toggle             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar** (optional): Date, time, system status
- **Data modules** (configurable): Weather, RSS, calendar, map tiles, YouTube preview
- **Browser view**: Full Chromium window with real Chromium controls
- **Overlay**: Minimal controls (Ailee status, mic toggle, mute, quit)

---

## Modes

| Mode | Description |
|--|--|
| `landing` | Default welcome screen — "Hello, Ailee is ready" |
| `briefing` | Active data modules — weather, news, calendar |
| `browser` | Browser view takes focus (real Chromium) |
| `cockpit` | Full Chromium cockpit (custom tabs,DevTools) |
| `tool_panel` | Unused in v0.1 — reserved for CAILEAN/assistant tools |
| `voice_only` | Mic active, screen may dim or show mic status |
| `sleep` | Screen off or minimal clock | 
| `error` | Error state (missing config, module failed) |

---

## Config Variables Needed

```yaml
ailee:
  deviceName: "Master Bedroom Mirror"
  displayLanguage: "en"

data:
  weather:
    provider: "open-meteo" # or "openweathermap"
    location:
      lat: 40.7128
      lon: -74.0060
  news:
    feeds:
      - url: "https://news.ycombinator.com/rss"
        title: "Hacker News"
      - url: "https://feeds.bbci.co.uk/news/rss.xml"
        title: "BBC News"
  calendar:
    enabled: true
    provider: "google" # or "ics-file"
    lookAheadDays: 7

browser:
  enabled: true
  defaultUrl: "https://www.youtube.com/live_stream"
```

---

## Data Providers

| Data | Provider Options | Auth Required |
|--|--|--|
| Weather | Open-Meteo, OpenWeatherMap | Optional (API key) |
| News/RSS | RSS feed URLs (user-configured) | None |
| Calendar | Google Calendar, local .ics file | Google: OAuth, .ics: none |
| Maps | OpenStreetMap tiles | None |
| YouTube | Direct embed or browser mode | None (public videos) |
| Email summary | IMAP read-only (optional) | IMAP credentials |

**Notes**:
- Email is **read-only summary only** — no send/delete/archive.
- All providers are user-configurable; defaults are open/free tiers.
- No external server proxy — direct from device to provider.

---

## Pass Order

1. **Boot** — Load config, verify data providers
2. **Initialize modules** — Fetch weather, RSS, calendar (async)
3. **Render UI** — Top bar, modules, overlay (loading states if slow)
4. **Browser** — If enabled, start Chromium viewport (real Chromium)
5. **Update** — Periodic refresh of data modules (configurable interval)
6. **Event** — Voice command triggers overlay or mode switch

---

## Explicit Non-Goals (v0.1)

❌ AetherCore integration  
❌ CAILEAN assistant  
❌ Operator tools  
❌ Email send/delete/archive  
❌ Model routing authority  
❌ Approval policy  
❌ Repository writes (Hermes only writes when explicitly asked)  
❌ Telegram or email authority  
❌ Cloud sync or accounts  
❌ Multi-device orchestration  
❌ Speech synthesis or transcription  
❌ Face or object recognition  
❌ Camera access  
❌ Third-party skill marketplace  

**Ailee v0.1 is a self-contained, data-displaying ambient screen.**

---

## Validation Checklist

- [ ] All data sources are user-configurable  
- [ ] No secrets baked into code  
- [ ] Browser cockpit uses real Chromium, no iframe  
- [ ] Modules are optional and swappable  
- [ ] No external service calls without user consent  
- [ ] Fallback UI when data provider fails (no crash)  

---

**Next steps after v0.1 validation:**
- Add AetherCore integration as optional enhancement  
- Add CAILEAN assistant module  
- Add approval workflows and operator tools  
- Add repo-agent integration for advanced users
