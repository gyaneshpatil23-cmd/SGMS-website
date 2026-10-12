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
  // any-*: a touchscreen laptop's primary input is touch, but its mouse/trackpad still hovers
  var canHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;

  // Run fn once a mouse is known to be present. The media query is wrong on some
  // touchscreen laptops, so a real mouse movement also counts.
  function whenMouse(fn) {
    if (canHover) { fn(); return; }
    window.addEventListener("pointermove", function onMove(e) {
      if (e.pointerType !== "mouse") return;
      window.removeEventListener("pointermove", onMove);
      fn();
    });
  }
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

  /* ---------- Expertise deck (home hero) ----------
     Click the card for the next one, or drag it: it follows the pointer, and on release
     either gets thrown off (carrying the pointer's speed) or springs back. */
  var deck = document.querySelector("[data-deck]");
  if (deck) {
    var cards = Array.prototype.slice.call(deck.querySelectorAll(".sheet--main"));
    var dots = Array.prototype.slice.call(deck.querySelectorAll(".deck-dot"));
    var current = 0;
    var REST_ROTATION = -2;   // matches .sheet--main in the stylesheet
    var suppressClick = false;

    // Spring driven by the GSAP ticker. Unlike a tween it starts with a velocity, so a
    // released card keeps moving at the speed the pointer had.
    var spring = function (from, to, velocity, response, damping, onUpdate, onRest) {
      var x = from, v = velocity;
      var k = Math.pow((2 * Math.PI) / response, 2), c = 2 * damping * Math.sqrt(k);
      var tick = function (time, deltaMs) {
        var dt = Math.min(deltaMs, 32) / 2000;   // two sub-steps per frame
        for (var i = 0; i < 2; i++) { v += (-k * (x - to) - c * v) * dt; x += v * dt; }
        if (Math.abs(x - to) < 0.5 && Math.abs(v) < 5) {
          gsap.ticker.remove(tick);
          onUpdate(to);
          if (onRest) onRest();
          return;
        }
        onUpdate(x);
      };
      gsap.ticker.add(tick);
      return function () { gsap.ticker.remove(tick); };
    };

    var stopSpring = function (card) {
      if (card._stop) { card._stop(); card._stop = null; }
    };

    var showCard = function (i, thrown) {
      i = (i + cards.length) % cards.length;
      if (i === current) return;
      var prev = cards[current], next = cards[i];
      // read what is on screen now, so a swap that interrupts another carries on from there
      var prevOpacity = getComputedStyle(prev).opacity;
      var nextOpacity = getComputedStyle(next).opacity;
      current = i;
      cards.forEach(function (c, n) { c.classList.toggle("is-active", n === i); });
      dots.forEach(function (d, n) { d.setAttribute("aria-current", String(n === i)); });
      if (!animated) return;

      stopSpring(next);
      gsap.set(prev, { autoAlpha: prevOpacity });
      if (!thrown) {
        // old card slips to the back
        gsap.to(prev, { autoAlpha: 0, x: 40, rotation: 4, duration: 0.3, ease: "power2.out", overwrite: true, clearProps: "all" });
      }
      // new card rises into place; if it was still on its way out it turns round from where it is
      gsap.set(next, { autoAlpha: nextOpacity });
      if (nextOpacity < 0.05) gsap.set(next, { x: 0, y: 26, scale: 0.97, rotation: REST_ROTATION });
      gsap.to(next, {
        autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: REST_ROTATION,
        duration: 0.45, ease: "power3.out", overwrite: true, clearProps: "all"
      });
      gsap.fromTo(next.querySelectorAll(".sheet-list li"), { autoAlpha: 0, x: -10 },
        { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.05, delay: 0.1, ease: "power3.out", overwrite: true, clearProps: "all" });
    };

    deck.addEventListener("click", function (e) {
      if (suppressClick) { suppressClick = false; return; }
      var dot = e.target.closest(".deck-dot");
      if (dot) { showCard(dots.indexOf(dot)); return; }
      // "Read more" is a normal link and opens the service page
      if (e.target.closest("a")) return;
      if (e.target.closest(".sheet--main")) showCard(current + 1);
    });

    // where a card released at this speed would come to rest (same decay as scrolling)
    var project = function (velocity) { return (velocity / 1000) * 0.995 / (1 - 0.995); };

    if (animated) cards.forEach(function (card) {
      var tracking = false, dragging = false, startX = 0, startOffset = 0, history = [];
      var peek = null;   // the card underneath, while this one is being pulled away
      var place = function (x) {
        gsap.set(card, { x: x, rotation: REST_ROTATION + x * 0.03 });
        if (!peek) return;
        // the next card comes up as this one leaves, so the drag shows where it is heading
        var p = Math.min(Math.abs(x) / (card.offsetWidth * 0.6), 1);
        gsap.set(peek, { autoAlpha: p, y: 26 * (1 - p), scale: 0.97 + 0.03 * p });
      };
      var unpress = function () { gsap.to(card, { scale: 1, duration: 0.25, overwrite: "auto" }); };

      card.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (card !== cards[current] || e.target.closest("a")) return;
        // catching a card that is still springing back: take it from where it is
        stopSpring(card);
        gsap.killTweensOf(card, "x,rotation");
        tracking = true; dragging = false;
        startX = e.clientX;
        startOffset = Number(gsap.getProperty(card, "x")) || 0;
        history = [{ x: e.clientX, t: e.timeStamp }];
        // the card answers the press itself; the swap still waits for the release
        gsap.to(card, { scale: 0.985, duration: 0.1, overwrite: "auto" });
      });

      // pressed, then slid off the card without dragging it: nothing was chosen
      card.addEventListener("pointerleave", function () {
        if (!tracking || dragging) return;
        tracking = false;
        unpress();
      });

      card.addEventListener("pointermove", function (e) {
        if (!tracking) return;
        if (!dragging) {
          // small movements are still a click
          if (Math.abs(e.clientX - startX) < 10) return;
          dragging = true;
          startX = e.clientX;
          card.setPointerCapture(e.pointerId);
          unpress();
          // lift this card above the one it uncovers
          peek = cards[(current + 1) % cards.length];
          stopSpring(peek);
          gsap.killTweensOf(peek);
          gsap.set(peek, { x: 0, rotation: REST_ROTATION });
          gsap.set(card, { zIndex: 2 });
        }
        place(startOffset + e.clientX - startX);
        history.push({ x: e.clientX, t: e.timeStamp });
        if (history.length > 6) history.shift();
      });

      var release = function (e) {
        if (!tracking) return;
        tracking = false;
        if (!dragging) { unpress(); return; }
        dragging = false;
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);

        var first = history[0], last = history[history.length - 1];
        var velocity = last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
        var x = Number(gsap.getProperty(card, "x")) || 0;
        var width = card.offsetWidth;
        var landing = x + project(velocity);

        if (e.type !== "pointercancel" && Math.abs(landing) > width * 0.4) {
          // thrown: keeps its speed, fades as it leaves, and the next card comes up underneath
          var exit = (landing > 0 ? 1 : -1) * width * 1.3;
          peek = null;   // showCard takes the next card on from where the drag left it
          showCard(current + 1, true);
          card._stop = spring(x, exit, velocity, 0.4, 1, function (v) {
            place(v);
            gsap.set(card, { autoAlpha: Math.max(0, 1 - Math.abs(v / exit)) });
          }, function () { card._stop = null; gsap.set(card, { clearProps: "all" }); });
        } else {
          // not far or fast enough: springs home, with a little bounce because it was moving
          card._stop = spring(x, 0, velocity, 0.4, 0.8, place, function () {
            card._stop = null; gsap.set(card, { clearProps: "all" });
            if (peek) { gsap.set(peek, { clearProps: "all" }); peek = null; }
          });
        }
      };
      card.addEventListener("pointerup", release);
      card.addEventListener("pointercancel", release);
    });
  }

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
  gsap.defaults({ ease: "power3.out", duration: 0.6 });

  /* ---------- Intro ----------
     Links navigate immediately: nothing is animated between a click and the next page. */
  var intro = gsap.timeline({ onComplete: function () { initHeaderAutoHide(); whenMouse(initHeroParallax); } });
  // the cover only hides the unstyled first frame, so it clears quickly
  intro.to(wipe, { autoAlpha: 0, duration: 0.3, ease: "power2.out" });
  intro.from(header, { y: -16, autoAlpha: 0, duration: 0.45, clearProps: "all" }, "-=0.2");

  var heroLines = gsap.utils.toArray("h1 .line > span");
  if (heroLines.length) {
    intro.from(heroLines, { yPercent: 110, duration: 0.8, stagger: 0.07, ease: "power4.out" }, "-=0.35");
  }
  intro.from("[data-intro]", { y: 18, autoAlpha: 0, stagger: 0.06 }, "-=0.55");
  intro.add(function () {
    gsap.utils.toArray(".eyebrow[data-intro]").forEach(function (el) { el.classList.add("is-in"); });
  }, "-=0.45");

  if (document.querySelector(".hero-art")) {
    intro
      .from(".sheet--back", { autoAlpha: 0, rotate: 0, x: 0, y: 30, duration: 0.7 }, "-=0.75")
      .from(".sheet--main.is-active", { autoAlpha: 0, y: 44, rotate: 2, duration: 0.8, clearProps: "all" }, "-=0.65")
      .from(".sheet--main.is-active .sheet-list li", { autoAlpha: 0, x: -12, stagger: 0.07, duration: 0.4, clearProps: "all" }, "-=0.4")
      .from(".sheet--main.is-active .sheet-foot", { autoAlpha: 0, y: 10, duration: 0.35, clearProps: "all" }, "-=0.2")
      .from(".float-card", { autoAlpha: 0, y: 20, scale: 0.97, duration: 0.5 }, "-=0.3")
      .from(".deck-nav", { autoAlpha: 0, duration: 0.4 }, "-=0.3");

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

  // The hero card moves only in response to the pointer; it does not drift on its own
  function initHeroParallax() {
    var hero = document.querySelector(".hero");
    if (!hero || !hero.querySelector(".hero-art")) return;
    var artX = gsap.quickTo(".hero-art", "x", { duration: 0.5, ease: "power3" });
    var artY = gsap.quickTo(".hero-art", "y", { duration: 0.5, ease: "power3" });
    var backX = gsap.quickTo(".sheet--back", "xPercent", { duration: 0.7, ease: "power3" });
    var backY = gsap.quickTo(".sheet--back", "yPercent", { duration: 0.7, ease: "power3" });
    hero.addEventListener("mousemove", function (e) {
      var px = e.clientX / window.innerWidth - 0.5;
      var py = e.clientY / window.innerHeight - 0.5;
      artX(px * -16); artY(py * -10);
      backX(px * 4); backY(py * 3);
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
          yPercent: hide ? -100 : 0, duration: 0.35, overwrite: true,
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
            yPercent: 110, duration: 0.7, stagger: 0.07, ease: "power4.out",
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
      y: 24, autoAlpha: 0, stagger: 0.06,
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  gsap.utils.toArray("[data-stagger]").forEach(function (group) {
    gsap.from(group.children, {
      y: 24, autoAlpha: 0, stagger: 0.06,
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
      x: -16, autoAlpha: 0, stagger: 0.12,
      scrollTrigger: { trigger: list, start: "top 80%", once: true }
    });
  });

  /* ---------- Smaller pieces inside the sections ---------- */
  gsap.utils.toArray(".facts").forEach(function (facts) {
    gsap.from(facts.querySelectorAll(".fact"), {
      y: 20, autoAlpha: 0, stagger: 0.06, delay: 0.3,
      scrollTrigger: { trigger: facts, start: "top 95%", once: true }
    });
  });

  gsap.utils.toArray("main .icon").forEach(function (icon) {
    gsap.from(icon, {
      scale: 0.9, autoAlpha: 0, duration: 0.4,
      scrollTrigger: { trigger: icon, start: "top 90%", once: true }
    });
  });

  gsap.utils.toArray(".ticks").forEach(function (list) {
    gsap.from(list.children, {
      x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.06,
      scrollTrigger: { trigger: list, start: "top 90%", once: true }
    });
  });

  gsap.utils.toArray("main .badge").forEach(function (el) {
    gsap.from(el, {
      scale: 0.95, autoAlpha: 0, duration: 0.35,
      scrollTrigger: { trigger: el, start: "top 92%", once: true }
    });
  });

  // Service numbers drift past their rows
  gsap.utils.toArray(".service-row .num").forEach(function (num) {
    gsap.fromTo(num, { y: 16 }, {
      y: -16, ease: "none",
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
    y: 20, autoAlpha: 0, stagger: 0.05,
    scrollTrigger: { trigger: ".site-footer", start: "top 95%", once: true }
  });

  /* ---------- Counters ---------- */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var end = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var pad = el.textContent.trim().length - suffix.length;
    var state = { v: parseInt(el.getAttribute("data-from") || "0", 10) };
    gsap.to(state, {
      v: end, duration: 1, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
      onUpdate: function () {
        el.textContent = String(Math.round(state.v)).padStart(pad, "0") + suffix;
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
  gsap.utils.toArray(".btn, .nav-toggle").forEach(function (btn) {
    function release() { gsap.to(btn, { scale: 1, duration: 0.25, overwrite: "auto" }); }
    btn.addEventListener("pointerdown", function () {
      gsap.to(btn, { scale: 0.97, duration: 0.1, overwrite: "auto" });
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  });

  /* ---------- Arriving on a #section link ----------
     The browser's smooth scroll to the section gets cut short by ScrollTrigger's first
     refresh, so each link stopped somewhere different. Jump straight to it instead, and
     again whenever the layout settles, until the visitor starts moving the page. */
  var landing = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (landing) {
    var land = function () {
      // measure where the section rests, not where its reveal animation currently has it
      var top = landing.getBoundingClientRect().top + window.scrollY - (Number(gsap.getProperty(landing, "y")) || 0);
      var margin = parseFloat(getComputedStyle(landing).scrollMarginTop) || 0;
      window.scrollTo({ top: top - margin, behavior: "instant" });
    };
    var stopLanding = function () {
      ScrollTrigger.removeEventListener("refresh", land);
      window.removeEventListener("load", land);
      landing = null;
    };
    land();
    ScrollTrigger.addEventListener("refresh", land);
    window.addEventListener("load", land);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (landing) land(); });
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (type) {
      window.addEventListener(type, stopLanding, { once: true, passive: true });
    });
  }

  /* ---------- Hover interactions ---------- */
  whenMouse(initHover);

  function initHover() {

  // Only cards that lead somewhere lift; a card that lifts but does nothing reads as broken
  gsap.utils.toArray(".card").forEach(function (card) {
    if (!card.querySelector("a")) return;
    card.addEventListener("mouseenter", function () {
      gsap.to(card, { y: -4, boxShadow: "0 18px 40px rgba(4, 6, 6, 0.1)", duration: 0.3, overwrite: "auto" });
    });
    card.addEventListener("mouseleave", function () {
      gsap.to(card, { y: 0, boxShadow: "0 0px 0px rgba(4, 6, 6, 0)", duration: 0.4, overwrite: "auto" });
    });
  });

  gsap.utils.toArray(".btn, .link-arrow").forEach(function (el) {
    var arrow = el.querySelector("svg");
    if (!arrow) return;
    el.addEventListener("mouseenter", function () { gsap.to(arrow, { x: 4, duration: 0.25 }); });
    el.addEventListener("mouseleave", function () { gsap.to(arrow, { x: 0, duration: 0.25 }); });
  });

  // Buttons lean towards the cursor
  gsap.utils.toArray(".btn").forEach(function (btn) {
    btn.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - r.left - r.width / 2) * 0.1,
        y: (e.clientY - r.top - r.height / 2) * 0.14,
        duration: 0.3, overwrite: "auto"
      });
    });
    btn.addEventListener("pointerleave", function () {
      gsap.to(btn, { x: 0, y: 0, duration: 0.4, overwrite: "auto" });
    });
  });

  // Nav underline is drawn from the --u custom property
  gsap.utils.toArray(".nav-links a").forEach(function (a) {
    a.addEventListener("mouseenter", function () { gsap.to(a, { "--u": 1, duration: 0.25 }); });
    a.addEventListener("mouseleave", function () {
      gsap.to(a, { "--u": a.classList.contains("is-active") ? 1 : 0, duration: 0.25 });
    });
  });
  }
})();
