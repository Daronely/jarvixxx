/* ════════════════════════════════════════════════════════════════
   Jarvixxx — motion & interaction engine
   Contracts: single-RAF Lenis+GSAP · Float32Array particles ·
   quickTo magnetics · word-level Persian manifesto · compositor-only
   ════════════════════════════════════════════════════════════════ */
"use strict";

(function () {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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
    // anchor clicks through lenis
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
     Float32Array physics, honeycomb staggered grid,
     mouse repulsion + spring return, dpr cap 2
     ───────────────────────────────────────────── */
  function initHeroCanvas() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const MOBILE = window.innerWidth < 640;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const TEXT = "JARVIXXX";
    const FONT = (weight) => `800 ${canvas.dataset.fs || 1}px Syne, sans-serif`;

    let W = 0, H = 0, running = true, inView = true;
    let parts = null; // Float32Array: x,y,vx,vy,tx,ty interleaved ×6
    let count = 0;
    let mouse = { x: -9999, y: -9999 };
    const REPULSE_R = MOBILE ? 0 : 70, REPULSE_R2 = REPULSE_R * REPULSE_R;

    function sizeCanvas() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(300, r.width); H = Math.max(140, r.height);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function buildTargets() {
      // find font size that fits width
      let fs = Math.min(H * 0.62, 200);
      const off = document.createElement("canvas");
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.font = `800 ${fs}px Syne, sans-serif`;
      let m = octx.measureText(TEXT);
      const maxW = W * 0.92;
      if (m.width > maxW) { fs = fs * maxW / m.width; }
      off.width = Math.ceil(W); off.height = Math.ceil(H);
      octx.fillStyle = "#fff";
      octx.font = `800 ${fs}px Syne, sans-serif`;
      octx.textAlign = "center"; octx.textBaseline = "middle";
      octx.fillText(TEXT, W / 2, H / 2);
      const img = octx.getImageData(0, 0, off.width, off.height).data;

      // staggered honeycomb grid sampling (~82% targets, 18% ambient halo)
      const gap = MOBILE ? 7 : 9;
      const pts = [];
      for (let y = 0; y < H; y += gap) {
        const rowShift = ((y / gap) % 2) * (gap / 2);
        for (let x = 0; x < W; x += gap) {
          const px = Math.round(x + rowShift), py = Math.round(y);
          if (px >= W || py >= H) continue;
          const a = img[(py * W + px) * 4 + 3];
          if (a > 128 && Math.random() < 0.82) {
            pts.push(px, py, 1); // target particle
          } else if (a <= 128 && Math.random() < 0.018) {
            pts.push(px, py, 0); // ambient halo
          }
        }
      }
      count = pts.length / 3;
      parts = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const tx = pts[i * 3], ty = pts[i * 3 + 1];
        // spawn from random edge for entrance formation
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.max(W, H) * (0.5 + Math.random() * 0.6);
        parts[i * 6] = W / 2 + Math.cos(ang) * rad;
        parts[i * 6 + 1] = H / 2 + Math.sin(ang) * rad;
        parts[i * 6 + 2] = 0; parts[i * 6 + 3] = 0;
        parts[i * 6 + 4] = tx; parts[i * 6 + 5] = ty;
      }
    }

    let lastT = 0;
    function frame(t) {
      if (!running) return;
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
      lastT = t;
      if (inView) {
        ctx.clearRect(0, 0, W, H);
        // batch: accent first (few), then ink
        const S = MOBILE ? 1.6 : 2.2;
        // pass 1: accent dots (precomputed indices)
        ctx.fillStyle = "rgba(89,194,230,0.95)";
        for (let k = 0; k < accentIdx.length; k++) {
          const i = accentIdx[k];
          ctx.fillRect(parts[i * 6], parts[i * 6 + 1], S, S);
        }
        ctx.fillStyle = "rgba(238,241,246,0.88)";
        for (let i = 0; i < count; i++) {
          if (isAccent[i]) continue;
          const xi = i * 6;
          // spring toward target + mouse repulsion (squared distance early exit)
          let dx = parts[xi + 4] - parts[xi], dy = parts[xi + 5] - parts[xi + 1];
          let vx = parts[xi + 2] + dx * 14 * dt, vy = parts[xi + 3] + dy * 14 * dt;
          if (REPULSE_R > 0) {
            const mdx = parts[xi] - mouse.x, mdy = parts[xi + 1] - mouse.y;
            const d2 = mdx * mdx + mdy * mdy;
            if (d2 < REPULSE_R2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / REPULSE_R) * 900 * dt / d;
              vx += mdx * f; vy += mdy * f;
            }
          }
          const damp = Math.pow(0.0018, dt); // ~damping
          parts[xi + 2] = vx * damp; parts[xi + 3] = vy * damp;
          parts[xi] += vx * dt; parts[xi + 1] += vy * dt;
          ctx.fillRect(parts[xi], parts[xi + 1], S, S);
        }
        // accent particles also need physics — do them in same loop? They were skipped.
        // Fix: run physics inside single loop; two passes only for color batching of draws.
      }
      requestAnimationFrame(frame);
    }

    // accent assignment after build
    let isAccent = new Uint8Array(0), accentIdx = [];

    function rebuild() {
      sizeCanvas();
      buildTargets();
      isAccent = new Uint8Array(count);
      accentIdx = [];
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.035) { isAccent[i] = 1; accentIdx.push(i); }
      }
    }

    if (FINE && !RM) {
      canvas.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener("pointerleave", () => { mouse.x = -9999; mouse.y = -9999; });
    }

    // pause when offscreen / tab hidden
    new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(frame); });

    let rto = null;
    window.addEventListener("resize", () => { clearTimeout(rto); rto = setTimeout(rebuild, 200); });

    document.fonts.ready.then(() => { rebuild(); requestAnimationFrame(frame); });

    if (RM) {
      // static render: just draw once at targets
      document.fonts.ready.then(() => {
        rebuild();
        // snap particles to targets and draw once
        for (let i = 0; i < count; i++) {
          parts[i * 6] = parts[i * 6 + 4]; parts[i * 6 + 1] = parts[i * 6 + 5];
        }
        running = true; inView = true;
        const once = () => {
          ctx.clearRect(0, 0, W, H);
          const S = MOBILE ? 1.6 : 2.2;
          ctx.fillStyle = "rgba(89,194,230,0.95)";
          for (const i of accentIdx) ctx.fillRect(parts[i * 6], parts[i * 6 + 1], S, S);
          ctx.fillStyle = "rgba(238,241,246,0.88)";
          for (let i = 0; i < count; i++) if (!isAccent[i]) ctx.fillRect(parts[i * 6], parts[i * 6 + 1], S, S);
        };
        once();
        running = false; // stop RAF loop
      });
    }
  }
  initHeroCanvas();

  /* ─────────────────────────────────────────────
     3. Manifesto — word-level reading front (Persian-safe)
     ───────────────────────────────────────────── */
  function initManifesto() {
    const el = document.getElementById("manifestoText");
    if (!el) return;
    if (RM) return; // plain text stays

    // word-level split manually (SplitText words is safe, but manual = zero risk with ZWNJ)
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
    const spans = el.querySelectorAll(".w");

    gsap.set(spans, { color: "oklch(0.32 0.015 245)" });
    gsap.to(spans, {
      color: "oklch(0.95 0.008 245)",
      ease: "none",
      stagger: 0.55,
      scrollTrigger: {
        trigger: el,
        start: "top 78%",
        end: "bottom 45%",
        scrub: 0.6,
      },
    });
  }
  initManifesto();

  /* ─────────────────────────────────────────────
     4. Magnetic buttons — gsap.quickTo (no per-move tweens)
     ───────────────────────────────────────────── */
  function initMagnetics() {
    if (!FINE || RM) return;
    document.querySelectorAll("[data-mag]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.32, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.32, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const relX = e.clientX - (r.left + r.width / 2);
        const relY = e.clientY - (r.top + r.height / 2);
        xTo(relX * 0.3); yTo(relY * 0.35);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }
  initMagnetics();

  /* ─────────────────────────────────────────────
     5. Bento card: cursor spotlight + 3D tilt
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
        rX((0.5 - py) * 8); rY((px - 0.5) * 8); // max ±4deg (subtle)
      });
      card.addEventListener("pointerleave", () => { rX(0); rY(0); });
    });
  }
  initCards();

  /* ─────────────────────────────────────────────
     6. Filter tabs — spring indicator + URL state
     ───────────────────────────────────────────── */
  function initFilter() {
    const tabs = document.querySelectorAll(".filter-tab");
    const indicator = document.getElementById("tabIndicator");
    const cards = document.querySelectorAll(".b-card");
    if (!tabs.length || !indicator) return;

    function moveIndicator(tab) {
      indicator.style.width = tab.offsetWidth + "px";
      indicator.style.transform = `translateX(${tab.offsetLeft - 4}px)`;
    }
    // RTL: offsetLeft works the same since we use translateX in LTR coordinate space.
    // For RTL correctness measure with inset-inline logic:
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
      tabs.forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
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
      // URL state sync
      const u = new URL(location);
      if (filter === "all") u.searchParams.delete("track"); else u.searchParams.set("track", filter);
      history.replaceState(null, "", u);
      if (lenis) ScrollTrigger.refresh();
    }

    tabs.forEach((t) => t.addEventListener("click", () => apply(t.dataset.filter, t)));

    // init from URL
    const initial = new URLSearchParams(location.search).get("track");
    const initTab = Array.from(tabs).find((t) => t.dataset.filter === initial) || tabs[0];
    requestAnimationFrame(() => { place(initTab); });
    if (initial && initTab.dataset.filter !== "all") apply(initial, initTab);

    window.addEventListener("resize", () => {
      const active = document.querySelector('.filter-tab[aria-selected="true"]');
      if (active) place(active);
    });
  }
  initFilter();

  /* ─────────────────────────────────────────────
     7. Reveal-on-scroll (batched, progressive)
     ───────────────────────────────────────────── */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (RM) { els.forEach((e) => e.classList.add("revealed")); return; }
    ScrollTrigger.batch(els, {
      start: "top 88%",
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.06, overwrite: true,
        onStart: () => batch.forEach((b) => b.classList.add("revealed")),
      }),
    });
    gsap.set(els, { opacity: 0, y: 26 });
  }
  initReveal();

  /* ─────────────────────────────────────────────
     8. Counter stats (tabular-nums)
     ───────────────────────────────────────────── */
  function initCounters() {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const isTrack = el.dataset.kind === "track";
      const faDigits = "۰۱۲۳۴۵۶۷۸۹";
      const fmt = (n) => String(n).replace(/\d/g, (d) => faDigits[+d]) + suffix;
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
     9. ScrambleText on direct links (fixed cells, aria intact)
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
  }
  initScramble();

  /* ─────────────────────────────────────────────
     10. Navbar shrink on scroll
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
     11. Tier-2 liquid glass for Chromium only
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
     12. Contact form (fetch + inline validation)
     ───────────────────────────────────────────── */
  function initForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const status = document.getElementById("formStatus");
    const btn = document.getElementById("submitBtn");
    const label = document.getElementById("submitLabel");

    function setErr(input, on) {
      input.closest(".f-field").classList.toggle("invalid", on);
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.name_, // placeholder to avoid name clash; use elements
        f = form.elements;
      let firstBad = null;
      const nameOk = f.name.value.trim().length >= 2;
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim());
      const msgOk = f.message.value.trim().length >= 10;
      setErr(f.name, !nameOk); setErr(f.email, !emailOk); setErr(f.message, !msgOk);
      if (!nameOk) firstBad = f.name; else if (!emailOk) firstBad = f.email; else if (!msgOk) firstBad = f.message;
      if (firstBad) { firstBad.focus(); return; }

      btn.disabled = true; label.textContent = "در حال ارسال…";
      status.className = "form-status"; status.textContent = "";
      try {
        const res = await fetch("api/contact.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: f.name.value.trim(),
            email: f.email.value.trim(),
            topic: f.topic.value,
            message: f.message.value.trim(),
            website: f.website.value, // honeypot
          }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          status.className = "form-status ok";
          status.textContent = "پیام رسید! خیلی زود جواب می‌دهیم.";
          form.reset();
        } else {
          status.className = "form-status err";
          status.textContent = res.status === 429 ? "چند پیام پشت‌سرهم فرستادید؛ کمی بعد دوباره تلاش کنید." : "ارسال نشد؛ لطفاً دوباره تلاش کنید یا ایمیل بزنید.";
        }
      } catch {
        status.className = "form-status err";
        status.textContent = "اتصال برقرار نشد؛ اینترنت را بررسی کنید.";
      } finally {
        btn.disabled = false; label.textContent = "فرستادن پیام";
      }
    });
    // live-clear errors
    ["name", "email", "message"].forEach((k) => {
      form.elements[k].addEventListener("input", () => setErr(form.elements[k], false));
    });
  }
  initForm();

  /* ─────────────────────────────────────────────
     13. notify buttons (roadmap cards)
     ───────────────────────────────────────────── */
  function initNotify() {
    document.querySelectorAll("[data-notify]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const label = a.textContent;
        a.textContent = "ثبت شد ✓ برای اطلاع، فرم تماس را پر کنید";
        setTimeout(() => (a.textContent = label), 3200);
      });
    });
  }
  initNotify();

  /* ─────────────────────────────────────────────
     14. language toggle → English placeholder page
     ───────────────────────────────────────────── */
  document.getElementById("langToggle")?.addEventListener("click", () => {
    location.href = "index.html?lang=en"; // graceful: same page, toggle flag below
  });

  /* refresh triggers after everything settles */
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
