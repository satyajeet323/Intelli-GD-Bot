# GD Bot — Group Discussion Practice Platform
## Final Year IT Project Report

---

**Project Title:** GD Bot — AI-Powered Group Discussion Practice and Evaluation Platform  
**Technology Stack:** React 18, TypeScript, Node.js, Express, MongoDB, Socket.IO, WebRTC, Google Gemini AI  
**Academic Year:** 2025–2026  

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
   - 2.1 Introduction to the Project
   - 2.2 Domain Knowledge
   - 2.3 Problem Description
3. [System Study](#3-system-study)
   - 3.1 Existing System
   - 3.2 Limitations of the Existing System
   - 3.3 Proposed System
   - 3.4 Objectives
   - 3.5 Feasibility Study
4. [System Analysis](#4-system-analysis)
   - 4.1 Gantt Chart
   - 4.2 Use Case Diagrams
   - 4.3 Operating Tools and Technologies
   - 4.4 Software Requirements
   - 4.5 Hardware Requirements
5. [System Design](#5-system-design)
   - 5.1 ER Diagram
   - 5.2 Component Diagram
   - 5.3 State Diagram
   - 5.4 Deployment Diagram
   - 5.5 Sequence Diagram
   - 5.6 Database Design
   - 5.7 Class Diagram
   - 5.8 Input/Output Design
6. [Implementation](#6-implementation)
   - 6.1 Authentication Module
   - 6.2 Dashboard Module
   - 6.3 AI Individual Session Module
   - 6.4 Group Discussion Session Module
   - 6.5 Real-Time Chat Module
   - 6.6 Performance Report Module
   - 6.7 Peer Rating Module
   - 6.8 Session History Module
   - 6.9 User Profile and Preferences Module
   - 6.10 Topic Generation Module
7. [Coding](#7-coding)
   - 7.1 Technologies Used
   - 7.2 Sample Code and Logic
8. [System Testing](#8-system-testing)
   - 8.1 Testing Methodology
   - 8.2 Test Cases and Results
9. [Conclusion](#9-conclusion)
10. [References](#10-references)

---

## 1. Abstract

GD Bot is a full-stack, AI-powered web application designed to help students and professionals practise and improve their group discussion (GD) skills in a structured, technology-driven environment. The platform addresses a well-documented gap in traditional communication training: the absence of an accessible, scalable, and data-driven tool that can simulate real group discussion scenarios, evaluate individual performance objectively, and provide actionable feedback in real time.

The system offers two primary modes of practice. In the **Individual AI Session** mode, a single user engages in a simulated group discussion with an AI partner powered by Google Gemini. The AI generates contextually relevant discussion topics, responds intelligently to the user's arguments, and evaluates each speaking turn across four dimensions: fluency, relevance, confidence, and filler-word usage. In the **Group Discussion Session** mode, multiple authenticated users join a shared virtual room where they can see and hear each other through WebRTC-based peer-to-peer video and audio streaming, exchange text messages via a real-time chat system, and receive post-session peer evaluations.

The backend is built on Node.js with Express and uses MongoDB as the persistent data store. Real-time communication is handled by Socket.IO, which manages WebRTC signalling (offer, answer, and ICE candidate exchange), participant roster synchronisation, and live chat broadcasting. The frontend is a React 18 single-page application written in TypeScript, using TanStack Router for client-side navigation and Tailwind CSS for styling.

Key outcomes of the project include: a fully functional multi-user video conferencing interface with responsive grid layout, a JWT-secured authentication system, an AI-driven topic generation engine with rate-limit resilience, a quantitative performance scoring model, a peer rating system with persistent MongoDB storage, a session history module with streak tracking, and a comprehensive dashboard displaying aggregated statistics. The system was validated through end-to-end signalling tests (17/17 passing), integration tests, and manual multi-browser testing.

---

## 2. Introduction

### 2.1 Introduction to the Project

Group discussions are a critical component of academic and professional evaluation processes. Universities use GDs to assess candidates for postgraduate admissions; corporations use them during campus recruitment drives; and competitive examinations such as the Common Admission Test (CAT) and the Graduate Management Admission Test (GMAT) include GD rounds as part of their selection process. Despite their importance, most students and early-career professionals have very limited opportunities to practise GDs in a structured, feedback-rich environment.

GD Bot was conceived to fill this gap. It is a web-based platform that provides two complementary practice environments:

1. **AI-Powered Individual Sessions:** The user practises alone against an AI discussion partner. The AI generates a topic, responds to the user's arguments, and scores each turn in real time. This mode is ideal for building confidence and vocabulary before participating in group settings.

2. **Multi-User Group Sessions:** Two to twelve authenticated users join a shared virtual room. Each participant's camera and microphone feed is streamed to all other participants via WebRTC. A live chat panel allows text-based communication. After the session, participants rate each other on four criteria, and the system computes a combined score that blends AI-assessed performance with peer evaluations.

The platform is designed to be accessible from any modern browser without requiring any plugin installation. It is responsive across desktop and mobile devices and supports graceful degradation when camera access is unavailable (audio-only mode).

### 2.2 Domain Knowledge

#### 2.2.1 Group Discussion as a Communication Skill

A group discussion is a structured conversation in which a set of participants exchange ideas on a given topic within a defined time frame. Evaluators assess participants on several dimensions:

- **Content Quality:** Relevance of arguments, depth of knowledge, use of examples and data.
- **Communication Skills:** Clarity of expression, vocabulary, sentence structure, and absence of filler words.
- **Confidence:** Assertiveness, eye contact, body language, and willingness to initiate or counter arguments.
- **Listening and Collaboration:** Ability to build on others' points, avoid interruptions, and maintain a constructive tone.

#### 2.2.2 Natural Language Processing and AI Evaluation

The project leverages Google Gemini, a large language model (LLM), for two purposes: generating discussion topics and evaluating the quality of user responses. The scoring model used in the system is based on the following weighted formula:

```
Overall Score = (Fluency × 0.35) + (Relevance × 0.35) + (Confidence × 0.30) − Filler Penalty
```

Where:
- **Fluency** (0–10): Measures the smoothness and pace of speech.
- **Relevance** (0–10): Measures how closely the response addresses the topic.
- **Confidence** (0–10): Measures assertiveness and clarity of expression.
- **Filler Penalty**: 0 for 0–2 fillers, 0.5 for 3–5, 1.0 for 6–10, 1.5 for 11+.

#### 2.2.3 WebRTC and Real-Time Communication

WebRTC (Web Real-Time Communication) is a W3C standard that enables peer-to-peer audio, video, and data communication directly between browsers without requiring an intermediary media server. The connection establishment process involves:

1. **Signalling:** Exchange of Session Description Protocol (SDP) offers and answers via a signalling server (Socket.IO in this project).
2. **ICE (Interactive Connectivity Establishment):** Discovery of network paths using STUN servers to traverse NAT and firewalls.
3. **DTLS-SRTP:** Encryption of media streams for security.

The system uses a **mesh topology** where each participant maintains a direct peer connection to every other participant. This is optimal for groups of 2–8 users.

#### 2.2.4 JWT Authentication

JSON Web Tokens (JWT) are used for stateless authentication. Upon login, the server signs a token containing the user's ID, name, and email using a secret key. The client stores this token in `localStorage` and attaches it to every API request and WebSocket handshake. The server verifies the token on each request without querying the database, making authentication fast and scalable.

### 2.3 Problem Description

The following problems motivated the development of GD Bot:

1. **Lack of Accessible Practice Platforms:** Existing GD preparation resources are primarily text-based (books, articles) or require physical presence (coaching institutes). There is no widely available, free, browser-based tool for practising GDs with real-time feedback.

2. **Absence of Objective Evaluation:** Human evaluators are subjective and inconsistent. Students rarely receive quantitative feedback on specific dimensions such as fluency or filler-word usage.

3. **No Peer Feedback Mechanism:** In real GDs, peer perception matters. Existing tools do not capture how other participants perceive a user's contribution.

4. **Scalability of Group Practice:** Organising a group of people for a practice session requires coordination. A virtual platform eliminates geographical and scheduling barriers.

5. **No Progress Tracking:** Without historical data, users cannot measure improvement over time or identify persistent weaknesses.

GD Bot addresses all five problems through its integrated AI evaluation, peer rating, session history, and dashboard modules.

---

## 3. System Study

### 3.1 Existing System

Prior to the development of GD Bot, the following approaches were commonly used for GD preparation:

1. **Coaching Institutes:** Physical centres where students practise GDs under the supervision of a trainer. These are expensive, geographically limited, and available only at fixed times.

2. **YouTube Videos and Online Articles:** Passive learning resources that explain GD techniques but provide no interactive practice or feedback.

3. **WhatsApp/Zoom Groups:** Informal groups where students self-organise practice sessions. These lack structured evaluation, topic generation, and performance tracking.

4. **Generic Video Conferencing Tools (Zoom, Google Meet):** These tools support multi-user video calls but have no GD-specific features such as topic generation, performance scoring, or peer rating.

5. **AI Chatbots (ChatGPT, etc.):** General-purpose chatbots can simulate a conversation partner but do not score performance, track history, or support multi-user sessions.

### 3.2 Limitations of the Existing System

| Limitation | Coaching Institutes | YouTube/Articles | Zoom/Meet | Generic Chatbots |
|---|---|---|---|---|
| Real-time feedback | Partial | None | None | None |
| Quantitative scoring | None | None | None | None |
| Multi-user video | Yes (physical) | No | Yes | No |
| Topic generation | Manual | No | No | Partial |
| Peer rating | Informal | No | No | No |
| Progress tracking | Manual | No | No | No |
| Accessible 24/7 | No | Yes | Yes | Yes |
| Free to use | No | Yes | Freemium | Freemium |
| GD-specific features | Yes | No | No | No |

The fundamental limitation across all existing approaches is the absence of an integrated system that combines multi-user video communication, AI-driven topic generation, quantitative performance evaluation, peer feedback, and historical progress tracking in a single, accessible web application.

### 3.3 Proposed System

GD Bot is proposed as a comprehensive, browser-based platform that integrates all the features missing from existing solutions. The proposed system:

- Provides **two practice modes**: individual AI sessions and multi-user group sessions.
- Generates **AI-powered discussion topics** using Google Gemini with a local fallback for resilience.
- Evaluates **individual performance** quantitatively across fluency, relevance, confidence, and filler-word usage.
- Supports **real-time multi-user video and audio** via WebRTC with a responsive grid layout.
- Includes a **live chat system** with correct per-user identity management.
- Implements a **peer rating system** with four criteria (communication, relevance, confidence, clarity) and persistent MongoDB storage.
- Maintains a **session history** with pagination, filtering, sorting, and search.
- Displays a **personalised dashboard** with aggregate statistics, streak tracking, and recent session cards.
- Secures all data with **JWT authentication** and bcrypt password hashing.
- Handles **edge cases** such as camera unavailability (audio-only fallback), user reconnection (stale socket eviction), and server restarts (persistent database storage).

### 3.4 Objectives

The primary and secondary objectives of the project are as follows:

**Primary Objectives:**
1. Design and implement a full-stack web application for GD practice with AI evaluation.
2. Build a real-time multi-user video conferencing system using WebRTC and Socket.IO.
3. Develop a quantitative performance scoring model and integrate it with AI feedback.
4. Implement a persistent peer rating system with aggregate score calculation.
5. Create a session history and dashboard module with streak tracking.

**Secondary Objectives:**
1. Ensure the system is secure through JWT authentication and input validation.
2. Make the UI responsive and accessible across desktop and mobile devices.
3. Handle network edge cases such as reconnection, camera failure, and late joining.
4. Implement rate limiting to prevent abuse of AI and chat APIs.
5. Write automated tests to validate the signalling and integration layers.

### 3.5 Feasibility Study

#### 3.5.1 Economic Feasibility

The project is economically feasible for the following reasons:

- **Development Cost:** The entire stack uses open-source technologies (React, Node.js, MongoDB, Socket.IO) with no licensing fees.
- **Infrastructure Cost:** The application can be deployed on free-tier cloud services (Render, Railway, MongoDB Atlas free tier) during development and testing.
- **AI Cost:** Google Gemini API offers a free tier sufficient for development and moderate usage. The system includes a rate-limit cooldown mechanism that automatically falls back to local topics when the quota is exceeded, eliminating unexpected costs.
- **WebRTC Cost:** Peer-to-peer WebRTC requires only STUN servers for most connections, which are freely provided by Google (`stun.l.google.com`). TURN servers are only needed for restrictive corporate networks and can be added as a paid upgrade.
- **Maintenance Cost:** The modular architecture and comprehensive test suite reduce ongoing maintenance effort.

**Estimated Development Cost Breakdown:**

| Resource | Cost |
|---|---|
| Frontend framework (React, Vite, Tailwind) | Free (open source) |
| Backend framework (Node.js, Express) | Free (open source) |
| Database (MongoDB Atlas free tier) | Free up to 512 MB |
| AI API (Gemini free tier) | Free up to quota |
| Hosting (development) | Free tier |
| Domain name (optional) | ~$10/year |
| **Total** | **~$10/year** |

#### 3.5.2 Technical Feasibility

The project is technically feasible because:

- **WebRTC** is natively supported in all modern browsers (Chrome 90+, Firefox 88+, Safari 14.1+, Edge 90+) without plugins.
- **Socket.IO** provides reliable WebSocket communication with automatic polling fallback for environments where WebSockets are blocked.
- **MongoDB** is well-suited for the document-oriented data model of sessions, participants, reports, and ratings.
- **React 18** with TypeScript provides a robust, type-safe frontend with excellent tooling support.
- **Google Gemini API** provides a REST interface that is straightforward to integrate.
- The development team has the required skills in JavaScript/TypeScript, React, Node.js, and MongoDB.
- All chosen technologies have extensive documentation, active communities, and long-term support.

#### 3.5.3 Operational Feasibility

The system is operationally feasible because:

- **User Interface:** The UI is intuitive and follows familiar patterns from Google Meet and similar platforms. No training is required for basic usage.
- **Browser Compatibility:** The application runs in any modern browser without installation.
- **Accessibility:** The system degrades gracefully when camera or microphone access is unavailable.
- **Scalability:** The modular architecture allows individual components (AI, WebRTC, database) to be scaled independently.
- **Reliability:** The system includes graceful shutdown, unhandled rejection guards, and automatic reconnection logic.
- **Security:** JWT authentication, bcrypt password hashing, input validation, and rate limiting protect against common attack vectors.

---

## 4. System Analysis

### 4.1 Gantt Chart

The project was executed over approximately 16 weeks following an iterative development methodology. The Gantt chart below represents the planned schedule:

```
Week  | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9  | 10 | 11 | 12 | 13 | 14 | 15 | 16
------|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----
Requirements & Design        |████|████|    |    |    |    |    |    |    |    |    |    |    |    |    |
Database Schema Design       |    |████|████|    |    |    |    |    |    |    |    |    |    |    |    |
Backend: Auth & Sessions     |    |    |████|████|    |    |    |    |    |    |    |    |    |    |    |
Backend: Reports & History   |    |    |    |████|████|    |    |    |    |    |    |    |    |    |    |
Backend: Socket.IO Signalling|    |    |    |    |████|████|████|    |    |    |    |    |    |    |    |
Frontend: Auth & Dashboard   |    |    |    |    |    |████|████|    |    |    |    |    |    |    |    |
Frontend: AI Session         |    |    |    |    |    |    |████|████|    |    |    |    |    |    |    |
Frontend: Group Session UI   |    |    |    |    |    |    |    |████|████|████|    |    |    |    |    |
WebRTC Integration           |    |    |    |    |    |    |    |    |████|████|████|    |    |    |    |
Peer Rating System           |    |    |    |    |    |    |    |    |    |████|████|    |    |    |    |
History & Profile Modules    |    |    |    |    |    |    |    |    |    |    |████|████|    |    |    |
Bug Fixes & Optimisation     |    |    |    |    |    |    |    |    |    |    |    |████|████|    |    |
Testing & Validation         |    |    |    |    |    |    |    |    |    |    |    |    |████|████|    |
Documentation & Report       |    |    |    |    |    |    |    |    |    |    |    |    |    |████|████|
```

**Key Milestones:**
- **Week 4:** Backend REST API complete and tested.
- **Week 7:** Frontend authentication and dashboard functional.
- **Week 10:** Group session with WebRTC video streaming working.
- **Week 12:** Peer rating and history modules complete.
- **Week 14:** All automated tests passing (17/17 signalling tests).
- **Week 16:** Final report and deployment complete.

### 4.2 Use Case Diagrams

#### 4.2.1 Overall System Use Case

```
                        ┌─────────────────────────────────────────────┐
                        │                  GD Bot System               │
                        │                                               │
  ┌──────────┐          │  ┌─────────────────┐  ┌──────────────────┐  │
  │          │──────────┼─►│  Register/Login  │  │  Generate Topic  │  │
  │          │          │  └─────────────────┘  └──────────────────┘  │
  │          │          │                                               │
  │          │──────────┼─►┌─────────────────┐                        │
  │          │          │  │ Start AI Session │                        │
  │  User    │          │  └─────────────────┘                        │
  │          │          │                                               │
  │          │──────────┼─►┌──────────────────────────────────────┐   │
  │          │          │  │       Group Session                   │   │
  │          │          │  │  ┌────────────┐  ┌────────────────┐  │   │
  │          │          │  │  │Create/Join │  │ Video/Audio    │  │   │
  │          │          │  │  │  Session   │  │  Streaming     │  │   │
  │          │          │  │  └────────────┘  └────────────────┘  │   │
  │          │          │  │  ┌────────────┐  ┌────────────────┐  │   │
  │          │──────────┼─►│  │  Live Chat │  │  Peer Rating   │  │   │
  │          │          │  │  └────────────┘  └────────────────┘  │   │
  │          │          │  └──────────────────────────────────────┘   │
  │          │          │                                               │
  │          │──────────┼─►┌─────────────────┐                        │
  │          │          │  │  View History   │                        │
  │          │          │  └─────────────────┘                        │
  │          │          │                                               │
  │          │──────────┼─►┌─────────────────┐                        │
  └──────────┘          │  │ Update Profile  │                        │
                        │  └─────────────────┘                        │
                        └─────────────────────────────────────────────┘
```

#### 4.2.2 Group Session Use Case

```
  ┌──────────┐     create session     ┌──────────────────────────────┐
  │  Host    │────────────────────────►│                              │
  └──────────┘                        │       Group Session          │
                                      │                              │
  ┌──────────┐     join session       │  ┌──────────────────────┐   │
  │Participant├───────────────────────►│  │ WebRTC Peer Connect  │   │
  └──────────┘                        │  └──────────────────────┘   │
                                      │                              │
  ┌──────────┐     send message       │  ┌──────────────────────┐   │
  │   User   ├───────────────────────►│  │   Live Chat          │   │
  └──────────┘                        │  └──────────────────────┘   │
                                      │                              │
  ┌──────────┐     toggle audio/video │  ┌──────────────────────┐   │
  │   User   ├───────────────────────►│  │  Media Controls      │   │
  └──────────┘                        │  └──────────────────────┘   │
                                      │                              │
  ┌──────────┐     submit ratings     │  ┌──────────────────────┐   │
  │   User   ├───────────────────────►│  │   Peer Rating        │   │
  └──────────┘                        │  └──────────────────────┘   │
                                      └──────────────────────────────┘
```

#### 4.2.3 AI Session Use Case

```
  ┌──────────┐                        ┌──────────────────────────────┐
  │   User   │──── start session ────►│                              │
  └──────────┘                        │       AI Session             │
       │                              │                              │
       │──── speak / type ──────────►│  ┌──────────────────────┐   │
       │                              │  │  Gemini AI Partner   │   │
       │◄─── AI response ────────────│  └──────────────────────┘   │
       │                              │                              │
       │◄─── turn score ─────────────│  ┌──────────────────────┐   │
       │                              │  │  Score Calculator    │   │
       │──── end session ───────────►│  └──────────────────────┘   │
       │                              │                              │
       │◄─── final report ───────────│  ┌──────────────────────┐   │
                                      │  │  Report Generator    │   │
                                      │  └──────────────────────┘   │
                                      └──────────────────────────────┘
```

### 4.3 Operating Tools and Technologies

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | React | 18.x | UI component library |
| Language (Frontend) | TypeScript | 5.x | Type-safe JavaScript |
| Build Tool | Vite | 7.x | Fast development server and bundler |
| Routing | TanStack Router | 1.x | File-based client-side routing |
| Styling | Tailwind CSS | 3.x | Utility-first CSS framework |
| UI Components | Shadcn UI | Latest | Accessible component primitives |
| Real-time (Client) | Socket.IO Client | 4.x | WebSocket client with fallback |
| Backend Runtime | Node.js | 18+ | JavaScript server runtime |
| Backend Framework | Express | 4.x | HTTP server and routing |
| Real-time (Server) | Socket.IO | 4.x | WebSocket server |
| Database | MongoDB | 6.x | NoSQL document database |
| ODM | Mongoose | 8.x | MongoDB object modelling |
| Authentication | JSON Web Token | 9.x | Stateless auth tokens |
| Password Hashing | bcryptjs | 2.x | Secure password storage |
| AI Integration | Google Gemini API | 2.0 Flash | Topic generation and evaluation |
| Validation | express-validator | 7.x | Request input validation |
| Unique IDs | uuid | 9.x | UUID generation for messages |
| Environment | dotenv | 16.x | Environment variable management |
| CORS | cors | 2.x | Cross-origin request handling |

### 4.4 Software Requirements

**Development Environment:**
- Node.js 18 or higher
- npm 9 or higher
- MongoDB 6.x (local) or MongoDB Atlas (cloud)
- Git 2.x
- Visual Studio Code (recommended IDE)

**Runtime Dependencies (Server):**
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.7.0",
  "mongoose": "^8.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0",
  "express-validator": "^7.0.0",
  "uuid": "^9.0.0"
}
```

**Runtime Dependencies (Client):**
```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "@tanstack/react-router": "^1.0.0",
  "socket.io-client": "^4.7.0",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.400.0",
  "sonner": "^1.5.0"
}
```

**Browser Requirements:**
- Chrome 90+ / Edge 90+ (recommended)
- Firefox 88+
- Safari 14.1+ (iOS 14.3+ for mobile)
- WebRTC support required for group sessions
- HTTPS required in production for camera/microphone access

### 4.5 Hardware Requirements

**Development Machine (Minimum):**
- CPU: Intel Core i5 or equivalent (4 cores)
- RAM: 8 GB
- Storage: 10 GB free space
- Network: Broadband internet connection
- Webcam and microphone (for testing group sessions)

**Server (Production Minimum):**
- CPU: 2 vCPUs
- RAM: 2 GB
- Storage: 20 GB SSD
- Network: 100 Mbps uplink
- OS: Ubuntu 20.04 LTS or higher

**Client (End User Minimum):**
- CPU: Any dual-core processor (2015 or newer)
- RAM: 4 GB
- Network: 5 Mbps per participant for video (1 Mbps for audio-only)
- Webcam: 720p (optional — audio-only mode available)
- Microphone: Built-in or external

---

## 5. System Design

### 5.1 ER Diagram

The Entity-Relationship diagram describes the persistent data model stored in MongoDB.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ENTITY-RELATIONSHIP DIAGRAM                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────────────────────────────────────────┐
│    USER      │          │                    SESSION                        │
├──────────────┤          ├──────────────────────────────────────────────────┤
│ _id (PK)     │          │ _id (PK)                                          │
│ name         │          │ sessionId (unique, e.g. "ABC-DEF-GHI")           │
│ email        │          │ type ("individual" | "group")                     │
│ password     │          │ topic                                             │
│ avatar       │          │ topicSource ("gemini" | "local")                  │
│ plan         │          │ hostId (FK → User)                                │
│ preferences  │          │ maxParticipants                                   │
│ createdAt    │          │ status ("waiting" | "active" | "ended")           │
│ updatedAt    │          │ startedAt                                         │
└──────┬───────┘          │ endedAt                                           │
       │                  │ duration (seconds)                                │
       │ 1                └──────────────────────────────────────────────────┘
       │                           │ 1                    │ 1
       │ hosts                     │ contains             │ contains
       │                           │ N                    │ N
       │              ┌────────────▼──────────┐  ┌───────▼──────────────────┐
       │              │    PARTICIPANT         │  │      PEER_RATING          │
       │              │  (embedded in Session) │  │  (embedded in Session)    │
       │              ├───────────────────────┤  ├──────────────────────────┤
       │              │ userId (FK → User)     │  │ _id                       │
       └──────────────┤ name                  │  │ raterId (FK → User)       │
                      │ email                 │  │ raterName                 │
                      │ joinedAt              │  │ rateeId (FK → User)       │
                      │ leftAt                │  │ rateeName                 │
                      │ isActive              │  │ communication (1-5)       │
                      │ report (embedded)     │  │ relevance (1-5)           │
                      └───────────────────────┘  │ confidence (1-5)          │
                                                  │ clarity (1-5)             │
                      ┌───────────────────────┐  │ comment                   │
                      │    REPORT             │  │ submittedAt               │
                      │  (embedded in         │  └──────────────────────────┘
                      │   Participant)        │
                      ├───────────────────────┤  ┌──────────────────────────┐
                      │ fluency (0-10)        │  │      MESSAGE              │
                      │ relevance (0-10)      │  │  (embedded in Session)    │
                      │ confidence (0-10)     │  ├──────────────────────────┤
                      │ fillerWords           │  │ senderId                  │
                      │ turns                 │  │ senderName                │
                      │ overallScore (0-10)   │  │ text                      │
                      │ feedback              │  │ ts                        │
                      │ aiFeedback            │  └──────────────────────────┘
                      │ peerScore (0-10)      │
                      │ peerFeedback          │
                      │ combinedScore (0-10)  │
                      └───────────────────────┘
```

### 5.2 Component Diagram

The component diagram illustrates the high-level architecture of the system and the relationships between major software components.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        React Application                             │    │
│  │                                                                       │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │    │
│  │  │  TanStack    │  │  Auth Module │  │    Dashboard Module       │  │    │
│  │  │  Router      │  │  (login,     │  │  (stats, streak, recent)  │  │    │
│  │  │              │  │   register)  │  └──────────────────────────┘  │    │
│  │  └──────────────┘  └──────────────┘                                 │    │
│  │                                                                       │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │                  Group Session Module                         │   │    │
│  │  │  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐  │   │    │
│  │  │  │ useGroupSession │  │ Participant  │  │  ChatSidebar   │  │   │    │
│  │  │  │ (WebRTC Hook)   │  │ Tile Grid    │  │                │  │   │    │
│  │  │  └────────┬────────┘  └──────────────┘  └────────────────┘  │   │    │
│  │  │           │                                                    │   │    │
│  │  │  ┌────────▼────────┐  ┌──────────────┐  ┌────────────────┐  │   │    │
│  │  │  │  Socket.IO      │  │  ControlBar  │  │  PeerRating    │  │   │    │
│  │  │  │  Client         │  │              │  │  Modal         │  │   │    │
│  │  │  └────────┬────────┘  └──────────────┘  └────────────────┘  │   │    │
│  │  └───────────┼────────────────────────────────────────────────┘   │    │
│  │              │                                                       │    │
│  │  ┌───────────▼──────────────────────────────────────────────────┐  │    │
│  │  │                      API Client (api.ts)                      │  │    │
│  │  │  auth | sessions | reports | history | topics | peerRatings  │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTP / WebSocket
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                              SERVER (Node.js)                                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Express Application                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │    │
│  │  │  /auth   │ │/sessions │ │/reports  │ │/history  │ │/topics   │ │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │    │
│  │  │  /peer-ratings       │  │  JWT Middleware + Rate Limiter        │ │    │
│  │  └──────────────────────┘  └──────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Socket.IO Server                                │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │  socketHandler.js                                             │   │    │
│  │  │  join-session | webrtc-offer | webrtc-answer | webrtc-ice    │   │    │
│  │  │  chat-message | toggle-audio | toggle-video | peer-updated   │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │  sessionStore.js (In-Memory)                                  │   │    │
│  │  │  participants: Map<socketId, Participant>                     │   │    │
│  │  │  userIndex:    Map<userId, socketId>  (deduplication)        │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         MongoDB (Mongoose)                           │    │
│  │              User Model          Session Model                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 State Diagram

#### 5.3.1 Session State Diagram

```
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         │ POST /api/sessions (host creates)
                         ▼
                    ┌─────────┐
                    │ WAITING │◄──────────────────────────────┐
                    └────┬────┘                               │
                         │ Second participant joins           │
                         │ (status auto-upgrades)             │
                         ▼                                    │
                    ┌─────────┐                               │
                    │ ACTIVE  │                               │
                    └────┬────┘                               │
                         │                                    │
              ┌──────────┴──────────┐                        │
              │                     │                        │
              ▼                     ▼                        │
    Last participant       Host calls POST                   │
    disconnects            /api/sessions/:id/end             │
              │                     │                        │
              └──────────┬──────────┘                        │
                         ▼                                    │
                    ┌─────────┐                               │
                    │  ENDED  │                               │
                    └─────────┘                               │
                         │ (TTL cleanup after 5 min)          │
                         └───────────────────────────────────┘
                           Session deleted from memory store
```

#### 5.3.2 WebRTC Connection State Diagram

```
  ┌──────────┐   getUserMedia()   ┌──────────────┐
  │  IDLE    │──────────────────►│ MEDIA_READY  │
  └──────────┘                   └──────┬───────┘
                                         │ join-session emitted
                                         ▼
                                  ┌──────────────┐
                                  │  SIGNALLING  │
                                  └──────┬───────┘
                                         │ offer/answer/ICE exchanged
                                         ▼
                                  ┌──────────────┐
                                  │  CONNECTING  │
                                  └──────┬───────┘
                                         │ ICE connected
                                         ▼
                                  ┌──────────────┐
                                  │  CONNECTED   │◄──────────────┐
                                  └──────┬───────┘               │
                                         │                        │ ICE restart
                                         │ ICE failed             │
                                         ▼                        │
                                  ┌──────────────┐               │
                                  │   FAILED     │───────────────┘
                                  └──────┬───────┘
                                         │ user leaves
                                         ▼
                                  ┌──────────────┐
                                  │   CLOSED     │
                                  └──────────────┘
```

### 5.4 Deployment Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT DIAGRAM                              │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐         ┌──────────────────────┐
  │   User A Browser     │         │   User B Browser     │
  │  (Chrome/Firefox)    │         │  (Chrome/Firefox)    │
  │                      │         │                      │
  │  React SPA           │         │  React SPA           │
  │  (Vite build)        │         │  (Vite build)        │
  └──────────┬───────────┘         └──────────┬───────────┘
             │                                 │
             │ HTTPS (REST API)                │ HTTPS (REST API)
             │ WSS  (Socket.IO)                │ WSS  (Socket.IO)
             │                                 │
             └──────────────┬──────────────────┘
                            │
                            ▼
             ┌──────────────────────────────┐
             │        Cloud Server           │
             │    (e.g. Render / Railway)    │
             │                               │
             │  ┌────────────────────────┐  │
             │  │   Node.js Process      │  │
             │  │   Express + Socket.IO  │  │
             │  │   Port 4000            │  │
             │  └────────────┬───────────┘  │
             │               │               │
             │  ┌────────────▼───────────┐  │
             │  │   MongoDB Atlas        │  │
             │  │   (Cloud Database)     │  │
             │  └────────────────────────┘  │
             └──────────────────────────────┘
                            │
                            │ WebRTC P2P (direct)
                            │ via STUN: stun.l.google.com
                            │
             ┌──────────────┴──────────────┐
             │   Peer-to-Peer Media Stream  │
             │   (Audio + Video, DTLS-SRTP) │
             └─────────────────────────────┘

  Note: The server only handles signalling (SDP + ICE).
  Media streams flow directly between browsers (P2P).
```

### 5.5 Sequence Diagram

#### 5.5.1 Group Session Join and WebRTC Connection

```
  User A          Server          User B
    │                │               │
    │─ POST /sessions ──────────────►│  (Create session)
    │◄─ { sessionId } ───────────────│
    │                │               │
    │─ socket connect ──────────────►│
    │─ join-session ────────────────►│
    │◄─ session-joined (peers:[]) ───│
    │◄─ room-roster (1 participant) ─│
    │                │               │
    │                │  socket connect ──────────────►│
    │                │  join-session ─────────────────►│
    │◄─ peer-joined ─│               │
    │                │◄─ session-joined (peers:[A]) ───│
    │                │◄─ room-roster (2 participants) ─│
    │                │               │
    │─ webrtc-offer ────────────────►│──────────────────►│
    │                │               │◄─ webrtc-offer ───│
    │                │               │
    │                │◄─ webrtc-answer ──────────────────│
    │◄─ webrtc-answer ──────────────│               │
    │                │               │
    │─ webrtc-ice ──────────────────►│──────────────────►│
    │                │◄─ webrtc-ice ─────────────────────│
    │◄─ webrtc-ice ─────────────────│               │
    │                │               │
    │◄══════════════ P2P Media Stream ══════════════►│
    │                │               │
```

#### 5.5.2 Chat Message Flow

```
  User A          Server          User B
    │                │               │
    │─ chat-message ────────────────►│
    │  { text: "Hello" }             │
    │                │               │
    │                │ verify JWT     │
    │                │ get participant│
    │                │ rate limit check
    │                │               │
    │◄─ chat-message ───────────────│  (broadcast to room)
    │  { senderId: userA_id,         │
    │    senderName: "Alice",        │──────────────────►│
    │    text: "Hello", ts: ... }    │  chat-message     │
    │  isOwn: true                   │  isOwn: false     │
    │                │               │               │
```

### 5.6 Database Design

The database uses MongoDB with Mongoose ODM. The schema design follows an **embedded document** pattern for performance — participant reports, messages, and peer ratings are embedded within the Session document rather than stored in separate collections. This avoids expensive JOIN operations and keeps all session data in a single document.

#### 5.6.1 User Collection

```javascript
{
  _id:       ObjectId,          // Primary key
  name:      String,            // Display name (max 100 chars)
  email:     String,            // Unique, lowercase, indexed
  password:  String,            // bcrypt hash (12 rounds)
  avatar:    String,            // URL or empty string
  plan:      "free" | "pro",    // Subscription tier
  preferences: {
    micEnabled:        Boolean,
    noiseSuppression:  Boolean,
    echoCancellation:  Boolean,
    practiceReminders: Boolean,
    sessionSummary:    Boolean,
    weeklyReport:      Boolean,
    aiPersona:         "friendly" | "critical" | "devils-advocate" | "neutral"
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 5.6.2 Session Collection

```javascript
{
  _id:        ObjectId,
  sessionId:  String,           // Unique code e.g. "ABC-DEF-GHI", indexed
  type:       "individual" | "group",
  topic:      String,
  topicSource:"gemini" | "local",
  hostId:     ObjectId,         // ref: User
  maxParticipants: Number,      // 1-50, default 12
  status:     "waiting" | "active" | "ended",
  startedAt:  Date,
  endedAt:    Date,
  duration:   Number,           // seconds

  participants: [{              // Embedded array
    userId:   ObjectId,         // ref: User
    name:     String,
    email:    String,
    joinedAt: Date,
    leftAt:   Date,
    isActive: Boolean,
    report: {                   // Embedded performance report
      fluency:      Number,     // 0-10
      relevance:    Number,     // 0-10
      confidence:   Number,     // 0-10
      fillerWords:  Number,
      turns:        Number,
      overallScore: Number,     // 0-10
      feedback:     String,
      aiFeedback:   String,
      peerScore:    Number,     // 0-10, populated after peer ratings
      peerFeedback: String,
      combinedScore:Number      // 0-10, 60% AI + 40% peer
    }
  }],

  messages: [{                  // Embedded chat messages
    senderId:   String,
    senderName: String,
    text:       String,         // max 2000 chars
    ts:         Date
  }],

  peerRatings: [{               // Embedded peer ratings
    _id:           ObjectId,
    raterId:       ObjectId,    // ref: User
    raterName:     String,
    rateeId:       ObjectId,    // ref: User
    rateeName:     String,
    communication: Number,      // 1-5
    relevance:     Number,      // 1-5
    confidence:    Number,      // 1-5
    clarity:       Number,      // 1-5
    comment:       String,      // max 500 chars
    submittedAt:   Date
  }],

  peerRatingSubmitters: [ObjectId], // Users who have submitted ratings

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `sessionId`: unique index for fast lookup by session code
- `hostId + status`: compound index for listing user's active sessions
- `participants.userId`: index for history queries
- `startedAt`: descending index for chronological sorting
- `peerRatings.raterId + peerRatings.rateeId`: compound index for rating queries

### 5.7 Class Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLASS DIAGRAM                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────────────────────────┐
│       User           │         │              Session                      │
├──────────────────────┤         ├──────────────────────────────────────────┤
│ - _id: ObjectId      │         │ - _id: ObjectId                           │
│ - name: string       │         │ - sessionId: string                       │
│ - email: string      │         │ - type: SessionType                       │
│ - password: string   │         │ - topic: string                           │
│ - avatar: string     │         │ - hostId: ObjectId                        │
│ - plan: PlanType     │         │ - status: SessionStatus                   │
│ - preferences: Prefs │         │ - participants: Participant[]              │
├──────────────────────┤         │ - messages: Message[]                     │
│ + comparePassword()  │         │ - peerRatings: PeerRating[]               │
│ + toJSON()           │         │ - duration: number                        │
└──────────────────────┘         ├──────────────────────────────────────────┤
                                  │ + hasActiveParticipant(userId): boolean   │
                                  │ + isFull(): boolean                       │
                                  │ + durationFormatted: string (virtual)     │
                                  └──────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────────────────────────┐
│    Participant       │         │              Report                       │
├──────────────────────┤         ├──────────────────────────────────────────┤
│ - userId: ObjectId   │         │ - fluency: number (0-10)                  │
│ - name: string       │         │ - relevance: number (0-10)                │
│ - joinedAt: Date     │         │ - confidence: number (0-10)               │
│ - leftAt: Date       │         │ - fillerWords: number                     │
│ - isActive: boolean  │         │ - turns: number                           │
│ - report: Report     │         │ - overallScore: number (0-10)             │
└──────────────────────┘         │ - feedback: string                        │
                                  │ - peerScore: number                       │
┌──────────────────────┐         │ - combinedScore: number                   │
│    PeerRating        │         └──────────────────────────────────────────┘
├──────────────────────┤
│ - raterId: ObjectId  │         ┌──────────────────────────────────────────┐
│ - rateeId: ObjectId  │         │           ScoreCalculator                 │
│ - communication: num │         ├──────────────────────────────────────────┤
│ - relevance: num     │         │ + countFillerWords(text): number          │
│ - confidence: num    │         │ + fillerPenalty(count): number            │
│ - clarity: num       │         │ + calculateOverallScore(metrics): number  │
│ - comment: string    │         │ + generateFeedback(metrics): string       │
└──────────────────────┘         │ + aggregateReports(reports): object       │
                                  │ + clamp(value, min, max): number          │
                                  └──────────────────────────────────────────┘
```

### 5.8 Input/Output Design

#### 5.8.1 Input Design

**Registration Form:**
- Name: Text input, 1–100 characters, required
- Email: Email input, valid format, unique, required
- Password: Password input, minimum 6 characters, required

**Login Form:**
- Email: Email input, required
- Password: Password input, required

**Session Creation:**
- Type: Radio button (Individual / Group)
- Max Participants: Number input, 1–50 (group only)
- Topic: Optional text input (auto-generated if empty)

**Chat Message:**
- Text: Text input, 1–2000 characters, Enter to send

**Peer Rating:**
- Communication: Star rating 1–5, required
- Relevance: Star rating 1–5, required
- Confidence: Star rating 1–5, required
- Clarity: Star rating 1–5, required
- Comment: Textarea, optional, max 500 characters

#### 5.8.2 Output Design

**Dashboard:**
- Average Overall Score (0–10, 1 decimal place)
- Total Sessions count
- Average Fluency percentage
- Practice Streak (consecutive days)
- Recent Sessions (last 3, with score bar chart)

**Session Report:**
- Overall Score with gradient display
- Individual metric scores (fluency, relevance, confidence)
- Filler word count
- Turn count
- AI-generated textual feedback
- Peer score and combined score (post-rating)
- Leaderboard ranking among participants

**Group Session Room:**
- Responsive video grid (1–12+ participants)
- Participant name overlay on each tile
- Audio/video mute indicators
- Speaking indicator (green ring)
- Connection status (connected/connecting/disconnected)
- Live chat sidebar with sender attribution

---

## 6. Implementation

### 6.1 Authentication Module

The authentication module handles user registration, login, session management, and profile updates. It is implemented as a REST API at `/api/auth` with the following endpoints:

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | No | Create a new user account |
| `/api/auth/login` | POST | No | Authenticate and receive JWT |
| `/api/auth/me` | GET | Yes | Fetch current user profile |
| `/api/auth/profile` | PATCH | Yes | Update name or password |
| `/api/auth/preferences` | PATCH | Yes | Update audio/notification preferences |

**Registration Flow:**
1. Client submits name, email, and password.
2. Server validates input using `express-validator`.
3. Server checks for duplicate email in MongoDB.
4. Password is hashed using bcrypt with 12 salt rounds.
5. User document is created in MongoDB.
6. JWT is signed with the user's `_id`, `name`, and `email`.
7. Token and user object are returned to the client.
8. Client stores the token in `localStorage` under the key `gdbot_token`.

**Frontend Implementation:**
The `useCurrentUser` hook implements a module-level singleton cache. The `/api/auth/me` endpoint is called exactly once per page load, and the result is shared across all components via a listener pattern. This prevents redundant API calls when multiple components need the current user.

**Security Measures:**
- Passwords are never stored in plain text (bcrypt, 12 rounds).
- JWT tokens expire after 7 days.
- The `toJSON()` method on the User model strips the password field before serialisation.
- Rate limiting: 20 login/register attempts per 15 minutes per IP in production.
- The JWT is verified on every Socket.IO connection handshake, attaching `socket.data.user` with the verified identity.

### 6.2 Dashboard Module

The dashboard is the primary landing page after login. It displays:

1. **Welcome Banner:** Personalised greeting with the user's first name and quick-start buttons for AI and group sessions.
2. **Statistics Cards:** Four metric cards showing average overall score, total sessions, average fluency percentage, and practice streak.
3. **Recent Sessions:** The three most recent ended sessions, each showing topic, date, duration, overall score, and a visual score bar.

**Streak Calculation Algorithm:**
The streak is calculated server-side in the `/api/history/stats` endpoint. The algorithm:
1. Fetches all ended sessions for the user.
2. Extracts unique session dates, normalised to midnight UTC.
3. Sorts dates newest-first.
4. Checks if the most recent session was within the last 1 day (today or yesterday).
5. Walks backwards through consecutive dates, incrementing the streak counter until a gap of more than 1 day is found.

**Data Freshness:**
The dashboard refetches data in three scenarios:
- On initial mount (`useEffect`).
- When the browser tab regains focus (`visibilitychange` event via `usePageFocus` hook).
- When a `session-ended` custom DOM event is dispatched (fired after peer rating submission or session leave).

### 6.3 AI Individual Session Module

The AI session module (`/gd/:sessionId`) provides a one-on-one practice environment with a Gemini AI partner.

**Topic Generation (`useAITopic` hook):**
- Calls the Gemini 2.0 Flash API with a category-specific prompt.
- Rotates through 8 topic categories (AI, cybersecurity, cloud computing, etc.).
- Implements three resilience layers:
  1. **In-flight deduplication:** Multiple component mounts share one fetch promise.
  2. **5-minute cache:** Avoids re-calling the API on navigation.
  3. **60-minute rate-limit cooldown:** After a 429 response, falls back to local topics.
- Falls back to a curated local topic bank if the API is unavailable.

**Conversation Flow:**
1. User types or speaks a response.
2. The message is sent to `/api/chat/gd` with the full conversation history.
3. The server calls Gemini with a system prompt instructing it to act as a GD participant.
4. The AI response and per-turn scores (fluency, relevance, confidence, filler words) are returned.
5. Scores are accumulated across turns.
6. On session end, the final report is submitted to `/api/reports/:sessionId`.

**Scoring Model:**
```
Overall Score = (Fluency × 0.35) + (Relevance × 0.35) + (Confidence × 0.30) − Filler Penalty

Filler Penalty:
  0–2 fillers  → 0.0
  3–5 fillers  → 0.5
  6–10 fillers → 1.0
  11+ fillers  → 1.5
```

### 6.4 Group Discussion Session Module

The group session module is the most complex component of the system. It consists of:

**Backend (Socket.IO):**
- `socketHandler.js`: Handles all real-time events.
- `sessionStore.js`: In-memory store with two data structures:
  - `participants: Map<socketId, Participant>` — active connections.
  - `userIndex: Map<userId, socketId>` — deduplication index.

**Frontend (`useGroupSession` hook):**
- Manages the Socket.IO connection lifecycle.
- Handles WebRTC peer connection creation, offer/answer exchange, and ICE candidate buffering.
- Implements a media acquisition fallback chain: HD video → basic video → audio-only → no media.
- Deduplicates participants by `userId` in `upsertParticipant`.

**Responsive Grid Layout:**
The video grid adapts dynamically based on participant count:

| Participants | Layout |
|---|---|
| 1 | Full screen |
| 2 | 1×2 split (stacked on mobile) |
| 3 | 2–3 column grid |
| 4 | 2×2 grid |
| 5–6 | 2–3 column grid |
| 7–9 | 3 column grid |
| 10–12 | 3–4 column grid |
| 13+ | 4–5 column grid with scrolling |

**Participant Deduplication:**
When an authenticated user reconnects (e.g., after a page refresh), the server:
1. Detects the existing `userId` in `userIndex`.
2. Removes the stale socket entry from `participants`.
3. Emits `peer-left` for the stale socket to all peers.
4. Inserts the new socket entry.
5. Emits `peer-joined` for the new socket.

This prevents ghost tiles from appearing in the grid.

### 6.5 Real-Time Chat Module

The chat module provides session-scoped text messaging with correct per-user identity.

**Identity Flow:**
1. The client sends the JWT in the Socket.IO handshake `auth` object.
2. The server's JWT middleware verifies the token and attaches `socket.data.user = { id, name, email }`.
3. When a `chat-message` event is received, the server uses `socket.data.user.name` (verified) as `senderName` and `socket.data.user.id` (stable MongoDB `_id`) as `senderId`.
4. The message is broadcast to all participants in the session room.
5. The client tags each received message with `isOwn: true` if `msg.senderId === userIdRef.current`.

**Message Rendering:**
- Own messages: right-aligned, gradient background, "You · timestamp" label.
- Others' messages: left-aligned, glass background, "SenderName · timestamp" label.

**Persistence:**
Each message is asynchronously persisted to the `messages` array in the Session document in MongoDB.

### 6.6 Performance Report Module

The report module (`/report/:sessionId`) displays a detailed post-session analysis.

**Report Components:**
- **Overall Score:** Large gradient number display (0–10).
- **Metric Breakdown:** Individual scores for fluency, relevance, and confidence with visual bars.
- **Filler Words:** Count with contextual feedback.
- **Turn Count:** Number of speaking turns with engagement assessment.
- **AI Feedback:** Multi-sentence textual feedback generated by the scoring model.
- **Peer Score:** Average score from peer ratings (populated after all participants submit).
- **Combined Score:** Weighted combination (60% AI score + 40% peer score).
- **Leaderboard:** Ranking of all participants by overall score.

**Auto-Feedback Generation:**
If a report has data but no stored feedback string, the `generateFeedback()` function in `scoreCalculator.js` generates contextual feedback based on score thresholds for each metric.

### 6.7 Peer Rating Module

The peer rating module allows participants to evaluate each other after a session ends.

**Rating Criteria (each 1–5 stars):**
1. **Communication:** Clarity and structure of expression.
2. **Relevance:** How on-topic and focused their points were.
3. **Confidence:** Assertiveness and conviction.
4. **Clarity of Ideas:** How well ideas were explained.

**Submission Rules:**
- A user must rate ALL other participants (all-or-nothing submission).
- Self-rating is blocked.
- Duplicate submissions are rejected (409 Conflict).
- Sessions in `waiting` status do not accept ratings.

**Aggregate Calculation:**
After submission, the server recalculates peer aggregates for all participants:
```
Peer Score = (Communication × 0.30) + (Relevance × 0.25) + (Confidence × 0.25) + (Clarity × 0.20)
```
Where each criterion is first converted from the 1–5 scale to 0–10:
```
Score_10 = (score_5 − 1) × (10 / 4)
```

**Persistence Fix:**
The `peerRatings` and `peerRatingSubmitters` arrays are explicitly marked as modified using `session.markModified("peerRatings")` before saving, ensuring Mongoose detects the in-place array mutations and persists them to MongoDB.

### 6.8 Session History Module

The history module (`/history`) provides a paginated, filterable, and searchable list of past sessions.

**Features:**
- **Pagination:** Configurable page size (default 20, max 50).
- **Sorting:** Newest, oldest, highest score, lowest score, longest duration, shortest duration.
- **Filtering:** By status (ended/active/all), type (individual/group/all), and date range.
- **Search:** Full-text search on topic field using MongoDB regex.
- **Detail View:** Full session detail including all participants, their reports, and the leaderboard.
- **Delete:** Soft-delete (removes user from participants array without deleting the session).

**History Entry Shape:**
Each entry includes: `sessionId`, `type`, `topic`, `date`, `duration`, `participantCount`, and `myReport` (the requesting user's own performance report).

### 6.9 User Profile and Preferences Module

The profile module (`/profile`) allows users to:
- Update their display name.
- Change their password (requires current password verification).
- Configure audio preferences (microphone, noise suppression, echo cancellation).
- Set notification preferences (practice reminders, session summary, weekly report).
- Choose an AI persona for individual sessions (friendly, critical, devil's advocate, neutral).

### 6.10 Topic Generation Module

The topic generation module provides discussion topics through two channels:

**Gemini API (`/api/topics/generate`):**
- Calls Gemini 2.0 Flash with a structured prompt.
- Rotates through 8 topic categories.
- Returns a single sentence topic (10–25 words).
- Includes rate-limit handling and local fallback.

**Local Topic Bank (`/api/topics/categories`, `/api/topics/category/:name`):**
- A curated set of topics organised by category.
- Used as fallback when Gemini is unavailable or rate-limited.
- Categories include: technology, society, environment, economics, education, health, politics, and ethics.

---

## 7. Coding

### 7.1 Technologies Used

#### 7.1.1 React 18 with TypeScript

React 18 introduces concurrent rendering features and the `useId` hook. The project uses React's `StrictMode` which double-invokes effects in development to surface side-effect bugs. TypeScript provides compile-time type safety, reducing runtime errors and improving IDE support.

Key patterns used:
- `useCallback` for stable function references in effects.
- `useRef` for mutable values that should not trigger re-renders (socket, peer connections, streams).
- `useEffect` with careful dependency arrays to avoid infinite loops.
- Custom hooks (`useGroupSession`, `useAITopic`, `useCurrentUser`, `usePageFocus`) for logic encapsulation.

#### 7.1.2 TanStack Router

TanStack Router provides file-based routing with full TypeScript support. Routes are defined as files in `src/routes/`, and the router generates a type-safe route tree automatically. This enables type-checked navigation with `navigate({ to: "/dashboard" })`.

#### 7.1.3 Socket.IO

Socket.IO provides reliable bidirectional communication with automatic fallback from WebSocket to HTTP long-polling. Key features used:
- **Rooms:** Each session is a Socket.IO room, isolating broadcasts.
- **Middleware:** JWT verification on connection handshake.
- **Acknowledgements:** Not used (fire-and-forget for signalling).
- **Reconnection:** Automatic with configurable delay and attempt count.

#### 7.1.4 WebRTC

The WebRTC implementation uses the browser's native `RTCPeerConnection` API. Key implementation details:
- **ICE Candidate Buffering:** Candidates arriving before `setRemoteDescription` are queued and flushed after the remote description is set.
- **Mesh Topology:** Each participant connects directly to every other participant.
- **Track Management:** Local tracks are added to peer connections before creating offers. Late-arriving streams (when camera access is delayed) trigger renegotiation.
- **ICE Restart:** Automatic ICE restart on connection failure.

#### 7.1.5 MongoDB with Mongoose

MongoDB's document model is well-suited for the session data structure where participants, messages, and ratings are naturally embedded. Mongoose provides:
- Schema validation with type checking.
- Pre-save hooks for password hashing.
- Virtual properties for computed fields.
- `markModified()` for explicit change tracking on nested arrays.

### 7.2 Sample Code and Logic

#### 7.2.1 JWT Socket Middleware (Server)

```javascript
// index.js — Socket.IO JWT verification middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? "fallback_secret");
      socket.data.user = payload; // { id, name, email }
    } catch {
      socket.data.user = null; // Invalid token — treat as guest
    }
  } else {
    socket.data.user = null;
  }
  next(); // Always allow connection
});
```

#### 7.2.2 Participant Deduplication (Session Store)

```javascript
// sessionStore.js — addParticipant with userId deduplication
export function addParticipant(sessionId, socketId, name, userId = null) {
  const session = sessions.get(sessionId);
  if (!session) return { participant: null, evictedSocketId: null };

  let evictedSocketId = null;
  if (userId) {
    const existingSocketId = session.userIndex.get(userId);
    if (existingSocketId && existingSocketId !== socketId) {
      // Remove stale socket entry for this user
      session.participants.delete(existingSocketId);
      evictedSocketId = existingSocketId;
    }
    session.userIndex.set(userId, socketId);
  }

  const participant = { socketId, userId, name, audioEnabled: true,
    videoEnabled: true, screenSharing: false, isSpeaking: false, joinedAt: new Date() };
  session.participants.set(socketId, participant);
  return { participant, evictedSocketId };
}
```

#### 7.2.3 WebRTC Peer Connection Creation (Client)

```typescript
// useGroupSession.ts — createPeer with ICE buffering
const createPeer = useCallback((remoteSocketId: string, isInitiator: boolean, socket: Socket) => {
  if (peersRef.current.has(remoteSocketId)) {
    return peersRef.current.get(remoteSocketId)!;
  }

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peersRef.current.set(remoteSocketId, pc);
  icePendingRef.current.set(remoteSocketId, []);

  // Add local tracks if stream is available
  localStreamRef.current?.getTracks().forEach(track => {
    pc.addTrack(track, localStreamRef.current!);
  });

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit("webrtc-ice", { targetSocketId: remoteSocketId, candidate });
  };

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    if (remoteStream) upsertParticipant({ id: remoteSocketId, stream: remoteStream });
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") pc.restartIce();
  };

  if (isInitiator) {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => socket.emit("webrtc-offer", {
        targetSocketId: remoteSocketId, sdp: pc.localDescription
      }));
  }
  return pc;
}, [upsertParticipant]);
```

#### 7.2.4 Streak Calculation (Server)

```javascript
// history.js — Correct streak calculation using UTC dates
const uniqueDates = sessions
  .map((s) => {
    const d = new Date(s.startedAt);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  })
  .filter((d, i, a) => a.findIndex((x) => x.getTime() === d.getTime()) === i)
  .sort((a, b) => b - a); // newest first

let streak = 0;
if (uniqueDates.length > 0) {
  const todayUTC = new Date();
  const todayMidnight = new Date(Date.UTC(
    todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()
  ));
  const MS_PER_DAY = 86_400_000;
  const daysSinceMostRecent = Math.round((todayMidnight - uniqueDates[0]) / MS_PER_DAY);

  if (daysSinceMostRecent <= 1) {
    streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = Math.round((uniqueDates[i - 1] - uniqueDates[i]) / MS_PER_DAY);
      if (diff === 1) streak++;
      else break;
    }
  }
}
```

#### 7.2.5 Peer Rating Aggregate Calculation (Server)

```javascript
// peerRatings.js — Convert 1-5 to 0-10 and compute weighted peer score
function toTen(v) {
  return clamp((v - 1) * (10 / 4)); // 1→0, 3→5, 5→10
}

function aggregatePeerRatings(ratings) {
  if (!ratings.length) return null;
  const avg = (key) =>
    parseFloat((ratings.reduce((s, r) => s + toTen(r[key]), 0) / ratings.length).toFixed(2));

  const communication = avg("communication");
  const relevance     = avg("relevance");
  const confidence    = avg("confidence");
  const clarity       = avg("clarity");

  // Weighted: communication 30%, relevance 25%, confidence 25%, clarity 20%
  const peerScore = clamp(
    communication * 0.30 + relevance * 0.25 + confidence * 0.25 + clarity * 0.20
  );
  return { peerScore, communication, relevance, confidence, clarity, raterCount: ratings.length };
}
```

#### 7.2.6 Media Acquisition Fallback Chain (Client)

```typescript
// useGroupSession.ts — Graceful media fallback
const acquireMedia = async (): Promise<MediaStream | null> => {
  const attempts = [
    () => navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    }),
    () => navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
    () => navigator.mediaDevices.getUserMedia({ video: false, audio: true }),
  ];

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      console.warn("[WebRTC] getUserMedia attempt failed:", err.message);
    }
  }
  return null; // Join without media
};
```

#### 7.2.7 Overall Score Calculation

```javascript
// scoreCalculator.js — Weighted score with filler penalty
export function calculateOverallScore({ fluency, relevance, confidence, fillerWords = 0 }) {
  const penalty    = fillerPenalty(fillerWords);
  const adjFluency = clamp(fluency - penalty);
  const overall    = (adjFluency * 0.35) + (relevance * 0.35) + (confidence * 0.30);
  return clamp(overall);
}

export function fillerPenalty(fillerCount) {
  if (fillerCount <= 2)  return 0;
  if (fillerCount <= 5)  return 0.5;
  if (fillerCount <= 10) return 1.0;
  return 1.5;
}
```

---

## 8. System Testing

### 8.1 Testing Methodology

The project employs a multi-layered testing strategy:

#### 8.1.1 Unit Testing

Individual functions in `scoreCalculator.js` were tested in isolation to verify correct score computation across boundary conditions (zero scores, maximum scores, filler word thresholds).

#### 8.1.2 Integration Testing

The `test-integration.js` script tests the complete REST API layer including authentication, session creation, joining, leaving, and report submission. It verifies that all endpoints return correct HTTP status codes and response shapes.

#### 8.1.3 End-to-End Signalling Testing

The `test-signaling.js` script is the most comprehensive test suite. It creates real Socket.IO connections and exercises the complete WebRTC signalling flow:

1. Session creation via REST API.
2. Two socket connections (Alice and Bob).
3. Join events and roster verification.
4. WebRTC offer/answer/ICE exchange.
5. Cross-session security validation.
6. Audio/video/screen toggle events.
7. Speaking detection broadcast.
8. Chat message broadcast (both directions).
9. Rate limiting enforcement.
10. Ping/pong latency check.
11. Leave event and roster update.
12. Clean disconnection.

**Result: 17/17 tests passing.**

#### 8.1.4 Manual Browser Testing

Multi-browser testing was performed using:
- Chrome (primary) and Firefox (secondary) on the same machine.
- Chrome on desktop and Safari on iOS for mobile testing.
- Two separate user accounts to verify identity isolation.

Test scenarios included:
- Two users joining and seeing each other's video.
- User refreshing the page (reconnection and deduplication).
- User with camera blocked (audio-only fallback).
- Late joiner connecting after session started.
- Chat messages appearing with correct sender names.
- Peer rating submission and score persistence across server restart.

### 8.2 Test Cases and Results

#### 8.2.1 Authentication Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-01 | Register with valid data | name, email, password | 201, JWT token returned | 201, token returned | ✅ PASS |
| TC-02 | Register with duplicate email | existing email | 409 Conflict | 409 Conflict | ✅ PASS |
| TC-03 | Register with short password | password < 6 chars | 400 Validation error | 400 Validation error | ✅ PASS |
| TC-04 | Login with correct credentials | valid email + password | 200, JWT token | 200, token returned | ✅ PASS |
| TC-05 | Login with wrong password | valid email, wrong password | 401 Unauthorized | 401 Unauthorized | ✅ PASS |
| TC-06 | Access protected route without token | No Authorization header | 401 Unauthorized | 401 Unauthorized | ✅ PASS |
| TC-07 | Access protected route with expired token | Expired JWT | 401 Unauthorized | 401 Unauthorized | ✅ PASS |
| TC-08 | Update profile with correct current password | valid currentPassword | 200, updated user | 200, updated user | ✅ PASS |
| TC-09 | Update profile with wrong current password | invalid currentPassword | 400 Bad Request | 400 Bad Request | ✅ PASS |

#### 8.2.2 Session Management Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-10 | Create group session | type: "group" | 201, sessionId generated | 201, sessionId returned | ✅ PASS |
| TC-11 | Join existing session | valid sessionId | 200, session details | 200, session details | ✅ PASS |
| TC-12 | Join non-existent session | invalid sessionId | 404 Not Found | 404 Not Found | ✅ PASS |
| TC-13 | Join full session | sessionId at capacity | 409 Conflict | 409 Conflict | ✅ PASS |
| TC-14 | Leave session | valid sessionId | 200, remainingParticipants | 200, count returned | ✅ PASS |
| TC-15 | Last user leaves — session ends | 1 participant leaves | status: "ended" | status: "ended" | ✅ PASS |
| TC-16 | Validate session ID | valid sessionId | { valid: true } | { valid: true } | ✅ PASS |
| TC-17 | Validate invalid session ID | random string | { valid: false } | { valid: false } | ✅ PASS |

#### 8.2.3 WebRTC Signalling Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-18 | Alice joins — empty room | join-session | session-joined, peers: [] | peers: [] | ✅ PASS |
| TC-19 | Bob joins — Alice gets peer-joined | join-session | peer-joined event | peer-joined received | ✅ PASS |
| TC-20 | Room roster after 2 joins | 2 participants | roster: 2 entries | roster: 2 entries | ✅ PASS |
| TC-21 | WebRTC offer forwarded | webrtc-offer to Alice | Alice receives offer | offer received | ✅ PASS |
| TC-22 | WebRTC answer forwarded | webrtc-answer to Bob | Bob receives answer | answer received | ✅ PASS |
| TC-23 | ICE candidates exchanged | webrtc-ice both ways | Both receive ICE | ICE received | ✅ PASS |
| TC-24 | Cross-session signal blocked | offer to wrong session | CROSS_SESSION error | error returned | ✅ PASS |
| TC-25 | Audio toggle broadcast | toggle-audio: false | peer-updated received | audioEnabled: false | ✅ PASS |
| TC-26 | Video toggle broadcast | toggle-video: false | peer-updated received | videoEnabled: false | ✅ PASS |
| TC-27 | Screen share broadcast | toggle-screen: true | peer-updated received | screenSharing: true | ✅ PASS |
| TC-28 | Speaking detection | speaking: true | peer-updated to others | isSpeaking: true | ✅ PASS |
| TC-29 | Chat message broadcast | chat-message text | Both users receive | message received | ✅ PASS |
| TC-30 | Rate limiting | 35 messages rapidly | RATE_LIMITED error | error after 30 | ✅ PASS |
| TC-31 | Ping/pong | ping event | pong with timestamp | pong received | ✅ PASS |
| TC-32 | Peer left event | Bob disconnects | Alice gets peer-left | peer-left received | ✅ PASS |
| TC-33 | Roster updated after leave | Bob leaves | roster: 1 entry | roster: 1 entry | ✅ PASS |

#### 8.2.4 Peer Rating Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-34 | Submit valid ratings | all criteria 1-5 | 201, submitted: N | 201, submitted | ✅ PASS |
| TC-35 | Submit self-rating | rateeId = own userId | 400 Bad Request | 400 Bad Request | ✅ PASS |
| TC-36 | Submit duplicate ratings | second submission | 409 Conflict | 409 Conflict | ✅ PASS |
| TC-37 | Submit incomplete ratings | rate only 1 of 2 peers | 400 Bad Request | 400 Bad Request | ✅ PASS |
| TC-38 | Ratings persist after restart | submit, restart server | ratings still in DB | ratings retrieved | ✅ PASS |
| TC-39 | Peer score calculated correctly | 4 criteria × 2 raters | weighted average | correct score | ✅ PASS |
| TC-40 | Combined score = 60% AI + 40% peer | known AI and peer scores | correct combined | correct combined | ✅ PASS |

#### 8.2.5 Participant Deduplication Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-41 | User refreshes page | same userId, new socket | 1 tile in grid | 1 tile shown | ✅ PASS |
| TC-42 | Stale socket evicted | reconnect before disconnect | peer-left for old socket | peer-left emitted | ✅ PASS |
| TC-43 | Participant count accurate | 2 users, 1 refreshes | count = 2 | count = 2 | ✅ PASS |
| TC-44 | Ghost tile not shown | user reconnects | no duplicate tile | no duplicate | ✅ PASS |

#### 8.2.6 History and Statistics Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-45 | List history — default | no filters | ended sessions, newest first | correct list | ✅ PASS |
| TC-46 | Filter by type | type: "group" | only group sessions | filtered correctly | ✅ PASS |
| TC-47 | Sort by score | sort: "score_high" | highest score first | sorted correctly | ✅ PASS |
| TC-48 | Search by topic | q: "AI" | sessions with "AI" in topic | correct results | ✅ PASS |
| TC-49 | Streak — consecutive days | 3 sessions on 3 days | streak: 3 | streak: 3 | ✅ PASS |
| TC-50 | Streak — gap in days | session 2 days ago | streak: 0 | streak: 0 | ✅ PASS |
| TC-51 | Streak — session yesterday | session yesterday | streak: 1 | streak: 1 | ✅ PASS |
| TC-52 | Stats — no sessions | new user | all zeros | all zeros | ✅ PASS |

#### 8.2.7 Chat Identity Test Cases

| TC# | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-53 | Own message right-aligned | User A sends message | isOwn: true, right side | right-aligned | ✅ PASS |
| TC-54 | Other's message left-aligned | User B sends message | isOwn: false, left side | left-aligned | ✅ PASS |
| TC-55 | Sender name correct | User B sends "Hello" | senderName: "Bob" | "Bob" shown | ✅ PASS |
| TC-56 | No duplicate messages | 1 message sent | 1 message received | 1 message shown | ✅ PASS |
| TC-57 | Identity after reconnect | User reconnects, sends msg | correct name shown | correct name | ✅ PASS |

### 8.3 Test Summary

| Module | Total Tests | Passed | Failed | Pass Rate |
|---|---|---|---|---|
| Authentication | 9 | 9 | 0 | 100% |
| Session Management | 8 | 8 | 0 | 100% |
| WebRTC Signalling | 16 | 16 | 0 | 100% |
| Peer Rating | 7 | 7 | 0 | 100% |
| Participant Deduplication | 4 | 4 | 0 | 100% |
| History & Statistics | 8 | 8 | 0 | 100% |
| Chat Identity | 5 | 5 | 0 | 100% |
| **Total** | **57** | **57** | **0** | **100%** |

All 57 test cases passed. The automated signalling test suite (17 tests) runs in under 5 seconds and is executed as part of the development workflow before each deployment.

---

## 9. Conclusion

GD Bot successfully achieves all primary and secondary objectives defined at the outset of the project. The platform delivers a comprehensive, browser-based group discussion practice environment that combines AI-powered evaluation, real-time multi-user video conferencing, peer feedback, and historical progress tracking in a single, cohesive application.

### Key Achievements

**Technical Achievements:**
- A fully functional WebRTC mesh topology supporting 2–12 simultaneous participants with responsive grid layout.
- A robust Socket.IO signalling layer with JWT-verified identity, ICE candidate buffering, and automatic reconnection.
- A participant deduplication system using a dual-index data structure (`participants` Map + `userIndex` Map) that eliminates ghost tiles on reconnection.
- A correct streak calculation algorithm using UTC-normalised dates that handles all edge cases (today, yesterday, gaps).
- Persistent peer rating storage with explicit `markModified()` calls ensuring Mongoose detects in-place array mutations.
- A media acquisition fallback chain (HD video → basic video → audio-only → no media) ensuring graceful degradation.
- A Gemini AI integration with three resilience layers: in-flight deduplication, 5-minute cache, and 60-minute rate-limit cooldown.

**Functional Achievements:**
- Complete user authentication with JWT and bcrypt.
- AI-powered individual practice sessions with per-turn scoring.
- Multi-user group sessions with video, audio, chat, and peer rating.
- Session history with pagination, filtering, sorting, and search.
- Personalised dashboard with aggregate statistics and streak tracking.
- User profile management with audio and notification preferences.

**Quality Achievements:**
- 57/57 test cases passing across all modules.
- 17/17 automated end-to-end signalling tests passing.
- Zero TypeScript compilation errors.
- Comprehensive error handling including graceful shutdown, unhandled rejection guards, and rate limiting.

### Limitations

1. **Mesh Topology Scalability:** The current WebRTC mesh topology is optimal for 2–8 participants. For larger groups (10+), bandwidth usage scales as O(N²). A Selective Forwarding Unit (SFU) architecture would be required for production-scale deployments.

2. **TURN Server:** The system relies on STUN servers for NAT traversal, which works for most home and mobile networks. Corporate firewalls may block WebRTC connections. A TURN server would be required for enterprise deployments.

3. **AI Scoring Accuracy:** The scoring model uses heuristic weights rather than a trained machine learning model. The scores are indicative rather than clinically validated.

4. **No Recording:** The system does not support session recording. This would require a media server (e.g., mediasoup) rather than pure peer-to-peer WebRTC.

5. **Single Language:** The platform currently supports English only. Multi-language support would require language detection and localised filler word lists.

### Future Enhancements

1. **SFU Architecture:** Migrate to a Selective Forwarding Unit (e.g., mediasoup, Janus) for scalability beyond 8 participants.
2. **Session Recording:** Add server-side recording with playback and transcript generation.
3. **Adaptive Bitrate:** Implement bandwidth estimation and quality adaptation based on network conditions.
4. **Breakout Rooms:** Allow the host to split participants into smaller sub-groups.
5. **Hand Raise and Reactions:** Add non-verbal participation indicators.
6. **Closed Captions:** Real-time speech-to-text using the Web Speech API or a cloud service.
7. **Mobile Application:** Native iOS and Android apps using React Native.
8. **Institutional Dashboard:** An admin panel for educational institutions to manage students and track cohort performance.
9. **Gamification:** Badges, leaderboards, and achievement systems to increase engagement.
10. **Multi-Language Support:** Filler word detection and feedback in multiple languages.

### Summary

GD Bot demonstrates that modern web technologies — React, WebRTC, Socket.IO, MongoDB, and Google Gemini AI — can be combined to create a sophisticated, real-time collaborative application that addresses a genuine educational need. The project provided hands-on experience with full-stack development, real-time systems, AI integration, and the complexities of multi-user state management. The resulting system is production-ready, well-tested, and extensible for future development.

---

## 10. References

1. **WebRTC API** — Mozilla Developer Network. *WebRTC API*. https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

2. **Socket.IO Documentation** — Socket.IO Team. *Socket.IO v4 Documentation*. https://socket.io/docs/v4/

3. **React Documentation** — Meta Open Source. *React 18 Documentation*. https://react.dev/

4. **TanStack Router** — Tanner Linsley. *TanStack Router Documentation*. https://tanstack.com/router/

5. **MongoDB Documentation** — MongoDB Inc. *MongoDB Manual*. https://www.mongodb.com/docs/manual/

6. **Mongoose Documentation** — Automattic. *Mongoose v8 Documentation*. https://mongoosejs.com/docs/

7. **JSON Web Tokens** — Auth0. *Introduction to JSON Web Tokens*. https://jwt.io/introduction/

8. **Google Gemini API** — Google DeepMind. *Gemini API Documentation*. https://ai.google.dev/docs

9. **bcryptjs** — dcodeIO. *bcryptjs npm package*. https://www.npmjs.com/package/bcryptjs

10. **express-validator** — express-validator contributors. *express-validator Documentation*. https://express-validator.github.io/docs/

11. **Tailwind CSS** — Tailwind Labs. *Tailwind CSS Documentation*. https://tailwindcss.com/docs/

12. **Vite** — Evan You. *Vite Documentation*. https://vitejs.dev/guide/

13. **RFC 8829** — IETF. *JavaScript Session Establishment Protocol (JSEP)*. https://datatracker.ietf.org/doc/html/rfc8829

14. **RFC 7519** — IETF. *JSON Web Token (JWT)*. https://datatracker.ietf.org/doc/html/rfc7519

15. **OWASP Authentication Cheat Sheet** — OWASP Foundation. *Authentication Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

16. **Flanagan, D.** (2020). *JavaScript: The Definitive Guide* (7th ed.). O'Reilly Media.

17. **Banks, A., & Porcello, E.** (2020). *Learning React* (2nd ed.). O'Reilly Media.

18. **Grigorik, I.** (2013). *High Performance Browser Networking*. O'Reilly Media. https://hpbn.co/

19. **Chodorow, K.** (2013). *MongoDB: The Definitive Guide* (2nd ed.). O'Reilly Media.

20. **Tanenbaum, A. S., & Van Steen, M.** (2017). *Distributed Systems: Principles and Paradigms* (3rd ed.). Pearson.

---

*End of Report*

---

**Document Information:**

| Field | Value |
|---|---|
| Project Name | GD Bot — AI-Powered Group Discussion Practice Platform |
| Report Version | 1.0 |
| Date | May 2026 |
| Technology Stack | React 18, TypeScript, Node.js, Express, MongoDB, Socket.IO, WebRTC, Google Gemini AI |
| Test Coverage | 57/57 test cases passing |
| Automated Tests | 17/17 signalling tests passing |
| Lines of Code (approx.) | ~8,000 (client) + ~3,500 (server) |
