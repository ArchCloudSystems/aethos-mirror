import type {
  TelegramMode,
  TelegramSendResult,
  TelegramStatus
} from "@aethos/mirror-protocol";
import TelegramBot from "node-telegram-bot-api";
import { getTelegramProviderConfig } from "../config";

/**
 * Telegram skeleton adapter for Mirror.
 *
 * Configuration is read from the SAME loaded config source as
 * `/modules/status` (see {@link getTelegramProviderConfig}) so adapter
 * behavior and reported status can never drift apart. We do NOT read raw
 * `process.env` here.
 *
 * Strictly guarded: a message is only sent when BOTH a bot token and at least
 * one allow-listed chat id are configured. No polling loop is started unless
 * TELEGRAM_POLLING_ENABLED=true (polling wiring is intentionally left for a
 * later pass). The bot token and raw chat ids are NEVER returned or logged.
 */

const MAX_MESSAGE_LENGTH = 4096;

function resolveMode(
  hasToken: boolean,
  hasChats: boolean,
  enabled: boolean,
  pollingEnabled: boolean,
  hasWebhook: boolean
): TelegramMode {
  if (!hasToken || !hasChats || !enabled) {
    return "disabled";
  }
  if (pollingEnabled) {
    return "polling";
  }
  if (hasWebhook) {
    return "webhook";
  }
  return "disabled";
}

/**
 * Report read-only Telegram status. Never exposes the token or raw chat ids;
 * only reports whether things are configured plus the count of allow-listed
 * chats. Mirrors the configured/enabled logic used by `/modules/status`.
 */
export function getTelegramStatus(): TelegramStatus {
  const config = getTelegramProviderConfig();
  const hasToken = config.botToken !== null;
  const allowedChatIds = config.allowedChatIds;
  const hasChats = allowedChatIds.length > 0;

  const configured = hasToken && hasChats;
  const enabled = configured && config.assistantEnabled;

  return {
    configured,
    enabled,
    mode: resolveMode(
      hasToken,
      hasChats,
      enabled,
      config.pollingEnabled,
      config.webhookUrl !== null
    ),
    allowedChatCount: allowedChatIds.length
  };
}

/**
 * Send a message to all allow-listed chats. Only proceeds when token + at
 * least one allow-listed chat id are configured. Always resolves — never
 * throws. The token and raw chat ids are never logged or returned.
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

  const config = getTelegramProviderConfig();
  const token = config.botToken;
  const allowedChatIds = config.allowedChatIds;

  if (!token) {
    return failure("Telegram is not configured");
  }
  if (allowedChatIds.length === 0) {
    return failure("No allow-listed chat ids configured");
  }

  try {
    // No polling: construct without { polling: true }.
    const bot = new TelegramBot(token, { polling: false });

    let deliveredCount = 0;
    for (const chatId of allowedChatIds) {
      try {
        // Chat ids are kept as strings so large group/supergroup ids are
        // never coerced through a lossy Number. node-telegram-bot-api accepts
        // a string chat id.
        await bot.sendMessage(chatId, message);
        deliveredCount += 1;
      } catch (innerError) {
        const detail =
          innerError instanceof Error ? innerError.message : "unknown error";
        // Never log the token or the raw chat id; chat-scoped failure only.
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
