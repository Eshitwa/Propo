const CONFIG = {
  yesMessage: "Well, Let's ride the rollercoaster!",
  maybeMessage: "Fine..., whatever you desire, understandable...",
};

const intro = document.querySelector("#intro");
const bookSection = document.querySelector("#book");
const bookCard = document.querySelector("#bookCard");
const turnPage = document.querySelector("#turnPage");
const backPage = document.querySelector("#backPage");
const musicToggle = document.querySelector("#musicToggle");
const answerNote = document.querySelector("#answerNote");
const toast = document.querySelector("#toast");

let audioContext;
let masterGain;
let musicTimer;
let isMusicPlaying = false;
let isGainConnected = false;

function setupIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function runIntro() {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reducedMotion || !intro) {
    intro?.classList.add("is-hidden");
    return;
  }

  if (window.anime) {
    const timeline = anime.timeline({
      easing: "easeOutCubic",
      complete: () => {
        intro.classList.add("is-hidden");
      },
    });

    timeline
      .add({
        targets: ".intro__glow",
        opacity: [0, 1],
        scale: [0.2, 1.1],
        duration: 720,
      })
      .add(
        {
          targets: ".intro__heart",
          opacity: [0, 1],
          scale: [0.2, 1],
          rotate: "-45deg",
          duration: 680,
        },
        "-=430",
      )
      .add({
        targets: ".intro__heart",
        scale: [1, 1.18, 0.94, 1.08],
        duration: 520,
      })
      .add(
        {
          targets: ".intro__glow",
          scale: [1.1, 9],
          opacity: [1, 0.94],
          duration: 680,
          easing: "easeInOutQuart",
        },
        "-=120",
      )
      .add(
        {
          targets: ".intro",
          opacity: [1, 0],
          duration: 560,
        },
        "-=260",
      );
  } else {
    window.setTimeout(() => intro.classList.add("is-hidden"), 1800);
  }
}

function noteFrequency(note) {
  const notes = {
    C4: 261.63,
    E4: 329.63,
    G4: 392.0,
    A4: 440.0,
    C5: 523.25,
    D5: 587.33,
  };

  return notes[note] || notes.C4;
}

function playTone(note, time, duration) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(noteFrequency(note), time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.045, time + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.04);
}

function startMusic() {
  audioContext =
    audioContext || new (window.AudioContext || window.webkitAudioContext)();
  masterGain = masterGain || audioContext.createGain();
  masterGain.gain.value = 0.42;

  if (!isGainConnected) {
    masterGain.connect(audioContext.destination);
    isGainConnected = true;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const pattern = ["C4", "E4", "G4", "C5", "A4", "G4", "E4", "D5"];
  let step = 0;

  const schedule = () => {
    const now = audioContext.currentTime;
    playTone(pattern[step % pattern.length], now, 1.35);
    playTone(pattern[(step + 2) % pattern.length], now + 0.18, 1.1);
    step += 1;
  };

  schedule();
  musicTimer = window.setInterval(schedule, 1450);
  isMusicPlaying = true;
  musicToggle?.classList.add("is-playing");
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = undefined;
  isMusicPlaying = false;
  musicToggle?.classList.remove("is-playing");
}

function toggleMusic() {
  if (isMusicPlaying) {
    stopMusic();
    return;
  }

  startMusic();
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function revealBookOnScroll() {
  if (!bookSection) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    bookSection.classList.add("is-revealed");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        bookSection.classList.add("is-revealed");
        observer.disconnect();
      });
    },
    {
      threshold: 0.28,
      rootMargin: "0px 0px -12% 0px",
    },
  );

  observer.observe(bookSection);
}

function celebrate(button) {
  if (!window.anime) return;

  const bounds = button.getBoundingClientRect();
  const pieces = Array.from({ length: 18 }, (_, index) => {
    const piece = document.createElement("span");
    piece.className = "burst-piece";
    piece.style.position = "fixed";
    piece.style.left = `${bounds.left + bounds.width / 2}px`;
    piece.style.top = `${bounds.top + bounds.height / 2}px`;
    piece.style.width = "0.42rem";
    piece.style.height = "0.42rem";
    piece.style.borderRadius = "50%";
    piece.style.background =
      index % 2 ? "var(--color-warm)" : "var(--color-accent)";
    piece.style.pointerEvents = "none";
    piece.style.zIndex = "12";
    document.body.appendChild(piece);
    return piece;
  });

  anime({
    targets: pieces,
    translateX: () => anime.random(-150, 150),
    translateY: () => anime.random(-170, -38),
    scale: [1, 0],
    opacity: [1, 0],
    delay: anime.stagger(24),
    duration: 1100,
    easing: "easeOutExpo",
    complete: () => pieces.forEach((piece) => piece.remove()),
  });
}

async function sendAnswer(answer) {
  if (window.location.protocol === "file:") {
    return { sent: false, configured: false, localOnly: true };
  }

  const response = await fetch("/api/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      answer,
      name: "_____",
      message: "The answer is......",
      createdAt: new Date().toISOString(),
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "The answer is......");
  }

  return result;
}

async function handleAnswer(event) {
  const button = event.currentTarget;
  const answer = button.dataset.answer || "Yes";
  const customMessage =
    answer === "Yes" ? CONFIG.yesMessage : CONFIG.maybeMessage;

  button.disabled = true;
  answerNote.textContent = customMessage;
  showToast("ERROR!!! Request:NA;fallback-none:quote_NA  Answer in school");
  celebrate(button);

  try {
    const result = await sendAnswer(answer);

    if (result.localOnly) {
      showToast("Open this page through the local server to send the answer.");
    } else if (result.sent) {
      showToast("Your answer was sent.");
    } else {
      showToast("SMTP is not configured yet, so this stayed on your machine.");
    }
  } catch (error) {
    button.disabled = false;
    showToast("The answer could not be sent right now.");
  }
}

function bindEvents() {
  turnPage?.addEventListener("click", () => {
    bookCard?.classList.add("is-open");
  });

  backPage?.addEventListener("click", () => {
    bookCard?.classList.remove("is-open");
  });

  musicToggle?.addEventListener("click", toggleMusic);

  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", handleAnswer);
  });
}

setupIcons();
bindEvents();
revealBookOnScroll();
runIntro();
