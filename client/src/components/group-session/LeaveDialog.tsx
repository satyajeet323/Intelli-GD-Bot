import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface LeaveDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function LeaveDialog({
  onConfirm,
  onCancel,
  title = "Leave session?",
  description = "Your session is still in progress. Leaving now will end the discussion — you can view your partial report from History.",
  confirmLabel = "Leave",
  cancelLabel = "Keep going",
}: LeaveDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in p-4"
      onClick={onCancel}
    >
      <div
        className="animate-scale-in glass-strong rounded-3xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl glass border border-white/10 py-2.5 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-destructive/90 hover:bg-destructive text-white py-2.5 text-sm font-semibold transition shadow-[0_0_20px_-4px_oklch(0.65_0.24_22/0.5)]"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
