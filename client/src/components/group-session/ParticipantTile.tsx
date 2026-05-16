import { useEffect, useRef, useCallback } from "react";
import { MicOff, VideoOff } from "lucide-react";
import type { Participant } from "./useGroupSession";

interface ParticipantTileProps {
  participant: Participant;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const AVATAR_COLORS = [
  "from-primary/60 to-violet/40",
  "from-cyan/60 to-accent/40",
  "from-success/60 to-cyan/40",
  "from-warning/60 to-destructive/40",
  "from-violet/60 to-primary/40",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ParticipantTile({ participant, isActive, size = "md", onClick }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (participant.stream) {
      // Only reassign if the stream actually changed to avoid flickering
      if (video.srcObject !== participant.stream) {
        video.srcObject = participant.stream;
        // Ensure playback starts — autoPlay may not fire after srcObject change
        video.play().catch(() => {});
      }
    } else {
      video.srcObject = null;
    }
  }, [participant.stream]);

  const hasVideo = participant.videoEnabled && !!participant.stream;

  // Callback ref: fires when the <video> element is inserted into the DOM.
  // Handles the race where the stream arrives before the element mounts.
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && participant.stream && el.srcObject !== participant.stream) {
      el.srcObject = participant.stream;
      el.play().catch(() => {});
    }
  }, [participant.stream]);

  return (
    <div
      onClick={onClick}
      className={[
        "relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer select-none",
        "bg-gradient-to-br from-white/5 to-white/[0.02]",
        "w-full h-full flex items-center justify-center",
        isActive
          ? "ring-2 ring-primary shadow-glow"
          : "ring-1 ring-white/10 hover:ring-primary/40 hover:shadow-glow",
        participant.isSpeaking && !isActive ? "ring-2 ring-success/70" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: size === "lg" ? "300px" : size === "sm" ? "150px" : "200px",
        aspectRatio: "16 / 9",
      }}
    >
      {/* Video */}
      {hasVideo ? (
        <video
          ref={setVideoRef}
          autoPlay
          muted={participant.isLocal}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`rounded-full bg-gradient-to-br ${getAvatarColor(participant.id)} flex items-center justify-center font-display font-bold text-white shadow-glow ${
              size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-10 w-10 text-sm" : "h-14 w-14 text-lg"
            }`}
          >
            {getInitials(participant.name)}
          </div>
        </div>
      )}

      {/* Speaking ring */}
      {participant.isSpeaking && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-success/80 animate-pulse pointer-events-none" />
      )}

      {/* Name + status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-xs font-medium text-white truncate max-w-[70%]">
          {participant.name}
          {participant.isLocal && (
            <span className="ml-1 text-[10px] text-white/60">(You)</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {!participant.audioEnabled && (
            <span className="h-5 w-5 rounded-full bg-destructive/80 flex items-center justify-center">
              <MicOff className="h-2.5 w-2.5 text-white" />
            </span>
          )}
          {!participant.videoEnabled && (
            <span className="h-5 w-5 rounded-full bg-black/60 flex items-center justify-center">
              <VideoOff className="h-2.5 w-2.5 text-white/70" />
            </span>
          )}
        </div>
      </div>

      {/* Active speaker label */}
      {isActive && (
        <div className="absolute top-2 left-2 rounded-full bg-primary/80 px-2 py-0.5 text-[10px] font-semibold text-white">
          Speaking
        </div>
      )}
    </div>
  );
}
