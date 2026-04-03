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
  frame: 0,
  floorY: 356,
  cameraShake: 0,
  mouse: { x: 720, y: 220 },
  projectiles: [],
  effects: [],
  particles: [],
  damageTexts: [],
  player: createFighter(210, "#eef6ff", true),
  enemy: createFighter(690, "#ffeef3", false)
};

function createFighter(x, color, isPlayer) {
  return {
    x,
    y: state.floorY,
    hp: 100,
    qi: 0,
    color,
    isPlayer,
    attacking: "idle",
    attackTimer: 0,
    cooldown: 0,
    hitFlash: 0,
    face: isPlayer ? 1 : -1,
    bob: Math.random() * Math.PI * 2
  };
}

function resetGame() {
  state.running = true;
  state.over = false;
  state.frame = 0;
  state.cameraShake = 0;
  state.projectiles = [];
  state.effects = [];
  state.particles = [];
  state.damageTexts = [];
  state.player = createFighter(210, "#eef6ff", true);
  state.enemy = createFighter(690, "#ffeef3", false);
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
  attacker.attackTimer = 12;
  attacker.cooldown = 20;

  const range = 110;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 10, attacker.face, "拳");
    gainQi(attacker, 13);
  }
}

function actionKick(attacker, defender) {
  if (attacker.cooldown > 0 || !state.running) return;
  attacker.attacking = "kick";
  attacker.attackTimer = 16;
  attacker.cooldown = 30;

  const range = 146;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 14, attacker.face, "踢");
    gainQi(attacker, 19);
  }
}

function actionCursor(attacker, targetX, targetY) {
  if (attacker.cooldown > 0 || !state.running) return;
  attacker.attacking = "cursor";
  attacker.attackTimer = 12;
  attacker.cooldown = 24;

  const hue = Math.floor(Math.random() * 360);
  const originX = attacker.x + attacker.face * 18;
  const originY = attacker.y - 86;
  const dx = targetX - originX;
  const dy = targetY - originY;
  const len = Math.hypot(dx, dy) || 1;

  state.projectiles.push({
    x: originX,
    y: originY,
    vx: (dx / len) * 9,
    vy: (dy / len) * 9,
    radius: 9,
    damage: 12,
    fromPlayer: attacker.isPlayer,
    hue,
    color: `hsl(${hue} 95% 62%)`
  });
}

function actionUltimate(attacker, defender) {
  if (attacker.qi < 100 || attacker.cooldown > 0 || !state.running) return;
  attacker.qi = 0;
  attacker.attacking = "ultimate";
  attacker.attackTimer = 24;
  attacker.cooldown = 70;

  state.effects.push({
    type: "beam",
    fromPlayer: attacker.isPlayer,
    x: attacker.x,
    life: 20,
    colorA: "#55f5ff",
    colorB: "#ff66f0"
  });

  state.cameraShake = Math.max(state.cameraShake, 14);
  const range = 260;
  if (Math.abs(attacker.x - defender.x) < range) {
    hit(defender, 34, attacker.face, "奥义");
  } else {
    hit(defender, 18, attacker.face, "波");
  }
}

function spawnHitParticles(x, y, direction, strong = false) {
  const count = strong ? 24 : 13;
  for (let i = 0; i < count; i += 1) {
    const speed = (strong ? 6 : 4) + Math.random() * 3;
    const angle = (Math.random() - 0.5) * 1.4 + (direction > 0 ? 0 : Math.PI);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: strong ? 24 : 16,
      color: strong
        ? `hsl(${Math.floor(Math.random() * 360)} 100% 68%)`
        : `hsl(${30 + Math.floor(Math.random() * 40)} 100% 65%)`
    });
  }
}

function hit(target, damage, direction, tag) {
  target.hp -= damage;
  target.hitFlash = 7;
  gainQi(target, 8);
  state.cameraShake = Math.max(state.cameraShake, 7);

  const impactX = target.x - direction * 16;
  const impactY = target.y - 88;

  state.effects.push({
    type: "impact",
    x: impactX,
    y: impactY,
    life: 12,
    direction,
    tag
  });

  state.damageTexts.push({
    x: impactX,
    y: impactY - 6,
    value: `-${damage}`,
    life: 30
  });

  spawnHitParticles(impactX, impactY, direction, damage >= 30);

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
  if (!state.running || state.over || enemy.cooldown > 0) return;

  const dist = Math.abs(enemy.x - player.x);
  const roll = Math.random();

  if (enemy.qi >= 100 && roll < 0.34) {
    actionUltimate(enemy, player);
  } else if (dist < 120 && roll < 0.52) {
    actionPunch(enemy, player);
  } else if (dist < 170 && roll < 0.86) {
    actionKick(enemy, player);
  } else {
    actionCursor(enemy, player.x, player.y - 90);
  }
}

function updateProjectiles(p, e) {
  state.projectiles = state.projectiles.filter((shot) => {
    shot.x += shot.vx;
    shot.y += shot.vy;

    state.particles.push({
      x: shot.x,
      y: shot.y,
      vx: -shot.vx * 0.2,
      vy: -shot.vy * 0.2,
      life: 10,
      color: `hsla(${shot.hue} 100% 70% / 0.5)`
    });

    const target = shot.fromPlayer ? e : p;
    if (Math.hypot(shot.x - target.x, shot.y - (target.y - 92)) < 30) {
      hit(target, shot.damage, shot.fromPlayer ? 1 : -1, "彩");
      const owner = shot.fromPlayer ? p : e;
      gainQi(owner, 11);
      return false;
    }

    return shot.x > -20 && shot.x < canvas.width + 20 && shot.y > -20 && shot.y < canvas.height + 20;
  });
}

function updateEffects() {
  state.effects = state.effects.filter((fx) => {
    fx.life -= 1;
    return fx.life > 0;
  });

  state.particles = state.particles.filter((pt) => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.12;
    pt.vx *= 0.96;
    pt.life -= 1;
    return pt.life > 0;
  });

  state.damageTexts = state.damageTexts.filter((text) => {
    text.y -= 1.1;
    text.life -= 1;
    return text.life > 0;
  });
}

function update() {
  const p = state.player;
  const e = state.enemy;
  state.frame += 1;

  [p, e].forEach((f) => {
    if (f.cooldown > 0) f.cooldown -= 1;
    if (f.attackTimer > 0) f.attackTimer -= 1;
    if (f.hitFlash > 0) f.hitFlash -= 1;
    if (f.attackTimer <= 0) f.attacking = "idle";
    f.bob += 0.05;
    gainQi(f, 0.015);
  });

  updateProjectiles(p, e);
  updateEffects();

  if (state.cameraShake > 0) {
    state.cameraShake *= 0.82;
    if (state.cameraShake < 0.25) state.cameraShake = 0;
  }

  syncBars();
}

function drawStickman(f) {
  const t = Math.max(0, f.attackTimer);
  const punchProgress = f.attacking === "punch" ? 1 - t / 12 : 0;
  const kickProgress = f.attacking === "kick" ? 1 - t / 16 : 0;
  const ultPulse = f.attacking === "ultimate" ? 0.8 + Math.sin(state.frame * 0.5) * 0.2 : 0;

  const bob = Math.sin(f.bob) * 2;
  const x = f.x;
  const y = f.y + bob;

  const shoulderY = y - 90;
  const hipY = y - 52;
  const headY = y - 114;

  const frontArmReach = 24 + Math.sin(punchProgress * Math.PI) * 36;
  const frontLegReach = 26 + Math.sin(kickProgress * Math.PI) * 46;

  const backHand = { x: x - f.face * 20, y: shoulderY + 17 };
  const frontHand = { x: x + f.face * frontArmReach, y: shoulderY + 8 };
  const backFoot = { x: x - f.face * 18, y: y - 6 };
  const frontFoot = { x: x + f.face * frontLegReach, y: y - 8 };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = f.hitFlash > 0 ? "#ffb5b5" : f.color;
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(x, headY + 18);
  ctx.lineTo(x, hipY);
  ctx.stroke();

  drawLimb(x, shoulderY, backHand.x, backHand.y, 4);
  drawLimb(x, shoulderY, frontHand.x, frontHand.y, 5.5);
  drawLimb(x, hipY, backFoot.x, backFoot.y, 4.5);
  drawLimb(x, hipY, frontFoot.x, frontFoot.y, 5.5);

  ctx.beginPath();
  ctx.arc(x, headY, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = f.hitFlash > 0 ? "#ffd2d2" : "#ffffff";
  ctx.beginPath();
  ctx.arc(frontHand.x, frontHand.y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(backHand.x, backHand.y, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9ad4ff";
  ctx.beginPath();
  ctx.arc(frontFoot.x, frontFoot.y, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(backFoot.x, backFoot.y, 4.8, 0, Math.PI * 2);
  ctx.fill();

  if (f.attacking === "punch") {
    drawSlash(frontHand.x, frontHand.y, f.face, "#ffe082");
  }
  if (f.attacking === "kick") {
    drawSlash(frontFoot.x, frontFoot.y, f.face, "#b6f2ff");
  }
  if (f.attacking === "cursor") {
    drawCursorCharge(x + f.face * 16, shoulderY - 2);
  }
  if (f.attacking === "ultimate") {
    ctx.strokeStyle = "rgba(129, 244, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, shoulderY - 4, 34 + ultPulse * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawLimb(x1, y1, x2, y2, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2 + 5);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawSlash(x, y, direction, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - direction * 8, y - 10);
  ctx.lineTo(x + direction * 14, y);
  ctx.lineTo(x - direction * 8, y + 10);
  ctx.stroke();
}

function drawCursorCharge(x, y) {
  for (let i = 0; i < 4; i += 1) {
    const angle = state.frame * 0.18 + i * 1.57;
    const px = x + Math.cos(angle) * 12;
    const py = y + Math.sin(angle) * 12;
    ctx.fillStyle = `hsl(${(state.frame * 9 + i * 90) % 360} 100% 65%)`;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectiles() {
  state.projectiles.forEach((s) => {
    const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 18);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEffects() {
  state.effects.forEach((fx) => {
    if (fx.type === "impact") {
      const alpha = fx.life / 12;
      const len = (13 - fx.life) * 5;

      ctx.strokeStyle = `rgba(255,245,170,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x - fx.direction * len, fx.y - len * 0.2);
      ctx.lineTo(fx.x + fx.direction * len, fx.y + len * 0.2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255,220,110,${alpha})`;
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(fx.tag, fx.x + 8, fx.y - 8);
    }

    if (fx.type === "beam") {
      const fromX = fx.fromPlayer ? state.player.x + 20 : state.enemy.x - 20;
      const toX = fx.fromPlayer ? state.enemy.x : state.player.x;
      const y = 245;
      const grad = ctx.createLinearGradient(fromX, y, toX, y);
      grad.addColorStop(0, fx.colorA);
      grad.addColorStop(1, fx.colorB);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(fromX, y);
      ctx.lineTo(toX, y + Math.sin(fx.life * 0.8) * 8);
      ctx.stroke();
    }
  });

  state.particles.forEach((pt) => {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / 24);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  state.damageTexts.forEach((text) => {
    ctx.fillStyle = `rgba(255, 236, 180, ${text.life / 30})`;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(text.value, text.x, text.y);
  });
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shakeX = (Math.random() - 0.5) * state.cameraShake;
  const shakeY = (Math.random() - 0.5) * state.cameraShake;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#1f3060");
  sky.addColorStop(0.7, "#121b3d");
  sky.addColorStop(1, "#0a0f23");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect(90 + i * 88, 70 + Math.sin((state.frame + i * 25) * 0.02) * 10, 26, 2);
  }

  ctx.fillStyle = "rgba(88, 132, 235, 0.2)";
  ctx.fillRect(40, state.floorY - 18, canvas.width - 80, 70);

  ctx.strokeStyle = "#7489cb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, state.floorY);
  ctx.lineTo(canvas.width - 60, state.floorY);
  ctx.stroke();

  drawShadow(state.player);
  drawShadow(state.enemy);
  drawStickman(state.player);
  drawStickman(state.enemy);
  drawProjectiles();
  drawEffects();

  if (!state.running && !state.over) {
    ctx.fillStyle = "rgba(8,11,25,0.62)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffe9a2";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("点击开始", canvas.width / 2, canvas.height / 2);
  }

  ctx.restore();
}

function drawShadow(fighter) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(fighter.x, fighter.y + 2, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function loop() {
  if (state.running) {
    update();
    if (Math.random() < 0.05) enemyAI();
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
