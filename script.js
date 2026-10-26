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
const SPLIT_CHANCE = 0.35;   // шанс размножения при ударе
const MAX_BOT_SCORE = 5;

const state = {
  paddle: { x: 0, y: 0, w: 90, h: PADDLE_H, targetX: 0, vx: 0, prevX: 0 },
  bot:    { x: 0, y: 0, w: 90, h: PADDLE_H, targetX: 0, vx: 0, prevX: 0 },
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
  mode: "bot",   // "bot" | "wall"
};

try { state.best = Number(localStorage.getItem("pong_best") || 0); } catch(e) {}
try { state.mode = localStorage.getItem("pong_mode") || "bot"; } catch(e) {}

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
const modeBtn     = document.getElementById("modeBtn");
const modeText    = document.getElementById("modeText");

function updateHUD() {
  if (scoreEl)     scoreEl.textContent     = state.score;
  if (botScoreEl)  botScoreEl.textContent  = state.mode === "bot" ? state.botScore : "—";
  if (ballCountEl) ballCountEl.textContent = state.balls.length || 1;
  if (modeText)    modeText.textContent    = state.mode === "bot" ? "С ботом" : "Без бота";
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
      setTimeout(function() { overlay.classList.remove("opening"); }, 500);
    }
  }
}

function hideOverlayAnimated() {
  if (!overlay) return;
  overlay.classList.add("closing");
  setTimeout(function() {
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
  b.vy = dir > 0 ? Math.abs(Math.sin(angle) * s) : -Math.abs(Math.sin(angle) * s);
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

  if (stage) {
    stage.classList.remove("launching");
    void stage.offsetWidth;
    stage.classList.add("launching");
    setTimeout(function() { stage.classList.remove("launching"); }, 650);
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
  showOverlay("ИГРА ОКОНЧЕНА", "Счёт: " + state.score + " · Рекорд: " + state.best, "ИГРАТЬ СНОВА", true);
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
if (modeBtn) {
  modeBtn.addEventListener("click", function() {
    state.mode = state.mode === "bot" ? "wall" : "bot";
    try { localStorage.setItem("pong_mode", state.mode); } catch(e) {}
    updateHUD();
    state.phase = "idle";
    setupServe("player");
    showOverlay(
      state.mode === "bot" ? "PING PONG · БОТ" : "PING PONG · СТЕНА",
      state.mode === "bot" ? "Отбивай — шарики размножаются" : "Стена сверху отбивает сама",
      "ИГРАТЬ", true
    );
    tg?.HapticFeedback?.selectionChanged?.();
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

  // бот — только в режиме bot
  const bot = state.bot;
  if (state.mode === "bot" && state.phase === "playing" && state.balls.length) {
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.vy < 0) {
        const d = Math.abs(b.y - bot.y);
        if (d < nearestDist) { nearestDist = d; nearest = b; }
      }
    }
    if (nearest) {
      bot.targetX = nearest.x - bot.w / 2 + (Math.random() - 0.5) * 20;
    }
  }
  bot.prevX = bot.x;
  bot.x += (bot.targetX - bot.x) * Math.min(1, dt * 10);
  bot.x = Math.max(0, Math.min(W - bot.w, bot.x));
  bot.vx = (bot.x - bot.prevX) / Math.max(dt, 0.001);

  // частицы
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt / pt.maxLife;
    if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
    pt.vy += 200 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  if (state.phase !== "playing") return;

  if (state.serveTimer > 0) {
    state.serveTimer -= dt;
    if (state.serveTimer <= 0) serveBall();
    return;
  }

  const targetSpeed = state.baseSpeed * state.speedMul;
  const newBalls = [];

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i];

    const mag = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / mag) * targetSpeed;
    b.vy = (b.vy / mag) * targetSpeed;

    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // стены
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      spawnParticles(0, b.y, 6, 0.6);
    }
    if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -Math.abs(b.vx);
      spawnParticles(W, b.y, 6, 0.6);
    }

    // верхняя стена / бот
    if (b.y - b.r < 0) {
      if (state.mode === "wall") {
        // стена отбивает сама
        b.y = b.r;
        b.vy = Math.abs(b.vy);
        state.lastHitter = "bot"; // считаем, что «стена» = «бот» (не даёт очко игроку)
        spawnParticles(b.x, 0, 8, 0.8);
        state.shake = Math.max(state.shake, 2);
        tg?.HapticFeedback?.impactOccurred?.("light");
      } else {
        // в режиме бота верхняя стена просто отражает
        b.y = b.r;
        b.vy = Math.abs(b.vy);
      }
    }

    // удар об ракетку БОТА (только в режиме bot)
    if (
      state.mode === "bot" &&
      b.vy < 0 &&
      b.y - b.r <= bot.y + bot.h &&
      b.y - b.r >= bot.y - 4 &&
      b.x + b.r >= bot.x &&
      b.x - b.r <= bot.x + bot.w
    ) {
      const rel = ((b.x - bot.x) / bot.w) * 2 - 1;
      const angle = -Math.PI / 2 + rel * 1.05;
      b.y = bot.y + bot.h + b.r;
      b.vx = Math.cos(angle) * targetSpeed + bot.vx * 0.3;
      b.vy = Math.abs(Math.sin(angle) * targetSpeed);
      state.lastHitter = "bot";
      spawnParticles(b.x, bot.y + bot.h, 10, 1);
      state.shake = Math.max(state.shake, 3);
      tg?.HapticFeedback?.impactOccurred?.("light");
    }

    // удар об платформу ИГРОКА — случайное размножение
    if (
      b.vy > 0 &&
      prevY + b.r <= p.y &&
      b.y + b.r >= p.y &&
      b.x + b.r >= p.x &&
      b.x - b.r <= p.x + p.w
    ) {
      const rel = ((b.x - p.x) / p.w) * 2 - 1;
      const angle = Math.PI / 2 + rel * 1.05;
      b.y = p.y - b.r;
      b.vx = Math.cos(angle) * targetSpeed + p.vx * 0.3;
      b.vy = -Math.abs(Math.sin(angle) * targetSpeed);

      state.score += 1;
      state.speedMul = Math.min(2.2, state.speedMul * 1.03);
      state.shake = Math.max(state.shake, 5);
      spawnParticles(b.x, b.y, 12, 1);
      state.lastHitter = "player";
      tg?.HapticFeedback?.impactOccurred?.("medium");

      // 🎲 СЛУЧАЙНОЕ размножение: шанс 35%
      if (
        Math.random() < SPLIT_CHANCE &&
        state.balls.length + newBalls.length < MAX_BALLS
      ) {
        const na = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const nb = createBall(b.x, b.y - 4, na);
        nb.vx = Math.cos(na) * targetSpeed;
        nb.vy = -Math.abs(Math.sin(na) * targetSpeed);
        newBalls.push(nb);
        spawnParticles(b.x, b.y, 8, 1.2);
        // лёгкая вибрация-«бонус»
        tg?.HapticFeedback?.notificationOccurred?.("success");
      }
    }

    // упал вниз (игрок пропустил)
    if (b.y - b.r > H + 10) {
      state.balls.splice(i, 1);
      continue;
    }

    // ушёл вверх (только в режиме бота — если бот пропустил)
    if (state.mode === "bot" && b.y + b.r < -10) {
      state.balls.splice(i, 1);
      state.score += 1;
      state.shake = Math.max(state.shake, 6);
      spawnParticles(b.x, 0, 14, 1.3);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      continue;
    }
  }

  if (newBalls.length) state.balls.push.apply(state.balls, newBalls);

  // все упали вниз
  if (state.balls.length === 0) {
    if (state.mode === "bot") {
      state.botScore += 1;
      if (state.botScore >= MAX_BOT_SCORE) { gameOver(); return; }
    }
    setupServe("player");
  }

  updateHUD();

  // след
  for (let i = 0; i < state.balls.length; i++) {
    state.trail.push({ x: state.balls[i].x, y: state.balls[i].y, life: 1 });
  }
  if (state.trail.length > 40) state.trail.splice(0, state.trail.length - 40);
  for (let i = state.trail.length - 1; i >= 0; i--) {
    state.trail[i].life -= dt * 2;
    if (state.trail[i].life <= 0) state.trail.splice(i, 1);
  }
}

/* ================= ОТРИСОВКА ================= */
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function drawPaddle(p) {
  if (!ctx) return;
  ctx.save();
  const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grad.addColorStop(0, colors.accent2);
  grad.addColorStop(0.5, colors.accent);
  grad.addColorStop(1, colors.accent2);
  ctx.fillStyle = grad;
  ctx.shadowBlur = 22;
  ctx.shadowColor = colors.accent;
  roundRectPath(ctx, p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();
  ctx.restore();
}

function drawWall() {
  if (!ctx) return;
  // «стена» — тонкая полоса сверху
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, colors.accent2);
  grad.addColorStop(0.5, colors.accent);
  grad.addColorStop(1, colors.accent2);
  ctx.fillStyle = grad;
  ctx.shadowBlur = 16;
  ctx.shadowColor = colors.accent;
  ctx.fillRect(0, 0, W, 4);
  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);

  let shakeX = 0, shakeY = 0;
  if (state.shake > 0) {
    shakeX = (Math.random() - 0.5) * state.shake * 2;
    shakeY = (Math.random() - 0.5) * state.shake * 2;
    ctx.save();
    ctx.translate(shakeX, shakeY);
  }

  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.12;
  ctx.setLineDash([4, 10]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (let i = 0; i < state.trail.length; i++) {
    const t = state.trail[i];
    ctx.save();
    ctx.globalAlpha = t.life * 0.25;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(t.x, t.y, BALL_R * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (state.mode === "bot") {
    drawPaddle(state.bot);
  } else {
    drawWall();
  }
  drawPaddle(state.paddle);

  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (state.phase !== "over") {
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      ctx.save();
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, colors.accent);
      ctx.fillStyle = g;
      ctx.shadowBlur = 20;
      ctx.shadowColor = colors.accent;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (state.shake > 0) ctx.restore();
}

/* ================= ЦИКЛ ================= */
let lastT = 0;
function loop(t) {
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ================= ИНИЦИАЛИЗАЦИЯ ================= */
function init() {
  applyTheme((function() { try { return localStorage.getItem("theme"); } catch(e) { return null; } })() || "black");
  readColors();
  resize();
  updateHUD();
  showOverlay(
    state.mode === "bot" ? "PING PONG · БОТ" : "PING PONG · СТЕНА",
    state.mode === "bot" ? "Отбивай — шарики размножаются" : "Стена сверху отбивает сама",
    "ИГРАТЬ", false
  );
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", function() { setTimeout(resize, 100); });
