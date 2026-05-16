# System Architecture - Group Discussion Video Conferencing

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSERS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   User A     │  │   User B     │  │   User C     │              │
│  │  (Chrome)    │  │  (Firefox)   │  │  (Safari)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         │ WebRTC (P2P)    │                  │                       │
│         ├─────────────────┼──────────────────┤                       │
│         │                  │                  │                       │
│         │ Socket.IO        │ Socket.IO        │ Socket.IO            │
│         │ (Signaling)      │ (Signaling)      │ (Signaling)          │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js)                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Socket.IO Server                            │  │
│  │  • WebSocket connections                                       │  │
│  │  • Signaling relay (offer/answer/ICE)                         │  │
│  │  • Room management                                             │  │
│  │  • Participant tracking                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                        │
│  ┌───────────────────────────┼────────────────────────────────────┐ │
│  │  In-Memory Session Store  │  Express REST API                  │ │
│  │  • Active sessions        │  • Session CRUD                    │ │
│  │  • Live participants      │  • User management                 │ │
│  │  • Real-time state        │  • History queries                 │ │
│  └───────────────────────────┴────────────────────────────────────┘ │
│                              │                                        │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   MongoDB Database   │
                    │  • Session history   │
                    │  • User profiles     │
                    │  • Chat logs         │
                    │  • Ratings           │
                    └──────────────────────┘
```

## WebRTC Mesh Topology

In a mesh topology, each participant connects directly to every other participant:

```
3 Participants = 3 connections total

    User A
    /    \
   /      \
User B ─── User C

User A: 2 connections (to B and C)
User B: 2 connections (to A and C)
User C: 2 connections (to A and B)
```

```
4 Participants = 6 connections total

    User A ─────── User B
     │  \         /  │
     │   \       /   │
     │    \     /    │
     │     \   /     │
     │      \ /      │
    User D ─────── User C

Each user: 3 connections
Total: 4 × 3 ÷ 2 = 6 connections
```

**Formula**: For N participants, total connections = N × (N-1) ÷ 2

**Scalability**:
- 2 users: 1 connection
- 4 users: 6 connections
- 6 users: 15 connections
- 8 users: 28 connections
- 10 users: 45 connections

**Note**: Mesh topology works well for small groups (2-8 participants). For larger groups, consider SFU (Selective Forwarding Unit) architecture.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  group-session_.$sessionId.tsx (Main Room Page)             │   │
│  │  • Responsive grid layout                                    │   │
│  │  • Participant rendering                                     │   │
│  │  • Control bar integration                                   │   │
│  │  • Chat/AI panel management                                  │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────┴────────────────────────────────────┐   │
│  │  useGroupSession Hook (WebRTC Logic)                        │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  State Management                                     │  │   │
│  │  │  • participants[]                                     │  │   │
│  │  │  • chatMessages[]                                     │  │   │
│  │  │  • status (connecting/connected/disconnected)         │  │   │
│  │  │  • audioEnabled, videoEnabled, screenSharing          │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Media Management                                     │  │   │
│  │  │  • localStreamRef (camera/microphone)                 │  │   │
│  │  │  • screenStreamRef (screen share)                     │  │   │
│  │  │  • Speaking detection (Web Audio API)                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  WebRTC Management                                    │  │   │
│  │  │  • peersRef: Map<socketId, RTCPeerConnection>        │  │   │
│  │  │  • icePendingRef: Map<socketId, ICECandidate[]>      │  │   │
│  │  │  • createPeer()                                       │  │   │
│  │  │  • flushPendingIce()                                  │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Socket.IO Client                                     │  │   │
│  │  │  • socketRef                                          │  │   │
│  │  │  • Event handlers (join, offer, answer, ice, etc.)   │  │   │
│  │  │  • Reconnection logic                                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────┴────────────────────────────────────┐   │
│  │  ParticipantTile Component                                  │   │
│  │  • Video element with stream                                │   │
│  │  • Avatar fallback                                          │   │
│  │  • Mute indicators                                          │   │
│  │  • Speaking indicator                                       │   │
│  │  • Responsive sizing                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Session Join Flow

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ User A  │                │ Server  │                │ User B  │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. getUserMedia()        │                          │
     ├─────────────────────────►│                          │
     │ 2. connect Socket.IO     │                          │
     ├─────────────────────────►│                          │
     │ 3. join-session          │                          │
     ├─────────────────────────►│                          │
     │ 4. session-joined        │                          │
     │    (peers: [])           │                          │
     │◄─────────────────────────┤                          │
     │                          │                          │
     │                          │ 5. getUserMedia()        │
     │                          │◄─────────────────────────┤
     │                          │ 6. connect Socket.IO     │
     │                          │◄─────────────────────────┤
     │                          │ 7. join-session          │
     │                          │◄─────────────────────────┤
     │ 8. peer-joined           │                          │
     │    (participant: B)      │                          │
     │◄─────────────────────────┤                          │
     │                          │ 9. session-joined        │
     │                          │    (peers: [A])          │
     │                          ├─────────────────────────►│
     │ 10. room-roster          │ 11. room-roster          │
     │     (participants: [A,B])│     (participants: [A,B])│
     │◄─────────────────────────┼─────────────────────────►│
     │                          │                          │
```

### 2. WebRTC Connection Flow

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ User A  │                │ Server  │                │ User B  │
│(Joiner) │                │(Relay)  │                │(Existing)│
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. Create PeerConnection │                          │
     │    for User B            │                          │
     ├──────────────────────────┤                          │
     │ 2. Add local tracks      │                          │
     ├──────────────────────────┤                          │
     │ 3. Create offer          │                          │
     ├──────────────────────────┤                          │
     │ 4. webrtc-offer          │                          │
     ├─────────────────────────►│                          │
     │                          │ 5. webrtc-offer          │
     │                          ├─────────────────────────►│
     │                          │ 6. Create PeerConnection │
     │                          │    for User A            │
     │                          │◄─────────────────────────┤
     │                          │ 7. Set remote description│
     │                          │◄─────────────────────────┤
     │                          │ 8. Create answer         │
     │                          │◄─────────────────────────┤
     │                          │ 9. webrtc-answer         │
     │                          │◄─────────────────────────┤
     │ 10. webrtc-answer        │                          │
     │◄─────────────────────────┤                          │
     │ 11. Set remote description│                         │
     ├──────────────────────────┤                          │
     │                          │                          │
     │ 12. ICE candidates       │ 13. ICE candidates       │
     ├─────────────────────────►├─────────────────────────►│
     │◄─────────────────────────┤◄─────────────────────────┤
     │                          │                          │
     │ 14. Connection established (P2P)                    │
     ├─────────────────────────────────────────────────────┤
     │                          │                          │
     │ 15. ontrack event        │ 16. ontrack event        │
     │     (receive B's stream) │     (receive A's stream) │
     ├──────────────────────────┤◄─────────────────────────┤
     │                          │                          │
```

### 3. State Update Flow

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ User A  │                │ Server  │                │ User B  │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. Click mute button     │                          │
     ├──────────────────────────┤                          │
     │ 2. Disable audio track   │                          │
     ├──────────────────────────┤                          │
     │ 3. toggle-audio          │                          │
     │    (enabled: false)      │                          │
     ├─────────────────────────►│                          │
     │                          │ 4. Update session store  │
     │                          ├──────────────────────────┤
     │                          │ 5. peer-updated          │
     │                          │    (socketId: A,         │
     │                          │     audioEnabled: false) │
     │                          ├─────────────────────────►│
     │                          │                          │
     │                          │ 6. Update UI             │
     │                          │    (show mute icon)      │
     │                          │◄─────────────────────────┤
     │                          │                          │
```

## Session Store Structure

```javascript
// In-Memory Session Store
{
  "ABC-DEF-GHI": {                    // Session ID
    id: "ABC-DEF-GHI",
    topic: "Should AI be regulated?",
    topicSource: "gemini",
    createdAt: Date,
    participants: Map {
      "socket-id-1": {                // Socket ID as key
        socketId: "socket-id-1",
        userId: "user-mongo-id-1",    // MongoDB user ID
        name: "Alice",
        audioEnabled: true,
        videoEnabled: true,
        screenSharing: false,
        isSpeaking: false,
        joinedAt: Date
      },
      "socket-id-2": {
        socketId: "socket-id-2",
        userId: "user-mongo-id-2",
        name: "Bob",
        audioEnabled: true,
        videoEnabled: false,
        screenSharing: false,
        isSpeaking: true,
        joinedAt: Date
      }
    },
    cleanupTimer: null                // Timeout for empty session cleanup
  }
}
```

## MongoDB Schema

```javascript
// Session Document
{
  _id: ObjectId,
  sessionId: "ABC-DEF-GHI",           // Unique session code
  topic: "Should AI be regulated?",
  topicSource: "gemini",
  status: "active",                   // active | ended
  startedAt: Date,
  endedAt: Date,
  duration: 3600,                     // seconds
  participants: [
    {
      userId: ObjectId,               // Reference to User
      name: "Alice",
      joinedAt: Date,
      leftAt: Date,
      isActive: false
    }
  ],
  messages: [
    {
      senderId: "socket-id",
      senderName: "Alice",
      text: "Hello everyone!",
      timestamp: Date
    }
  ],
  ratings: [
    {
      fromUserId: ObjectId,
      toUserId: ObjectId,
      score: 4,
      comment: "Great discussion!",
      timestamp: Date
    }
  ]
}

// User Document
{
  _id: ObjectId,
  email: "alice@example.com",
  name: "Alice",
  passwordHash: "...",
  createdAt: Date,
  stats: {
    totalSessions: 10,
    totalDuration: 36000,
    averageRating: 4.2
  }
}
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Security Layers                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Transport Security                                               │
│     • HTTPS for web traffic                                          │
│     • WSS (WebSocket Secure) for Socket.IO                          │
│     • DTLS-SRTP for WebRTC media                                    │
│                                                                       │
│  2. Authentication                                                   │
│     • JWT tokens for API requests                                    │
│     • Token validation on socket connection                          │
│     • User ID verification before joining sessions                   │
│                                                                       │
│  3. Authorization                                                    │
│     • Session existence check before join                            │
│     • Cross-session signal blocking                                  │
│     • Participant verification for all events                        │
│                                                                       │
│  4. Rate Limiting                                                    │
│     • 30 messages per 10 seconds per socket                         │
│     • Prevents chat spam and DoS                                     │
│     • Per-socket tracking with automatic reset                       │
│                                                                       │
│  5. Input Validation                                                 │
│     • All socket event payloads validated                            │
│     • Session ID format validation                                   │
│     • Text length limits (2000 chars for chat)                      │
│     • Type checking for all parameters                               │
│                                                                       │
│  6. Session Management                                               │
│     • Automatic cleanup of empty sessions (5 min TTL)               │
│     • Participant tracking and cleanup on disconnect                 │
│     • Session state isolation (no cross-session access)             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Current Architecture (Mesh)
- **Best for**: 2-8 participants
- **Pros**: Simple, low latency, no server processing
- **Cons**: Bandwidth scales O(N²), CPU scales O(N)

### Future Architecture (SFU)
```
┌─────────────────────────────────────────────────────────────────────┐
│                    SFU (Selective Forwarding Unit)                   │
│                                                                       │
│         User A                    User B                    User C   │
│           │                         │                         │      │
│           │ Upload 1 stream         │ Upload 1 stream         │      │
│           ├────────────────────────►│◄────────────────────────┤      │
│           │                         │                         │      │
│           │                    ┌────┴────┐                    │      │
│           │                    │   SFU   │                    │      │
│           │                    │ Server  │                    │      │
│           │                    └────┬────┘                    │      │
│           │                         │                         │      │
│           │ Download 2 streams      │ Download 2 streams      │      │
│           │◄────────────────────────┼────────────────────────►│      │
│           │                         │                         │      │
│                                                                       │
│  Each user: Upload 1 stream, Download N-1 streams                   │
│  Server: Receives N streams, Forwards N×(N-1) streams               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits**:
- Scales to 20-50+ participants
- Each client uploads once (saves bandwidth)
- Server handles forwarding (requires more server resources)

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Metrics to Track                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Server Metrics                                                      │
│  • Active sessions count                                             │
│  • Total participants online                                         │
│  • Socket connections per second                                     │
│  • WebRTC signals per second                                         │
│  • Chat messages per second                                          │
│  • Average session duration                                          │
│  • Memory usage (session store size)                                 │
│                                                                       │
│  Client Metrics                                                      │
│  • Connection establishment time                                     │
│  • ICE connection state distribution                                 │
│  • Video resolution and framerate                                    │
│  • Audio/video packet loss                                           │
│  • Round-trip time (RTT)                                             │
│  • Bandwidth usage (upload/download)                                 │
│                                                                       │
│  Business Metrics                                                    │
│  • Sessions created per day                                          │
│  • Average participants per session                                  │
│  • User retention rate                                               │
│  • Average rating per session                                        │
│  • Peak concurrent users                                             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Error Scenarios                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Camera/Microphone Permission Denied                             │
│     → Join session without media                                     │
│     → Show avatar instead of video                                   │
│     → Display "Camera off" indicator                                 │
│                                                                       │
│  2. Socket Connection Failed                                         │
│     → Show "Connecting..." status                                    │
│     → Retry with exponential backoff                                 │
│     → Display error after max retries                                │
│                                                                       │
│  3. WebRTC Connection Failed                                         │
│     → Log ICE connection state                                       │
│     → Attempt ICE restart                                            │
│     → Show "Connection issues" indicator                             │
│                                                                       │
│  4. Session Not Found                                                │
│     → Emit session-error event                                       │
│     → Display error message to user                                  │
│     → Redirect to session list                                       │
│                                                                       │
│  5. Network Disconnection                                            │
│     → Socket.IO auto-reconnects                                      │
│     → Re-join session on reconnect                                   │
│     → Re-establish peer connections                                  │
│                                                                       │
│  6. Peer Disconnection                                               │
│     → Close peer connection                                          │
│     → Remove from participant list                                   │
│     → Update grid layout                                             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

This architecture provides a solid foundation for a production-ready video conferencing system with room for future enhancements and scaling.
