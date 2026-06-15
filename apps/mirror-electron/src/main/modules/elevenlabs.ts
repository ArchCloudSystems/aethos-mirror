import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VoiceStatus, VoiceTtsResult } from "@aethos/mirror-protocol";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getSecret, hasSecret, configValueOr, getConfig } from "../config-adapter";

/**
 * ElevenLabs voice skeleton adapter for Mirror.
 *
 * Generates speech from text only when an API key is configured. The generated
 * audio is written to a local temp file and that path is returned (the app has
 * no renderer audio channel yet, so a temp path is the safe handoff). The API
 * key is NEVER returned or logged.
 *
 * Configuration is read from the unified config adapter (config.json +
 * secrets.env + .env.local + process.env) so adapter behavior and reported
 * status can never drift apart.
 */

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 5000;

/** Map an output format token to a best-effort mime type + file extension. */
function describeFormat(outputFormat: string): {
  mimeType: string;
  ext: string;
} {
  if (outputFormat.startsWith("mp3")) {
    return { mimeType: "audio/mpeg", ext: "mp3" };
  }
  if (outputFormat.startsWith("pcm")) {
    return { mimeType: "audio/wave", ext: "wav" };
  }
  if (outputFormat.startsWith("ulaw") || outputFormat.startsWith("alaw")) {
    return { mimeType: "audio/basic", ext: "raw" };
  }
  if (outputFormat.startsWith("opus")) {
    return { mimeType: "audio/opus", ext: "opus" };
  }
  return { mimeType: "application/octet-stream", ext: "bin" };
}

/**
 * Report read-only voice module status. Never exposes the API key.
 */
export function getVoiceStatus(): VoiceStatus {
  const config = getConfig();
  const configured =
    config.providers.elevenLabs.enabled && hasSecret("ELEVENLABS_API_KEY");

  return {
    configured,
    enabled: configured,
    voiceConfigured: hasSecret("ELEVENLABS_VOICE_ID"),
    modelId: configValueOr("ELEVENLABS_MODEL_ID", DEFAULT_MODEL_ID),
    outputFormat: configValueOr("ELEVENLABS_OUTPUT_FORMAT", DEFAULT_OUTPUT_FORMAT)
  };
}

/**
 * Synthesize speech from text. Only proceeds when an API key (and a voice id)
 * are configured and the text passes length validation. Always resolves —
 * never throws. On success writes audio to a temp file and returns its path.
 * The API key is never returned or logged.
 */
export async function synthesizeSpeech(
  text: unknown
): Promise<VoiceTtsResult> {
  const failure = (error: string): VoiceTtsResult => ({
    ok: false,
    source: "fallback",
    audioPath: null,
    mimeType: null,
    byteLength: 0,
    error
  });

  if (typeof text !== "string" || text.trim().length < MIN_TEXT_LENGTH) {
    return failure("Text is required");
  }

  const message = text.trim();
  if (message.length > MAX_TEXT_LENGTH) {
    return failure(`Text exceeds ${MAX_TEXT_LENGTH} characters`);
  }

  const config = getConfig();
  if (!config.providers.elevenLabs.enabled) {
    return failure("Voice is not configured");
  }

  const apiKey = getSecret("ELEVENLABS_API_KEY");
  const voiceId = getSecret("ELEVENLABS_VOICE_ID");
  const modelId = configValueOr("ELEVENLABS_MODEL_ID", DEFAULT_MODEL_ID);
  const outputFormat =
    configValueOr("ELEVENLABS_OUTPUT_FORMAT", DEFAULT_OUTPUT_FORMAT);

  if (apiKey.length === 0) {
    return failure("Voice is not configured");
  }
  if (voiceId.length === 0) {
    return failure("No voice id configured");
  }

  try {
    const client = new ElevenLabsClient({ apiKey });

    const stream = await client.textToSpeech.convert(voiceId, {
      text: message,
      modelId,
      outputFormat: outputFormat as never
    });

    // Collect the streamed audio into a single buffer.
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

    if (audio.byteLength === 0) {
      return failure("Synthesis produced no audio");
    }

    const { mimeType, ext } = describeFormat(outputFormat);
    const audioPath = path.join(
      os.tmpdir(),
      `mirror-tts-${randomUUID()}.${ext}`
    );
    await writeFile(audioPath, audio);

    return {
      ok: true,
      source: "live",
      audioPath,
      mimeType,
      byteLength: audio.byteLength,
      error: null
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    // Never log the API key; generic message only.
    console.warn(`[aethos-mirror] voice synthesis failed: ${detail}`);
    return failure("Voice synthesis failed");
  }
}
