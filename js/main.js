/* SGMS Online Solutions — shared behaviour + GSAP animations */
(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var wipe = document.querySelector(".page-wipe");
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  var navItems = nav.querySelectorAll(".nav-links li, .btn");
  var bars = toggle.querySelectorAll("span");

  var mqMobile = window.matchMedia("(max-width: 820px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var animated = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined" && !reduceMotion;
  var canSplit = animated && typeof window.SplitText !== "undefined";

  window.__sgms = true;

  /* ---------- Basics ---------- */
  document.querySelectorAll("[data-year]").forEach(function (year) {
    year.textContent = new Date().getFullYear();
  });

  var page = document.body.getAttribute("data-page");
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    if (a.getAttribute("data-nav") === page) {
      a.classList.add("is-active");
      a.setAttribute("aria-current", "page");
    }
  });

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  var navOpen = false;

  function setNav(open) {
    if (open === navOpen) return;
    navOpen = open;
    toggle.setAttribute("aria-expanded", String(open));

    if (!animated || !mqMobile.matches) {
      root.classList.toggle("nav-open", open);
      return;
    }

    gsap.killTweensOf([nav, navItems, bars, header]);
    if (open) {
      // reopened mid-close: carry on from where the panel is instead of restarting
      var fresh = !root.classList.contains("nav-open");
      root.classList.add("nav-open");
      // a transform left on the header would trap the fixed menu inside it
      gsap.set(header, { clearProps: "all" });
      gsap.set(nav, { visibility: "visible", opacity: 1 });
      if (fresh) {
        gsap.set(nav, { yPercent: -100 });
        gsap.set(navItems, { y: 40, autoAlpha: 0 });
      }
      gsap.to(nav, { yPercent: 0, duration: 0.55, ease: "power4.out" });
      gsap.to(navItems, {
        y: 0, autoAlpha: 1, duration: 0.5, stagger: fresh ? 0.06 : 0, delay: fresh ? 0.12 : 0, ease: "power3.out"
      });
      gsap.to(bars[0], { y: 3.5, rotate: 45, duration: 0.3, ease: "power3.out" });
      gsap.to(bars[1], { y: -3.5, rotate: -45, duration: 0.3, ease: "power3.out" });
    } else {
      gsap.to(bars, { y: 0, rotate: 0, duration: 0.3, ease: "power3.out" });
      gsap.to(nav, {
        yPercent: -100, duration: 0.4, ease: "power3.out",
        onComplete: function () {
          root.classList.remove("nav-open");
          gsap.set([nav, navItems], { clearProps: "all" });
        }
      });
    }
  }

  toggle.addEventListener("click", function () { setNav(!navOpen); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setNav(false);
  });
  mqMobile.addEventListener("change", function (e) {
    if (e.matches) return;
    navOpen = false;
    root.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    if (animated) {
      gsap.killTweensOf([nav, navItems, bars]);
      gsap.set([nav, navItems, bars], { clearProps: "all" });
    }
  });

  /* ---------- Contact form: compose an email ---------- */
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var subject = "Enquiry: " + (d.get("service") || "General") + " — " + d.get("name");
      var body = [
        "Name: " + d.get("name"),
        "Phone: " + d.get("phone"),
        "Organisation: " + (d.get("organisation") || "-"),
        "Service: " + d.get("service"),
        "",
        d.get("message")
      ].join("\n");
      window.location.href =
        "mailto:" + form.getAttribute("data-to") +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      var note = form.querySelector(".form-note");
      if (note) note.textContent = "Your email app should now be open with the enquiry filled in. Press send there to reach us.";
    });
  }

  /* ---------- Without GSAP or with reduced motion: show everything, CSS handles hovers ---------- */
  if (!animated) {
    root.classList.remove("js");
    return;
  }

  root.classList.add("gsap");
  gsap.registerPlugin(ScrollTrigger);
  if (canSplit) gsap.registerPlugin(SplitText);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });

  /* ---------- Page transition ---------- */
  function isInternal(a) {
    var href = a.getAttribute("href");
    return (
      href && a.target !== "_blank" && a.origin === window.location.origin &&
      !/^(#|mailto:|tel:)/.test(href) && a.pathname !== window.location.pathname
    );
  }
  document.querySelectorAll("a[href]").forEach(function (a) {
    if (!isInternal(a)) return;
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      gsap.set(wipe, { transformOrigin: "bottom" });
      gsap.to(wipe, {
        scaleY: 1, duration: 0.35, ease: "power3.inOut",
        onComplete: function () { window.location.href = a.href; }
      });
    });
  });
  // Back/forward cache restores the page with the wipe still covering it
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) gsap.set(wipe, { scaleY: 0 });
  });

  /* ---------- Intro ---------- */
  var intro = gsap.timeline({ onComplete: function () { initHeaderAutoHide(); initIdleMotion(); } });
  intro.to(wipe, { scaleY: 0, transformOrigin: "top", duration: 0.75, ease: "power4.inOut" });
  intro.from(header, { y: -30, autoAlpha: 0, duration: 0.7, clearProps: "all" }, "-=0.35");

  var heroLines = gsap.utils.toArray("h1 .line > span");
  if (heroLines.length) {
    intro.from(heroLines, { yPercent: 110, duration: 1.1, stagger: 0.1, ease: "power4.out" }, "-=0.55");
  }
  intro.from("[data-intro]", { y: 26, autoAlpha: 0, stagger: 0.09 }, "-=0.8");
  intro.add(function () {
    gsap.utils.toArray(".eyebrow[data-intro]").forEach(function (el) { el.classList.add("is-in"); });
  }, "-=0.6");

  if (document.querySelector(".hero-art")) {
    intro
      .from(".sheet--back", { autoAlpha: 0, rotate: 0, x: 0, y: 40, duration: 1 }, "-=1")
      .from(".sheet--main", { autoAlpha: 0, y: 70, rotate: 4, duration: 1.1 }, "-=0.9")
      .from(".sheet-list li", { autoAlpha: 0, x: -16, stagger: 0.12, duration: 0.5 }, "-=0.5")
      .from(".stamp", { autoAlpha: 0, scale: 1.8, duration: 0.45, ease: "back.out(2.2)" }, "-=0.1")
      .from(".chip", { autoAlpha: 0, scale: 0.9, duration: 0.4 }, "-=0.15")
      .from(".float-card", { autoAlpha: 0, y: 30, scale: 0.95, duration: 0.7 }, "-=0.35");

    gsap.to(".hero-art", {
      yPercent: -10, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }

  // Glow drifts down as the hero scrolls away
  gsap.utils.toArray(".hero-glow").forEach(function (glow) {
    gsap.to(glow, {
      yPercent: 30, ease: "none",
      scrollTrigger: { trigger: glow.parentNode, start: "top top", end: "bottom top", scrub: true }
    });
  });

  // Slow breathing glow behind every hero
  gsap.to(".hero-glow", { scale: 1.18, opacity: 0.7, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });

  /* ---------- Hero card keeps floating once the intro has finished ---------- */
  function initIdleMotion() {
    if (!document.querySelector(".hero-art")) return;
    gsap.to(".sheet--main", { y: -12, rotation: -0.5, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(".float-card", { y: -9, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(".stamp", { rotation: -5, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1 });

    if (!canHover) return;
    // Layers shift against the cursor for depth
    var hero = document.querySelector(".hero");
    var artX = gsap.quickTo(".hero-art", "x", { duration: 0.8, ease: "power3" });
    var artY = gsap.quickTo(".hero-art", "y", { duration: 0.8, ease: "power3" });
    var backX = gsap.quickTo(".sheet--back", "xPercent", { duration: 1.1, ease: "power3" });
    var backY = gsap.quickTo(".sheet--back", "yPercent", { duration: 1.1, ease: "power3" });
    hero.addEventListener("mousemove", function (e) {
      var px = e.clientX / window.innerWidth - 0.5;
      var py = e.clientY / window.innerHeight - 0.5;
      artX(px * -26); artY(py * -18);
      backX(px * 7); backY(py * 5);
    });
    hero.addEventListener("mouseleave", function () { artX(0); artY(0); backX(0); backY(0); });
  }

  /* ---------- Scroll progress bar ---------- */
  var progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.appendChild(progress);
  gsap.to(progress, {
    scaleX: 1, ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 }
  });

  /* ---------- Header hides on scroll down, returns on scroll up ---------- */
  function initHeaderAutoHide() {
    var hidden = false;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: function (self) {
        if (navOpen) return;
        var hide = self.direction === 1 && self.scroll() > 400;
        if (hide === hidden) return;
        hidden = hide;
        gsap.to(header, {
          yPercent: hide ? -100 : 0, duration: 0.45, overwrite: true,
          onComplete: function () { if (!hide) gsap.set(header, { clearProps: "transform" }); }
        });
      }
    });
  }

  /* ---------- Headings: line-by-line reveal ---------- */
  if (canSplit) {
    gsap.utils.toArray("main h2, main blockquote").forEach(function (h2) {
      if (h2.closest(".form")) return;
      SplitText.create(h2, {
        type: "lines", mask: "lines", linesClass: "split-line", autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, {
            yPercent: 110, duration: 1, stagger: 0.1, ease: "power4.out",
            scrollTrigger: { trigger: h2, start: "top 88%", once: true }
          });
        }
      });
    });
  }

  /* ---------- Scroll reveals ---------- */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    // detail rows come in one after another
    var targets = el.matches(".details") ? el.children : el;
    // split headings animate themselves; fade only what sits around them
    if (canSplit && !el.matches(".form")) {
      if (el.matches("h2")) return;
      if (el.querySelector(":scope > h2")) {
        targets = Array.prototype.filter.call(el.children, function (c) { return !c.matches("h2"); });
      }
    }
    gsap.from(targets, {
      y: 44, autoAlpha: 0, stagger: 0.1,
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  gsap.utils.toArray("[data-stagger]").forEach(function (group) {
    gsap.from(group.children, {
      y: 44, autoAlpha: 0, stagger: 0.1,
      scrollTrigger: { trigger: group, start: "top 85%", once: true }
    });
  });

  // Eyebrow rules draw in (the transition lives in the stylesheet)
  gsap.utils.toArray(".eyebrow:not([data-intro])").forEach(function (el) {
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: function () { el.classList.add("is-in"); }
    });
  });

  gsap.utils.toArray(".timeline").forEach(function (list) {
    gsap.from(list.children, {
      x: -24, autoAlpha: 0, stagger: 0.25,
      scrollTrigger: { trigger: list, start: "top 80%", once: true }
    });
  });

  /* ---------- Smaller pieces inside the sections ---------- */
  gsap.utils.toArray(".facts").forEach(function (facts) {
    gsap.from(facts.querySelectorAll(".fact"), {
      y: 30, autoAlpha: 0, stagger: 0.1, delay: 0.6,
      scrollTrigger: { trigger: facts, start: "top 95%", once: true }
    });
  });

  gsap.utils.toArray("main .icon").forEach(function (icon) {
    gsap.from(icon, {
      scale: 0.8, autoAlpha: 0, duration: 0.6,
      scrollTrigger: { trigger: icon, start: "top 90%", once: true }
    });
  });

  gsap.utils.toArray(".ticks").forEach(function (list) {
    gsap.from(list.children, {
      x: -18, autoAlpha: 0, duration: 0.6, stagger: 0.12,
      scrollTrigger: { trigger: list, start: "top 90%", once: true }
    });
  });

  gsap.utils.toArray("main .badge").forEach(function (el) {
    gsap.from(el, {
      scale: 0.9, autoAlpha: 0, duration: 0.5,
      scrollTrigger: { trigger: el, start: "top 92%", once: true }
    });
  });

  // Service numbers drift past their rows
  gsap.utils.toArray(".service-row .num").forEach(function (num) {
    gsap.fromTo(num, { y: 36 }, {
      y: -36, ease: "none",
      scrollTrigger: { trigger: num.parentNode, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  // Gold line draws along the process steps and the about timeline as you scroll
  gsap.utils.toArray(".steps, .timeline").forEach(function (track) {
    var vertical = track.classList.contains("timeline");
    var line = document.createElement(vertical ? "li" : "div");
    line.className = "line-progress";
    line.setAttribute("aria-hidden", "true");
    line.appendChild(document.createElement("span"));
    track.insertBefore(line, track.firstChild);
    var stops = track.querySelectorAll(".step, li:not(.line-progress)");
    gsap.fromTo(line.firstChild, vertical ? { scaleY: 0 } : { scaleX: 0 }, {
      scaleX: 1, scaleY: 1, ease: "none",
      scrollTrigger: { trigger: track, start: "top 80%", end: "bottom 60%", scrub: 0.5 },
      // each dot lights up as the line reaches it
      onUpdate: function () {
        var p = this.progress();
        stops.forEach(function (stop, i) {
          var at = vertical ? stop.offsetTop / track.offsetHeight : i / stops.length;
          stop.classList.toggle("is-reached", p > 0 && p >= at);
        });
      }
    });
  });

  // Ring behind the call-to-action grows while it crosses the screen
  gsap.utils.toArray(".cta").forEach(function (cta) {
    gsap.fromTo(cta, { "--ring": 0.5 }, {
      "--ring": 1.5, ease: "none",
      scrollTrigger: { trigger: cta, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  gsap.from(".footer-grid > *", {
    y: 30, autoAlpha: 0, stagger: 0.08,
    scrollTrigger: { trigger: ".site-footer", start: "top 95%", once: true }
  });

  /* ---------- Counters ---------- */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var end = parseInt(el.getAttribute("data-count"), 10);
    var pad = el.textContent.trim().length;
    var state = { v: parseInt(el.getAttribute("data-from") || "0", 10) };
    gsap.to(state, {
      v: end, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
      onUpdate: function () {
        el.textContent = String(Math.round(state.v)).padStart(pad, "0");
      }
    });
  });

  /* ---------- Marquee: constant drift that speeds up with scroll ---------- */
  gsap.utils.toArray(".marquee-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
    var loop = gsap.to(track, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
    ScrollTrigger.create({
      trigger: track, start: "top bottom", end: "bottom top",
      onUpdate: function (self) {
        var boost = Math.min(Math.abs(self.getVelocity()) / 400, 4);
        gsap.to(loop, { timeScale: 1 + boost, duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: 1, duration: 1, delay: 0.2 });
      }
    });
  });

  /* ---------- Press feedback ---------- */
  gsap.utils.toArray(".btn").forEach(function (btn) {
    function release() { gsap.to(btn, { scale: 1, duration: 0.25, overwrite: "auto" }); }
    btn.addEventListener("pointerdown", function () {
      gsap.to(btn, { scale: 0.97, duration: 0.12, overwrite: "auto" });
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  });

  /* ---------- Hover interactions ---------- */
  if (!canHover) return;

  // Logo mark tips over on hover
  gsap.utils.toArray(".logo").forEach(function (logo) {
    var mark = logo.querySelector(".logo-mark");
    logo.addEventListener("mouseenter", function () { gsap.to(mark, { rotation: -8, scale: 1.06, duration: 0.3 }); });
    logo.addEventListener("mouseleave", function () { gsap.to(mark, { rotation: 0, scale: 1, duration: 0.3 }); });
  });

  gsap.utils.toArray(".card, .value").forEach(function (card) {
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener("mouseenter", function () {
      gsap.to(card, { y: -6, boxShadow: "0 24px 48px rgba(11, 26, 43, 0.1)", duration: 0.4, overwrite: "auto" });
    });
    // tilt towards the cursor
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      gsap.to(card, {
        rotationY: ((e.clientX - r.left) / r.width - 0.5) * 7,
        rotationX: ((e.clientY - r.top) / r.height - 0.5) * -7,
        duration: 0.5, overwrite: "auto"
      });
    });
    card.addEventListener("mouseleave", function () {
      gsap.to(card, {
        y: 0, rotationX: 0, rotationY: 0, boxShadow: "0 0px 0px rgba(11, 26, 43, 0)",
        duration: 0.6, overwrite: "auto"
      });
    });
  });

  /* Cursor ring that trails the pointer and grows over anything clickable */
  var ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.appendChild(ring);
  var ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
  var ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
  var ringShown = false;
  window.addEventListener("mousemove", function (e) {
    ringX(e.clientX); ringY(e.clientY);
    if (!ringShown) { ringShown = true; gsap.to(ring, { autoAlpha: 1, duration: 0.3 }); }
  });
  document.documentElement.addEventListener("mouseleave", function () {
    ringShown = false; gsap.to(ring, { autoAlpha: 0, duration: 0.3 });
  });
  gsap.utils.toArray("a, button").forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      gsap.to(ring, { scale: 1.9, backgroundColor: "rgba(200, 151, 62, 0.16)", duration: 0.35 });
    });
    el.addEventListener("mouseleave", function () {
      gsap.to(ring, { scale: 1, backgroundColor: "rgba(200, 151, 62, 0)", duration: 0.35 });
    });
  });

  gsap.utils.toArray(".btn, .link-arrow").forEach(function (el) {
    var arrow = el.querySelector("svg");
    if (!arrow) return;
    el.addEventListener("mouseenter", function () { gsap.to(arrow, { x: 5, duration: 0.3 }); });
    el.addEventListener("mouseleave", function () { gsap.to(arrow, { x: 0, duration: 0.3 }); });
  });

  // Buttons lean towards the cursor
  gsap.utils.toArray(".btn").forEach(function (btn) {
    btn.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - r.left - r.width / 2) * 0.25,
        y: (e.clientY - r.top - r.height / 2) * 0.35,
        duration: 0.4, overwrite: "auto"
      });
    });
    btn.addEventListener("pointerleave", function () {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, overwrite: "auto" });
    });
  });

  // Nav underline is drawn from the --u custom property
  gsap.utils.toArray(".nav-links a").forEach(function (a) {
    a.addEventListener("mouseenter", function () { gsap.to(a, { "--u": 1, duration: 0.35 }); });
    a.addEventListener("mouseleave", function () {
      gsap.to(a, { "--u": a.classList.contains("is-active") ? 1 : 0, duration: 0.35 });
    });
  });
})();
