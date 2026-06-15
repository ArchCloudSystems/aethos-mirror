import { BrowserView, type Rectangle } from "electron";
import type { BrowserError, BrowserState } from "@aethos/mirror-protocol";
import { getMainWindow } from "./window";

/**
 * Real embedded Chromium browser surface for Aethos Mirror.
 *
 * Implemented with an Electron `BrowserView` attached to the main window. This
 * is a genuine Chromium browsing context — NOT an iframe, <webview> tag, fake
 * React UI, screenshot, or external Chrome. Security posture for remote pages:
 *   - `contextIsolation: true`
 *   - `nodeIntegration: false`
 *   - `sandbox: true`
 *   - NO preload script (remote pages get no bridge into the app)
 *   - popups denied; only http/https navigations allowed
 *
 * The view is INSET from the window so the renderer-owned assistant overlay
 * (orb + status rail) stays visible beside it — the BrowserView paints above
 * the window's web contents, so we reserve a left rail and a top strip that the
 * BrowserView never covers.
 */

// Layout reserved for the renderer-owned assistant overlay (kept clear of the
// browser surface so the overlay is always visible beside the page).
const OVERLAY_RAIL_WIDTH = 360;
const TOP_STRIP_HEIGHT = 64;

const DEFAULT_HOME_URL = "https://duckduckgo.com";

function resolveHomeUrl(): string {
  const fromEnv = process.env.AETHOS_MIRROR_BROWSER_HOME;
  if (typeof fromEnv === "string" && /^https?:\/\//i.test(fromEnv.trim())) {
    return fromEnv.trim();
  }
  return DEFAULT_HOME_URL;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface NavResult {
  ok: boolean;
  error: string | null;
}

class BrowserSurface {
  private view: BrowserView | null = null;
  private attached = false;
  private hasLoaded = false;
  private readonly homeUrl = resolveHomeUrl();
  private lastError: BrowserError | null = null;
  private resizeHandler: (() => void) | null = null;

  /** Lazily create the BrowserView with a locked-down web preferences set. */
  private ensureView(): BrowserView | null {
    if (this.view) {
      return this.view;
    }
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        sandbox: true,
        webSecurity: true,
        // No preload: remote pages get zero access to the app or Node.
        preload: undefined,
        // Don't allow the remote content to spawn an unsandboxed popup window.
        webviewTag: false
      }
    });

    view.setBackgroundColor("#05070d");

    const wc = view.webContents;

    // Deny all popups / window.open — keep a single, controlled surface.
    wc.setWindowOpenHandler(() => ({ action: "deny" }));

    // Block in-page navigations to non-http(s) schemes (file:, etc.).
    wc.on("will-navigate", (event, url) => {
      if (!isAllowedUrl(url)) {
        event.preventDefault();
      }
    });

    // Deny all permission requests (camera, mic, geolocation, etc.).
    wc.session.setPermissionRequestHandler((_webContents, _permission, cb) => {
      cb(false);
    });

    wc.on("did-start-loading", () => {
      this.lastError = null;
    });

    wc.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        // -3 == ERR_ABORTED (e.g. user navigated away); not a real failure.
        if (!isMainFrame || errorCode === -3) {
          return;
        }
        this.lastError = {
          code: errorCode,
          message: safeErrorMessage(errorDescription),
          url: typeof validatedURL === "string" ? validatedURL : null,
          occurredAt: new Date().toISOString()
        };
      }
    );

    this.view = view;
    return view;
  }

  private computeBounds(): Rectangle | null {
    const win = getMainWindow();
    if (!win) {
      return null;
    }
    const [width, height] = win.getContentSize();
    const x = OVERLAY_RAIL_WIDTH;
    const y = TOP_STRIP_HEIGHT;
    return {
      x,
      y,
      width: Math.max(0, width - OVERLAY_RAIL_WIDTH),
      height: Math.max(0, height - TOP_STRIP_HEIGHT)
    };
  }

  private applyBounds(): void {
    const bounds = this.computeBounds();
    if (this.view && bounds) {
      this.view.setBounds(bounds);
    }
  }

  /** Attach + show the surface (browser mode). Loads home on first show. */
  show(): void {
    const win = getMainWindow();
    const view = this.ensureView();
    if (!win || !view) {
      return;
    }

    if (!this.attached) {
      win.addBrowserView(view);
      this.attached = true;

      // Keep the view inset as the window resizes so the overlay rail stays
      // clear. setAutoResize can't model a fixed left/top inset, so track
      // resize manually.
      this.resizeHandler = () => this.applyBounds();
      win.on("resize", this.resizeHandler);
    }

    this.applyBounds();

    if (!this.hasLoaded) {
      this.hasLoaded = true;
      void view.webContents.loadURL(this.homeUrl);
    }
  }

  /** Detach/hide the surface (any non-browser mode). View + history persist. */
  hide(): void {
    const win = getMainWindow();
    if (this.view && this.attached && win) {
      if (this.resizeHandler) {
        win.removeListener("resize", this.resizeHandler);
        this.resizeHandler = null;
      }
      win.removeBrowserView(this.view);
    }
    this.attached = false;
  }

  navigate(url: string): NavResult {
    const trimmed = (url ?? "").trim();
    if (!isAllowedUrl(trimmed)) {
      return { ok: false, error: "Only http(s) URLs are allowed" };
    }
    const view = this.ensureView();
    if (!view) {
      return { ok: false, error: "Browser surface unavailable" };
    }
    this.hasLoaded = true;
    this.lastError = null;
    void view.webContents.loadURL(trimmed);
    return { ok: true, error: null };
  }

  reload(): NavResult {
    if (!this.view) {
      return { ok: false, error: "Browser surface not created" };
    }
    this.view.webContents.reload();
    return { ok: true, error: null };
  }

  back(): NavResult {
    if (!this.view) {
      return { ok: false, error: "Browser surface not created" };
    }
    const wc = this.view.webContents;
    if (!wc.canGoBack()) {
      return { ok: false, error: "Cannot go back" };
    }
    wc.goBack();
    return { ok: true, error: null };
  }

  forward(): NavResult {
    if (!this.view) {
      return { ok: false, error: "Browser surface not created" };
    }
    const wc = this.view.webContents;
    if (!wc.canGoForward()) {
      return { ok: false, error: "Cannot go forward" };
    }
    wc.goForward();
    return { ok: true, error: null };
  }

  home(): NavResult {
    return this.navigate(this.homeUrl);
  }

  /** Truthful, secret-free snapshot of the live webContents. */
  getState(): BrowserState {
    const wc = this.view?.webContents ?? null;
    const currentUrl = wc ? wc.getURL() : "";
    return {
      implemented: true,
      active: this.attached,
      currentUrl: currentUrl && currentUrl.length > 0 ? currentUrl : null,
      title: wc ? wc.getTitle() || null : null,
      loading: wc ? wc.isLoading() : false,
      canGoBack: wc ? wc.canGoBack() : false,
      canGoForward: wc ? wc.canGoForward() : false,
      homeUrl: this.homeUrl,
      lastError: this.lastError
    };
  }
}

/** Reduce any error description to a short, secret-free first line. */
function safeErrorMessage(description: unknown): string {
  const text =
    typeof description === "string" && description.length > 0
      ? description
      : "Navigation failed";
  return text.split("\n")[0].slice(0, 200);
}

let surface: BrowserSurface | null = null;

function getSurface(): BrowserSurface {
  if (!surface) {
    surface = new BrowserSurface();
  }
  return surface;
}

// Public API used by the API server / mode switching.
export function showBrowserSurface(): void {
  getSurface().show();
}
export function hideBrowserSurface(): void {
  getSurface().hide();
}
export function navigateBrowser(url: string): NavResult {
  return getSurface().navigate(url);
}
export function reloadBrowser(): NavResult {
  return getSurface().reload();
}
export function browserGoBack(): NavResult {
  return getSurface().back();
}
export function browserGoForward(): NavResult {
  return getSurface().forward();
}
export function browserGoHome(): NavResult {
  return getSurface().home();
}
export function getBrowserState(): BrowserState {
  return getSurface().getState();
}
