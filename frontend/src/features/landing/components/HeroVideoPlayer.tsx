"use client";

import { useEffect, useRef } from "react";
import { LANDING_CONFIG } from "../config/landing.config";

export function HeroVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.debug("Video autoplay hint:", err);
      });
    }
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
      >
        <source src={LANDING_CONFIG.hero.videoSrc} type="video/mp4" />
      </video>

      {/* Gradient overlay tự nhiên chuẩn HTML demo: Sáng rõ ở giữa, chuyển dần sang trắng ở đáy */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/15 to-black/65"></div>
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/50 to-transparent"></div>
    </div>
  );
}
