/**
 * api.ts — Centralised API client for the INTELLI BOT backend.
 *
 * All requests go to VITE_SERVER_URL (default http://localhost:4000).
 * The Vite dev server also proxies /api → localhost:4000 as a fallback.
 */

const BASE_URL = (import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/$/, "");
const TOKEN_KEY = "gdbot_token";

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

type ApiOptions = {
  method?:  "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?:    unknown;
  auth?:    boolean;   // default true — attach token if present
  timeout?: number;    // ms, default 15000
};

export class ApiError extends Error {
  status: number;
  data:   unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
    this.data   = data;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true, timeout = 15000 } = options;

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body:   body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    window.clearTimeout(timer);

    // Handle 401 — clear token and redirect
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login";
      throw new ApiError("Session expired. Please log in again.", 401);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        (data as { message?: string }).message ?? `Request failed (${res.status})`,
        res.status,
        data
      );
    }

    return data as T;
  } catch (err) {
    window.clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Request timed out. Check your connection.", 408);
    }
    throw new ApiError(
      (err as Error).message ?? "Network error",
      0
    );
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type User = {
  _id:       string;
  name:      string;
  email:     string;
  plan:      "free" | "pro";
  role?:     "user" | "admin";
  avatar:    string;
  createdAt: string;
  isAdmin?:  boolean;
  preferences?: {
    micEnabled:        boolean;
    noiseSuppression:  boolean;
    echoCancellation:  boolean;
    practiceReminders: boolean;
    sessionSummary:    boolean;
    weeklyReport:      boolean;
    aiPersona:         "friendly" | "critical" | "devils-advocate" | "neutral";
  };
};

export type AuthResponse = { success: boolean; token: string; user: User };

export const auth = {
  register: (name: string, email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body:   { name, email, password },
      auth:   false,
    }).then((res) => { setToken(res.token); return res; }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body:   { email, password },
      auth:   false,
    }).then((res) => { setToken(res.token); return res; }),

  me: () =>
    apiFetch<{ success: boolean; user: User }>("/api/auth/me"),

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    apiFetch<{ success: boolean; user: User }>("/api/auth/profile", {
      method: "PATCH",
      body:   data,
    }),

  updatePreferences: (prefs: Partial<NonNullable<User["preferences"]>>) =>
    apiFetch<{ success: boolean; preferences: NonNullable<User["preferences"]> }>(
      "/api/auth/preferences",
      { method: "PATCH", body: prefs }
    ),

  logout: () => {
    clearToken();
    // Dynamically import to avoid circular dependency
    import("@/lib/useCurrentUser").then(({ clearUserCache }) => clearUserCache());
    window.location.href = "/login";
  },
};

// ── Topics ────────────────────────────────────────────────────────────────────

export type TopicResult = {
  success:  boolean;
  topic:    string;
  source:   "gemini" | "local";
  category: string;
};

export const topics = {
  generate: (category?: string) =>
    apiFetch<TopicResult>(
      `/api/topics/generate${category ? `?category=${encodeURIComponent(category)}` : ""}`,
      { auth: false }
    ),

  categories: () =>
    apiFetch<{ success: boolean; categories: string[] }>("/api/topics/categories", { auth: false }),

  byCategory: (name: string) =>
    apiFetch<{ success: boolean; category: string; topics: string[] }>(
      `/api/topics/category/${encodeURIComponent(name)}`,
      { auth: false }
    ),
};

// ── Sessions ──────────────────────────────────────────────────────────────────

export type SessionSummary = {
  sessionId:        string;
  type:             "individual" | "group";
  topic:            string;
  topicSource:      "gemini" | "local";
  status:           "waiting" | "active" | "ended";
  maxParticipants:  number;
  participantCount: number;
  startedAt:        string;
};

export const sessions = {
  create: (opts?: { type?: "individual" | "group"; maxParticipants?: number; topic?: string }) =>
    apiFetch<{ success: boolean; session: SessionSummary }>("/api/sessions", {
      method: "POST",
      body:   opts ?? {},
    }),

  list: () =>
    apiFetch<{ success: boolean; sessions: SessionSummary[] }>("/api/sessions"),

  get: (id: string) =>
    apiFetch<{ success: boolean; session: SessionSummary & { participants: unknown[] } }>(
      `/api/sessions/${id}`
    ),

  validate: (id: string) =>
    apiFetch<{ success: boolean; valid: boolean }>(`/api/sessions/${id}/validate`, { auth: false }),

  join: (id: string) =>
    apiFetch<{ success: boolean; message: string; session: SessionSummary; alreadyJoined?: boolean }>(
      `/api/sessions/${id}/join`,
      { method: "POST" }
    ),

  leave: (id: string) =>
    apiFetch<{ success: boolean; message: string; remainingParticipants: number }>(
      `/api/sessions/${id}/leave`,
      { method: "POST" }
    ),

  end: (id: string) =>
    apiFetch<{ success: boolean; session: { sessionId: string; status: string; duration: number } }>(
      `/api/sessions/${id}/end`,
      { method: "POST" }
    ),

  participants: (id: string) =>
    apiFetch<{ success: boolean; total: number; active: number; participants: unknown[] }>(
      `/api/sessions/${id}/participants`,
      { auth: false }
    ),
};

// ── Chat (AI discussion partner) ──────────────────────────────────────────────

export type TurnScore = {
  fluency:      number;
  relevance:    number;
  confidence:   number;
  fillerWords:  number;
  overallScore: number;
  feedback:     string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const chat = {
  send: (topic: string, messages: ChatMessage[]) =>
    apiFetch<{ reply: string; scores: TurnScore | null }>("/api/chat/gd", {
      method: "POST",
      body:   { topic, messages },
      auth:   false, // chat works without login too
    }),
};

// ── Reports ───────────────────────────────────────────────────────────────────

export type Report = {
  fluency:       number;
  relevance:     number;
  confidence:    number;
  fillerWords:   number;
  turns:         number;
  overallScore:  number;
  feedback:      string;
  aiFeedback:    string;
  // Peer rating aggregates — null until peer ratings are submitted
  peerScore:     number | null;
  peerFeedback:  string;
  combinedScore: number | null;
};

export const reports = {
  submit: (sessionId: string, report: Omit<Report, "overallScore">) =>
    apiFetch<{ success: boolean; report: Report }>(`/api/reports/${sessionId}`, {
      method: "POST",
      body:   report,
    }),

  recordTurn: (sessionId: string, data: { text?: string; fluency?: number; relevance?: number; confidence?: number }) =>
    apiFetch<{ success: boolean; turnNumber: number; runningReport: Report }>(
      `/api/reports/${sessionId}/turn`,
      { method: "PATCH", body: data }
    ),

  get: (sessionId: string) =>
    apiFetch<{ success: boolean; session: unknown }>(`/api/reports/${sessionId}`, { auth: false }),

  me: (sessionId: string) =>
    apiFetch<{ success: boolean; report: Report & { autoFeedback: string } }>(
      `/api/reports/${sessionId}/me`
    ),

  summary: (sessionId: string) =>
    apiFetch<{ success: boolean; summary: unknown }>(`/api/reports/${sessionId}/summary`, { auth: false }),

  leaderboard: (sessionId: string) =>
    apiFetch<{ success: boolean; leaderboard: unknown[] }>(`/api/reports/${sessionId}/leaderboard`, { auth: false }),
};

// ── Peer Ratings ──────────────────────────────────────────────────────────────

export type PeerRatingInput = {
  rateeId:       string;
  communication: number; // 1–5
  relevance:     number; // 1–5
  confidence:    number; // 1–5
  clarity:       number; // 1–5
  comment?:      string;
};

export type PeerAggregate = {
  peerScore:     number;
  communication: number;
  relevance:     number;
  confidence:    number;
  clarity:       number;
  raterCount:    number;
  peerFeedback:  string;
  comments:      string[];
};

export type PeerRatingStatus = {
  success:             boolean;
  sessionId:           string;
  status:              string;
  totalParticipants:   number;
  submitterCount:      number;
  hasSubmitted:        boolean;
  pendingParticipants: string[];
  allSubmitted:        boolean;
};

export type PeerParticipantSummary = {
  userId:        string;
  name:          string;
  isMe:          boolean;
  peerScore:     number | null;
  combinedScore: number | null;
  raterCount:    number;
  breakdown: {
    communication: number;
    relevance:     number;
    confidence:    number;
    clarity:       number;
  } | null;
};

export const peerRatings = {
  submit: (sessionId: string, ratings: PeerRatingInput[]) =>
    apiFetch<{ success: boolean; message: string; submitted: number }>(
      `/api/peer-ratings/${sessionId}`,
      { method: "POST", body: { ratings } }
    ),

  status: (sessionId: string) =>
    apiFetch<PeerRatingStatus>(`/api/peer-ratings/${sessionId}/status`),

  mine: (sessionId: string) =>
    apiFetch<{
      success:     boolean;
      sessionId:   string;
      hasSubmitted:boolean;
      received: {
        count:         number;
        aggregate:     PeerAggregate | null;
        peerScore:     number | null;
        peerFeedback:  string;
        combinedScore: number | null;
      };
    }>(`/api/peer-ratings/${sessionId}`),

  summary: (sessionId: string) =>
    apiFetch<{
      success:           boolean;
      sessionId:         string;
      topic:             string;
      totalParticipants: number;
      submitterCount:    number;
      participants:      PeerParticipantSummary[];
    }>(`/api/peer-ratings/${sessionId}/summary`),
};

export type HistoryEntry = {
  sessionId:         string;
  type:              "individual" | "group";
  topic:             string;
  date:              string;
  duration:          number;
  durationFormatted: string;
  participantCount:  number;
  myReport:          Report | null;
};

export type HistoryFilters = {
  page?:   number;
  limit?:  number;
  sort?:   "newest" | "oldest" | "score_high" | "score_low" | "duration_long" | "duration_short";
  status?: "ended" | "active" | "all";
  type?:   "individual" | "group" | "all";
  from?:   string;
  to?:     string;
};

export const history = {
  list: (filters: HistoryFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return apiFetch<{ success: boolean; sessions: HistoryEntry[]; pagination: unknown }>(
      `/api/history${qs ? `?${qs}` : ""}`
    );
  },

  stats: () =>
    apiFetch<{ success: boolean; stats: unknown }>("/api/history/stats"),

  search: (q: string) =>
    apiFetch<{ success: boolean; results: HistoryEntry[] }>(
      `/api/history/search?q=${encodeURIComponent(q)}`
    ),

  get: (id: string) =>
    apiFetch<{ success: boolean; session: unknown }>(`/api/history/${id}`),

  remove: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/history/${id}`, { method: "DELETE" }),
};

// ── Fluency (English Fluency Session) ─────────────────────────────────────────

export type FluencyUploadResult = {
  transcript: string;
  prosody: {
    duration_sec:          number;
    speech_rate_wpm:       number;
    syllable_nuclei_count: number;
    nPVI:                  number | null;
    pause_ratio:           number;
    total_pause_s:         number;
    fillers:               number;
    relevance_score?:      number;
  };
  timings?: { total_time_sec: number; transcription_sec: number };
  error?: string;
};

export type FluencyScoreResult = {
  score?: {
    vocabulary_score:           number;
    grammar_score:              number;
    sentence_correctness_score: number;
    coherence_score:            number;
    clarity_score:              number;
    relevance_score:            number;
    grammatical_mistake:        string;
    improvement_needed:         string;
    speech_rate_score:          number;
    pause_time_score:           number;
    pitch_variability_score:    number;
    rhythm_variability_score:   number;
    fillers_score:              number;
  };
  status?: string;
  reason?: string;
  message?: string;
  error?: string;
};

export const fluency = {
  /** Generate a discussion topic from the Python backend. */
  topic: () =>
    apiFetch<{ topic?: string; error?: string }>("/api/fluency/topic", { auth: false }),

  /**
   * Upload a recorded audio blob for transcription + prosody analysis.
   * @param blob     - The audio Blob from MediaRecorder
   * @param ext      - File extension hint ("webm" | "ogg")
   * @param onProgress - Optional upload progress callback (0–100)
   */
  upload: (
    blob: Blob,
    ext: string = "webm",
    onProgress?: (pct: number) => void
  ): Promise<FluencyUploadResult> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/api/fluency/upload`);

      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          clearToken();
          window.location.href = "/login";
          reject(new ApiError("Session expired.", 401));
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText) as FluencyUploadResult;
          resolve(data);
        } catch {
          reject(new ApiError("Invalid response from server.", xhr.status));
        }
      };

      xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection.", 0));
      xhr.ontimeout = () => reject(new ApiError("Upload timed out.", 408));
      xhr.timeout = 120_000; // 2 minutes for large audio files

      xhr.send(formData);
    });
  },

  /**
   * Score a transcript using Gemini + prosody metrics.
   */
  score: (
    transcript: string,
    topic: string,
    prosody: FluencyUploadResult["prosody"]
  ) =>
    apiFetch<FluencyScoreResult>("/api/fluency/score", {
      method:  "POST",
      body:    { transcript, topic, prosody },
      timeout: 60_000,
    }),

  /** Check if the Python analysis server is reachable. */
  health: () =>
    apiFetch<{ online: boolean; message?: string }>("/api/fluency/health", {
      auth:    false,
      timeout: 5_000,
    }),
};

// ── User Notifications ────────────────────────────────────────────────────────

export type UserNotification = {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isBanner: boolean;
  isDismissible: boolean;
  actionUrl: string;
  actionLabel: string;
  isRead: boolean;
  isDismissed: boolean;
  readAt: string | null;
  deliveredAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export const notifications = {
  list: (params: { page?: number; limit?: number; unread?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.page)   qs.set("page",   String(params.page));
    if (params.limit)  qs.set("limit",  String(params.limit));
    if (params.unread) qs.set("unread", "true");
    const q = qs.toString();
    return apiFetch<{
      success: boolean;
      notifications: UserNotification[];
      unreadCount: number;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/api/notifications${q ? `?${q}` : ""}`);
  },

  unreadCount: () =>
    apiFetch<{ success: boolean; unreadCount: number }>("/api/notifications/unread-count"),

  markRead: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "POST" }),

  markAllRead: () =>
    apiFetch<{ success: boolean; count: number }>("/api/notifications/read-all", { method: "POST" }),

  dismiss: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/${id}/dismiss`, { method: "POST" }),

  clearAll: () =>
    apiFetch<{ success: boolean }>("/api/notifications/clear", { method: "DELETE" }),
};
