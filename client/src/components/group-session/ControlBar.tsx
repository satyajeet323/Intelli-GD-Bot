import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, PhoneOff, MessageSquare, Sparkles, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ConnectionStatus } from "./useGroupSession";

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  participantCount: number;
  status: ConnectionStatus;
  chatOpen: boolean;
  aiOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
  onToggleChat: () => void;
  onToggleAI: () => void;
  onLeave: () => void;
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, { color: string; label: string }> = {
    connecting: { color: "bg-warning animate-pulse", label: "Connecting…" },
    connected: { color: "bg-success", label: "Connected" },
    reconnecting: { color: "bg-warning animate-pulse", label: "Reconnecting…" },
    disconnected: { color: "bg-destructive", label: "Disconnected" },
  };
  const { color, label } = map[status];
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

interface CtrlBtnProps {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  label: string;
  children: React.ReactNode;
  badge?: string;
}

function CtrlBtn({ onClick, active, danger, label, children, badge }: CtrlBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={[
        "relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 transition-all hover:scale-105 active:scale-95",
        danger
          ? "bg-destructive/20 hover:bg-destructive/40 text-destructive border border-destructive/30"
          : active
          ? "glass border border-primary/40 text-foreground shadow-glow"
          : "glass border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {badge && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="h-5 w-5">{children}</span>
      <span className="text-[10px] font-medium hidden sm:block">{label}</span>
    </button>
  );
}

export function ControlBar({
  audioEnabled,
  videoEnabled,
  screenSharing,
  participantCount,
  status,
  chatOpen,
  aiOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleChat,
  onToggleAI,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="h-20 flex items-center justify-between px-4 sm:px-8 border-t border-white/8 bg-background/60 backdrop-blur-xl">
      {/* Left: status */}
      <div className="flex items-center gap-3 min-w-[120px]">
        <StatusDot status={status} />
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {participantCount}
        </div>
      </div>

      {/* Center: main controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <CtrlBtn onClick={onToggleAudio} active={audioEnabled} label={audioEnabled ? "Mute" : "Unmute"}>
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-destructive" />}
        </CtrlBtn>

        <CtrlBtn onClick={onToggleVideo} active={videoEnabled} label={videoEnabled ? "Stop video" : "Start video"}>
          {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-destructive" />}
        </CtrlBtn>

        <CtrlBtn onClick={onToggleScreen} active={screenSharing} label={screenSharing ? "Stop share" : "Share screen"}>
          {screenSharing ? <MonitorOff className="h-5 w-5 text-warning" /> : <MonitorUp className="h-5 w-5" />}
        </CtrlBtn>

        <button
          onClick={onLeave}
          className="flex flex-col items-center gap-1 rounded-2xl px-4 py-2.5 bg-destructive/90 hover:bg-destructive text-white transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_-4px_oklch(0.65_0.24_22/0.6)]"
        >
          <PhoneOff className="h-5 w-5" />
          <span className="text-[10px] font-medium hidden sm:block">Leave</span>
        </button>
      </div>

      {/* Right: panels */}
      <div className="flex items-center gap-2 min-w-[120px] justify-end">
        <CtrlBtn onClick={onToggleChat} active={chatOpen} label="Chat">
          <MessageSquare className="h-5 w-5" />
        </CtrlBtn>
        <CtrlBtn onClick={onToggleAI} active={aiOpen} label="AI">
          <Sparkles className="h-5 w-5" />
        </CtrlBtn>
      </div>
    </div>
  );
}
