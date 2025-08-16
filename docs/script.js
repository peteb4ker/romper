// Platform detection and dynamic content
document.addEventListener("DOMContentLoaded", function () {
  // Detect user platform
  const platform = detectPlatform();

  // Update download button text
  const platformSpan = document.getElementById("platform");
  if (platformSpan) {
    platformSpan.textContent = platform;
  }

  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Add loading states for external links
  document.querySelectorAll('a[href^="https://github.com"]').forEach((link) => {
    link.addEventListener("click", function () {
      // Add subtle loading indication
      this.style.opacity = "0.7";
      setTimeout(() => {
        this.style.opacity = "1";
      }, 200);
    });
  });

  // App screenshot is static - no animation needed

  // Intersection Observer for fade-in animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  // Observe sections for animations
  document
    .querySelectorAll(".feature, .step, .screenshot-item")
    .forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      observer.observe(el);
    });
});

function detectPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();

  if (userAgent.includes("mac") || platform.includes("mac")) {
    return "macOS";
  } else if (userAgent.includes("win") || platform.includes("win")) {
    return "Windows";
  } else if (userAgent.includes("linux") || platform.includes("linux")) {
    return "Linux";
  } else {
    return "Your Platform";
  }
}

// Terminal animation removed - using app screenshot instead

// Add some easter eggs for developers
console.log(`
╭───────────────────────────────────────╮
│  Welcome to Romper Sample Manager!   │
│                                       │
│  🎵 Built for Squarp Rample users    │
│  🔊 Open source and cross-platform   │
│  💾 Safe, non-destructive editing    │
│                                       │
│  GitHub: github.com/peteb4ker/romper  │
╰───────────────────────────────────────╯
`);
