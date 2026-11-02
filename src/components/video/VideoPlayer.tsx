"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface VideoPlayerProps {
  lessonId: number;
  lessonTitle: string;
  user?: { name: string; email: string };
  onCompleted?: () => void;
}

export default function VideoPlayer({
  lessonId,
  user,
  onCompleted,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [streamSessionId] = useState(() => {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(user || null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  // Dinamik harakatlanuvchi Watermark koordinatalari (ekran yozishdan himoya)
  const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "15%" });

  // 1. Dars bo'yicha video mavjudligini va foydalanuvchi ma'lumotlarini yuklash
  useEffect(() => {
    let isMounted = true;

    fetch(`/api/videos/${lessonId}/meta`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("Iltimos, video ko'rish uchun tizimga kiring.");
          if (res.status === 403) throw new Error("Ushbu dars videosini ko'rish uchun ruxsat berilmagan.");
          if (res.status === 404) return { success: true, hasVideo: false };
          throw new Error("Video ma'lumotlarini yuklab bo'lmadi.");
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.hasVideo) {
          setHasVideo(true);
          if (data.user) setUserInfo(data.user);
        } else {
          setHasVideo(false);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lessonId]);

  // 2. To'xtagan joydan davom ettirish (Resume from last position)
  useEffect(() => {
    if (!hasVideo || !videoRef.current) return;

    fetch(`/api/videos/${lessonId}/progress`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data.progress?.positionSec > 3 && videoRef.current) {
          const pos = data.progress.positionSec;
          videoRef.current.currentTime = pos;
          const mins = Math.floor(pos / 60);
          const secs = Math.floor(pos % 60);
          const formatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
          setResumeNotice(`Avvalgi to'xtagan joyingizdan davom etildi (${formatted})`);
          setTimeout(() => setResumeNotice(null), 4000);
        }
      })
      .catch(() => {});
  }, [hasVideo, lessonId]);

  // 3. Dinamik Watermark o'rnini har 14 soniyada tasodifiy o'zgartirish
  useEffect(() => {
    const interval = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 65 + 10); // 10% dan 75% gacha
      const randomLeft = Math.floor(Math.random() * 60 + 10); // 10% dan 70% gacha
      setWatermarkPos({ top: `${randomTop}%`, left: `${randomLeft}%` });
    }, 14000);

    return () => clearInterval(interval);
  }, []);

  // 4. Progressni vaqti-vaqti bilan serverga saqlash (Har 5 soniyada yoki pauzada)
  const saveProgress = useCallback(
    (pos: number, isFinished = false) => {
      if (!hasVideo || pos <= 0) return;
      fetch(`/api/videos/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionSec: Math.floor(pos),
          completed: isFinished,
        }),
      }).catch(() => {});
    },
    [hasVideo, lessonId]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, saveProgress]);

  // 5. Oyna yopilganda yoki unmount bo'lganda stream slotini ozod qilish
  useEffect(() => {
    const handleUnload = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/videos/${lessonId}/stream/release?streamSessionId=${streamSessionId}`
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [lessonId, streamSessionId]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        if (err.name !== "AbortError") {
          setError("Videoni ijro etishda xatolik yuz berdi.");
        }
      });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      saveProgress(videoRef.current.currentTime, false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      saveProgress(newTime, false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowCompletePrompt(true);
    saveProgress(duration, true);
    if (onCompleted) {
      onCompleted();
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#090d16",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: "0.95rem",
          border: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="spinner" style={{ width: 22, height: 22, border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span>Video dars yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#180a0a",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#f87171",
          padding: 24,
          border: "1px solid #7f1d1d",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "2rem", marginBottom: 8 }}>🔒</span>
        <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Video Mavjud Emas yoki Ruxsat Yo&apos;q</h4>
        <p style={{ fontSize: "0.85rem", color: "#fca5a5", maxWidth: 440 }}>{error}</p>
      </div>
    );
  }

  if (!hasVideo) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "linear-gradient(135deg, #090d16 0%, #0f172a 100%)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          padding: 24,
          border: "1px dashed #334155",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "2.5rem", marginBottom: 10 }}>📖</span>
        <h4 style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
          Ushbu dars uchun video darslik tez kunda joylanadi
        </h4>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", maxWidth: 460 }}>
          Dars konspekti va amaliy laboratoriya orqali o&apos;rganishni davom ettirishingiz mumkin.
        </p>
      </div>
    );
  }

  const streamSrc = `/api/videos/${lessonId}/stream?streamSessionId=${streamSessionId}`;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        border: "1px solid #1e293b",
      }}
    >
      {/* Asosiy Video elementi */}
      <video
        ref={videoRef}
        src={streamSrc}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "pointer",
        }}
      />

      {/* Dinamik Harakatlanuvchi Watermark Overlay (Ekran yozish va sizishdan himoya) */}
      {userInfo && (
        <div
          data-testid="video-watermark"
          style={{
            position: "absolute",
            top: watermarkPos.top,
            left: watermarkPos.left,
            pointerEvents: "none",
            userSelect: "none",
            opacity: 0.35,
            color: "#ffffff",
            fontSize: "0.82rem",
            fontWeight: 700,
            textShadow: "0 0 4px #000, 1px 1px 2px #000",
            transition: "top 2s ease-in-out, left 2s ease-in-out",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0, 0, 0, 0.25)",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          <span>🛡️</span>
          <span>
            {userInfo.name} ({userInfo.email})
          </span>
        </div>
      )}

      {/* Avvalgi to'xtagan joydan davom etish bildirishnomasi */}
      {resumeNotice && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid #38bdf8",
            color: "#38bdf8",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: "0.8rem",
            fontWeight: 600,
            zIndex: 15,
            backdropFilter: "blur(4px)",
          }}
        >
          ⏱️ {resumeNotice}
        </div>
      )}

      {/* Video tugaganda darsni yakunlangan deb belgilash taklifi */}
      {showCompletePrompt && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 25,
            padding: 24,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</span>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            Tabriklaymiz! Video darsni yakunladingiz
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", maxWidth: 400, marginBottom: 18 }}>
            Ushbu dars bo&apos;yicha videoni to&apos;liq ko&apos;rib chiqdingiz. Konspekt bilan tanishing yoki testni topshiring!
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setShowCompletePrompt(false);
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play();
                }
              }}
              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
            >
              🔄 Qayta ko&apos;rish
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCompletePrompt(false)}
              style={{ fontSize: "0.82rem", padding: "6px 16px" }}
            >
              ✅ Davom etish
            </button>
          </div>
        </div>
      )}

      {/* Maxsus Video Boshqaruv Paneli (Controls Bar) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          padding: "16px 14px 10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 20,
        }}
      >
        {/* Seek ProgressBar */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: "100%",
            height: 4,
            accentColor: "#38bdf8",
            cursor: "pointer",
          }}
        />

        {/* Buttons Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={togglePlay}
              data-testid="video-play-toggle"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "4px 6px",
              }}
              title={isPlaying ? "To'xtatish" : "Ijro etish"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <span style={{ fontSize: "0.8rem", color: "#cbd5e1", fontFamily: "monospace" }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Tezlik tanlash (Speed selector: 0.75x, 1x, 1.25x, 1.5x, 2x) */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  data-testid={`video-speed-${speed}`}
                  onClick={() => handleSpeedChange(speed)}
                  style={{
                    background: playbackRate === speed ? "#38bdf8" : "rgba(255,255,255,0.1)",
                    color: playbackRate === speed ? "#000" : "#cbd5e1",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* To'liq ekran (Fullscreen toggle) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                background: "transparent",
                border: "none",
                color: "#cbd5e1",
                fontSize: "1.05rem",
                cursor: "pointer",
                padding: "4px 6px",
              }}
              title={isFullscreen ? "Kichraytirish" : "To'liq ekran"}
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
