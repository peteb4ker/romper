document.addEventListener("DOMContentLoaded", function () {
  // Platform detection
  const platformSpan = document.getElementById("platform");
  if (platformSpan) {
    platformSpan.textContent = detectPlatform();
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Fade-in animations via IntersectionObserver
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
});

function detectPlatform() {
  var ua = navigator.userAgent.toLowerCase();
  var p = (navigator.platform || "").toLowerCase();
  if (ua.includes("mac") || p.includes("mac")) return "macOS";
  if (ua.includes("win") || p.includes("win")) return "Windows";
  if (ua.includes("linux") || p.includes("linux")) return "Linux";
  return "Your Platform";
}
