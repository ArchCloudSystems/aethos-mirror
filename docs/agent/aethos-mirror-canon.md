# Aethos Mirror Canon

## Purpose

Aethos Mirror v0.1 is **Ailee-first**, MagicMirror-style, and fully functional standalone. It renders content, hosts browser sessions, and provides an overlay layer for interaction—without requiring AetherCore, CAILEAN, or assistant services.

For v0.1:
- **Ailee is the only visible assistant**.
- Mirror fetches and displays ambient data: weather, RSS, calendar, map tiles, YouTube links, minimal email summary (read-only).
- Mirror operates without memory, approval authority, or control-plane responsibilities.
- AetherCore integration is future-facing—not required for v0.1.

Mirror never initiates actions, stores persistent memory, or controls external systems beyond display state.

---

## Alee (v0.1) / AetherCore Boundary

| v0.1 (Ailee-Focused, Standalone) | AetherCore (Future, Optional) |
|--|-----------------------------|
| Ailee display, ambient data rendering | CAILEAN assistant with memory and tools |
| No decision-making, no routing | Model routing, approval workflows |
| No email send/delete/archive | Email send/delete/archive |
| Read-only data fetch only | Agent actions, repository writes |
| Ailee state only | Global policy, memory persistence |

**v0.1 is valid without AetherCore. AetherCore integration is enhancements for later versions.**

---

## What Belongs in Mirror (v0.1)

✅ UI rendering (React components, Electron BrowserViews)  
✅ Browser navigation and display (real Chromium windows, not iframes)  
✅ Overlay graphics and HUD elements  
✅ Ambient data display (weather, RSS, calendar, maps, YouTube, minimal email)  
✅ Mode switching (`landing`, `briefing`, `browser`, `cockpit`, `tool_panel`, `voice_only`, `sleep`, `error`)  
✅ Device status reporting (GPU, memory, uptime)  
✅ Visual feedback (animations, transitions, confirmations)  
✅ User input forwarding (to Ailee or AetherCore when available)

**Mirror may store only transient, UI-local state:**
- Current mode
- Active assistant (Ailee in v0.1)
- Overlay visibility
- Current URL displayed
- Timestamp of last mode change
- Receipt of last command (not executed command log)

---

## What Must NOT Belong in Mirror (v0.1)

❌ Decision-making logic  
❌ Model selection or routing authority  
❌ Ailee memory storage or retrieval  
❌ Approval policy enforcement  
❌ Email send/delete/archive (only read-only summary)  
❌ Repository agent actions (Hermes control)  
❌ Secrets or keys (use user-provided environment variables)  
❌ Global state beyond UI display  
❌ Persistent history or logs  
❌ Network request发起 (except required display URLs)  
❌ Build-time or runtime configuration authority  
❌ CAILEAN, operator tools, or AetherCore features in v0.1

**If it’s not about *display*, *browser runtime*, or *ambient data rendering*, it does not belong in Mirror v0.1.**

---

## Browser Cockpit Rule: Real Electron/Chromium Control

Browser and cockpit modes **MUST** use actual Electron `BrowserView` or `webContents.loadURL()` in the main process.

✅ Allowed:  
- `BrowserView` with `webContents.loadURL()`  
- Direct Chromium window management  
- Native Chromium DevTools integration  
- Full Chromium network and security stack

❌ Forbidden:  
- `<iframe>` for browsing/cockpit UX  
- `<webview>` tag (deprecated and sandbox-limited)  
- React components that mock browser behavior  
- JavaScript-run headless browsers or Puppeteer/Playwright  
- Any "fake browser" implementation inside renderer

**Rationale**: Real Chromium control ensures correct CORS, cookies, hardware acceleration, privacy features, and security isolation. Mocked browsers violate the platform’s trust model.

---

## Targets

### Raspberry Pi / Desktop Kiosk

- Full-screen display with no window chrome  
- Touch and/or mouse input enabled  
- Persistent session across reboots (UI state only)  
- Automatic reload on crash  
- No user account switching  
- Air-gapped from network where secrets are present  

### Mobile Minimal Orb (Future)

- Small, lightweight "orb" floating UI  
- Voice-first interaction  
- Handoff to full Mirror on desktop  
- Minimal overlay layers  
- Battery-conscious rendering  

---

## Enforcement

All code must pass:
- `npm run typecheck` (strict mode)
- `npm run lint`
- `npm test`

Aethos Mirror v0.1 code that violates canon **MUST be rejected** at review time.

---

## Ailee-Focused v0.1 Checklist

- [ ] Ailee is the only visible assistant  
- [ ] Ambient data sources are optional and user-configured  
- [ ] No email send/delete/archive (only read-only summary)  
- [ ] No decision-making logic  
- [ ] Browser cockpit uses real Chromium (no iframe)  
- [ ] Hermes may inspect always; may write only when explicitly asked  
- [ ] No secrets in code or config  
- [ ] AetherCore integration is not required for basic usability  
