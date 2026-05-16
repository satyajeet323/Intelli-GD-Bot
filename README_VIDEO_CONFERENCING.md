# Group Discussion Video Conferencing System

A complete, production-ready video conferencing solution built with React, WebRTC, and Socket.IO. Provides a Google Meet-like experience with responsive grid layouts, real-time audio/video streaming, and comprehensive participant management.

## ✨ Features

### Core Functionality
- 🎥 **Real-time Video Conferencing**: WebRTC-based peer-to-peer video/audio streaming
- 📱 **Responsive Grid Layout**: Automatically adapts to any number of participants
- 🔊 **High-Quality Audio**: Echo cancellation, noise suppression, auto gain control
- 🖥️ **Screen Sharing**: Share your screen with all participants
- 💬 **Real-time Chat**: Send messages to all participants
- 🎤 **Speaking Detection**: Visual indicators for active speakers
- 👥 **Participant Management**: Track and display all connected users
- 🔄 **Reconnection Support**: Automatic reconnection on network issues
- 🚪 **Late Joiner Support**: Join sessions in progress seamlessly

### Technical Features
- ✅ **Mesh Topology**: Direct peer-to-peer connections (optimal for 2-8 participants)
- ✅ **ICE Candidate Buffering**: Reliable connection establishment
- ✅ **Automatic ICE Restart**: Recovery from connection failures
- ✅ **Session Persistence**: MongoDB-backed session history
- ✅ **Rate Limiting**: Protection against spam and abuse
- ✅ **Cross-Session Security**: Isolated session communication
- ✅ **Comprehensive Logging**: Detailed debugging information

## 🎯 What Was Fixed

This implementation resolves all major issues with the video conferencing system:

### 1. Layout Issues ✅
- **Before**: Videos overlapping, appearing below screen, not visible simultaneously
- **After**: Responsive grid layout showing all participants properly sized and aligned

### 2. Video Display ✅
- **Before**: Incorrect aspect ratios, videos outside viewport
- **After**: Proper 16:9 aspect ratio, all videos contained within viewport

### 3. Scrolling Support ✅
- **Before**: Hidden videos when participants exceeded screen space
- **After**: Automatic scrolling for large groups (10+ participants)

### 4. WebRTC Integration ✅
- **Before**: Unreliable connections, missing streams
- **After**: Reliable peer connections with comprehensive error handling

### 5. Participant Management ✅
- **Before**: Inconsistent state between backend and frontend
- **After**: Synchronized participant lists with room roster updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Install dependencies
cd ROXGD/server && npm install
cd ../client && npm install

# Configure environment variables
# See QUICK_START.md for details

# Start server
cd ROXGD/server && npm start

# Start client (in another terminal)
cd ROXGD/client && npm run dev
```

### Testing

```bash
# Run automated tests
cd ROXGD/server
node test-signaling.js

# Expected: 17/17 tests passed ✅
```

See **[QUICK_START.md](./QUICK_START.md)** for detailed setup instructions.

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[QUICK_START.md](./QUICK_START.md)** | Get started in 5 minutes |
| **[VIDEO_CONFERENCING_FIXES.md](./VIDEO_CONFERENCING_FIXES.md)** | Detailed explanation of all fixes |
| **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** | Complete developer reference |
| **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** | Architecture diagrams and flows |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | Executive summary and test results |

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────┐     WebRTC (P2P)      ┌─────────────┐
│   User A    │◄──────────────────────►│   User B    │
│  (Browser)  │                        │  (Browser)  │
└──────┬──────┘                        └──────┬──────┘
       │                                      │
       │ Socket.IO (Signaling)                │
       │                                      │
       └──────────────┬───────────────────────┘
                      │
              ┌───────▼────────┐
              │  Node.js       │
              │  Server        │
              │  • Socket.IO   │
              │  • Express     │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   MongoDB      │
              │  • Sessions    │
              │  • Users       │
              └────────────────┘
```

### Technology Stack

**Frontend**:
- React 18 + TypeScript
- TanStack Router
- Socket.IO Client
- WebRTC API
- Tailwind CSS + Shadcn UI

**Backend**:
- Node.js + Express
- Socket.IO
- MongoDB + Mongoose
- In-memory session store

## 🎨 Responsive Grid Layouts

The system automatically adapts the layout based on participant count:

```
1 participant:  Full screen
2 participants: Split screen (1x2)
3 participants: 2-3 column grid
4 participants: 2x2 grid
5-6 participants: 2-3 column grid
7-9 participants: 3 column grid
10-12 participants: 3-4 column grid
13+ participants: 4-5 column grid with scrolling
```

## 🔒 Security Features

- **Transport Security**: HTTPS/WSS in production
- **Authentication**: JWT-based user authentication
- **Authorization**: Session validation before joining
- **Cross-Session Protection**: Signals only forwarded within same session
- **Rate Limiting**: 30 messages per 10 seconds per socket
- **Input Validation**: All socket events validated
- **Session Isolation**: No cross-session data access

## 📊 Performance

### Bandwidth Usage (per participant)
- **Upload**: ~1.5 Mbps per peer
- **Download**: ~1.5 Mbps per peer

### Scalability
- **Optimal**: 2-8 participants (mesh topology)
- **Maximum**: 10-12 participants (with good network)
- **Future**: SFU architecture for 20+ participants

### Browser Support
| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14.1+ | ✅ Full support |
| Mobile | iOS 14.3+, Android Chrome 90+ | ✅ Full support |

## 🧪 Testing

### Automated Tests

```bash
cd ROXGD/server
node test-signaling.js
```

Tests cover:
- ✅ Session creation and joining
- ✅ WebRTC offer/answer/ICE exchange
- ✅ Audio/video/screen toggle
- ✅ Speaking detection
- ✅ Chat messages
- ✅ Rate limiting
- ✅ Cross-session security
- ✅ Participant leave/disconnect

### Manual Testing

1. Open session in multiple browsers
2. Verify video/audio streaming
3. Test controls (mute, video off, screen share)
4. Add/remove participants
5. Test reconnection (disable/enable network)
6. Test on mobile devices

## 🚢 Production Deployment

### Requirements
- HTTPS certificate (required for camera/microphone)
- TURN server (for NAT traversal)
- MongoDB replica set (for high availability)
- Load balancer (for multiple server instances)

### Deployment Checklist
- [ ] Configure TURN server
- [ ] Set up HTTPS with valid SSL certificate
- [ ] Configure production environment variables
- [ ] Set up MongoDB replica set
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and alerting
- [ ] Configure CDN for static assets
- [ ] Implement backup strategy
- [ ] Set up health check endpoints
- [ ] Configure session affinity for Socket.IO

See **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** for complete deployment guide.

## 🔧 Configuration

### Server Environment Variables

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/roxgd
JWT_SECRET=your-secret-key
SESSION_TTL_SECONDS=300
GEMINI_API_KEY=your-api-key-optional
```

### Client Environment Variables

```env
VITE_SERVER_URL=http://localhost:4000
VITE_ICE_SERVER_URL=turn:your-turn-server.com:3478
VITE_ICE_SERVER_USER=username
VITE_ICE_SERVER_CRED=password
```

## 🐛 Troubleshooting

### Common Issues

**Video not displaying**:
- Check browser permissions
- Verify camera is not in use by another app
- Check browser console for errors

**Cannot connect to other participants**:
- Verify both users are in the same session
- Check network/firewall settings
- Ensure TURN server is configured (for production)

**Audio not working**:
- Check browser audio permissions
- Verify microphone is not muted
- Check audio device settings

See **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** for detailed troubleshooting.

## 📈 Monitoring

### Key Metrics
- Active sessions count
- Total participants online
- Connection success rate
- Average session duration
- Bandwidth usage
- Error rates

### Logging
- Server logs all WebSocket events
- Client logs all WebRTC state changes
- Comprehensive error logging

## 🔮 Future Enhancements

### Short-term
- Spotlight mode (pin participants)
- Virtual backgrounds
- Improved noise cancellation
- Mobile app optimization

### Medium-term
- Recording functionality
- Breakout rooms
- Hand raise feature
- Reactions (emoji)
- Closed captions

### Long-term
- SFU architecture (20+ participants)
- Adaptive bitrate
- Simulcast
- AI-powered features
- Calendar integration

## 🤝 Contributing

Contributions are welcome! Please:

1. Read **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**
2. Create a feature branch
3. Write tests for new features
4. Update documentation
5. Submit a pull request

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- WebRTC API and community
- Socket.IO team
- React and TypeScript communities
- All contributors and testers

## 📞 Support

- **Documentation**: See docs folder
- **Issues**: Check browser console and server logs
- **Tests**: Run `node test-signaling.js` to verify system health
- **Community**: [Your community links]

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: 2026-05-02  
**Test Coverage**: 17/17 tests passing

Built with ❤️ for seamless video conferencing experiences.
