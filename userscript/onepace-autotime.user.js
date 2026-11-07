// ==UserScript==
// @name         One Pace Tracker – Auto-Zeit
// @namespace    https://mowdow.github.io/onepace-tracker/
// @version      1.1.0
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
  if (window.top === window) return;              // nur eingebettet (im Tracker) aktiv

  let video = null;
  let armed = false;       // erst melden, wenn der Tracker geantwortet hat (sonst würde 0:00 den Stand überschreiben)
  let pendingSeek = null;
  let lastSent = 0;

  const send = (msg) => {
    try { window.top.postMessage(Object.assign({ src: "onepace-us", v: 1 }, msg), TRACKER); } catch (e) {}
  };

  window.addEventListener("message", (e) => {
    if (e.origin !== TRACKER) return;
    const d = e.data;
    if (!d || d.src !== "onepace-tr") return;
    if (d.type === "seek") {
      armed = true;
      if (d.t > 2) { pendingSeek = d.t; trySeek(false); }
    } else if (d.type === "play") {
      tryPlay();
    }
  });

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
    if (Math.abs(video.currentTime - pendingSeek) > 3) {
      try { video.currentTime = pendingSeek; } catch (e) {}
    }
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
