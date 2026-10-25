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

const colors = { accent: "#ffffff", accent2: "#bdbdbd", table: "#1a6b3c" };

function readColors() {
  const cs = getComputedStyle(document.body);
  colors.accent  = cs.getPropertyValue("--accent").trim()   || "#fff";
  colors.accent2 = cs.getPropertyValue("--accent-2").trim() || "#bdbdbd";
  colors.table   = cs.getPropertyValue("--table").trim()    || "#1a6b3c";
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

/* ================= 3D-МИР ================= */
const TABLE = { W: 152.5, L: 274 };
const NET_H = 15.25;
const BALL_R = 2;
const PADDLE_R = 8;
const GRAVITY = 980;

const cam = { fov: 400, tilt: 0.62, distance: 240, height: 110, cx: 0, cy: 0 };

function project(x, y, z) {
  const py = y - TABLE.L / 2;
  const pz = z;
  const cosT = Math.cos(cam.tilt);
  const sinT = Math.sin(cam.tilt);
  const ry = py * cosT - pz * sinT;
  const rz = py * sinT + pz * cosT;
  const camY = -TABLE.L / 2 - cam.distance;
  const dy = ry - camY;
  const dz = rz - cam.height;
  const scale = cam.fov / (dy + cam.distance + TABLE.L / 2);
  const sx = cam.cx + x * scale;
  const sy = cam.cy - dz * scale + 70;
  return { x: sx, y: sy, scale };
}

/* ================= СОСТОЯНИЕ ================= */
const state = {
  paddle: { x: 0, targetX: 0, vx: 0, prevX: 0 },
  bot: { x: 0, targetX: 0, speed: 85 },
  ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
  trail: [],
  particles: [],
  shake: 0,
  score: 0,
  botScore: 0,
  best: 0,
  baseSpeed: 200,
  speedMul: 1,
  phase: "idle",
  modalOpen: false,
  lastHitter: "bot",
  serveTimer: 0,
  statusText: "—",
};

try { state.best = Number(localStorage.getItem("tt_best") || 0); } catch(e) {}

/* ================= ЭЛЕМЕНТЫ ================= */
const scoreEl     = document.getElementById("score");
const botScoreEl  = document.getElementById("botScore");
const statusEl    = document.getElementById("status");
const overlay     = document.getElementById("overlay");
const overlayTitle= document.getElementById("overlayTitle");
const overlaySub  = document.getElementById("overlaySub");
const overlayBtn  = document.getElementById("overlayBtn");
const colorModal  = document.getElementById("colorModal");
const closeColors = document.getElementById("closeColors");
const restartBtn  = document.getElementById("restartBtn");
const themeBtn    = document.getElementById("themeBtn");

function updateHUD() {
  if (scoreEl)    scoreEl.textContent    = state.score;
  if (botScoreEl) botScoreEl.textContent = state.botScore;
  if (statusEl)   statusEl.textContent   = state.statusText;
}

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
  cam.cx = W / 2;
  cam.cy = H * 0.35;
  cam.fov = Math.max(W, H) * 1.15;
  state.paddle.x = 0;
  state.paddle.targetX = 0;
  state.bot.x = 0;
  state.bot.targetX = 0;
  if (state.phase === "idle") setupServe("player");
}

/* ================= МЯЧ ================= */
function setupServe(who) {
  const b = state.ball;
  b.x = 0;
  b.y = who === "player" ? 20 : TABLE.L - 20;
  b.z = 25;
  b.vx = 0; b.vy = 0; b.vz = 0;
  state.trail = [];
  state.particles = [];
  state.lastHitter = who === "player" ? "bot" : "player";
  state.serveTimer = 0.8;
  state.statusText = who === "player" ? "ТВОЙ УДАР" : "УДАР БОТА";
}

function serveBall() {
  const b = state.ball;
  const dir = state.lastHitter === "bot" ? 1 : -1;
  state.baseSpeed = 200;
  state.speedMul = 1;
  const speed = state.baseSpeed;
  const angle = (Math.random() - 0.5) * 0.3;
  if (dir > 0) {
    b.vy = speed;
    b.vx = Math.sin(angle) * speed * 0.5;
    b.vz = 120;
  } else {
    b.vy = -speed;
    b.vx = Math.sin(angle) * speed * 0.5;
    b.vz = 120;
  }
}

/* ================= ЧАСТИЦЫ ================= */
function spawnParticles(x, y, z, count, power) {
  if (!power) power = 1;
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: x, y: y, z: z,
      vx: (Math.random() - 0.5) * 100 * power,
      vy: (Math.random() - 0.5) * 100 * power,
      vz: Math.random() * 60 * power,
      life: 1,
      maxLife: 0.35 + Math.random() * 0.25,
      size: 1 + Math.random() * 2,
    });
  }
}

/* ================= СТАРТ / КОНЕЦ ================= */
function startGame() {
  state.score = 0;
  state.botScore = 0;
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = 0;
  state.paddle.targetX = 0;
  state.paddle.prevX = 0;
  state.paddle.vx = 0;
  state.bot.x = 0;
  state.bot.targetX = 0;
  state.shake = 0;
  setupServe("player");
  updateHUD();
  hideOverlay();
  tg?.HapticFeedback?.impactOccurred?.("medium");
}

function gameOver() {
  state.phase = "over";
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem("tt_best", state.best); } catch(e) {}
  }
  updateHUD();
  showOverlay("ИГРА ОКОНЧЕНА", "Счёт " + state.score + " : " + state.botScore + " · Рекорд: " + state.best, "ИГРАТЬ СНОВА");
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
function movePaddleToScreenX(clientX) {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const sx = clientX - r.left;
  const p0 = project(-10, 10, 0);
  const p1 = project(10, 10, 0);
  const scaleX = p1.x - p0.x;
  if (Math.abs(scaleX) < 0.0001) return;
  let worldX = (sx - cam.cx) / (scaleX / 20);
  const limit = TABLE.W / 2 - PADDLE_R;
  worldX = Math.max(-limit, Math.min(limit, worldX));
  state.paddle.targetX = worldX;
}

window.addEventListener("pointermove", function(e) {
  if (state.modalOpen) return;
  if (state.phase === "playing" || state.phase === "idle") movePaddleToScreenX(e.clientX);
});

window.addEventListener("keydown", function(e) {
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= 15;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += 15;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ================= ФИЗИКА ================= */
function update(dt) {
  if (state.modalOpen) return;

  // платформа игрока
  const p = state.paddle;
  p.prevX = p.x;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  const limit = TABLE.W / 2 - PADDLE_R;
  p.x = Math.max(-limit, Math.min(limit, p.x));
  p.vx = (p.x - p.prevX) / Math.max(dt, 0.001);

  // бот
  const bot = state.bot;
  const b = state.ball;
  if (state.phase === "playing" && b.vy > 0) {
    bot.targetX = b.x * 0.9;
  }
  bot.x += (bot.targetX - bot.x) * Math.min(1, dt * bot.speed / 20);
  bot.x = Math.max(-limit, Math.min(limit, bot.x));

  // частицы
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt / pt.maxLife;
    if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
    pt.vz -= GRAVITY * 0.35 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    if (pt.z < 0) { pt.z = 0; pt.vz *= -0.4; }
  }

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  if (state.phase !== "playing") return;

  // подача
  if (state.serveTimer > 0) {
    state.serveTimer -= dt;
    if (state.serveTimer <= 0) serveBall();
    return;
  }

  // гравитация
  b.vz -= GRAVITY * dt;

  // шаг симуляции
  const steps = Math.min(4, Math.ceil(Math.hypot(b.vx, b.vy, b.vz) * dt / 5));
  const sub = dt / Math.max(1, steps);

  for (let s = 0; s < steps; s++) {
    const prevY = b.y;
    b.x += b.vx * sub;
    b.y += b.vy * sub;
    b.z += b.vz * sub;

    // отскок от стола
    if (b.z - BALL_R < 0 && b.vz < 0) {
      const onTable = Math.abs(b.x) < TABLE.W / 2 && b.y > 0 && b.y < TABLE.L;
      if (onTable) {
        b.z = BALL_R;
        b.vz = -b.vz * 0.78;
        spawnParticles(b.x, b.y, 0, 5, 0.6);
        state.shake = Math.max(state.shake, 2);
        tg?.HapticFeedback?.impactOccurred?.("light");
      } else if (b.z < -30) {
        if (b.y > TABLE.L / 2) {
          state.score += 1;
          setupServe("bot");
        } else {
          state.botScore += 1;
          if (state.botScore >= 5) { gameOver(); return; }
          setupServe("player");
        }
        updateHUD();
        return;
      }
    }

    // сетка
    const crossedNet = (prevY < TABLE.L / 2 && b.y >= TABLE.L / 2) || (prevY > TABLE.L / 2 && b.y <= TABLE.L / 2);
    if (crossedNet && Math.abs(b.x) < TABLE.W / 2 && b.z < NET_H) {
      b.y = prevY;
      b.vy = -b.vy * 0.4;
      b.vz = Math.abs(b.vz) * 0.3;
      spawnParticles(b.x, TABLE.L / 2, b.z, 8, 0.8);
      state.shake = Math.max(state.shake, 4);
      tg?.HapticFeedback?.impactOccurred?.("medium");
    }

    // боковые стены
    if (Math.abs(b.x) > TABLE.W / 2 + 30 && b.z < 20) {
      if (b.y > TABLE.L / 2) { state.score += 1; setupServe("bot"); }
      else { state.botScore += 1; if (state.botScore >= 5) { gameOver(); return; } setupServe("player"); }
      updateHUD();
      return;
    }

    // удар об ракетку игрока
    if (
      b.vy < 0 &&
      b.y < 12 && b.y > -5 &&
      b.z < 30 &&
      Math.abs(b.x - p.x) < PADDLE_R + BALL_R &&
      state.lastHitter !== "player"
    ) {
      b.y = 12;
      b.vy = Math.abs(b.vy) * 1.05 + 20;
      b.vx = (b.x - p.x) * 8 + p.vx * 0.3;
      b.vz = Math.max(80, b.vz * 0.5 + 60);
      state.speedMul = Math.min(2.4, state.speedMul * 1.05);
      state.baseSpeed = Math.min(400, state.baseSpeed * 1.03);
      state.lastHitter = "player";
      state.shake = Math.max(state.shake, 5);
      spawnParticles(b.x, 0, b.z, 10, 1);
      tg?.HapticFeedback?.impactOccurred?.("medium");
    }

    // удар об ракетку бота
    if (
      b.vy > 0 &&
      b.y > TABLE.L - 12 && b.y < TABLE.L + 5 &&
      b.z < 30 &&
      Math.abs(b.x - bot.x) < PADDLE_R + BALL_R &&
      state.lastHitter !== "bot"
    ) {
      b.y = TABLE.L - 12;
      b.vy = -Math.abs(b.vy) * 1.02 - 10;
      b.vx = (b.x - bot.x) * 6;
      b.vz = Math.max(70, b.vz * 0.5 + 50);
      state.baseSpeed = Math.min(400, state.baseSpeed * 1.02);
      state.lastHitter = "bot";
      state.shake = Math.max(state.shake, 4);
      spawnParticles(b.x, TABLE.L, b.z, 8, 0.9);
      tg?.HapticFeedback?.impactOccurred?.("light");
    }
  }

  // стабилизация скорости
  const mag = Math.hypot(b.vx, b.vy) || 1;
  const target = state.baseSpeed * state.speedMul;
  const clamped = Math.min(target, mag * 1.05);
  b.vx = (b.vx / mag) * clamped;
  b.vy = (b.vy / mag) * clamped;

  // след
  state.trail.push({ x: b.x, y: b.y, z: b.z, life: 1 });
  if (state.trail.length > 20) state.trail.shift();
  for (let i = state.trail.length - 1; i >= 0; i--) {
    state.trail[i].life -= dt * 2;
    if (state.trail[i].life <= 0) state.trail.splice(i, 1);
  }

  state.statusText = state.lastHitter === "player" ? "ЛЕТИТ БОТУ" : "ЛЕТИТ ТЕБЕ";
  updateHUD();
}

/* ================= ОТРИСОВКА ================= */
function drawTable() {
  if (!ctx) return;

  const corners = [
    project(-TABLE.W/2, 0, 0),
    project( TABLE.W/2, 0, 0),
    project( TABLE.W/2, TABLE.L, 0),
    project(-TABLE.W/2, TABLE.L, 0),
  ];

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(corners[0].x + 10, corners[0].y + 30);
  ctx.lineTo(corners[1].x + 10, corners[1].y + 30);
  ctx.lineTo(corners[2].x + 10, corners[2].y + 30);
  ctx.lineTo(corners[3].x + 10, corners[3].y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  const g = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[3].x, corners[3].y);
  g.addColorStop(0, colors.table);
  g.addColorStop(1, shade(colors.table, -30));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const l1 = project(0, 0, 0);
  const l2 = project(0, TABLE.L, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(l1.x, l1.y);
  ctx.lineTo(l2.x, l2.y);
  ctx.stroke();

  ctx.restore();
}

function drawNet() {
  if (!ctx) return;
  const left  = project(-TABLE.W/2, TABLE.L/2, 0);
  const right = project( TABLE.W/2, TABLE.L/2, 0);
  const topL  = project(-TABLE.W/2, TABLE.L/2, NET_H);
  const topR  = project( TABLE.W/2, TABLE.L/2, NET_H);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);   ctx.lineTo(topL.x, topL.y);
  ctx.moveTo(right.x, right.y); ctx.lineTo(topR.x, topR.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const gx = left.x + (right.x - left.x) * t;
    const gy = left.y + (right.y - left.y) * t;
    const tx = topL.x + (topR.x - topL.x) * t;
    const ty = topL.y + (topR.y - topL.y) * t;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(left.x + (topL.x - left.x) * t, left.y + (topL.y - left.y) * t);
    ctx.lineTo(right.x + (topR.x - right.x) * t, right.y + (topR.y - right.y) * t);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaddle(worldX, worldY, isPlayer) {
  if (!ctx) return;
  const base = project(worldX, worldY, 0);
  const top  = project(worldX, worldY, 15);
  const rScreen = Math.abs(top.x - base.x) || 30;
  const radius = Math.max(18, rScreen * PADDLE_R / 15);

  const handleEnd = project(worldX, worldY + (isPlayer ? -15 : 15), 5);
  ctx.save();
  ctx.strokeStyle = shade(colors.accent, -50);
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(handleEnd.x, handleEnd.y);
  ctx.stroke();

  const rw = radius;
  const rh = radius * 0.75;
  ctx.translate(base.x, base.y);
  ctx.rotate(isPlayer ? -cam.tilt * 0.3 : cam.tilt * 0.3);
  const g = ctx.createRadialGradient(-rw*0.3, -rh*0.3, 2, 0, 0, rw);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.4, colors.accent);
  g.addColorStop(1, shade(colors.accent, -60));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  if (!ctx) return;
  const b = state.ball;
  if (b.z < -50) return;
  const p = project(b.x, b.y, Math.max(0, b.z));
  const r = Math.max(3, 8 * p.scale * 0.15 + 3);

  if (b.z > 0 && Math.abs(b.x) < TABLE.W/2 && b.y > 0 && b.y < TABLE.L) {
    const sh = project(b.x, b.y, 0);
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, 0.4 - b.z / 100);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, r * 1.5, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  state.trail.forEach(function(t, i) {
    if (t.z < 0) return;
    const tp = project(t.x, t.y, t.z);
    ctx.save();
    ctx.globalAlpha = t.life * 0.3;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, r * 0.6 * (i / state.trail.length), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.save();
  const g = ctx.createRadialGradient(p.x - r*0.35, p.y - r*0.35, r*0.1, p.x, p.y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.7, "#ffdd66");
  g.addColorStop(1, "#cc8800");
  ctx.fillStyle = g;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#ffaa44";
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  if (!ctx) return;
  state.particles.forEach(function(pt) {
    const p = project(pt.x, pt.y, Math.max(0, pt.z));
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pt.size * (0.5 + p.scale * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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

  drawTable();
  drawNet();
  drawPaddle(state.bot.x, TABLE.L, false);
  drawPaddle(state.paddle.x, 0, true);
  drawParticles();
  drawBall();

  if (state.shake > 0) ctx.restore();
}

/* ================= ВСПОМОГАТЕЛЬНОЕ ================= */
function shade(hex, amt) {
  if (!hex || hex[0] !== "#") return hex;
  let c = hex.slice(1);
  if (c.length === 3) c = c.split("").map(function(x){ return x + x; }).join("");
  const n = parseInt(c, 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 0xff) + amt;
  let b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
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
  showOverlay("TABLE TENNIS", "Двигай ракетку — отбивай мяч", "ИГРАТЬ");
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", function() { setTimeout(resize, 100); });
