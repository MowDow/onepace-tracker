// ==UserScript==
// @name         One Pace Tracker – Auto-Zeit
// @namespace    https://mowdow.github.io/onepace-tracker/
// @version      1.5.0
// @description  Meldet die Abspielposition des eingebetteten Drive-Players an den One Pace Tracker und springt beim Laden an die gespeicherte Stelle.
// @match        https://youtube.googleapis.com/embed/*
// @match        https://www.youtube.com/embed/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/MowDow/onepace-tracker/main/userscript/onepace-autotime.user.js
// @downloadURL  https://raw.githubusercontent.com/MowDow/onepace-tracker/main/userscript/onepace-autotime.user.js
// ==/UserScript==

(function () {
  "use strict";
  const TRACKER = "https://mowdow.github.io";   // Nachrichten gehen nur an diese Seite
  const VERSION = "1.5.0";
  if (window.top === window) return;              // nur eingebettet (im Tracker) aktiv

  let video = null;
  let armed = false;       // erst melden, wenn der Tracker geantwortet hat (sonst würde 0:00 den Stand überschreiben)
  let pendingSeek = null;
  let lastSent = 0;

  const send = (msg) => {
    try { window.top.postMessage(Object.assign({ src: "onepace-us", v: 1, ver: VERSION, api: !!ytp() }, msg), TRACKER); } catch (e) {}
  };

  window.addEventListener("message", (e) => {
    if (e.origin !== TRACKER) return;
    const d = e.data;
    if (!d || d.src !== "onepace-tr") return;
    if (typeof d.fs === "boolean") fsPref = d.fs;
    if (d.type === "seek") {
      armed = true;
      if (d.t > 2) { pendingSeek = d.t; trySeek(false); }
    } else if (d.type === "play") {
      tryPlay();
    } else if (d.type === "resume" && d.t >= 0) {
      armed = true;
      resumeAt(d.t);
    }
  });

  // YouTube-Player im Drive-Player: hat eigene Steuerung (seekTo/playVideo), die auch vor dem ersten Play greift
  // Firefox isoliert Userscripts: Funktionen, die die Seite an Elemente hängt, sind nur über wrappedJSObject sichtbar
  const ytp = () => {
    const el = document.getElementById("movie_player");
    if (!el) return null;
    const cands = [];
    try { if (el.wrappedJSObject) cands.push(el.wrappedJSObject); } catch (e) {}
    cands.push(el);
    for (const c of cands) { try { if (typeof c.seekTo === "function" && typeof c.playVideo === "function") return c; } catch (e) {} }
    return null;
  };
  function seekNow(t) {
    const mp = ytp();
    try { if (mp) mp.seekTo(t, true); else if (video) video.currentTime = t; } catch (e) {}
  }

  // "Ab X weiterschauen": an die Stelle springen und abspielen
  let resumeTimer = null;
  function resumeAt(t) {
    pendingSeek = null;
    send({ type: "resume-ack", t });
    clearInterval(resumeTimer);
    let tries = 0;
    const step = () => {
      tries++;
      const cur = video ? video.currentTime : 0;
      const atSpot = Math.abs(cur - t) < 4;
      if ((atSpot && video && !video.paused) || tries > 16) {
        clearInterval(resumeTimer);
        send({ type: "resumed", ok: atSpot, playing: !!(video && !video.paused), cur: video ? video.currentTime : -1, t });
        return;
      }
      const mp = ytp();
      try {
        if (!atSpot) seekNow(t);
        if (mp && typeof mp.playVideo === "function") mp.playVideo();
        else if (video) video.play().catch(() => {});
      } catch (e) {}
    };
    step();
    resumeTimer = setInterval(step, 500);
  }

  // ---------- Vollbild beim ersten Play ----------
  // Drive bettet diesen Player ohne Vollbild-Erlaubnis ein → wir melden den Play-Klick an den Tracker,
  // der dann den ganzen Player-Bereich in Vollbild schaltet (dort klappt auch das Querformat auf Android).
  let fsPref = false, hasPlayed = false, fsSent = false;
  function requestFs() {
    if (!fsPref || fsSent) return;
    fsSent = true;
    send({ type: "fs-request" });
  }
  const onUserStart = (ev) => {
    if (!fsPref || hasPlayed || fsSent) return;
    if (ev.type === "keydown" && ![" ", "k", "Enter"].includes(ev.key)) return;
    if (video && !video.paused) return;          // Klick zum Pausieren → nichts tun
    requestFs();
  };
  window.addEventListener("pointerup", onUserStart, true);
  window.addEventListener("click", onUserStart, true);
  window.addEventListener("keydown", onUserStart, true);

  // Nächste Folge automatisch starten: mehrere Wege, weil der Player je nach Version anders reagiert.
  // Kann vom Browser blockiert werden (Autoplay-Regeln) – dann passiert einfach nichts.
  let playTimer = null;
  function tryPlay() {
    clearInterval(playTimer);
    let tries = 0;
    playTimer = setInterval(() => {
      tries++;
      if ((video && !video.paused) || tries > 30) { clearInterval(playTimer); return; }
      try {
        const mp = document.getElementById("movie_player");
        if (mp && typeof mp.playVideo === "function") mp.playVideo();
        else if (video) video.play().catch(() => {});
        else { const b = document.querySelector(".ytp-large-play-button, .ytp-play-button"); if (b) b.click(); }
      } catch (e) {}
    }, 500);
  }

  // final=true beim ersten "playing": dann bleibt die Stelle sicher, auch wenn der Player beim Start zurücksetzt
  function trySeek(final) {
    if (!video || pendingSeek == null || video.readyState < 1) return;
    if (Math.abs(video.currentTime - pendingSeek) > 3) seekNow(pendingSeek);
    if (final) pendingSeek = null;
  }

  function report(paused) {
    if (!armed || !video) return;
    const t = video.currentTime, d = video.duration;
    if (!isFinite(t) || t < 2) return;
    send({ type: "pos", t, d: isFinite(d) ? d : 0, paused: !!paused });
    lastSent = Date.now();
  }

  function attach(v) {
    video = v;
    v.addEventListener("loadedmetadata", () => trySeek(false));
    v.addEventListener("playing", () => trySeek(true));
    v.addEventListener("play", () => {
      // Falls der Start nicht über unseren Klick-Haken lief (z. B. Tippen auf dem Handy): nur mit frischer Nutzeraktion
      const ua = navigator.userActivation;
      if (!hasPlayed && ua && ua.isActive) requestFs();
      hasPlayed = true;
    });
    v.addEventListener("pause", () => { if (!v.ended) report(true); });
    v.addEventListener("seeked", () => { if (v.paused) report(true); });
    v.addEventListener("timeupdate", () => { if (!v.paused && Date.now() - lastSent > 10000) report(false); });
    v.addEventListener("ended", () => send({ type: "ended", d: v.duration }));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(true); });
    window.addEventListener("pagehide", () => report(true));
    send({ type: "ready" });
    setTimeout(() => { armed = true; }, 5000);
  }

  send({ type: "hello" });   // sofort melden, auch bevor das Video-Element existiert

  const find = () => {
    const v = document.querySelector("video");
    if (v && v !== video) attach(v);
  };
  find();
  new MutationObserver(find).observe(document.documentElement, { childList: true, subtree: true });
})();
