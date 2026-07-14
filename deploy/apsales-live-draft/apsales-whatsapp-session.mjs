/**
 * APSales WhatsApp session (QA-driver path + controlled inbound media download).
 * Does NOT use monitorWebChannel / production inbox takeover.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { n as getStatusCode, t as formatError } from "/root/.openclaw/extensions/whatsapp/dist/session-errors-CbsoQqoy.js";
import { u as jidToE164 } from "/root/.openclaw/extensions/whatsapp/dist/text-runtime-Dk37KYHj.js";
import {
  d as normalizeMessageContent,
  f as resolveInboundMediaMimetype,
  g as extractLocationData,
  h as extractContextInfo,
  l as downloadMediaMessage,
  p as describeReplyContext,
  t as createWebSendApi,
  y as extractText,
} from "/root/.openclaw/extensions/whatsapp/dist/send-api-CFbAgIbn.js";
import { r as waitForWaConnection, t as createWaSocket } from "/root/.openclaw/extensions/whatsapp/dist/session-CoxlXm2K.js";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/** Avoid importing openclaw package name from this extension dir (no package root). */
function formatLocationText(location) {
  if (!location || typeof location !== "object") return "";
  const lat = location.degreesLatitude ?? location.latitude;
  const lon = location.degreesLongitude ?? location.longitude;
  const parts = [
    location.name,
    location.address,
    lat != null && lon != null ? `${lat},${lon}` : undefined,
  ].filter(Boolean);
  return parts.join(" | ");
}

function isRecord(value) {
  return Boolean(value && typeof value === "object");
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value) {
  return typeof value === "boolean" ? value : undefined;
}

function findMessageSection(message, sectionNames) {
  if (!isRecord(message)) return;
  const queue = [{ depth: 0, value: message }];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.value)) continue;
    seen.add(current.value);
    for (const sectionName of sectionNames) {
      const section = current.value[sectionName];
      if (isRecord(section)) return section;
    }
    if (current.depth >= 4) continue;
    for (const wrapperName of [
      "botInvokeMessage",
      "documentWithCaptionMessage",
      "ephemeralMessage",
      "groupMentionedMessage",
      "viewOnceMessage",
      "viewOnceMessageV2",
      "viewOnceMessageV2Extension",
    ]) {
      const wrapper = current.value[wrapperName];
      if (isRecord(wrapper) && isRecord(wrapper.message)) {
        queue.push({ depth: current.depth + 1, value: wrapper.message });
      }
    }
  }
}

function readReaction(message) {
  const reaction = findMessageSection(message, ["reactionMessage"]);
  if (!reaction) return;
  const emoji = readString(reaction.text) ?? "";
  const key = isRecord(reaction.key) ? reaction.key : undefined;
  return {
    emoji,
    fromMe: readBoolean(key?.fromMe),
    messageId: readString(key?.id),
    participant: readString(key?.participant),
  };
}

function readPoll(message) {
  const poll = findMessageSection(message, [
    "pollCreationMessage",
    "pollCreationMessageV2",
    "pollCreationMessageV3",
  ]);
  if (!poll) return;
  return {
    options: (Array.isArray(poll.options) ? poll.options : [])
      .map((option) => (isRecord(option) ? readString(option.optionName) : undefined))
      .filter(Boolean),
    question: readString(poll.name),
  };
}

function readMedia(message) {
  const normalizedMessage = isRecord(message) ? normalizeMessageContent(message) : undefined;
  for (const sectionName of [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
  ]) {
    const section = findMessageSection(normalizedMessage ?? message, [sectionName]);
    if (!section) continue;
    const mediaMessage = { [sectionName]: section };
    return {
      fileName: readString(section.fileName),
      mediaType: resolveInboundMediaMimetype(mediaMessage),
      sectionName,
    };
  }
}

function readQuotedMessage(message) {
  const contextInfo = extractContextInfo(message.message ?? undefined);
  const replyContext = describeReplyContext(message.message);
  if (!contextInfo && !replyContext) return;
  if (!contextInfo?.stanzaId && !contextInfo?.participant && !replyContext?.body) return;
  return {
    messageId: replyContext?.id ?? contextInfo?.stanzaId ?? undefined,
    participant: replyContext?.sender?.jid ?? contextInfo?.participant ?? undefined,
    text: replyContext?.body,
  };
}

function normalizeObservedMessage(message, authDir) {
  if (message.key.fromMe) return null;
  const extractedText = extractText(message.message ?? undefined);
  const location = extractLocationData(message.message);
  const text =
    [extractedText, location ? formatLocationText(location) : undefined].filter(Boolean).join("\n").trim() ||
    undefined;
  const reaction = readReaction(message.message);
  const poll = readPoll(message.message);
  const media = readMedia(message.message);
  const quoted = readQuotedMessage(message);
  const kind = reaction
    ? "reaction"
    : poll
      ? "poll"
      : media
        ? "media"
        : location
          ? "location"
          : text
            ? "text"
            : "unknown";
  if (!text && kind === "unknown") return null;
  const fromJid = message.key.remoteJid ?? undefined;
  return {
    fromJid,
    fromPhoneE164: fromJid ? jidToE164(fromJid, { authDir }) : null,
    hasMedia: media ? true : undefined,
    kind,
    mediaFileName: media?.fileName,
    mediaType: media?.mediaType,
    mediaSection: media?.sectionName,
    messageId: message.key.id ?? undefined,
    observedAt: new Date().toISOString(),
    poll,
    quoted,
    reaction,
    text: text ?? "",
  };
}

function closeSocket(sock) {
  if (typeof sock.end === "function") {
    sock.end();
    return;
  }
  sock.ws?.close?.();
}

function createConnectionClosedError(update) {
  const reason = update.lastDisconnect?.error;
  const status = getStatusCode(reason);
  const details = reason ? `: ${formatError(reason)}` : "";
  const statusLabel = typeof status === "number" ? ` (status ${status})` : "";
  return new Error(`WhatsApp QA driver connection closed${statusLabel}${details}`);
}

function extForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function writeBufferToFile(buffer, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(Readable.from(buffer), createWriteStream(filePath));
}

/**
 * Same surface as startWhatsAppQaDriverSession, plus downloadInboundImage().
 */
export async function startApsalesWhatsAppSession(params) {
  const sock = await createWaSocket(false, false, { authDir: params.authDir });
  const observedMessages = [];
  const rawByMessageId = new Map();
  const pendingNotificationsWaiters = [];
  const waiters = [];
  let closed = false;
  let closedError;
  let receivedPendingNotifications = false;

  const removeWaiter = (waiter) => {
    const index = waiters.indexOf(waiter);
    if (index >= 0) waiters.splice(index, 1);
    clearTimeout(waiter.timeout);
  };
  const removePendingNotificationsWaiter = (waiter) => {
    const index = pendingNotificationsWaiters.indexOf(waiter);
    if (index >= 0) pendingNotificationsWaiters.splice(index, 1);
    clearTimeout(waiter.timeout);
  };
  const markPendingNotificationsReceived = () => {
    if (receivedPendingNotifications) return;
    receivedPendingNotifications = true;
    for (const waiter of pendingNotificationsWaiters.slice()) {
      removePendingNotificationsWaiter(waiter);
      waiter.resolve();
    }
  };
  const observe = (message) => {
    observedMessages.push(message);
    if (observedMessages.length > 200) observedMessages.splice(0, observedMessages.length - 200);
    for (const waiter of waiters.slice()) {
      if (!waiter.predicate(message)) continue;
      removeWaiter(waiter);
      waiter.resolve(message);
    }
  };
  const onMessagesUpsert = (event) => {
    for (const rawMessage of event.messages ?? []) {
      const observed = normalizeObservedMessage(rawMessage, params.authDir);
      if (!observed) continue;
      if (observed.messageId) {
        rawByMessageId.set(observed.messageId, rawMessage);
        if (rawByMessageId.size > 300) {
          const first = rawByMessageId.keys().next().value;
          rawByMessageId.delete(first);
        }
      }
      observe(observed);
    }
  };
  const onConnectionUpdate = (event) => {
    if (event.receivedPendingNotifications === true) markPendingNotificationsReceived();
    if (event.connection === "close") closeSessionResources(createConnectionClosedError(event));
  };
  const removeMessageListener = () => {
    sock.ev?.off?.("messages.upsert", onMessagesUpsert);
    sock.ev?.off?.("connection.update", onConnectionUpdate);
  };
  const closeSessionResources = (waiterError) => {
    if (closed) return;
    closed = true;
    closedError = waiterError;
    for (const waiter of pendingNotificationsWaiters.slice()) {
      removePendingNotificationsWaiter(waiter);
      if (waiterError) waiter.reject(waiterError);
    }
    for (const waiter of waiters.slice()) {
      removeWaiter(waiter);
      if (waiterError) waiter.reject(waiterError);
    }
    removeMessageListener();
    closeSocket(sock);
  };

  sock.ev.on("messages.upsert", onMessagesUpsert);
  sock.ev.on("connection.update", onConnectionUpdate);

  try {
    await waitForWaConnection(sock, { timeoutMs: params.connectionTimeoutMs ?? 45e3 });
    if (params.waitForPendingNotifications) {
      await new Promise((resolve, reject) => {
        if (receivedPendingNotifications) {
          resolve();
          return;
        }
        if (closed) {
          reject(closedError ?? new Error("WhatsApp QA driver session closed"));
          return;
        }
        const timeoutMs = params.connectionTimeoutMs ?? 45e3;
        const waiter = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            removePendingNotificationsWaiter(waiter);
            reject(
              new Error(
                `timed out after ${timeoutMs}ms waiting for WhatsApp QA driver pending notifications`,
              ),
            );
          }, timeoutMs),
        };
        pendingNotificationsWaiters.push(waiter);
      });
    }
  } catch (error) {
    closeSessionResources(
      error instanceof Error ? error : new Error("failed starting WhatsApp QA driver session"),
    );
    throw error;
  }

  const sendApi = createWebSendApi({
    sock,
    defaultAccountId: "qa-driver",
    authDir: params.authDir,
  });

  return {
    async close() {
      closeSessionResources(new Error("WhatsApp QA driver session closed"));
    },
    getObservedMessages() {
      return [...observedMessages];
    },
    async sendContact(to, contact) {
      return { messageId: (await sendApi.sendContact(to, contact)).messageId };
    },
    async sendLocation(to, location) {
      return { messageId: (await sendApi.sendLocation(to, location)).messageId };
    },
    async sendMedia(to, text, mediaBuffer, mediaType, options) {
      return {
        messageId: (await sendApi.sendMessage(to, text, mediaBuffer, mediaType, options)).messageId,
      };
    },
    async sendPoll(to, poll) {
      return { messageId: (await sendApi.sendPoll(to, poll)).messageId };
    },
    async sendReaction(chatJid, messageId, emoji, options) {
      return {
        messageId: (
          await sendApi.sendReaction(chatJid, messageId, emoji, options.fromMe, options.participant)
        ).messageId,
      };
    },
    async sendSticker(to, stickerBuffer, options) {
      return { messageId: (await sendApi.sendSticker(to, stickerBuffer, options)).messageId };
    },
    async sendText(to, text, options) {
      return { messageId: (await sendApi.sendMessage(to, text, undefined, undefined, options)).messageId };
    },
    /**
     * Controlled image download for APSales media/VIN pipeline.
     * Returns metadata + local path. Never logs file bytes.
     */
    async downloadInboundImage(messageId, options = {}) {
      const id = String(messageId || "");
      if (!id) throw new Error("media_missing_message_id");
      const raw = rawByMessageId.get(id);
      if (!raw) throw new Error("media_raw_message_missing");
      const media = readMedia(raw.message);
      const mime = String(media?.mediaType || "").toLowerCase();
      if (!ALLOWED_IMAGE_MIME.has(mime) && media?.sectionName !== "imageMessage") {
        throw new Error(`media_unsupported_mime:${mime || "unknown"}`);
      }
      const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES;
      const mediaDir =
        options.mediaDir ||
        "/root/.openclaw/workspace/AsiaPower/memory/customer_gateway/whatsapp_inbound_media";
      const buffer = await downloadMediaMessage(
        raw,
        "buffer",
        {},
        {
          reuploadRequest: sock.updateMediaMessage,
          logger: sock.logger,
        },
      );
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("media_download_empty");
      if (buffer.length > maxBytes) throw new Error(`media_too_large:${buffer.length}`);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      const safeMime = ALLOWED_IMAGE_MIME.has(mime) ? mime : "image/jpeg";
      const filePath = path.join(mediaDir, `${id.replace(/[^\w.-]/g, "_")}.${extForMime(safeMime)}`);
      await writeBufferToFile(buffer, filePath);
      return {
        messageId: id,
        mimeType: safeMime,
        sizeBytes: buffer.length,
        sha256,
        path: filePath,
        mediaFileName: media?.fileName || null,
      };
    },
    async waitForMessage(paramsLocal) {
      const predicate = (message) =>
        (!paramsLocal.observedAfter ||
          new Date(message.observedAt).getTime() >= paramsLocal.observedAfter.getTime()) &&
        paramsLocal.match(message);
      const existing = observedMessages.find(predicate);
      if (existing) return existing;
      if (closed) throw closedError ?? new Error("WhatsApp QA driver session closed");
      return await new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timeout: setTimeout(() => {
            removeWaiter(waiter);
            reject(new Error("timed out waiting for WhatsApp QA driver message"));
          }, paramsLocal.timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
}
