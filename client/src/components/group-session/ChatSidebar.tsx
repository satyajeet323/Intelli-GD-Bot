import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import type { ChatMessage } from "./useGroupSession";

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatSidebar({ messages, onSend, onClose }: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full glass-strong border-l border-white/8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <h3 className="font-semibold text-sm">Live Chat</h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.isOwn === true;
          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {!isOwn && (
                <span className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.senderName}</span>
              )}
              <div
                className={[
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isOwn
                    ? "gradient-cosmic text-white rounded-br-sm"
                    : "glass border border-white/10 rounded-bl-sm",
                ].join(" ")}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                {isOwn ? "You" : msg.senderName} · {formatTime(msg.ts)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/8">
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="h-7 w-7 rounded-lg gradient-cosmic flex items-center justify-center disabled:opacity-40 transition hover:opacity-90"
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
