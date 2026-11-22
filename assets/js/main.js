/* ════════════════════════════════════════════════════════════════
   Jarvixxx — motion & interaction engine v2
   Single-RAF Lenis+GSAP · Float32Array particles (physics fixed for
   accent dots) · quickTo magnetics · word-level manifesto · form v2
   ════════════════════════════════════════════════════════════════ */
"use strict";

(function () {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const I18N = window.JX_I18N || {};
  const t = (k, fallback) => (I18N[k] != null ? I18N[k] : fallback);

  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

  /* ─────────────────────────────────────────────
     1. Lenis smooth scroll + GSAP single RAF
     ───────────────────────────────────────────── */
  let lenis = null;
  if (!RM) {
    lenis = new Lenis({ autoRaf: false, wheelMultiplier: 1, lerp: 0.11 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          lenis.scrollTo(id, { offset: -80, duration: 1.1 });
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     2. Hero Canvas 2D particle text — JARVIXXX
     Single physics pass over ALL particles; draws batched
     into two colors (accent dots precollected as indices).
     ───────────────────────────────────────────── */
  function initHeroCanvas() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const MOBILE = window.innerWidth < 640;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const TEXT = "JARVIXXX";

    let W = 0, H = 0, running = true, inView = true;
    let parts = null;   // Float32Array ×6: x,y,vx,vy,tx,ty
    let count = 0;
    let isAccent = new Uint8Array(0), accentIdx = [];
    let mouse = { x: -9999, y: -9999 };
    const REPULSE_R = MOBILE ? 0 : 70, REPULSE_R2 = REPULSE_R * REPULSE_R;

    function sizeCanvas() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(300, r.width); H = Math.max(140, r.height);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function buildTargets() {
      let fs = Math.min(H * 0.62, 200);
      const off = document.createElement("canvas");
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.font = `800 ${fs}px Syne, sans-serif`;
      const m = octx.measureText(TEXT);
      const maxW = W * 0.92;
      if (m.width > maxW) fs = fs * maxW / m.width;
      off.width = Math.ceil(W); off.height = Math.ceil(H);
      octx.fillStyle = "#fff";
      octx.font = `800 ${fs}px Syne, sans-serif`;
      octx.textAlign = "center"; octx.textBaseline = "middle";
      octx.fillText(TEXT, W / 2, H / 2);
      const img = octx.getImageData(0, 0, off.width, off.height).data;

      const gap = MOBILE ? 7 : 9;
      const pts = [];
      for (let y = 0; y < H; y += gap) {
        const rowShift = ((y / gap) % 2) * (gap / 2);
        for (let x = 0; x < W; x += gap) {
          const px = Math.round(x + rowShift), py = Math.round(y);
          if (px >= W || py >= H) continue;
          const a = img[(py * W + px) * 4 + 3];
          if (a > 128 && Math.random() < 0.82) pts.push(px, py);
          else if (a <= 128 && Math.random() < 0.018) pts.push(px, py);
        }
      }
      count = pts.length / 2;
      parts = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.max(W, H) * (0.5 + Math.random() * 0.6);
        parts[i * 6]     = W / 2 + Math.cos(ang) * rad;
        parts[i * 6 + 1] = H / 2 + Math.sin(ang) * rad;
        parts[i * 6 + 2] = 0; parts[i * 6 + 3] = 0;
        parts[i * 6 + 4] = pts[i * 2]; parts[i * 6 + 5] = pts[i * 2 + 1];
      }
      isAccent = new Uint8Array(count);
      accentIdx = [];
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.035) { isAccent[i] = 1; accentIdx.push(i); }
      }
    }

    let lastT = 0;
    function frame(t) {
      if (!running) return;
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
      lastT = t;
      if (inView && count) {
        ctx.clearRect(0, 0, W, H);
        const S = MOBILE ? 1.6 : 2.2;
        const damp = Math.pow(0.0018, dt);
        const spring = 14 * dt, push = 900 * dt;
        // one physics pass for ALL particles (incl. accent — fixed)
        for (let i = 0; i < count; i++) {
          const xi = i * 6;
          const dx = parts[xi + 4] - parts[xi], dy = parts[xi + 5] - parts[xi + 1];
          let vx = parts[xi + 2] + dx * spring, vy = parts[xi + 3] + dy * spring;
          if (REPULSE_R > 0) {
            const mdx = parts[xi] - mouse.x, mdy = parts[xi + 1] - mouse.y;
            const d2 = mdx * mdx + mdy * mdy;
            if (d2 < REPULSE_R2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / REPULSE_R) * push / d;
              vx += mdx * f; vy += mdy * f;
            }
          }
          parts[xi + 2] = vx * damp; parts[xi + 3] = vy * damp;
          parts[xi] += vx * dt; parts[xi + 1] += vy * dt;
        }
        // draw: two color batches
        ctx.fillStyle = "rgba(89,194,230,0.95)";
        for (let k = 0; k < accentIdx.length; k++) {
          const xi = accentIdx[k] * 6;
          ctx.fillRect(parts[xi], parts[xi + 1], S, S);
        }
        ctx.fillStyle = "rgba(238,241,246,0.88)";
        for (let i = 0; i < count; i++) {
          if (isAccent[i]) continue;
          const xi = i * 6;
          ctx.fillRect(parts[xi], parts[xi + 1], S, S);
        }
      }
      requestAnimationFrame(frame);
    }

    if (FINE && !RM) {
      canvas.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener("pointerleave", () => { mouse.x = -9999; mouse.y = -9999; });
    }

    new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });

    let rto = null;
    window.addEventListener("resize", () => { clearTimeout(rto); rto = setTimeout(buildTargets, 200); });

    function renderStatic() {
      for (let i = 0; i < count; i++) {
        parts[i * 6] = parts[i * 6 + 4]; parts[i * 6 + 1] = parts[i * 6 + 5];
      }
      ctx.clearRect(0, 0, W, H);
      const S = MOBILE ? 1.6 : 2.2;
      ctx.fillStyle = "rgba(89,194,230,0.95)";
      for (const i of accentIdx) ctx.fillRect(parts[i * 6], parts[i * 6 + 1], S, S);
      ctx.fillStyle = "rgba(238,241,246,0.88)";
      for (let i = 0; i < count; i++) if (!isAccent[i]) ctx.fillRect(parts[i * 6], parts[i * 6 + 1], S, S);
    }

    document.fonts.ready.then(() => {
      sizeCanvas();
      buildTargets();
      if (RM) renderStatic();
      else requestAnimationFrame(frame);
    });
  }
  initHeroCanvas();

  /* ─────────────────────────────────────────────
     3. Manifesto — word-level reading front
     ───────────────────────────────────────────── */
  function initManifesto() {
    const el = document.getElementById("manifestoText");
    if (!el || RM) return;
    const spans = el.querySelectorAll(".w");
    if (!spans.length) return;
    gsap.set(spans, { color: "oklch(0.32 0.015 245)" });
    gsap.to(spans, {
      color: "oklch(0.95 0.008 245)",
      ease: "none",
      stagger: 0.55,
      scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 45%", scrub: 0.6 },
    });
  }
  initManifesto();

  /* ─────────────────────────────────────────────
     4. Magnetic buttons — gsap.quickTo
     ───────────────────────────────────────────── */
  function initMagnetics() {
    if (!FINE || RM) return;
    document.querySelectorAll("[data-mag]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.32, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.32, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }
  initMagnetics();

  /* ─────────────────────────────────────────────
     5. Bento cards: spotlight + subtle 3D tilt
     ───────────────────────────────────────────── */
  function initCards() {
    if (!FINE || RM) return;
    document.querySelectorAll(".b-card").forEach((card) => {
      const rX = gsap.quickTo(card, "rotationX", { duration: 0.4, ease: "power2.out" });
      const rY = gsap.quickTo(card, "rotationY", { duration: 0.4, ease: "power2.out" });
      gsap.set(card, { transformPerspective: 800 });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--spot-x", (px * 100) + "%");
        card.style.setProperty("--spot-y", (py * 100) + "%");
        rX((0.5 - py) * 8); rY((px - 0.5) * 8);
      });
      card.addEventListener("pointerleave", () => { rX(0); rY(0); });
    });
  }
  initCards();

  /* ─────────────────────────────────────────────
     6. Filter tabs — indicator + URL state
     ───────────────────────────────────────────── */
  function initFilter() {
    const tabs = document.querySelectorAll(".filter-tab");
    const indicator = document.getElementById("tabIndicator");
    const cards = document.querySelectorAll(".b-card");
    if (!tabs.length || !indicator) return;

    function place(tab) {
      const parent = tabs[0].parentElement.getBoundingClientRect();
      const tr = tab.getBoundingClientRect();
      const x = (document.documentElement.dir === "rtl")
        ? parent.right - tr.right
        : tr.left - parent.left;
      indicator.style.width = tr.width + "px";
      indicator.style.transform = `translateX(${x}px)`;
    }

    function apply(filter, tab) {
      tabs.forEach((tb) => tb.setAttribute("aria-selected", tb === tab ? "true" : "false"));
      place(tab);
      cards.forEach((c) => {
        const show = filter === "all" || c.dataset.track === filter;
        if (RM) { c.classList.toggle("is-hidden", !show); }
        else {
          if (show) {
            c.classList.remove("is-hidden");
            gsap.fromTo(c, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", overwrite: "auto" });
          } else {
            gsap.to(c, {
              opacity: 0, scale: 0.96, duration: 0.28, ease: "power2.in",
              onComplete: () => { c.classList.add("is-hidden"); gsap.set(c, { opacity: 1, scale: 1 }); },
            });
          }
        }
      });
      const u = new URL(location);
      if (filter === "all") u.searchParams.delete("track"); else u.searchParams.set("track", filter);
      history.replaceState(null, "", u);
      if (lenis) ScrollTrigger.refresh();
    }

    tabs.forEach((tb) => tb.addEventListener("click", () => apply(tb.dataset.filter, tb)));
    const initial = new URLSearchParams(location.search).get("track");
    const initTab = Array.from(tabs).find((tb) => tb.dataset.filter === initial) || tabs[0];
    requestAnimationFrame(() => place(initTab));
    if (initial && initTab.dataset.filter !== "all") apply(initial, initTab);
    window.addEventListener("resize", () => {
      const active = document.querySelector('.filter-tab[aria-selected="true"]');
      if (active) place(active);
    });
  }
  initFilter();

  /* ─────────────────────────────────────────────
     7. Reveal-on-scroll (batched)
     ───────────────────────────────────────────── */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (RM) { els.forEach((e) => e.classList.add("revealed")); return; }
    gsap.set(els, { opacity: 0, y: 26 });
    ScrollTrigger.batch(els, {
      start: "top 88%",
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.06, overwrite: true,
        onStart: () => batch.forEach((b) => b.classList.add("revealed")),
      }),
    });
  }
  initReveal();

  /* ─────────────────────────────────────────────
     8. Counter stats — latin digits on both locales
     ───────────────────────────────────────────── */
  function initCounters() {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const fmt = (n) => String(n) + suffix; // latin digits per user request
      if (RM) { el.textContent = fmt(end); return; }
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end, duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => { el.textContent = fmt(Math.round(obj.v)); },
        onComplete: () => { el.textContent = fmt(end); },
      });
    });
  }
  initCounters();

  /* ─────────────────────────────────────────────
     9. Scramble effects — dwell (handles) + hover (labels)
     ScrambleText keeps cells fixed → layout-safe, aria-safe.
     ───────────────────────────────────────────── */
  function initScramble() {
    if (RM) return;
    document.querySelectorAll("[data-scramble]").forEach((el) => {
      const original = el.textContent;
      el.addEventListener("pointerenter", () => {
        gsap.to(el, {
          duration: 0.7,
          scrambleText: { text: original, chars: "01▚▞█▓▒░<>/", revealDelay: 0.25, speed: 1.1 },
          ease: "none",
        });
      });
    });
    document.querySelectorAll("[data-scramble-hover]").forEach((el) => {
      const original = el.textContent;
      if (!original.trim()) return;
      el.addEventListener("pointerenter", () => {
        gsap.to(el, {
          duration: 0.55,
          scrambleText: { text: original, chars: "upperCase", revealDelay: 0.15, speed: 1.4 },
          ease: "none",
        });
      });
    });
  }
  initScramble();

  /* ─────────────────────────────────────────────
     10. Navbar shrink
     ───────────────────────────────────────────── */
  function initNav() {
    const nav = document.getElementById("navbar");
    ScrollTrigger.create({
      start: 60,
      onUpdate: (self) => nav.classList.toggle("scrolled", self.scroll() > 60),
      onEnter: () => nav.classList.add("scrolled"),
      onLeaveBack: () => nav.classList.remove("scrolled"),
    });
  }
  initNav();

  /* ─────────────────────────────────────────────
     11. Tier-2 liquid glass (Chromium 120+ only)
     ───────────────────────────────────────────── */
  function initGlassTier2() {
    const ua = navigator.userAgentData;
    const chromium = ua && ua.brands && ua.brands.some((b) => /Chromium/i.test(b.brand) && +b.version >= 120);
    if (chromium && !window.matchMedia("(prefers-reduced-transparency: reduce)").matches) {
      document.documentElement.classList.add("lg-refract");
    }
  }
  initGlassTier2();

  /* ─────────────────────────────────────────────
     12. Contact form v2 — chips, counter, spinner, shake
     ───────────────────────────────────────────── */
  function initForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const status = document.getElementById("formStatus");
    const btn = document.getElementById("submitBtn");
    const label = document.getElementById("submitLabel");
    const counter = document.getElementById("fCounter");
    const msgField = form.elements.message;
    let topic = "idea";

    form.querySelectorAll(".f-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        form.querySelectorAll(".f-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        topic = chip.dataset.topic;
      });
    });

    function updateCounter() {
      if (!counter) return;
      const n = msgField.value.length, max = 3000;
      counter.textContent = n + " / " + max;
      counter.classList.toggle("warn", n > max * 0.85 && n <= max);
      counter.classList.toggle("max", n > max);
    }
    msgField.addEventListener("input", updateCounter);
    updateCounter();

    function setErr(input, on) { input.closest(".f-field").classList.toggle("invalid", on); }
    function shake() {
      form.classList.remove("shake");
      void form.offsetWidth; // restart animation
      form.classList.add("shake");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = form.elements;
      const nameOk = f.name.value.trim().length >= 2;
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim());
      const msgOk = f.message.value.trim().length >= 10;
      setErr(f.name, !nameOk); setErr(f.email, !emailOk); setErr(f.message, !msgOk);
      if (!nameOk || !emailOk || !msgOk) {
        shake();
        (nameOk ? (emailOk ? f.message : f.email) : f.name).focus();
        return;
      }

      btn.disabled = true; btn.classList.add("loading");
      label.textContent = t("sending", "Sending…");
      status.className = "form-status"; status.textContent = "";
      try {
        const res = await fetch("api/contact.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: f.name.value.trim(),
            email: f.email.value.trim(),
            topic: topic,
            subject: f.subject.value.trim(),
            message: f.message.value.trim(),
            website: f.website.value, // honeypot
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ok) {
          status.className = "form-status ok";
          status.textContent = t("ok", "Message received!");
          form.reset();
          updateCounter();
        } else if (res.status === 429) {
          status.className = "form-status err";
          status.textContent = t("errRate", "Too many messages — try again later.");
          shake();
        } else {
          status.className = "form-status err";
          status.textContent = t("errSend", "Couldn't send — try again.");
        }
      } catch {
        status.className = "form-status err";
        status.textContent = t("errNet", "Connection failed.");
      } finally {
        btn.disabled = false; btn.classList.remove("loading");
        label.textContent = t("submit", "Send");
      }
    });

    ["name", "email", "message"].forEach((k) => {
      form.elements[k].addEventListener("input", () => setErr(form.elements[k], false));
    });
  }
  initForm();

  /* ─────────────────────────────────────────────
     13. Notify buttons (roadmap cards)
     ───────────────────────────────────────────── */
  function initNotify() {
    document.querySelectorAll("[data-notify]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const orig = a.textContent;
        a.textContent = t("notifyDone", "Noted ✓");
        setTimeout(() => (a.textContent = orig), 3200);
      });
    });
  }
  initNotify();

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
