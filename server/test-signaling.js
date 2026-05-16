/**
 * test-signaling.js — Full WebRTC signalling system test.
 * No MongoDB required — uses in-memory session store.
 *
 * Run from ROXGD/server:  node test-signaling.js
 */

import { io } from "socket.io-client";

const SERVER  = "http://localhost:4000";
const delay   = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Helpers ───────────────────────────────────────────────────────────────────

function connect(label) {
  return new Promise((resolve, reject) => {
    const sock = io(SERVER, { transports: ["websocket"], timeout: 5000 });
    sock.on("connect",       () => resolve(sock));
    sock.on("connect_error", (e) => reject(new Error(`${label} connect failed: ${e.message}`)));
  });
}

function waitFor(sock, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
    sock.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

const results = [];
const pass = (label)      => { results.push({ label, ok: true  }); console.log(`  ✓  ${label}`); };
const fail = (label, err) => { results.push({ label, ok: false }); console.log(`  ✗  ${label}  →  ${err}`); };

async function run() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   WebRTC Signalling — End-to-End Test            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── 1. Create in-memory session ─────────────────────────────────────────────
  let sessionId, topic;
  try {
    const res  = await fetch(`${SERVER}/api/test/session`, { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    sessionId = data.sessionId;
    topic     = data.topic;
    pass(`Session created  →  ${sessionId}`);
    console.log(`     topic: "${topic.slice(0, 60)}…"`);
  } catch (e) { fail("Create session", e.message); process.exit(1); }

  // ── 2. Connect two sockets ──────────────────────────────────────────────────
  let sockA, sockB;
  try {
    [sockA, sockB] = await Promise.all([connect("Alice"), connect("Bob")]);
    pass(`Two WebSocket connections  →  A:${sockA.id.slice(0,8)}  B:${sockB.id.slice(0,8)}`);
  } catch (e) { fail("Connect sockets", e.message); process.exit(1); }

  // Log errors without crashing
  sockA.on("session-error", ({ code, message }) => console.log(`     [Alice] ← session-error [${code}] ${message}`));
  sockB.on("session-error", ({ code, message }) => console.log(`     [Bob]   ← session-error [${code}] ${message}`));

  // ── 3. Alice joins ──────────────────────────────────────────────────────────
  let aliceSocketId;
  try {
    const p = waitFor(sockA, "session-joined");
    sockA.emit("join-session", { sessionId, name: "Alice" });
    const d = await p;
    aliceSocketId = sockA.id;
    if (d.peers.length !== 0)                throw new Error(`Expected 0 peers, got ${d.peers.length}`);
    if (d.session.id !== sessionId)          throw new Error("session ID mismatch");
    if (d.you.name !== "Alice")              throw new Error("name mismatch");
    pass(`Alice joined  →  0 existing peers  |  roster: 1`);
  } catch (e) { fail("Alice join", e.message); }

  // ── 4. Bob joins — Alice gets peer-joined + room-roster ─────────────────────
  let bobSocketId;
  try {
    // Set up listeners BEFORE emitting so we don't miss fast events
    const peerJoined = waitFor(sockA, "peer-joined");
    const bobJoined  = waitFor(sockB, "session-joined");

    sockB.emit("join-session", { sessionId, name: "Bob" });

    // Wait for both join confirmations first
    const [pj, bj] = await Promise.all([peerJoined, bobJoined]);

    // Roster arrives shortly after — wait for it separately
    const roster = await waitFor(sockA, "room-roster", 2000);

    bobSocketId = sockB.id;

    if (pj.participant.name !== "Bob")    throw new Error(`peer-joined name: ${pj.participant.name}`);
    if (roster.participants.length !== 2) throw new Error(`roster count: ${roster.participants.length}`);
    if (bj.peers.length !== 1)            throw new Error(`Bob peers: ${bj.peers.length}`);
    if (bj.peers[0].name !== "Alice")     throw new Error(`Bob's peer: ${bj.peers[0].name}`);

    pass(`Bob joined  →  Alice got peer-joined  |  roster: 2  |  Bob sees 1 peer`);
  } catch (e) { fail("Bob join + roster", e.message); }

  // ── 5. WebRTC offer: Bob → Alice ────────────────────────────────────────────
  try {
    const offerAtAlice = waitFor(sockA, "webrtc-offer");
    sockB.emit("webrtc-offer", {
      targetSocketId: aliceSocketId,
      sdp: { type: "offer", sdp: "v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
    });
    const offer = await offerAtAlice;
    if (offer.fromSocketId !== bobSocketId) throw new Error("fromSocketId mismatch");
    if (offer.sdp.type !== "offer")         throw new Error("sdp.type mismatch");
    if (offer.fromName !== "Bob")           throw new Error("fromName mismatch");
    pass(`WebRTC offer forwarded  Bob → Alice  |  fromName: ${offer.fromName}`);
  } catch (e) { fail("WebRTC offer", e.message); }

  // ── 6. WebRTC answer: Alice → Bob ───────────────────────────────────────────
  try {
    const answerAtBob = waitFor(sockB, "webrtc-answer");
    sockA.emit("webrtc-answer", {
      targetSocketId: bobSocketId,
      sdp: { type: "answer", sdp: "v=0\r\no=- 222 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
    });
    const answer = await answerAtBob;
    if (answer.fromSocketId !== aliceSocketId) throw new Error("fromSocketId mismatch");
    if (answer.sdp.type !== "answer")           throw new Error("sdp.type mismatch");
    pass(`WebRTC answer forwarded  Alice → Bob`);
  } catch (e) { fail("WebRTC answer", e.message); }

  // ── 7. ICE candidates (both directions simultaneously) ──────────────────────
  try {
    const iceAtAlice = waitFor(sockA, "webrtc-ice");
    const iceAtBob   = waitFor(sockB, "webrtc-ice");

    sockB.emit("webrtc-ice", { targetSocketId: aliceSocketId, candidate: { candidate: "candidate:1 1 UDP 100 192.168.1.2 5000 typ host" } });
    sockA.emit("webrtc-ice", { targetSocketId: bobSocketId,   candidate: { candidate: "candidate:2 1 UDP 200 192.168.1.3 5001 typ host" } });

    const [iA, iB] = await Promise.all([iceAtAlice, iceAtBob]);
    if (iA.fromSocketId !== bobSocketId)   throw new Error("ICE at Alice: wrong sender");
    if (iB.fromSocketId !== aliceSocketId) throw new Error("ICE at Bob: wrong sender");
    pass(`ICE candidates exchanged  (both directions simultaneously)`);
  } catch (e) { fail("ICE exchange", e.message); }

  // ── 8. Cross-session signal must be blocked ──────────────────────────────────
  try {
    const errP = waitFor(sockB, "session-error", 1500);
    sockB.emit("webrtc-offer", { targetSocketId: "nonexistent-socket-id", sdp: { type: "offer", sdp: "..." } });
    const err = await errP;
    if (err.code !== "CROSS_SESSION") throw new Error(`Expected CROSS_SESSION, got ${err.code}`);
    pass(`Cross-session signal blocked  →  code: ${err.code}`);
  } catch (e) { fail("Cross-session security", e.message); }

  // ── 9. Toggle audio (mute) ───────────────────────────────────────────────────
  try {
    const updAtBob = waitFor(sockB, "peer-updated");
    sockA.emit("toggle-audio", { enabled: false });
    const u = await updAtBob;
    if (u.socketId !== aliceSocketId) throw new Error("wrong socketId");
    if (u.audioEnabled !== false)     throw new Error("audioEnabled should be false");
    pass(`Audio muted  →  Bob received peer-updated  (audioEnabled=false)`);
  } catch (e) { fail("Toggle audio", e.message); }

  // ── 10. Toggle video ─────────────────────────────────────────────────────────
  try {
    const updAtBob = waitFor(sockB, "peer-updated");
    sockA.emit("toggle-video", { enabled: false });
    const u = await updAtBob;
    if (u.videoEnabled !== false) throw new Error("videoEnabled should be false");
    pass(`Video off  →  Bob received peer-updated  (videoEnabled=false)`);
  } catch (e) { fail("Toggle video", e.message); }

  // ── 11. Screen share ─────────────────────────────────────────────────────────
  try {
    const updAtBob = waitFor(sockB, "peer-updated");
    sockA.emit("toggle-screen", { enabled: true });
    const u = await updAtBob;
    if (u.screenSharing !== true) throw new Error("screenSharing should be true");
    pass(`Screen share started  →  Bob received peer-updated  (screenSharing=true)`);
  } catch (e) { fail("Screen share", e.message); }

  // ── 12. Speaking detection ───────────────────────────────────────────────────
  try {
    // Bob speaks — Alice should get the update (sender does NOT get it back)
    const updAtAlice = waitFor(sockA, "peer-updated");
    sockB.emit("speaking", { isSpeaking: true });
    const u = await updAtAlice;
    if (u.socketId !== bobSocketId) throw new Error("wrong socketId");
    if (u.isSpeaking !== true)      throw new Error("isSpeaking should be true");
    pass(`Speaking detected  →  Alice received peer-updated  (isSpeaking=true)`);
  } catch (e) { fail("Speaking detection", e.message); }

  // ── 13. Chat message broadcast ───────────────────────────────────────────────
  try {
    const msgAtAlice = waitFor(sockA, "chat-message");
    const msgAtBob   = waitFor(sockB, "chat-message"); // sender also gets confirmation
    sockB.emit("chat-message", { text: "Hello from Bob!" });
    const [mA, mB] = await Promise.all([msgAtAlice, msgAtBob]);
    if (mA.text !== "Hello from Bob!")  throw new Error(`Alice got: "${mA.text}"`);
    if (mB.senderName !== "Bob")        throw new Error(`senderName: ${mB.senderName}`);
    if (!mA.id || !mA.ts)               throw new Error("missing id or ts");
    pass(`Chat broadcast  →  both Alice & Bob received  |  id: ${mA.id.slice(0,8)}…`);
  } catch (e) { fail("Chat message", e.message); }

  // ── 14. Rate limiting ────────────────────────────────────────────────────────
  try {
    let rateLimitHit = false;
    const errP = new Promise((resolve) => {
      sockA.on("session-error", (d) => { if (d.code === "RATE_LIMITED") { rateLimitHit = true; resolve(); } });
    });
    // Send 35 messages rapidly (limit is 30 per 10s)
    for (let i = 0; i < 35; i++) sockA.emit("chat-message", { text: `msg ${i}` });
    await Promise.race([errP, delay(2000)]);
    if (!rateLimitHit) throw new Error("Rate limit was not triggered after 35 messages");
    pass(`Rate limiting triggered  →  RATE_LIMITED error after 35 messages`);
    sockA.off("session-error"); // clean up listener
  } catch (e) { fail("Rate limiting", e.message); }

  // ── 15. Ping / pong ──────────────────────────────────────────────────────────
  try {
    const pong = waitFor(sockA, "pong");
    const t0   = Date.now();
    sockA.emit("ping");
    const p = await pong;
    if (!p.ts) throw new Error("pong missing ts");
    pass(`Ping/pong  →  round-trip ~${Date.now() - t0}ms`);
  } catch (e) { fail("Ping/pong", e.message); }

  // ── 16. Bob leaves — Alice gets peer-left + updated roster ───────────────────
  try {
    const peerLeft  = waitFor(sockA, "peer-left");
    const rosterUpd = waitFor(sockA, "room-roster");
    sockB.emit("leave-session", {});
    const [pl, r] = await Promise.all([peerLeft, rosterUpd]);
    if (pl.name !== "Bob")           throw new Error(`peer-left name: ${pl.name}`);
    if (r.participants.length !== 1) throw new Error(`roster count: ${r.participants.length}`);
    pass(`Bob left  →  Alice got peer-left  |  roster updated to 1`);
  } catch (e) { fail("Leave session", e.message); }

  // ── 17. Disconnect cleanup ───────────────────────────────────────────────────
  try {
    sockA.disconnect();
    sockB.disconnect();
    await delay(300);
    pass(`Both sockets disconnected cleanly`);
  } catch (e) { fail("Disconnect", e.message); }

  // ── Summary ──────────────────────────────────────────────────────────────────
  await delay(200);
  const passed = results.filter((r) => r.ok).length;
  const total  = results.length;
  console.log(`\n${"─".repeat(52)}`);
  console.log(`  ${passed}/${total} tests passed`);
  if (passed === total) {
    console.log("  ✅  All signalling tests passed!\n");
  } else {
    console.log("  ❌  Failed tests:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`       ✗ ${r.label}`));
    console.log();
  }
  process.exit(passed === total ? 0 : 1);
}

run().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
