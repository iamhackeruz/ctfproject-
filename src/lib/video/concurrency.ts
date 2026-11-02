/**
 * Video oqimlari (Streaming) yuklamasi va bir vaqtning o'zidagi cheklovlarni (Concurrency) boshqarish.
 * Qoida: Bitta foydalanuvchi bir vaqtda maksimal 2 ta oqim (stream) ochishi mumkin.
 * Akkaunt ulashish (account sharing) va server resurslarini suiiste'mol qilishning oldini oladi.
 */

interface ActiveStreamSession {
  streamSessionId: string;
  lessonId: string;
  lastActive: number;
}

// userId -> Map<streamSessionId, ActiveStreamSession>
const userStreamsMap = new Map<string, Map<string, ActiveStreamSession>>();

export const MAX_CONCURRENT_STREAMS = 2;
export const STREAM_INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 soniya faoliyatsizlikdan keyin sessiya avtomatik bo'shatiladi

/**
 * Muddati o'tgan (inaktiv) oqim sessiyalarini tozalash (60 soniya faolsizlik)
 */
function pruneStaleStreams(userId: string, now = Date.now()): Map<string, ActiveStreamSession> {
  let streams = userStreamsMap.get(userId);
  if (!streams) {
    streams = new Map();
    userStreamsMap.set(userId, streams);
    return streams;
  }

  for (const [sId, session] of Array.from(streams.entries())) {
    if (now - session.lastActive >= STREAM_INACTIVITY_TIMEOUT_MS) {
      streams.delete(sId);
    }
  }

  if (streams.size === 0) {
    userStreamsMap.delete(userId);
    streams = new Map();
    userStreamsMap.set(userId, streams);
  }

  return streams;
}

export interface AcquireResult {
  allowed: boolean;
  activeCount: number;
  message?: string;
}

/**
 * Foydalanuvchi uchun video oqimi slotini band qilish yoki yangilash.
 * Bir xil streamSessionId kelganda faollik vaqti (lastActive) yangilanadi (Range so'rovlari uchun).
 * 60 soniya faolsizlikdan so'ng eski slotlar avtomatik bo'shatiladi.
 */
export function acquireStreamSlot(
  userId: string,
  streamSessionId: string,
  lessonId: string,
  now = Date.now()
): AcquireResult {
  const streams = pruneStaleStreams(userId, now);

  // Agar bu streamSessionId avvaldan ro'yxatdan o'tgan bo'lsa (masalan, navbatdagi Range 206 so'rovi)
  if (streams.has(streamSessionId)) {
    const existing = streams.get(streamSessionId)!;
    existing.lastActive = now;
    existing.lessonId = lessonId;
    return {
      allowed: true,
      activeCount: streams.size,
    };
  }

  // Yangi stream ochilayotgan bo'lsa va limitga yetgan bo'lsa
  if (streams.size >= MAX_CONCURRENT_STREAMS) {
    return {
      allowed: false,
      activeCount: streams.size,
      message:
        "Bir vaqtning o'zida maksimal 2 ta video oqimi ochilishi mumkin. Iltimos, boshqa qurilma yoki oynadagi videoni to'xtating.",
    };
  }

  // Yangi slot band qilish
  streams.set(streamSessionId, {
    streamSessionId,
    lessonId,
    lastActive: now,
  });

  return {
    allowed: true,
    activeCount: streams.size,
  };
}

/**
 * Video oqimi to'xtatilganda yoki oyna yopilganda slotni bo'shatish
 */
export function releaseStreamSlot(userId: string, streamSessionId: string): void {
  const streams = userStreamsMap.get(userId);
  if (streams) {
    streams.delete(streamSessionId);
    if (streams.size === 0) {
      userStreamsMap.delete(userId);
    }
  }
}

/**
 * Foydalanuvchining ayni paytdagi faol oqimlari sonini olish
 */
export function getActiveStreamCount(userId: string): number {
  const streams = pruneStaleStreams(userId);
  return streams.size;
}

/**
 * Testlar uchun barcha faol sessiyalarni tozalash
 */
export function resetAllStreamSlotsForTest(): void {
  userStreamsMap.clear();
}
