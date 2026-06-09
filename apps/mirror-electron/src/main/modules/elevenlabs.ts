import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VoiceStatus, VoiceTtsResult } from "@aethos/mirror-protocol";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * ElevenLabs voice skeleton adapter for Ailee.
 *
 * Generates speech from text only when an API key is configured. The generated
 * audio is written to a local temp file and that path is returned (the app has
 * no renderer audio channel yet, so a temp path is the safe handoff). The API
 * key is NEVER returned or logged.
 */

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 5000;

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
  const configured = Boolean(readString("ELEVENLABS_API_KEY"));
  const aileeEnabled =
    readString("AILEE_ENABLED") === undefined
      ? true
      : isTruthy(readString("AILEE_ENABLED"));

  return {
    configured,
    enabled: configured && aileeEnabled,
    voiceConfigured: Boolean(readString("ELEVENLABS_VOICE_ID")),
    modelId: readString("ELEVENLABS_MODEL_ID") ?? DEFAULT_MODEL_ID,
    outputFormat: readString("ELEVENLABS_OUTPUT_FORMAT") ?? DEFAULT_OUTPUT_FORMAT
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

  const apiKey = readString("ELEVENLABS_API_KEY");
  const voiceId = readString("ELEVENLABS_VOICE_ID");
  const modelId = readString("ELEVENLABS_MODEL_ID") ?? DEFAULT_MODEL_ID;
  const outputFormat =
    readString("ELEVENLABS_OUTPUT_FORMAT") ?? DEFAULT_OUTPUT_FORMAT;

  if (!apiKey) {
    return failure("Voice is not configured");
  }
  if (!voiceId) {
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
      `ailee-tts-${randomUUID()}.${ext}`
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
