"use client";
import { useState } from "react";

interface VideoFacadeProps {
  videoId: string;
  title: string;
  width?: number;
  height?: number;
  className?: string;
}

export function VideoFacade({ videoId, title, width = 315, height = 560, className }: VideoFacadeProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        width={width}
        height={height}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ borderRadius: "12px" }}
        className={className}
      />
    );
  }

  return (
    <div
      style={{ width, height, borderRadius: "12px", overflow: "hidden", position: "relative", cursor: "pointer", display: "inline-block" }}
      className={className}
      onClick={() => setPlaying(true)}
      role="button"
      aria-label={`Play video: ${title}`}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt={title}
        width={width}
        height={height}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
