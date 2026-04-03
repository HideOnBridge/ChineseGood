const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  playerHp: document.getElementById("playerHp"),
  enemyHp: document.getElementById("enemyHp"),
  playerQi: document.getElementById("playerQi"),
  enemyQi: document.getElementById("enemyQi"),
  message: document.getElementById("message"),
  startBtn: document.getElementById("startBtn"),
  punchBtn: document.getElementById("punchBtn"),
  kickBtn: document.getElementById("kickBtn"),
  cursorBtn: document.getElementById("cursorBtn"),
  ultBtn: document.getElementById("ultBtn")
};

const state = {
  running: false,
  over: false,
  mouse: { x: 720, y: 210 },
  projectiles: [],
  effects: [],
  player: createFighter(220, "#f8fcff", true),
  enemy: createFighter(680, "#ffefef", false)
};

function createFighter(x, color, isPlayer) {
  return {
    x,
    y: 320,
    hp: 100,
    qi: 0,
    color,
    isPlayer,
    attacking: "idle",
    attackTimer: 0,
    cooldown: 0,
    face: isPlayer ? 1 : -1
  };
}

function resetGame() {
  state.running = true;
  state.over = false;
  state.projectiles = [];
  state.effects = [];
  state.player = createFighter(220, "#f8fcff", true);
  state.enemy = createFighter(680, "#ffefef", false);
  ui.message.textContent = "战斗开始！";
  syncBars();
}

function syncBars() {
  ui.playerHp.style.width = `${Math.max(0, state.player.hp)}%`;
  ui.enemyHp.style.width = `${Math.max(0, state.enemy.hp)}%`;
  ui.playerQi.style.width = `${Math.max(0, state.player.qi)}%`;
  ui.enemyQi.style.width = `${Math.max(0, state.enemy.qi)}%`;
}

function gainQi(fighter, amount) {
  fighter.qi = Math.min(100, fighter.qi + amount);
}

function actionPunch(attacker, defender) {
  if (attacker.cooldown > 0 || !state.running) return;
  attacker.attacking = "punch";
  attacker.attackTimer = 11;
  attacker.cooldown = 22;

  const range = 95;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 8);
    gainQi(attacker, 12);
  }
}

function actionKick(attacker, defender) {
  if (attacker.cooldown > 0 || !state.running) return;
  attacker.attacking = "kick";
  attacker.attackTimer = 14;
  attacker.cooldown = 30;

  const range = 130;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 13);
    gainQi(attacker, 18);
  }
}

function actionCursor(attacker, targetX, targetY) {
  if (attacker.cooldown > 0 || !state.running) return;
  attacker.attacking = "cursor";
  attacker.attackTimer = 12;
  attacker.cooldown = 24;

  const hue = Math.floor(Math.random() * 360);
  const dx = targetX - attacker.x;
  const dy = targetY - (attacker.y - 70);
  const len = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    x: attacker.x,
    y: attacker.y - 70,
    vx: (dx / len) * 8,
    vy: (dy / len) * 8,
    radius: 9,
    damage: 11,
    fromPlayer: attacker.isPlayer,
    color: `hsl(${hue} 95% 62%)`
  });
}

function actionUltimate(attacker, defender) {
  if (attacker.qi < 100 || attacker.cooldown > 0 || !state.running) return;
  attacker.qi = 0;
  attacker.attacking = "ultimate";
  attacker.attackTimer = 20;
  attacker.cooldown = 60;

  state.effects.push({
    type: "beam",
    fromPlayer: attacker.isPlayer,
    life: 18,
    colorA: "#67e8ff",
    colorB: "#f06bff"
  });

  const range = 240;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 32);
  } else {
    hit(defender, 16);
  }
}

function hit(target, damage) {
  target.hp -= damage;
  gainQi(target, 6);
  state.effects.push({
    type: "impact",
    x: target.x,
    y: target.y - 80,
    life: 14
  });

  if (target.hp <= 0) {
    target.hp = 0;
    state.over = true;
    state.running = false;
    ui.message.textContent = target.isPlayer ? "你被击败了，再来一局！" : "你赢了！点击开始可重开。";
  }
}

function controlPlayer(type) {
  if (!state.running || state.over) return;
  if (type === "punch") actionPunch(state.player, state.enemy);
  if (type === "kick") actionKick(state.player, state.enemy);
  if (type === "cursor") actionCursor(state.player, state.mouse.x, state.mouse.y);
  if (type === "ultimate") actionUltimate(state.player, state.enemy);
}

function enemyAI() {
  const enemy = state.enemy;
  const player = state.player;
  if (!state.running || state.over) return;
  if (enemy.cooldown > 0) return;

  const roll = Math.random();
  if (enemy.qi >= 100 && roll < 0.35) {
    actionUltimate(enemy, player);
    return;
  }

  if (roll < 0.45) {
    actionPunch(enemy, player);
  } else if (roll < 0.82) {
    actionKick(enemy, player);
  } else {
    actionCursor(enemy, player.x, player.y - 70);
  }
}

function update() {
  const p = state.player;
  const e = state.enemy;

  [p, e].forEach((f) => {
    if (f.cooldown > 0) f.cooldown -= 1;
    if (f.attackTimer > 0) f.attackTimer -= 1;
    if (f.attackTimer <= 0) f.attacking = "idle";
  });

  state.projectiles = state.projectiles.filter((shot) => {
    shot.x += shot.vx;
    shot.y += shot.vy;
    const target = shot.fromPlayer ? e : p;
    if (Math.hypot(shot.x - target.x, shot.y - (target.y - 80)) < 28) {
      hit(target, shot.damage);
      const owner = shot.fromPlayer ? p : e;
      gainQi(owner, 10);
      return false;
    }
    return shot.x > 0 && shot.x < canvas.width && shot.y > 0 && shot.y < canvas.height;
  });

  state.effects = state.effects.filter((fx) => {
    fx.life -= 1;
    return fx.life > 0;
  });

  syncBars();
}

function drawFighter(f) {
  const x = f.x;
  const y = f.y;
  const armOffset = f.attacking === "punch" ? 26 : 10;
  const legOffset = f.attacking === "kick" ? 32 : 14;

  ctx.strokeStyle = f.color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(x, y - 110, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - 92);
  ctx.lineTo(x, y - 38);

  ctx.moveTo(x, y - 78);
  ctx.lineTo(x + f.face * armOffset, y - 62);
  ctx.moveTo(x, y - 78);
  ctx.lineTo(x - f.face * 14, y - 62);

  ctx.moveTo(x, y - 38);
  ctx.lineTo(x + f.face * legOffset, y);
  ctx.moveTo(x, y - 38);
  ctx.lineTo(x - f.face * 16, y);
  ctx.stroke();

  if (f.attacking === "ultimate") {
    ctx.strokeStyle = "#8ef6ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 72, 42 + Math.sin(Date.now() / 70) * 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawProjectiles() {
  state.projectiles.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * 1.5, s.y - s.vy * 1.5);
    ctx.lineTo(s.x - s.vx * 3.2, s.y - s.vy * 3.2);
    ctx.stroke();
  });
}

function drawEffects() {
  state.effects.forEach((fx) => {
    if (fx.type === "impact") {
      const alpha = fx.life / 14;
      ctx.strokeStyle = `rgba(255,220,120,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, (14 - fx.life) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (fx.type === "beam") {
      const fromX = fx.fromPlayer ? state.player.x + 16 : state.enemy.x - 16;
      const toX = fx.fromPlayer ? state.enemy.x : state.player.x;
      const y = 235;
      const grad = ctx.createLinearGradient(fromX, y, toX, y);
      grad.addColorStop(0, fx.colorA);
      grad.addColorStop(1, fx.colorB);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(fromX, y);
      ctx.lineTo(toX, y + Math.sin(fx.life) * 5);
      ctx.stroke();
    }
  });
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const floorY = 340;
  ctx.strokeStyle = "#3f4f88";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, floorY);
  ctx.lineTo(canvas.width - 60, floorY);
  ctx.stroke();

  drawFighter(state.player);
  drawFighter(state.enemy);
  drawProjectiles();
  drawEffects();

  if (!state.running && !state.over) {
    ctx.fillStyle = "rgba(10,16,36,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffe385";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("点击开始", canvas.width / 2, canvas.height / 2);
  }
}

function loop() {
  if (state.running) {
    update();
    if (Math.random() < 0.042) enemyAI();
  }
  drawArena();
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  state.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener("click", () => {
  if (!state.running && !state.over) {
    resetGame();
  } else {
    controlPlayer("cursor");
  }
});

ui.startBtn.addEventListener("click", resetGame);
ui.punchBtn.addEventListener("click", () => controlPlayer("punch"));
ui.kickBtn.addEventListener("click", () => controlPlayer("kick"));
ui.cursorBtn.addEventListener("click", () => controlPlayer("cursor"));
ui.ultBtn.addEventListener("click", () => controlPlayer("ultimate"));

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "j") controlPlayer("punch");
  if (key === "k") controlPlayer("kick");
  if (key === "l") controlPlayer("cursor");
  if (key === "u") controlPlayer("ultimate");
});

syncBars();
loop();
