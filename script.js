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
let W = 0, H = 0, DPR = 1;

/* ================= КОНСТАНТЫ ФИЗИКИ ================= */
const MAX_BALLS   = 12;
const BALL_R      = 9;
const GRAVITY     = 140;      // px/сек² — лёгкая гравитация
const AIR_DRAG    = 0.02;     // сопротивление воздуха
const SPIN_DRAG   = 0.55;     // затухание вращения
const MAGNUS      = 0.35;     // эффект Магнуса (искривление от спина)
const RESTITUTION = 0.98;     // упругость стен
const PADDLE_REACT = 1.05;    // сила отскока от платформы

/* ================= СОСТОЯНИЕ ================= */
const state = {
  paddle: { x: 0, y: 0, w: 90, h: 14, targetX: 0, prevX: 0, vx: 0 },
  balls: [],
  trail: [],
  particles: [],
  shake: 0,
  score: 0,
  best: 0,
  baseSpeed: 340,
  speedMul: 1,
  phase: "idle",
  modalOpen: false,
};

try { state.best = Number(localStorage.getItem("pong_best") || 0); } catch(e) {}

/* ================= ЭЛЕМЕНТЫ ================= */
const scoreEl     = document.getElementById("score");
const bestEl      = document.getElementById("best");
const countEl     = document.getElementById("ballCount");
const overlay     = document.getElementById("overlay");
const overlayTitle= document.getElementById("overlayTitle");
const overlaySub  = document.getElementById("overlaySub");
const overlayBtn  = document.getElementById("overlayBtn");
const colorModal  = document.getElementById("colorModal");
const closeColors = document.getElementById("closeColors");
const restartBtn  = document.getElementById("restartBtn");
const themeBtn    = document.getElementById("themeBtn");

/* ================= HUD ================= */
function updateHUD() {
  if (scoreEl) scoreEl.textContent = state.score;
  if (bestEl)  bestEl.textContent  = state.best;
  if (countEl) countEl.textContent = state.balls.length;
}

/* ================= OVERLAY ================= */
function showOverlay(title, sub, btn) {
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlaySub)   overlaySub.textContent   = sub;
  if (overlayBtn)   overlayBtn.textContent   = btn;
  if (overlay)      overlay.hidden = false;
}
function hideOverlay() { if (overlay) overlay.hidden = true; }

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
  state.paddle.h = 14;
  state.paddle.y = H - 30;
  state.paddle.x = Math.max(0, Math.min(W - state.paddle.w, state.paddle.x));
  state.paddle.targetX = state.paddle.x;

  if (state.phase === "idle") placeBalls();
}

/* ================= ШАРИКИ ================= */
function createBall(x, y, angle, spin = 0) {
  const s = state.baseSpeed * state.speedMul;
  return {
    x, y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    r: BALL_R,
    spin: spin + (Math.random() - 0.5) * 2.5,
  };
}

function placeBalls() {
  state.balls = [];
  state.balls.push(createBall(W / 2, Math.max(40, H * 0.25), Math.PI / 2 + (Math.random() - 0.5) * 0.4));
  state.trail = [];
  state.particles = [];
}

/* ================= ЧАСТИЦЫ ================= */
function spawnParticles(x, y, count, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (80 + Math.random() * 200) * power;
    state.particles.push({
      x, y,
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
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = (W - state.paddle.w) / 2;
  state.paddle.targetX = state.paddle.x;
  state.paddle.prevX = state.paddle.x;
  state.paddle.vx = 0;
  state.shake = 0;
  placeBalls();
  updateHUD();
  hideOverlay();
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
  showOverlay("ИГРА ОКОНЧЕНА", "Счёт: " + state.score, "ИГРАТЬ СНОВА");
  tg?.HapticFeedback?.notificationOccurred?.("error");
}

/* ================= КНОПКИ ================= */
if (overlayBtn) {
  overlayBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.phase === "idle" || state.phase === "over") startGame();
  });
}
if (overlay) {
  overlay.addEventListener("click", () => {
    if (state.phase === "idle" || state.phase === "over") startGame();
  });
}
if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    startGame();
    tg?.HapticFeedback?.selectionChanged?.();
  });
}
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    state.modalOpen = true;
    if (colorModal) colorModal.hidden = false;
    tg?.HapticFeedback?.selectionChanged?.();
  });
}
if (closeColors) {
  closeColors.addEventListener("click", () => {
    state.modalOpen = false;
    if (colorModal) colorModal.hidden = true;
  });
}
document.querySelectorAll(".color-dot").forEach(dot => {
  dot.addEventListener("click", () => {
    applyTheme(dot.dataset.theme);
    tg?.HapticFeedback?.selectionChanged?.();
  });
});

/* ================= УПРАВЛЕНИЕ ================= */
function movePaddle(clientX) {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  state.paddle.targetX = (clientX - r.left) - state.paddle.w / 2;
}

window.addEventListener("pointermove", e => {
  if (state.modalOpen) return;
  if (state.phase === "playing" || state.phase === "idle") movePaddle(e.clientX);
});

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= 40;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += 40;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ================= ФИЗИКА ================= */
function update(dt) {
  if (state.modalOpen) return;

  // платформа
  const p = state.paddle;
  p.prevX = p.x;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));
  p.vx = (p.x - p.prevX) / Math.max(dt, 0.001);

  // частицы
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt / pt.maxLife;
    if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
    pt.vy += GRAVITY * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }

  // тряска
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  if (state.phase !== "playing") return;

  const targetSpeed = state.baseSpeed * state.speedMul;
  const newBalls = [];

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i];

    // эффект Магнуса — искривление от спина
    b.vx += b.spin * MAGNUS * dt;
    b.spin *= (1 - SPIN_DRAG * dt);

    // гравитация
    b.vy += GRAVITY * dt;

    // сопротивление воздуха
    b.vx *= (1 - AIR_DRAG * dt);
    b.vy *= (1 - AIR_DRAG * dt);

    // стабилизация скорости
    const mag = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / mag) * targetSpeed;
    b.vy = (b.vy / mag) * targetSpeed;

    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // стены с упругостью
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * RESTITUTION;
      b.spin += 1.5;
      spawnParticles(0, b.y, 6, 0.6);
      state.shake = Math.max(state.shake, 2);
    }
    if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -Math.abs(b.vx) * RESTITUTION;
      b.spin -= 1.5;
      spawnParticles(W, b.y, 6, 0.6);
      state.shake = Math.max(state.shake, 2);
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy) * RESTITUTION;
      spawnParticles(b.x, 0, 6, 0.6);
      state.shake = Math.max(state.shake, 2);
    }

    // удар об платформу
    if (
      b.vy > 0 &&
      prevY + b.r <= p.y &&
      b.y + b.r >= p.y &&
      b.x + b.r >= p.x &&
      b.x - b.r <= p.x + p.w
    ) {
      const rel = ((b.x - p.x) / p.w) * 2 - 1;
      const angle = rel * PADDLE_REACT;

      state.speedMul = Math.min(2.4, state.speedMul * 1.03);
      const speed = state.baseSpeed * state.speedMul;

      // скорость платформы влияет на отскок
      const paddleInfluence = Math.max(-200, Math.min(200, p.vx * 0.4));

      b.vx = Math.sin(angle) * speed + paddleInfluence;
      b.vy = -Math.cos(angle) * speed;
      b.y = p.y - b.r;

      // спин от скорости платформы
      b.spin = (p.vx / 100) + rel * 1.8;

      state.score += 1;
      state.shake = Math.max(state.shake, 6);

      spawnParticles(b.x, b.y, 14, 1);

      if (state.balls.length + newBalls.length < MAX_BALLS) {
        const na = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        newBalls.push(createBall(b.x, b.y - 4, na, (Math.random() - 0.5) * 2));
      }

      tg?.HapticFeedback?.impactOccurred?.("light");
    }

    if (b.y - b.r > H + 20) state.balls.splice(i, 1);
  }

  if (newBalls.length) state.balls.push(...newBalls);

  if (state.balls.length === 0) {
    gameOver();
    return;
  }

  updateHUD();

  if (state.balls[0]) {
    state.trail.push({ x: state.balls[0].x, y: state.balls[0].y, life: 1
