# Developer Guide - Group Discussion Video Conferencing

## Quick Start

### Running the Application

1. **Start the Server**:
```bash
cd ROXGD/server
npm install
npm start
```

2. **Start the Client**:
```bash
cd ROXGD/client
npm install
npm run dev
```
cd ml-server
uvicorn main:app --port 8000

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)


3. **Access the Application**:
- Open browser to `http://localhost:5173`
- Create or join a session
- Allow camera/microphone permissions

### Testing

**Run Signaling Tests**:
```bash
cd ROXGD/server
node test-signaling.js
```

**Run Integration Tests**:
```bash
cd ROXGD/server
node test-integration.js
```

## Architecture Overview

### Technology Stack

**Frontend**:
- React 18 with TypeScript
- TanStack Router for routing
- Socket.IO Client for real-time communication
- WebRTC for peer-to-peer video/audio
- Tailwind CSS for styling
- Shadcn UI components

**Backend**:
- Node.js with Express
- Socket.IO for WebSocket connections
- MongoDB for persistent storage
- In-memory session store for active sessions

### Key Files

#### Client
```
client/src/
├── components/group-session/
│   ├── useGroupSession.ts          # WebRTC hook (main logic)
│   ├── ParticipantTile.tsx         # Video tile component
│   ├── ControlBar.tsx              # Audio/video controls
│   ├── ChatSidebar.tsx             # Chat interface
│   └── AIPanel.tsx                 # AI insights panel
├── routes/
│   └── group-session_.$sessionId.tsx  # Main room page
└── lib/
    └── api.ts                      # API client
```

#### Server
```
server/src/
├── socketHandler.js                # WebSocket event handlers
├── sessionStore.js                 # In-memory session management
├── models/
│   ├── Session.js                  # MongoDB session model
│   └── User.js                     # MongoDB user model
└── routes/
    └── sessions.js                 # REST API endpoints
```

## WebRTC Flow

### Connection Establishment

1. **User A joins session**:
   - Gets camera/microphone stream
   - Connects to Socket.IO server
   - Emits `join-session`
   - Receives `session-joined` with empty peer list

2. **User B joins session**:
   - Gets camera/microphone stream
   - Connects to Socket.IO server
   - Emits `join-session`
   - Receives `session-joined` with User A in peer list
   - Creates RTCPeerConnection for User A
   - Adds local tracks to peer connection
   - Creates and sends WebRTC offer to User A

3. **User A receives offer**:
   - Receives `webrtc-offer` event
   - Creates RTCPeerConnection for User B (if not exists)
   - Sets remote description (User B's offer)
   - Creates answer
   - Sends `webrtc-answer` to User B

4. **ICE Candidate Exchange**:
   - Both users gather ICE candidates
   - Send candidates via `webrtc-ice` events
   - Candidates are buffered if remote description not set yet
   - Flushed after remote description is set

5. **Connection Established**:
   - ICE negotiation completes
   - Peer connection state becomes "connected"
   - Video/audio streams flow between peers

### Adding More Users

When User C joins:
1. Receives peer list with Users A and B
2. Creates peer connections for both
3. Sends offers to both A and B
4. A and B respond with answers
5. ICE candidates exchanged with both
6. Now all three users are connected in a mesh topology

## Component Details

### useGroupSession Hook

**Purpose**: Manages WebRTC connections, signaling, and session state.

**Key Responsibilities**:
- Acquire local media stream
- Connect to Socket.IO server
- Create and manage RTCPeerConnections
- Handle signaling (offer/answer/ICE)
- Track participant state
- Provide controls (mute, video toggle, screen share)

**State Management**:
```typescript
const {
  participants,      // Array of all participants with streams
  chatMessages,      // Chat message history
  status,           // Connection status
  audioEnabled,     // Local audio state
  videoEnabled,     // Local video state
  screenSharing,    // Screen share state
  activeSpeakerId,  // Currently speaking participant
  toggleAudio,      // Mute/unmute function
  toggleVideo,      // Camera on/off function
  toggleScreenShare,// Screen share function
  sendChatMessage,  // Send chat function
} = useGroupSession(sessionId, userId);
```

### ParticipantTile Component

**Purpose**: Display individual participant video with controls.

**Features**:
- Responsive sizing (sm, md, lg)
- Video stream display with proper aspect ratio
- Avatar fallback when video is off
- Audio/video mute indicators
- Speaking indicator (green ring)
- Active speaker label
- Click to pin/spotlight

**Props**:
```typescript
interface ParticipantTileProps {
  participant: Participant;  // Participant data with stream
  isActive?: boolean;        // Is active speaker
  size?: "sm" | "md" | "lg"; // Tile size
  onClick?: () => void;      // Click handler
}
```

### Responsive Grid Layout

**Breakpoints**:
- Mobile: 1-2 columns
- Tablet: 2-3 columns
- Desktop: 3-4 columns
- Large Desktop: 4-5 columns

**Grid Logic**:
```typescript
participants.length === 1  → grid-cols-1 (full screen)
participants.length === 2  → grid-cols-1 sm:grid-cols-2 (split)
participants.length === 3  → grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
participants.length === 4  → grid-cols-2 (2x2)
participants.length <= 6   → grid-cols-2 lg:grid-cols-3
participants.length <= 9   → grid-cols-2 sm:grid-cols-3
participants.length <= 12  → grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
participants.length > 12   → grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
```

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId, name, userId? }` | Join a session |
| `leave-session` | `{ sessionId? }` | Leave current session |
| `webrtc-offer` | `{ targetSocketId, sdp }` | Send WebRTC offer |
| `webrtc-answer` | `{ targetSocketId, sdp }` | Send WebRTC answer |
| `webrtc-ice` | `{ targetSocketId, candidate }` | Send ICE candidate |
| `toggle-audio` | `{ enabled }` | Mute/unmute audio |
| `toggle-video` | `{ enabled }` | Turn camera on/off |
| `toggle-screen` | `{ enabled }` | Start/stop screen share |
| `speaking` | `{ isSpeaking }` | Speaking status |
| `chat-message` | `{ text }` | Send chat message |
| `ping` | - | Ping server |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session-joined` | `{ session, you, peers[] }` | Joined successfully |
| `session-error` | `{ code, message }` | Error occurred |
| `peer-joined` | `{ participant }` | New peer joined |
| `peer-left` | `{ socketId, name }` | Peer left |
| `room-roster` | `{ participants[] }` | Full participant list |
| `webrtc-offer` | `{ fromSocketId, sdp }` | Received offer |
| `webrtc-answer` | `{ fromSocketId, sdp }` | Received answer |
| `webrtc-ice` | `{ fromSocketId, candidate }` | Received ICE candidate |
| `peer-updated` | `{ socketId, ...state }` | Peer state changed |
| `chat-message` | `{ id, senderId, senderName, text, ts }` | Chat message |
| `pong` | `{ ts }` | Pong response |

## Common Issues & Solutions

### Issue: Video not displaying

**Symptoms**: Black screen or avatar shown instead of video

**Solutions**:
1. Check browser console for errors
2. Verify camera permissions granted
3. Check if `participant.stream` is not null
4. Verify `participant.videoEnabled` is true
5. Check WebRTC connection state in console logs

**Debug**:
```javascript
// In browser console
console.log(participants);
// Check each participant's stream and videoEnabled
```

### Issue: No audio from remote participants

**Symptoms**: Can see video but can't hear audio

**Solutions**:
1. Check if remote participant has audio enabled
2. Verify audio tracks exist in stream
3. Check browser audio permissions
4. Ensure video element is not muted (only local should be muted)

**Debug**:
```javascript
// Check audio tracks
participant.stream?.getAudioTracks().forEach(track => {
  console.log('Audio track:', track.enabled, track.muted, track.readyState);
});
```

### Issue: Participants not connecting

**Symptoms**: Participants join but don't see each other's video

**Solutions**:
1. Check Socket.IO connection status
2. Verify WebRTC signaling in console logs
3. Check ICE connection state
4. Verify STUN/TURN servers are accessible
5. Check firewall/NAT settings

**Debug**:
```javascript
// Check peer connection state
peersRef.current.forEach((pc, socketId) => {
  console.log(socketId, {
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    signalingState: pc.signalingState,
  });
});
```

### Issue: Late joiner can't connect

**Symptoms**: User joining after session started doesn't see others

**Solutions**:
1. Verify `session-joined` event includes peer list
2. Check if peer connections are created for all peers
3. Verify offers are sent to all existing peers
4. Check console logs for signaling errors

**Debug**:
```javascript
// Check if peers are created
console.log('Peer connections:', peersRef.current.size);
console.log('Participants:', participants.length);
// Should match (excluding local)
```

## Performance Optimization

### Video Quality

Adjust video constraints based on network conditions:

```typescript
// High quality (good network)
{ width: { ideal: 1280 }, height: { ideal: 720 } }

// Medium quality (moderate network)
{ width: { ideal: 640 }, height: { ideal: 480 } }

// Low quality (poor network)
{ width: { ideal: 320 }, height: { ideal: 240 } }
```

### Grid Rendering

For large groups (10+ participants):
- Use `will-change: transform` on tiles for smooth scrolling
- Implement virtual scrolling for 20+ participants
- Consider pagination or "pages" of participants

### Memory Management

- Clean up peer connections on disconnect
- Stop media tracks when leaving session
- Clear intervals and timeouts
- Remove event listeners

## Security Best Practices

1. **Always use HTTPS in production** (required for camera/microphone)
2. **Validate all socket events** on the server
3. **Rate limit** chat messages and signaling
4. **Authenticate users** before joining sessions
5. **Validate session IDs** before allowing joins
6. **Use TURN servers** for production (not just STUN)
7. **Implement session timeouts** to clean up abandoned sessions
8. **Log security events** (failed joins, rate limits, etc.)

## Deployment

### Environment Variables

**Client** (`.env`):
```env
VITE_SERVER_URL=https://your-server.com
VITE_ICE_SERVER_URL=turn:your-turn-server.com:3478
VITE_ICE_SERVER_USER=username
VITE_ICE_SERVER_CRED=password
```

**Server** (`.env`):
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/roxgd
JWT_SECRET=your-secret-key
SESSION_TTL_SECONDS=300
GEMINI_API_KEY=your-gemini-key
```

### Production Checklist

- [ ] Set up TURN server (coturn, Twilio, etc.)
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Set up MongoDB replica set for high availability
- [ ] Configure CORS for production domain
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Implement analytics (participant count, session duration, etc.)
- [ ] Set up CDN for static assets
- [ ] Configure rate limiting and DDoS protection
- [ ] Set up automated backups for MongoDB
- [ ] Configure health check endpoints
- [ ] Set up load balancing for multiple server instances
- [ ] Implement session affinity (sticky sessions) for Socket.IO

## Troubleshooting

### Enable Debug Logging

**Client**:
```typescript
// In useGroupSession.ts, add more console.logs
console.log('[WebRTC] Event:', eventName, data);
```

**Server**:
```javascript
// In socketHandler.js
console.log('[ws] Event:', eventName, 'from:', socket.id, data);
```

### Check WebRTC Stats

```javascript
// Get stats for a peer connection
const pc = peersRef.current.get(socketId);
const stats = await pc.getStats();
stats.forEach(report => {
  if (report.type === 'inbound-rtp' && report.kind === 'video') {
    console.log('Video stats:', {
      bytesReceived: report.bytesReceived,
      packetsLost: report.packetsLost,
      framesDecoded: report.framesDecoded,
    });
  }
});
```

### Monitor Network Quality

```javascript
// Check ICE candidate types
pc.onicecandidate = ({ candidate }) => {
  if (candidate) {
    console.log('ICE candidate type:', candidate.type);
    // host = local network
    // srflx = STUN (public IP)
    // relay = TURN (relayed)
  }
};
```

## Contributing

When adding new features:

1. **Update types** in `useGroupSession.ts`
2. **Add socket events** in `socketHandler.js`
3. **Update tests** in `test-signaling.js`
4. **Document changes** in this guide
5. **Test with multiple browsers** (Chrome, Firefox, Safari)
6. **Test on mobile devices**
7. **Check performance** with 10+ participants

## Resources

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [RTCPeerConnection API](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
- [WebRTC Samples](https://webrtc.github.io/samples/)

## Support

For issues or questions:
1. Check console logs for errors
2. Review this guide for common issues
3. Run signaling tests to verify server
4. Check browser compatibility
5. Verify network/firewall settings
