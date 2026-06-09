import type {
  TelegramMode,
  TelegramSendResult,
  TelegramStatus
} from "@aethos/mirror-protocol";
import TelegramBot from "node-telegram-bot-api";

/**
 * Telegram skeleton adapter for Ailee.
 *
 * Strictly guarded: a message is only sent when BOTH a bot token and at least
 * one valid allow-listed chat id are configured. No polling loop is started
 * unless TELEGRAM_POLLING_ENABLED=true (polling wiring is intentionally left
 * for a later pass). The bot token is NEVER returned or logged.
 */

const MAX_MESSAGE_LENGTH = 4096;

function readString(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Parse and validate the allow-listed chat ids. A valid id is a non-empty
 * integer (Telegram chat ids may be negative for groups). Invalid entries are
 * dropped.
 */
function parseAllowedChatIds(): number[] {
  const raw = readString("TELEGRAM_ALLOWED_CHAT_IDS");
  if (!raw) {
    return [];
  }
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      continue;
    }
    const parsed = Number(trimmed);
    if (Number.isSafeInteger(parsed)) {
      ids.push(parsed);
    }
  }
  return ids;
}

function resolveMode(
  hasToken: boolean,
  hasChats: boolean,
  enabled: boolean
): TelegramMode {
  if (!hasToken || !hasChats || !enabled) {
    return "disabled";
  }
  if (isTruthy(readString("TELEGRAM_POLLING_ENABLED"))) {
    return "polling";
  }
  if (readString("TELEGRAM_WEBHOOK_URL")) {
    return "webhook";
  }
  return "disabled";
}

/**
 * Report read-only Telegram status. Never exposes the token; only reports
 * whether things are configured plus the count of valid allow-listed chats.
 */
export function getTelegramStatus(): TelegramStatus {
  const hasToken = Boolean(readString("TELEGRAM_BOT_TOKEN"));
  const allowedChatIds = parseAllowedChatIds();
  const hasChats = allowedChatIds.length > 0;
  // Master Ailee switch; defaults to enabled when unset.
  const aileeEnabled =
    readString("AILEE_ENABLED") === undefined
      ? true
      : isTruthy(readString("AILEE_ENABLED"));

  const configured = hasToken && hasChats;
  const enabled = configured && aileeEnabled;

  return {
    configured,
    enabled,
    mode: resolveMode(hasToken, hasChats, enabled),
    allowedChatCount: allowedChatIds.length
  };
}

/**
 * Send a message to all allow-listed chats. Only proceeds when token + at
 * least one valid chat id are configured. Always resolves — never throws.
 * The token is never logged or returned.
 */
export async function sendTelegramMessage(
  text: unknown
): Promise<TelegramSendResult> {
  const failure = (error: string): TelegramSendResult => ({
    ok: false,
    delivered: false,
    deliveredCount: 0,
    error
  });

  if (typeof text !== "string" || text.trim().length === 0) {
    return failure("Message text is required");
  }

  const message = text.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return failure(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
  }

  const token = readString("TELEGRAM_BOT_TOKEN");
  const allowedChatIds = parseAllowedChatIds();

  if (!token) {
    return failure("Telegram is not configured");
  }
  if (allowedChatIds.length === 0) {
    return failure("No valid allow-listed chat ids configured");
  }

  try {
    // No polling: construct without { polling: true }.
    const bot = new TelegramBot(token, { polling: false });

    let deliveredCount = 0;
    for (const chatId of allowedChatIds) {
      try {
        await bot.sendMessage(chatId, message);
        deliveredCount += 1;
      } catch (innerError) {
        const detail =
          innerError instanceof Error ? innerError.message : "unknown error";
        // Never log the token; chat-scoped failure only.
        console.warn(
          `[aethos-mirror] telegram delivery failed for a chat: ${detail}`
        );
      }
    }

    if (deliveredCount === 0) {
      return failure("Delivery failed for all allow-listed chats");
    }

    return {
      ok: true,
      delivered: true,
      deliveredCount,
      error: null
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] telegram send failed: ${detail}`);
    return failure("Telegram send failed");
  }
}
