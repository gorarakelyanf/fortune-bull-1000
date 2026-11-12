// Fortune Bull 1000 - shared-video clip player for phones (?mobile). Global: window.SegVideo.
// Several clips are laid end to end in ONE video file ("segments", tools/build_mobile_clips.py). Each segment gets a
// facade that behaves like the <video> element the game's clip code already drives (currentTime, play(), pause(),
// paused, ended, playbackRate, onended, seeked listeners), so the bull director and the wild code stay unchanged
// while a phone decodes ONE video instead of eight.
// - One "base" segment loops (the idle); a one-shot (a move) plays once and holds its last frame until the game
//   hands control back to the base (by setting the base's currentTime, as the bull director does on a move's end).
// - The player reports whether it is really showing frames (`live`): false until the first frame is decoded, while a
//   play() is refused (iOS Low Power Mode, data saver) and while the picture is stuck. The game shows the still bull
//   then, so the bull never disappears.
// - unlock(): call inside a user gesture (every tap): restarts a refused or stopped video.
// WHITE (video audit 2026-11-12, VIDEO_AUDIT.md):
// - segment ends are caught on every decoded frame (requestVideoFrameCallback mediaTime), not only once per game frame,
//   and the file has 3 "guard" frames (copies of the last frame) after every segment: a late check shows the right pose,
//   never the first frames of the next move;
// - ready(): a segment is only played once it is downloaded (video.buffered), so a slow network never freezes a move;
// - { lazy: true }: the file starts downloading on start() (the wild video waits until the bull has arrived);
// - a video that should run but stopped (end of file, browser pause) is restarted at most once a second, unless refused.
(function () {
  "use strict";
  const now = () => performance.now();

  class SegClip {
    constructor(p, name, s) {
      Object.assign(this, { p, name, t0: s.t0, t1: s.t1, len: s.t1 - s.t0, loop: !!s.loop, ended: false, onended: null, _t: 0, _rate: 1 });
    }
    get currentTime() { return this.p.isActive(this) ? Math.max(0, Math.min(this.len, this.p.v.currentTime - this.t0)) : this._t; }
    set currentTime(t) {
      this._t = t;
      if (this.p.isActive(this)) { this.ended = false; this.p.seek(this.t0 + t); }
      else if (this.loop) this.p.take(this, t, true);      // the base takes over (a move has ended)
    }
    play() {
      if (!this.p.isActive(this)) {
        if (this.loop && this.p.busy()) return Promise.resolve();   // a move is playing: the idle waits
        this.p.take(this, this._t, false);
      }
      this.ended = false;
      this.p.setRate(this._rate);
      return this.p.play();
    }
    // never really paused: a phone in Low Power Mode would refuse to start it again without a tap. A finished move
    // hands over to the base loop instead (tick), and an unused video simply keeps looping its base, unseen.
    pause() { /* no-op on purpose */ }
    get paused() { return !this.p.isActive(this) || this.p.v.paused; }
    get playbackRate() { return this._rate; }
    set playbackRate(r) { this._rate = r; if (this.p.isActive(this)) this.p.setRate(r); }
    set defaultPlaybackRate(r) { /* per segment rate is set by the game every frame */ }
    get readyState() { return this.p.v.readyState; }
    get videoWidth() { return this.p.v.videoWidth; }
    get videoHeight() { return this.p.v.videoHeight; }
    get error() { return this.p.v.error; }
    ready() { return this.p.hasRange(this.t0, this.t1); }            // white: downloaded, so it can play without a stall
    addEventListener(type, fn, o) { this.p.v.addEventListener(type, fn, o); }
    removeEventListener(type, fn, o) { this.p.v.removeEventListener(type, fn, o); }
  }

  class SegPlayer {
    constructor(src, segs, o) {
      o = o || {};
      const v = document.createElement("video");
      v.muted = true; v.defaultMuted = true; v.setAttribute("muted", "");
      v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      v.preload = "auto"; v.crossOrigin = "anonymous"; v.loop = false;
      try { v.disableRemotePlayback = true; } catch (e) { /* not supported */ }
      // in the page (invisible): some phone browsers throttle or never decode a video that is not in the document
      v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.appendChild(v);
      this.v = v; this.src = src; this.fps = o.fps || 24; this.minRate = o.minRate || 0.5; this.maxRate = o.maxRate || 2.5;
      this.active = null; this.base = null; this.want = false; this.blocked = false; this.shown = false;
      this.lastT = -1; this.lastMove = now(); this.lastKick = 0; this.groups = {};
      this.clips = {};
      for (const [name, s] of Object.entries(segs)) {
        const c = new SegClip(this, name, s); this.clips[name] = c;
        const key = s.t0 + ":" + s.t1; (this.groups[key] = this.groups[key] || []).push(c);
        if (s.loop && !this.base) this.base = c;
      }
      v.addEventListener("playing", () => { this.blocked = false; });
      v.addEventListener("timeupdate", () => { if (v.currentTime > 0.02) this.shown = true; });
      if (v.requestVideoFrameCallback) {
        const cb = (t, md) => { this.shown = true; this.lastMove = now(); this.checkEnd(md.mediaTime, true); v.requestVideoFrameCallback(cb); };
        v.requestVideoFrameCallback(cb);
      }
      if (!o.lazy) this.start();
    }
    start() { if (!this.started) { this.started = true; this.v.src = this.src; this.v.load(); } }
    // white: is [t0, t1) downloaded? (the last half frame may sit in the next range)
    hasRange(t0, t1) {
      const b = this.v.buffered;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= t0 + 0.05 && b.end(i) >= t1 - 0.5 / this.fps) return true;
      return false;
    }
    full() { return !!this.v.duration && this.hasRange(0, this.v.duration); }
    // a facade of another name on the same time range (e.g. the wild and the super wild share one segment)
    alias(name, of) {
      const s = this.clips[of], c = new SegClip(this, name, { t0: s.t0, t1: s.t1, loop: s.loop });
      this.clips[name] = c; this.groups[s.t0 + ":" + s.t1].push(c); return c;
    }
    sameRange(a, b) { return a && b && a.t0 === b.t0 && a.t1 === b.t1; }
    isActive(c) { return this.sameRange(this.active, c); }
    busy() { const a = this.active; return !!(a && !a.loop && !a.ended); }       // a one-shot is still running
    take(c, t, playIt) {
      this.active = c; c.ended = false;
      this.seek(c.t0 + Math.max(0, Math.min(t || 0, c.len - 1 / this.fps)));
      if (playIt) this.play();
    }
    seek(t) { if (Math.abs(this.v.currentTime - t) > 0.4 / this.fps) { try { this.v.currentTime = t; } catch (e) { /* not seekable yet */ } } }
    play() {
      this.want = true; this.start();
      const p = this.v.play();
      if (p && p.catch) p.catch((e) => { if (e && e.name === "NotAllowedError") this.blocked = true; });
      return p || Promise.resolve();
    }
    // inside a user gesture: start a refused or stopped video that should be running
    unlock() {
      if (this.want && this.v.paused) this.play();
      else if (!this.want && this.v.paused && !this.unlocked && this.started) {   // first gesture: let the browser allow it later
        this.unlocked = true; const p = this.v.play();
        if (p && p.then) p.then(() => { if (!this.want) this.v.pause(); }, (e) => { if (e && e.name === "NotAllowedError") this.blocked = true; });
      }
    }
    // the active segment has reached its end at media time t: loop the base, or stop a one-shot and report it ended
    checkEnd(t, frame) {
      const a = this.active;
      if (!a || t < a.t1 - 0.6 / this.fps) return;
      if (frame && t > a.t1 + 0.3) return;            // a decoded frame from before the last seek (another segment): not ours
      if (a.loop) { if (!this.seeking(a.t0)) this.seek(a.t0); }
      else if (!a.ended) {
        for (const c of this.groups[a.t0 + ":" + a.t1]) {
          c.ended = true;
          if (c.onended) { const f = c.onended; setTimeout(() => f(), 0); }
        }
        // straight back to the base loop, still playing (its first frame is the move's last pose)
        if (this.base) { this.active = this.base; this.base.ended = false; this.seek(this.base.t0); this.v.playbackRate = 1; }
      }
      if (this.want && this.v.ended) this.play();                     // ran off the end of the file
    }
    seeking(t) { return this.v.seeking && Math.abs(this.v.currentTime - t) < 0.5 / this.fps; }
    // every frame: the same end check on the element clock, watch progress, restart a video that stopped by itself
    tick() {
      const v = this.v;
      if (v.currentTime !== this.lastT) { this.lastT = v.currentTime; this.lastMove = now(); }
      if (this.active) this.checkEnd(v.currentTime);
      if (this.want && v.paused && !this.blocked && !document.hidden && now() - this.lastKick > 1000) { this.lastKick = now(); this.play(); }
    }
    setRate(r) { this.v.playbackRate = Math.max(this.minRate, Math.min(this.maxRate, r)); }
    // really showing frames: decoded at least once, not refused, and not stuck while it should run
    get live() {
      // (not readyState: it drops while the video jumps between sections; the texture keeps the last picture meanwhile)
      if (!this.shown || this.blocked || this.v.error) return false;
      return !(this.want && now() - this.lastMove > 1100);
    }
  }

  window.SegVideo = { SegPlayer };
})();
