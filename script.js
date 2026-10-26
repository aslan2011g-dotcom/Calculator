/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

/* ================= ТЕМА ================= */
const THEMES = ["black","blue","pink","purple","green","orange","red","yellow","teal","indigo","lime","cyan","magenta"];
const THEME_BG = {
  black:"#000000", blue:"#04101c", pink:"#14060f", purple:"#0d0718",
  green:"#04120a", orange:"#140a05", red:"#140505", yellow:"#141005",
  teal:"#04120f", indigo:"#070b18", lime:"#0b1405", cyan:"#041318", magenta:"#140518"
};

const colors = { accent: "#ffffff", accent2: "#bdbdbd" };

function readColors() {
  const cs = getComputedStyle(document.body);
  colors.accent  = cs.getPropertyValue("--accent").trim()   || "#fff";
  colors.accent2 = cs.getPropertyValue("--accent-2").trim() || "#bdbdbd";
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "black";
  THEMES.forEach(t => document.body.classList.remove("theme-" + t));
  document.body.classList.add("theme-" + theme);
  try { localStorage.setItem("theme", theme); } catch(e) {}
  document.querySelectorAll(".color-dot").forEach(dot => {
    dot.classList.toggle("selected", dot.dataset.theme === theme);
  });
  tg?.setHeaderColor?.(THEME_BG[theme]);
  tg?.setBackgroundColor?.(THEME_BG[theme]);
  readColors();
}

/* ================= КАНВАС ================= */
const canvas = document.getElementById("game");
const stage  = document.getElementById("stage");
const ctx    = canvas ? canvas.getContext("2d") : null;
let W = 1, H = 1, DPR = 1;

/* ================= СОСТОЯНИЕ ================= */
const MAX_BALLS = 12;
const BALL_R = 8;
const PADDLE_H = 12;

const state = {
  paddle: { x: 0, y: 0, w: 90, h: PADDLE_H, targetX: 0, vx: 0, prevX: 0 },
  bot:    { x: 0, y: 0, w: 90, h: PADDLE_H, targetX: 0, vx: 0, prevX: 0, speed: 0.18 },
  balls: [],
  trail: [],
  particles: [],
  shake: 0,
  score: 0,
  botScore: 0,
  best: 0,
  baseSpeed: 320,
  speedMul: 1,
  phase: "idle",
  modalOpen: false,
  lastHitter: "bot",
  serveTimer: 0,
};

try { state.best = Number(localStorage.getItem("pong_best") || 0); } catch(e) {}

/* ================= ЭЛЕМЕНТЫ ================= */
const scoreEl     = document.getElementById("score");
const botScoreEl  = document.getElementById("botScore");
const ballCountEl = document.getElementById("ballCount");
const overlay     = document.getElementById("overlay");
const overlayTitle= document.getElementById("overlayTitle");
const overlaySub  = document.getElementById("overlaySub");
const overlayBtn  = document.getElementById("overlayBtn");
const colorModal  = document.getElementById("colorModal");
const closeColors = document.getElementById("closeColors");
const restartBtn  = document.getElementById("restartBtn");
const themeBtn    = document.getElementById("themeBtn");

function updateHUD() {
  if (scoreEl)     scoreEl.textContent     = state.score;
  if (botScoreEl)  botScoreEl.textContent  = state.botScore;
  if (ballCountEl) ballCountEl.textContent = state.balls.length || 1;
}

function showOverlay(title, sub, btn, animate) {
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlaySub)   overlaySub.textContent   = sub;
  if (overlayBtn)   overlayBtn.textContent   = btn;
  if (overlay) {
    overlay.hidden = false;
    overlay.classList.remove("closing");
    if (animate) {
      overlay.classList.add("opening");
      setTimeout(() => overlay.classList.remove("opening"), 500);
    }
  }
}

function hideOverlayAnimated() {
  if (!overlay) return;
  overlay.classList.add("closing");
  setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove("closing");
  }, 350);
}

/* ================= РАЗМЕР ================= */
function resize() {
  if (!canvas || !stage) return;
  const r = stage.getBoundingClientRect();
  W = Math.max(1, Math.floor(r.width));
  H = Math.max(1, Math.floor(r.height));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  state.paddle.w = Math.round(Math.max(70, Math.min(W * 0.3, 130)));
  state.paddle.y = H - 30;
  state.paddle.x = Math.max(0, Math.min(W - state.paddle.w, state.paddle.x));
  state.paddle.targetX = state.paddle.x;

  state.bot.w = state.paddle.w;
  state.bot.y = 30 - state.paddle.h;
  state.bot.x = Math.max(0, Math.min(W - state.bot.w, state.bot.x));
  state.bot.targetX = state.bot.x;

  if (state.phase === "idle") setupServe("player");
}

/* ================= ШАРИКИ ================= */
function createBall(x, y, angle) {
  const s = state.baseSpeed * state.speedMul;
  return {
    x: x, y: y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    r: BALL_R,
  };
}

function setupServe(who) {
  state.balls = [];
  state.trail = [];
  state.particles = [];
  state.lastHitter = who === "player" ? "bot" : "player";
  state.serveTimer = 0.8;
  const b = createBall(W / 2, H / 2, who === "player" ? Math.PI / 2 : -Math.PI / 2);
  b.vx = 0; b.vy = 0;
  state.balls.push(b);
}

function serveBall() {
  const b = state.balls[0];
  if (!b) return;
  const dir = state.lastHitter === "bot" ? 1 : -1;
  state.baseSpeed = 320;
  state.speedMul = 1;
  const s = state.baseSpeed;
  const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
  b.vx = Math.cos(angle) * s * 0.6;
  b.vy = Math.sin(angle) * s * dir;
  if (dir < 0) b.vy = -Math.abs(b.vy);
  else b.vy = Math.abs(b.vy);
}

/* ================= ЧАСТИЦЫ ================= */
function spawnParticles(x, y, count, power) {
  if (!power) power = 1;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 180) * power;
    state.particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      maxLife: 0.4 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 2.5,
    });
  }
}

/* ================= СТАРТ / КОНЕЦ ================= */
function startGame() {
  state.score = 0;
  state.botScore = 0;
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = (W - state.paddle.w) / 2;
  state.paddle.targetX = state.paddle.x;
  state.paddle.prevX = state.paddle.x;
  state.paddle.vx = 0;
  state.bot.x = (W - state.bot.w) / 2;
  state.bot.targetX = state.bot.x;
  state.bot.prevX = state.bot.x;
  state.bot.vx = 0;
  state.shake = 0;
  setupServe("player");
  updateHUD();

  // 🎬 Анимация старта
  if (stage) {
    stage.classList.remove("launching");
    void stage.offsetWidth;
    stage.classList.add("launching");
    setTimeout(() => stage.classList.remove("launching"), 650);
  }

  hideOverlayAnimated();
  tg?.HapticFeedback?.impactOccurred?.("medium");
}

function gameOver() {
  state.phase = "over";
  state.speedMul = 1;
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem("pong_best", state.best); } catch(e) {}
  }
  updateHUD();
  showOverlay("ИГРА ОКОНЧЕНА", "Счёт " + state.score + " : " + state.botScore + " · Рекорд: " + state.best, "ИГРАТЬ СНОВА", true);
  tg?.HapticFeedback?.notificationOccurred?.("error");
}

/* ================= КНОПКИ ================= */
if (overlayBtn) {
  overlayBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (state.phase === "idle" || state.phase === "over") startGame();
  });
}
if (overlay) {
  overlay.addEventListener("click", function() {
    if (state.phase === "idle" || state.phase === "over") startGame();
  });
}
if (restartBtn) {
  restartBtn.addEventListener("click", function() {
    startGame();
    tg?.HapticFeedback?.selectionChanged?.();
  });
}
if (themeBtn) {
  themeBtn.addEventListener("click", function() {
    state.modalOpen = true;
    if (colorModal) colorModal.hidden = false;
    tg?.HapticFeedback?.selectionChanged?.();
  });
}
if (closeColors) {
  closeColors.addEventListener("click", function() {
    state.modalOpen = false;
    if (colorModal) colorModal.hidden = true;
  });
}
document.querySelectorAll(".color-dot").forEach(function(dot) {
  dot.addEventListener("click", function() {
    applyTheme(dot.dataset.theme);
    tg?.HapticFeedback?.selectionChanged?.();
  });
});

/* ================= УПРАВЛЕНИЕ ================= */
function movePaddle(clientX) {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const x = clientX - r.left;
  state.paddle.targetX = x - state.paddle.w / 2;
}

window.addEventListener("pointermove", function(e) {
  if (state.modalOpen) return;
  if (state.phase === "playing" || state.phase === "idle") movePaddle(e.clientX);
});

window.addEventListener("keydown", function(e) {
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= 40;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += 40;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ================= ФИЗИКА ================= */
function update(dt) {
  if (state.modalOpen) return;

  // платформа игрока
  const p = state.paddle;
  p.prevX = p.x;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));
  p.vx = (p.x - p.prevX) / Math.max(dt, 0.001);

  // бот
  const bot = state.bot;
  if (state.phase === "playing" && state.balls.length) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const b of state.balls) {
      if (b.vy < 0) {
        const d = Math.abs(b.y - bot.y);
        if (d < nearestDist) { nearestDist = d; nearest = b; }
      }
    }
    if (nearest) {
      bot.targetX = nearest.x - bot.w / 2 + (Math.random() - 0.5) * 20;
