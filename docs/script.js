document.addEventListener("DOMContentLoaded", function () {
  // --- Theme Toggle ---
  initTheme();

  // --- Platform detection ---
  var platformSpan = document.getElementById("platform");
  if (platformSpan) {
    platformSpan.textContent = detectPlatform();
  }

  // --- Smooth scrolling for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // --- Progressive enhancement fade-in ---
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".fade-in").forEach(function (el) {
    observer.observe(el);
  });

  document.documentElement.classList.add("js-ready");

  // --- Manual sidebar toggle (mobile) ---
  var sidebarToggle = document.getElementById("sidebar-toggle");
  var manualNav = document.getElementById("manual-nav");
  if (sidebarToggle && manualNav) {
    sidebarToggle.addEventListener("click", function () {
      var isOpen = manualNav.classList.toggle("is-open");
      sidebarToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // --- Manual TOC generation ---
  buildTableOfContents();
});

// --- Theme ---

function initTheme() {
  var saved = localStorage.getItem("romper-theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var isDark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("romper-theme", isDark ? "dark" : "light");
    });
  }
}

// --- Platform detection ---

function detectPlatform() {
  var ua = navigator.userAgent.toLowerCase();
  var p = (navigator.platform || "").toLowerCase();
  if (ua.includes("mac") || p.includes("mac")) return "macOS";
  if (ua.includes("win") || p.includes("win")) return "Windows";
  if (ua.includes("linux") || p.includes("linux")) return "Linux";
  return "Your Platform";
}

// --- Manual TOC ---

function buildTableOfContents() {
  var tocContainer = document.getElementById("manual-toc");
  if (!tocContainer) return;

  var manualBody = document.querySelector(".manual-body");
  if (!manualBody) return;

  var headings = manualBody.querySelectorAll("h2, h3");
  if (headings.length === 0) {
    tocContainer.style.display = "none";
    return;
  }

  var nav = tocContainer.querySelector("nav");
  if (!nav) return;

  headings.forEach(function (heading, index) {
    if (!heading.id) {
      heading.id = "section-" + index;
    }

    var link = document.createElement("a");
    link.href = "#" + heading.id;
    link.textContent = heading.textContent;

    if (heading.tagName === "H3") {
      link.classList.add("toc-h3");
    }

    link.addEventListener("click", function (e) {
      e.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    nav.appendChild(link);
  });
}
