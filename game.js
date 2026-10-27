(() => {
  'use strict';
  const C = CONFIG;
  const W = C.width, H = C.height, R = C.kangarooRadius;
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const pauseButton = document.getElementById('pauseButton');
  const soundButton = document.getElementById('soundButton');
  const restartButton = document.getElementById('restartButton');
  const shopButton = document.getElementById('shopButton');
  const closeShopButton = document.getElementById('closeShopButton');
  const shopModal = document.getElementById('shopModal');
  const shopItems = document.getElementById('shopItems');
  const shopCoins = document.getElementById('shopCoins');
  const coinCount = document.getElementById('coinCount');
  const magnetButton = document.getElementById('magnetButton');
  const floatButton = document.getElementById('floatButton');
  const livesCount = document.getElementById('livesCount');
  if (!ctx) return;

  // -------------------- State --------------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const loadBest = () => { try { return Number(localStorage.getItem('fkk-best')) || 0; } catch { return 0; } };
  let best = loadBest();
  const STORAGE_KEY = 'fkk-progress-v2';
  const paddleSkins = {
    classic: { label: 'CLASSIC GOLD', cost: 0, border: '#2b1738', base: '#7f4f35', face: '#b77746', center: '#f4d98f', note: 'Original canyon catcher.' },
    jade: { label: 'NEON JADE', cost: 95, border: '#102c43', base: '#196c7a', face: '#36b4ba', center: '#baf9ed', note: 'Bright teal pixel circuitry.' },
    magma: { label: 'MAGMA BLOCK', cost: 140, border: '#361326', base: '#972d39', face: '#f56338', center: '#ffe082', note: 'Molten red-orange stone.' },
    void: { label: 'VOID CRYSTAL', cost: 185, border: '#130c36', base: '#4a2797', face: '#9659ee', center: '#edc8ff', note: 'Arcane amethyst pixels.' }
  };
  function readProgress() {
    const initial = { coins: C.shop.startingCoins, upgrades: { magnet: 0, float: 0, width: 0, shield: 0 }, skins: ['classic'], skin: 'classic' };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || typeof stored !== 'object' || !stored.upgrades) return initial;
      initial.coins = Number.isFinite(stored.coins) ? Math.max(0, Math.floor(stored.coins)) : initial.coins;
      if (Array.isArray(stored.skins)) {
        initial.skins = ['classic', ...stored.skins.filter(key => key !== 'classic' && Object.hasOwn(paddleSkins, key))];
      }
      if (typeof stored.skin === 'string' && initial.skins.includes(stored.skin)) initial.skin = stored.skin;
      for (const key of Object.keys(initial.upgrades)) {
        const tier = stored.upgrades[key];
        initial.upgrades[key] = Number.isFinite(tier) ? clamp(Math.floor(tier), 0, C.shop.upgrades[key].costs.length) : 0;
      }
    } catch { /* A private browser may reject localStorage. */ }
    return initial;
  }
  const progress = readProgress();
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Keep playing without persistence. */ }
  }
  function updateWallet() {
    coinCount.textContent = String(progress.coins);
    shopCoins.textContent = String(progress.coins);
  }
  function earnCoins(amount) {
    progress.coins += amount;
    updateWallet();
    saveProgress();
  }
  let state = 'ready';
  let score, level, catches, combo, elapsed, wind, nextBox, nextBonus, toast, toastTime, shake;
  let scoreFlash = 0;
  let recentlyOverAt = 0;
  let soundOn = false;
  let audioContext = null;
  const keys = { left: false, right: false };
  const roo = { x: R + 20, y: 310, vx: 245, vy: -325, wallBoosts: 0 };
  const paddle = { x: W / 2 };
  const boxes = Array.from({ length: 9 }, () => ({ active: false, x: 0, y: 0, prevY: 0, type: 'normal' }));
  const particles = [];
  const trail = [];
  const bonus = { active: false, x: 0, y: 0, phase: 0 };
  let boss = null;
  const bossStones = [];
  const decoys = [];
  let shields = 0;
  let magnetTimer = 0, magnetCooldown = 0;
  let floatTimer = 0, floatCooldown = 0;
  let shopWasPlaying = false;
  let lastAbilityLabel = '';


  function gravity() { return Math.min(C.maxGravity, C.gravity * (1 + C.gravityPerLevel * (level - 1))); }
  function paddleW() {
    const base = level >= C.levels.shrinkFrom
      ? Math.max(C.paddle.minW, C.paddle.w - (level - C.levels.shrinkFrom + 1) * C.paddle.shrinkPerLevel)
      : C.paddle.w;
    return Math.min(W - 22, base + progress.upgrades.width * C.paddle.permanentWidthPerTier);
  }
  function windAt(time) {
    return level >= C.levels.windFrom
      ? Math.sin(time * 0.6) * C.wind.strength * Math.min(1, (level - C.levels.windFrom + 1) / 3)
      : 0;
  }
  function message(value, seconds = 1.45) { toast = value; toastTime = seconds; }
  function reset() {
    score = 0; level = 1; catches = 0; combo = 0; elapsed = 0;
    wind = 0; nextBox = 0.95; nextBonus = C.bonus.firstAfter;
    toast = ''; toastTime = 0; shake = 0; scoreFlash = 0;
    paddle.x = W / 2;
    Object.assign(roo, { x: R + 20, y: 310, vx: 245, vy: -325, wallBoosts: 0 });
    bonus.active = false;
    boss = null;
    bossStones.length = 0;
    decoys.length = 0;
    shields = progress.upgrades.shield;
    livesCount.textContent = String(shields);
    magnetTimer = magnetCooldown = floatTimer = floatCooldown = 0;
    boxes.forEach(b => { b.active = false; });
    particles.length = 0;
    trail.length = 0;
  }

  function updateControls() {
    const paused = state === 'pause';
    pauseButton.disabled = state === 'ready' || state === 'over';
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    soundButton.textContent = soundOn ? 'SFX ON' : 'SFX OFF';
    soundButton.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    soundButton.setAttribute('aria-pressed', String(soundOn));
    updateAbilityButtons();
  }
  function setAbilityButton(button, unlocked, activeTime, cooldown, textLabel) {
    const active = activeTime > 0;
    button.disabled = !unlocked || state !== 'play' || active || cooldown > 0 || !shopModal.hidden;
    button.classList.toggle('available', unlocked && !active && cooldown <= 0 && state === 'play');
    button.classList.toggle('running', active);
    let status = !unlocked ? 'LOCKED' : active ? `${activeTime.toFixed(1)}s ACTIVE` : cooldown > 0 ? `${Math.ceil(cooldown)}s RECHARGE` : 'READY';
    const label = `${textLabel}:${status}`;
    if (button.dataset.status !== label) {
      button.dataset.status = label;
      button.querySelector('small').textContent = status;
    }
  }
  function updateAbilityButtons() {
    setAbilityButton(magnetButton, progress.upgrades.magnet > 0, magnetTimer, magnetCooldown, 'magnet');
    setAbilityButton(floatButton, progress.upgrades.float > 0, floatTimer, floatCooldown, 'float');
    livesCount.textContent = String(shields);
  }
  function activateAbility(kind) {
    if (state !== 'play' || !shopModal.hidden) return;
    if (kind === 'magnet' && progress.upgrades.magnet && magnetCooldown <= 0) {
      magnetTimer = C.abilities.magnetSeconds + (progress.upgrades.magnet - 1) * 0.7;
      magnetCooldown = C.abilities.magnetCooldown;
      message('MAGNET FIELD!', 0.8); ping('star');
    } else if (kind === 'float' && progress.upgrades.float && floatCooldown <= 0) {
      floatTimer = C.abilities.floatSeconds + (progress.upgrades.float - 1) * 0.65;
      floatCooldown = C.abilities.floatCooldown;
      message('LOW GRAVITY!', 0.8); ping('star');
    }
    updateAbilityButtons();
  }
  function renderShop() {
    updateWallet();
    shopItems.replaceChildren();
    for (const [key, item] of Object.entries(C.shop.upgrades)) {
      const tier = progress.upgrades[key];
      const max = item.costs.length;
      const price = tier < max ? item.costs[tier] : null;
      const card = document.createElement('article');
      card.className = 'shop-item';
      const info = document.createElement('div');
      const name = document.createElement('h3'); name.textContent = item.label;
      const description = document.createElement('p'); description.textContent = item.description;
      const progressLabel = document.createElement('p'); progressLabel.className = 'tier';
      progressLabel.textContent = `TIER ${tier}/${max}`;
      info.append(name, description, progressLabel);
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = price === null ? 'MAXED' : `â ${price}`;
      button.disabled = price === null || progress.coins < price;
      button.addEventListener('click', () => {
        if (price === null || progress.coins < price || progress.upgrades[key] !== tier) return;
        progress.coins -= price;
        progress.upgrades[key]++;
        if (key === 'shield') { shields++; livesCount.textContent = String(shields); }
        saveProgress(); renderShop(); updateControls();
      });
      card.append(info, button); shopItems.append(card);
    }
    const heading = document.createElement('h3');
    heading.className = 'skin-heading';
    heading.textContent = 'PADDLE SKINS / COLLECT & EQUIP';
    shopItems.append(heading);
    for (const [key, skin] of Object.entries(paddleSkins)) {
      const hasSkin = progress.skins.includes(key);
      const equipped = progress.skin === key;
      const card = document.createElement('article');
      card.className = 'shop-item skin-item';
      const info = document.createElement('div');
      const name = document.createElement('h3'); name.textContent = skin.label;
      const detail = document.createElement('p'); detail.textContent = skin.note;
      const sample = document.createElement('div'); sample.className = 'skin-swatch';
      sample.style.setProperty('--skin-border', skin.border);
      sample.style.setProperty('--skin-face', skin.face);
      sample.style.setProperty('--skin-center', skin.center);
      info.append(name, detail, sample);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = equipped ? 'EQUIPPED' : hasSkin ? 'EQUIP' : `â ${skin.cost}`;
      button.disabled = equipped || (!hasSkin && progress.coins < skin.cost);
      button.addEventListener('click', () => {
        if (equipped) return;
        if (!progress.skins.includes(key)) {
          if (progress.coins < skin.cost) return;
          progress.coins -= skin.cost;
          progress.skins.push(key);
        }
        progress.skin = key;
        saveProgress(); renderShop();
      });
      card.append(info, button); shopItems.append(card);
    }
  }
  function openShop() {
    if (!shopModal.hidden) return;
    shopWasPlaying = state === 'play';
    if (shopWasPlaying) togglePause();
    shopModal.hidden = false;
    renderShop(); updateAbilityButtons();
    closeShopButton.focus();
  }
  function closeShop() {
    if (shopModal.hidden) return;
    shopModal.hidden = true;
    if (shopWasPlaying && state === 'pause') togglePause();
    shopWasPlaying = false;
    updateAbilityButtons();
    shopButton.focus();
  }
  function begin() { reset(); state = 'play'; updateControls(); ping('start'); }
  function togglePause() {
    if (state === 'play') state = 'pause';
    else if (state === 'pause') state = 'play';
    else return;
    keys.left = keys.right = false;
    updateControls();
  }
  function tap() {
    if (state === 'ready' || (state === 'over' && performance.now() - recentlyOverAt > 350)) begin();
    else if (state === 'pause') togglePause();
  }
  reset();
  updateWallet();
  updateControls();

  // -------------------- Sound, optional and gesture-driven --------------------
  function ping(kind) {
    if (!soundOn) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const sounds = {
        catch: [380, 520, 0.075], perfect: [670, 1040, 0.15],
        box: [280, 390, 0.09], wall: [220, 280, 0.055],
        star: [750, 1250, 0.16], fail: [260, 100, 0.23], start: [420, 710, 0.11]
      };
      const [f0, f1, duration] = sounds[kind] || sounds.catch;
      osc.type = kind === 'fail' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch { /* Audio isn't essential to gameplay. */ }
  }

  // -------------------- Tiny particle engine --------------------
  function spray(x, y, color, n = 9, power = 120) {
    for (let i = 0; i < n; i++) {
      if (particles.length >= C.particles.max) particles.shift();
      const a = rand(0, Math.PI * 2), v = rand(power * 0.2, power);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(0.27, 0.64), maxLife: 0, radius: rand(1.2, 3.4), color });
      particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function rememberTrail() {
    trail.push({ x: roo.x, y: roo.y });
    if (trail.length > 10) trail.shift();
  }

  // -------------------- Wall logic: only ONE vertical assist per paddle flight --------------------
  function collideWithWalls(body, announce = false) {
    let side = 0;
    if (body.x < R) { body.x = R; side = -1; }
    else if (body.x > W - R) { body.x = W - R; side = 1; }
    if (side) {
      // Reflect horizontally on EVERY wall hit. No vertical energy added after
      // maxBoostsPerFlight is reached; gravity then guarantees descent.
      body.vx = -side * Math.max(C.wall.minReboundX, Math.abs(body.vx));
      if (body.vy > 55 && body.wallBoosts < C.wall.maxBoostsPerFlight) {
        body.vy = Math.min(body.vy, -C.wall.kick);
        body.wallBoosts++;
        if (announce) { spray(body.x, body.y, '#ffe1a0', 11, 105); ping('wall'); }
      } else if (announce) {
        spray(body.x, body.y, '#f7bb79', 3, 70);
      }
    }
    if (body.y < R) {
      body.y = R;
      body.vy = Math.max(0, body.vy) + Math.abs(Math.min(0, body.vy)) * 0.45;
    }
  }

  function spawnBox() {
    const b = boxes.find(item => !item.active);
    if (!b) return;
    const r = Math.random(), odds = C.box.chances;
    b.type = r < odds.normal ? 'normal' : r < odds.normal + odds.spring ? 'spring' : 'cracked';
    b.x = rand(14, W - C.box.w - 14);
    b.y = -C.box.h;
    b.prevY = b.y;
    b.active = true;
  }
  function spawnBonus() {
    if (bonus.active) return;
    bonus.active = true;
    bonus.x = rand(40, W - 40);
    bonus.y = -22;
    bonus.phase = rand(0, 6.28);
  }
  function updateBonus(dt) {
    if (!bonus.active) return;
    bonus.y += C.bonus.speed * dt;
    bonus.phase += dt * 2.8;
    const drawnX = bonus.x + Math.sin(bonus.phase) * 14;
    if (Math.hypot(roo.x - drawnX, roo.y - bonus.y) < R + 13) {
      bonus.active = false;
      score += C.bonus.points;
      earnCoins(C.bonus.coins);
      scoreFlash = 0.4;
      message('LUCKY STAR  +' + C.bonus.points);
      spray(drawnX, bonus.y, '#ffe79e', 19, 200);
      ping('star');
    } else if (bonus.y > C.paddle.y - 38) bonus.active = false;
  }

  // -------------------- Mini-boss director (5 / 10 / 15 / ...) --------------------
  const bossNames = { devourer: 'THE DEVOURER', stone: 'STONEBREAKER', phantom: 'THE PHANTOM' };
  function spawnBoss() {
    const index = Math.floor(level / C.boss.everyLevels) - 1;
    const type = ['devourer', 'stone', 'phantom'][index % 3];
    boss = { type, phase: 'enter', x: W / 2, y: -64, timer: 0,
      age: 0, attackAge: 0, spat: false, held: false, holdTime: 0, stoneTimer: 0 };
    bossStones.length = 0; decoys.length = 0;
    message('BOSS: ' + bossNames[type], 2.3);
    ping('wall');
  }
  function startBossAttack() {
    if (!boss) return;
    boss.phase = 'attack'; boss.attackAge = 0;
    boss.timer = boss.type === 'devourer' ? C.boss.devourSeconds :
      boss.type === 'stone' ? C.boss.stoneSeconds : C.boss.phantomSeconds;
    if (boss.type === 'stone') boss.stoneTimer = 0.1;
    if (boss.type === 'phantom') {
      decoys.length = 0;
      for (const side of [-1, 1]) {
        decoys.push({ x: clamp(roo.x + side * 42, R, W - R),
          y: roo.y + side * 17, vx: roo.vx + side * 80,
          vy: roo.vy + side * 45, wallBoosts: 1 });
      }
      message('PHANTOM: FIND THE GOLD ROO!', 2.0);
    } else if (boss.type === 'stone') {
      message('STONE STORM!', 1.4);
    } else {
      message('WATCH THE VACUUM!', 1.4);
    }
  }
  function updateBoss(dt) {
    if (!boss) return;
    boss.age += dt;
    boss.x = W / 2 + Math.sin(elapsed * 1.4) * 58;
    if (boss.phase === 'enter') {
      boss.y = Math.min(141, boss.y + C.boss.enterSpeed * dt);
      if (boss.y >= 141) { boss.phase = 'warn'; boss.timer = C.boss.warnSeconds; }
    } else if (boss.phase === 'warn') {
      boss.y = 141 + Math.sin(elapsed * 3) * 4;
      boss.timer -= dt;
      if (boss.timer <= 0) startBossAttack();
    } else if (boss.phase === 'attack') {
      boss.y = 141 + Math.sin(elapsed * 3) * 4;
      boss.timer -= dt; boss.attackAge += dt;
      if (boss.type === 'devourer' && !boss.spat) {
        const mouthX = boss.x, mouthY = boss.y + 26;
        if (boss.held) {
          boss.holdTime -= dt;
          roo.x = mouthX; roo.y = mouthY;
          roo.vx = roo.vy = 0;
          if (boss.holdTime <= 0) {
            boss.held = false; boss.spat = true;
            roo.y += 16;
            roo.vx = rand(-425, 425);
            // Always preserve a catchable downward outcome eventually.
            roo.vy = rand(-260, 190);
            roo.wallBoosts = C.wall.maxBoostsPerFlight;
            spray(roo.x, roo.y, '#f4b943', 22, 210);
            message('SPAT OUT!', 1.1); ping('perfect');
          }
        } else {
          // The boss temporarily takes over the flight; the player never controls the roo.
          const rate = Math.min(1, 5.4 * dt);
          roo.x += (mouthX - roo.x) * rate;
          roo.y += (mouthY - roo.y) * rate;
          roo.vx = roo.vy = 0;
          if (Math.hypot(roo.x - mouthX, roo.y - mouthY) < 15) {
            boss.held = true;
            boss.holdTime = C.boss.devourHold;
            spray(mouthX, mouthY, '#f1a94d', 12, 105);
            ping('box');
          }
        }
      }
      if (boss.type === 'stone') {
        boss.stoneTimer -= dt;
        if (boss.stoneTimer <= 0) {
          bossStones.push({ x: clamp(boss.x + rand(-115, 115), 23, W - 23),
            y: boss.y + 27, vy: rand(145, 215), size: 30, spin: rand(-1, 1) });
          boss.stoneTimer = C.boss.stoneEvery;
        }
      }
      if (boss.timer <= 0) {
        // Retiring stone attacks must not leave invisible collidable objects.
        bossStones.length = 0;
        // Release the kangaroo even if it wasn't swallowed because of an edge case.
        if (boss.type === 'devourer' && !boss.spat) {
          roo.vx = rand(-300, 300); roo.vy = 140; roo.wallBoosts = C.wall.maxBoostsPerFlight;
        }
        boss.phase = 'leave'; boss.timer = 0;
        decoys.length = 0;
      }
    } else if (boss.phase === 'leave') {
      boss.y -= C.boss.leaveSpeed * dt;
      if (boss.y < -86) {
        earnCoins(C.boss.rewardCoins);
        score += C.boss.rewardScore;
        scoreFlash = 0.5;
        message(`BOSS SURVIVED! +${C.boss.rewardCoins} COINS`, 1.9);
        boss = null;
        bossStones.length = 0;
        decoys.length = 0;
        ping('star');
      }
    }

    for (let i = bossStones.length - 1; i >= 0; i--) {
      const rock = bossStones[i];
      rock.y += rock.vy * dt;
      if (rock.y > C.paddle.y - 42) bossStones.splice(i, 1);
    }
    for (const copy of decoys) {
      copy.vy += gravity() * dt;
      copy.vx = clamp(copy.vx + windAt(elapsed) * dt, -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
      copy.x += copy.vx * dt; copy.y += copy.vy * dt;
      if (copy.x < R) { copy.x = R; copy.vx = Math.abs(copy.vx); }
      if (copy.x > W - R) { copy.x = W - R; copy.vx = -Math.abs(copy.vx); }
      if (copy.y > H + R) { copy.y = 180; copy.vy = -250; }
    }
  }
  function devourerHasControl() {
    return !!(boss && boss.type === 'devourer' && boss.phase === 'attack' && !boss.spat);
  }
  function applyStoneCollisions() {
    for (let i = bossStones.length - 1; i >= 0; i--) {
      const rock = bossStones[i];
      if (Math.abs(roo.x - rock.x) > rock.size / 2 + R || Math.abs(roo.y - rock.y) > rock.size / 2 + R) continue;
      roo.vx = clamp(roo.vx + rand(-280, 280), -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
      roo.vy = -Math.max(350, Math.abs(roo.vy) * 0.8);
      roo.y = rock.y - rock.size / 2 - R;
      spray(rock.x, rock.y, '#df9a6c', 14, 120);
      bossStones.splice(i, 1);
      message('STONE KICK!', 0.85);
      ping('box');
    }
  }

  // -------------------- Fixed-timestep gameplay --------------------
  function step(dt) {
    if (state !== 'play') return;
    elapsed += dt;
    if (toastTime > 0) toastTime -= dt;
    if (scoreFlash > 0) scoreFlash -= dt;
    if (shake > 0) shake -= dt;
    updateParticles(dt);
    magnetCooldown = Math.max(0, magnetCooldown - dt);
    floatCooldown = Math.max(0, floatCooldown - dt);
    magnetTimer = Math.max(0, magnetTimer - dt);
    floatTimer = Math.max(0, floatTimer - dt);
    updateBoss(dt);
    if (Math.floor(elapsed * 10) !== Math.floor((elapsed - dt) * 10)) updateAbilityButtons();

    if (keys.left) paddle.x -= C.paddle.keyboardSpeed * dt;
    if (keys.right) paddle.x += C.paddle.keyboardSpeed * dt;
    paddle.x = clamp(paddle.x, paddleW() / 2, W - paddleW() / 2);
    wind = windAt(elapsed);

    const fallingSpeed = C.box.fall + C.box.fallPerLevel * level;
    for (const b of boxes) {
      if (!b.active) continue;
      b.prevY = b.y;
      b.y += fallingSpeed * dt;
      // Don't allow box collisions below/inside the paddle plane.
      if (b.y + C.box.h >= C.paddle.y - 8) b.active = false;
    }
    if (level >= C.levels.boxesFrom) {
      nextBox -= dt;
      if (nextBox <= 0) {
        spawnBox();
        nextBox = Math.max(C.box.spawnMin, C.box.spawnEvery - 0.14 * (level - C.levels.boxesFrom));
      }
    }
    if (level >= C.bonus.fromLevel) {
      nextBonus -= dt;
      if (nextBonus <= 0) {
        spawnBonus();
        nextBonus = rand(C.bonus.minAfter, C.bonus.maxAfter);
      }
    }

    const prevY = roo.y;
    const bossControlsRoo = devourerHasControl();
    if (!bossControlsRoo) {
      let g = gravity();
      if (floatTimer > 0) {
        g *= 0.06;
        roo.vy = clamp(roo.vy * 0.972, -85, 95);
      }
      if (magnetTimer > 0 && roo.y > 205 && roo.y < C.paddle.y + 30 && roo.vy > 0) {
        const magnetPull = clamp((paddle.x - roo.x) * (2.9 + progress.upgrades.magnet * 0.75), -650, 650);
        roo.vx += magnetPull * dt;
      }
      roo.vx = clamp(roo.vx + wind * dt, -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
      roo.vy += g * dt;
      roo.x += roo.vx * dt;
      roo.y += roo.vy * dt;
      collideWithWalls(roo, true);
      applyStoneCollisions();
    }

    // A landing must cross the top face WHILE the kangaroo is going down.
    for (const b of boxes) {
      if (!b.active || roo.vy <= 0 || bossControlsRoo) continue;
      const crossed = prevY + R <= b.prevY + 2 && roo.y + R >= b.y;
      const overlaps = roo.x > b.x - R * 0.45 && roo.x < b.x + C.box.w + R * 0.45;
      if (!crossed || !overlaps) continue;
      roo.y = b.y - R;
      roo.vy = -C.box.bounce[b.type];
      roo.vx = clamp(roo.vx + rand(-C.box.horizontalNudge, C.box.horizontalNudge),
        -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
      // A box can change the path but NEVER resets the one-wall-boost allowance.
      score += b.type === 'spring' ? 10 : 5;
      earnCoins(1);
      spray(roo.x, b.y, b.type === 'spring' ? '#b8efbf' : '#f9d39a', 10, 115);
      if (b.type === 'spring') message('SPRING!  +10', 0.9);
      if (b.type === 'cracked') b.active = false;
      ping('box');
      break;
    }

    const pw = paddleW();
    const crossedPaddle = roo.vy > 0 && prevY + R <= C.paddle.y && roo.y + R >= C.paddle.y;
    if (!bossControlsRoo && crossedPaddle && Math.abs(roo.x - paddle.x) <= pw / 2 + R * 0.48) catchRoo(pw);

    updateBonus(dt);
    if (roo.y - R > H + 3) {
      if (shields > 0) {
        shields--;
        roo.x = paddle.x;
        roo.y = C.paddle.y - R - 12;
        roo.vx = rand(-285, 285);
        roo.vy = -650;
        roo.wallBoosts = C.wall.maxBoostsPerFlight;
        combo = 0;
        message('EXTRA LIFE SAVED YOU!', 1.6);
        spray(roo.x, roo.y, '#7ce2d9', 22, 155);
        ping('perfect');
        updateAbilityButtons();
      } else gameOver();
    }
    if (Math.floor(elapsed * 42) !== Math.floor((elapsed - dt) * 42)) rememberTrail();
  }

  function catchRoo(pw) {
    const offset = clamp((roo.x - paddle.x) / (pw / 2), -1, 1);
    const perfect = Math.abs(offset) <= C.paddle.perfectZone;
    const angle = offset * C.launch.maxAngleDeg * Math.PI / 180;
    const speed = Math.min(C.launch.maxSpeed, C.launch.base + C.launch.perLevel * (level - 1))
      * (perfect ? C.launch.perfectBoost : 1);
    roo.vx = clamp(Math.sin(angle) * speed * 0.91 + rand(-C.launch.randomDrift, C.launch.randomDrift),
      -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
    roo.vy = -speed * (0.62 + 0.38 * Math.cos(angle));
    roo.y = C.paddle.y - R;
    roo.wallBoosts = 0; // Fresh flight, so one new rescue-hop is allowed.
    catches++;
    shake = perfect ? 0.12 : 0.045;
    scoreFlash = 0.24;
    if (perfect) {
      combo++;
      score += 10 + 10 * Math.min(combo, 8); // cap combo points to keep scores meaningful
      earnCoins(6);
      message('PERFECT  Ã' + combo);
      spray(roo.x, C.paddle.y, '#ffe99c', 16, 155);
      ping('perfect');
    } else {
      combo = 0;
      score += 10;
      earnCoins(3);
      spray(roo.x, C.paddle.y, '#f5b985', 10, 105);
      ping('catch');
    }
    if (catches % C.levels.catchesPerLevel === 0) {
      level++;
      if (level === C.levels.boxesFrom) message('LEVEL 2 Â· FALLING BOXES', 2);
      else if (level === C.levels.windFrom) message('LEVEL 3 Â· CROSSWINDS', 2);
      else if (level === C.levels.shrinkFrom) message('LEVEL 4 Â· SMALLER PADDLE', 2);
      else message('LEVEL ' + level + ' Â· KEEP HOPPING!', 2);
      spray(W / 2, 112, '#ffe0a4', 22, 155);
      if (!boss && level >= C.boss.firstLevel && level % C.boss.everyLevels === 0) spawnBoss();
    }
  }
  function gameOver() {
    state = 'over';
    recentlyOverAt = performance.now();
    keys.left = keys.right = false;
    shake = 0;
    boss = null; decoys.length = 0; bossStones.length = 0;
    if (score > best) {
      best = score;
      try { localStorage.setItem('fkk-best', String(best)); } catch { /* Private mode can block storage. */ }
    }
    ping('fail');
    updateControls();
  }

  // -------------------- Retro pixel backdrop and rendering --------------------
  const background = document.createElement('canvas');
  background.width = W;
  background.height = H;
  const bg = background.getContext('2d');

  function borderRect(x, y, w, h, outer = '#f6df9c', inner = '#2b1549', fill = '#1a0d34') {
    ctx.fillStyle = outer; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = inner; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = fill; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
  function bgBorderRect(x, y, w, h, outer = '#f6df9c', inner = '#2b1549', fill = '#1a0d34') {
    bg.fillStyle = outer; bg.fillRect(x, y, w, h);
    bg.fillStyle = inner; bg.fillRect(x + 2, y + 2, w - 4, h - 4);
    bg.fillStyle = fill; bg.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
  function pixelText(target, textValue, x, y, size = 12, color = '#f6df9c', align = 'left') {
    target.fillStyle = color;
    target.font = `bold ${size}px Courier New, monospace`;
    target.textAlign = align;
    target.textBaseline = 'top';
    target.fillText(textValue, x, y);
  }

  function drawPixelSprite(target, sprite, colors, x, y, scale = 2, flip = false) {
    for (let row = 0; row < sprite.length; row++) {
      const line = sprite[row];
      for (let col = 0; col < line.length; col++) {
        const code = line[col];
        if (code === '.') continue;
        const drawCol = flip ? (line.length - 1 - col) : col;
        target.fillStyle = colors[code] || '#fff';
        target.fillRect(x + drawCol * scale, y + row * scale, scale, scale);
      }
    }
  }

  // 24Ã24 hand-pixeled kangaroo: tail, ears, pouch, nose and feet.
  const kangarooSprite = [
    '.............111........',
    '............1131...111..',
    '............13311..111..',
    '............13731..1331.',
    '............13731..1731.',
    '............13771111731.',
    '............1377311171..',
    '............1171133311..',
    '............1111333331..',
    '............11133333631.',
    '..........1131133331111.',
    '.........113331333344461',
    '111......133333133144441',
    '121.....1323333113114111',
    '1222....1322224441111...',
    '11223...1322224555331...',
    '.122233313222244443311..',
    '.11123331322224444334...',
    '.....2222122223444111...',
    '......1111111111443331..',
    '..........133333113333..',
    '...........333331133331.',
    '........1122333331322331',
    '........1111111111111111',
  ];
  const kangarooColors = {
    '1': '#201134', '2': '#643635', '3': '#c27d42',
    '4': '#f5c580', '5': '#ffe4aa', '6': '#211121', '7': '#f39494'
  };

  const boxSprites = {
    normal: [
      '1111111111111111',
      '1222222222222221',
      '1233333333333321',
      '1232222322232321',
      '1233333333333321',
      '1444444444444441'
    ],
    spring: [
      '1111111111111111',
      '1222222222222221',
      '1233333333333321',
      '1212121212121221',
      '1233333333333321',
      '1444444444444441'
    ],
    cracked: [
      '1111111111111111',
      '1222222222222221',
      '1233333133333321',
      '1233331313333321',
      '1233313331333321',
      '1444444444444441'
    ]
  };
  const boxColors = {
    normal: { '1': '#2b1738', '2': '#784a3a', '3': '#b47249', '4': '#d39b66' },
    spring: { '1': '#2b1738', '2': '#46743b', '3': '#7fd26b', '4': '#b9f2a8' },
    cracked: { '1': '#2b1738', '2': '#64505b', '3': '#a08a92', '4': '#cab5bc' }
  };

  function makeBackground() {
    bg.fillStyle = '#120827';
    bg.fillRect(0, 0, W, H);

    // Stars.
    const stars = [
      [20, 25], [56, 92], [88, 42], [136, 20], [194, 46], [247, 28], [316, 58], [339, 96],
      [31, 150], [75, 183], [120, 136], [173, 170], [224, 124], [277, 162], [331, 144]
    ];
    bg.fillStyle = '#fff2b8';
    for (const [x, y] of stars) bg.fillRect(x, y, 3, 3);

    // Block moon/sun.
    bg.fillStyle = '#f4b24a';
    bg.fillRect(300, 52, 34, 34);
    bg.fillStyle = '#ffcf6b';
    bg.fillRect(304, 56, 10, 10);
    bg.fillRect(316, 56, 14, 22);
    bg.fillRect(304, 68, 26, 14);

    // Layered mesas.
    const layers = [
      { y: 390, c: '#2e144f', blocks: [[0,36],[40,54],[82,44],[122,60],[162,40],[206,58],[248,36],[293,52],[332,44]] },
      { y: 450, c: '#5a1e62', blocks: [[0,52],[44,38],[84,60],[126,46],[168,64],[215,42],[258,58],[306,40]] },
      { y: 510, c: '#8f315f', blocks: [[0,64],[54,42],[92,60],[148,38],[190,68],[244,40],[302,60]] },
      { y: 560, c: '#cf6a54', blocks: [[0,28],[30,28],[62,20],[90,34],[130,20],[164,24],[192,20],[224,30],[260,20],[296,28],[328,22]] },
    ];
    for (const layer of layers) {
      bg.fillStyle = layer.c;
      let cursor = 0;
      for (const [width, height] of layer.blocks) {
        bg.fillRect(cursor, layer.y - height, width, height);
        cursor += width;
      }
    }

    // Ground band.
    bg.fillStyle = '#301553';
    bg.fillRect(0, C.paddle.y + 32, W, H - (C.paddle.y + 32));
    bg.fillStyle = '#f0b24d';
    bg.fillRect(0, H - 26, W, 26);
    bg.fillStyle = '#9d4b38';
    bg.fillRect(0, H - 36, W, 10);
  }
  makeBackground();

  function drawBox(b) {
    const sprite = boxSprites[b.type];
    drawPixelSprite(ctx, sprite, boxColors[b.type], Math.round(b.x), Math.round(b.y), 4, false);
  }

  function drawPaddle() {
    const pw = Math.round(paddleW());
    const x = Math.round(paddle.x - pw / 2);
    const y = C.paddle.y;
    const skin = paddleSkins[progress.skin] || paddleSkins.classic;
    ctx.fillStyle = skin.border;
    ctx.fillRect(x - 2, y - 2, pw + 4, C.paddle.h + 4);
    ctx.fillStyle = skin.base;
    ctx.fillRect(x, y, pw, C.paddle.h);
    ctx.fillStyle = skin.face;
    ctx.fillRect(x + 2, y + 2, pw - 4, C.paddle.h - 4);
    for (let tile = 8; tile < pw - 8; tile += 13) {
      ctx.fillStyle = skin.border;
      ctx.fillRect(x + tile, y + 2, 2, 2);
    }
    const perfectW = Math.max(12, Math.round(pw * C.paddle.perfectZone * 2));
    const perfectX = Math.round(paddle.x - perfectW / 2);
    ctx.fillStyle = skin.center;
    ctx.fillRect(perfectX, y + 2, perfectW, C.paddle.h - 4);
    if (magnetTimer > 0) {
      ctx.fillStyle = '#88f4ee';
      ctx.fillRect(x + 4, y - 5, 5, 3);
      ctx.fillRect(x + pw - 9, y - 5, 5, 3);
      const arrowX = Math.round(paddle.x + (Math.sin(elapsed * 12) * 18));
      ctx.fillRect(arrowX, y - 22, 4, 4);
      ctx.fillRect(arrowX + 4, y - 18, 4, 4);
    }
  }

  function drawRoo() {
    const bob = Math.round(Math.sin(elapsed * 9) * 1.5);
    drawPixelSprite(ctx, kangarooSprite, kangarooColors, Math.round(roo.x - 24), Math.round(roo.y - 28 + bob), 2, roo.vx < 0);
  }

  // This remains a short hint only; it never promises the exact landing spot.
  function hintPoints() {
    const duration = Math.max(C.hint.minTime, C.hint.baseTime - C.hint.perLevel * (level - 1));
    const s = { x: roo.x, y: roo.y, vx: roo.vx, vy: roo.vy, wallBoosts: roo.wallBoosts };
    const points = [], dt = 1 / 60;
    for (let i = 0; i < Math.round(duration / dt); i++) {
      s.vx = clamp(s.vx + windAt(elapsed + i * dt) * dt,
        -C.wall.maxHorizontalSpeed, C.wall.maxHorizontalSpeed);
      s.vy += gravity() * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      collideWithWalls(s);
      if (i % 4 === 0 && s.y > R && s.y < C.paddle.y) points.push({ x: s.x, y: s.y, a: 1 - i * dt / duration });
      if (s.y + R >= C.paddle.y) break;
    }
    return points;
  }

  function drawBonus() {
    if (!bonus.active) return;
    const x = Math.round(bonus.x + Math.sin(bonus.phase) * 14);
    const y = Math.round(bonus.y);
    const sprite = [
      '..1..',
      '.111.',
      '11111',
      '.111.',
      '..1..'
    ];
    drawPixelSprite(ctx, sprite, { '1': '#f6df9c' }, x - 10, y - 10, 4, false);
  }

  function drawParticlesAndTrail() {
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const size = 1 + (i > trail.length - 4 ? 1 : 0);
      ctx.fillStyle = i < trail.length / 2 ? '#e3b36f55' : '#f7e4a488';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size * 2, size * 2);
    }
    for (const p of particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(2, Math.round(p.radius)), Math.max(2, Math.round(p.radius)));
    }
    ctx.globalAlpha = 1;
  }

  // Original hand-made 18x18 boss sprites. Every block is drawn by the engine.
  const bossSprites = {
    devourer: [
      '....1111111111....',
      '...122222222221...',
      '..12333333333321..',
      '.1233333333333321.',
      '123333333333333321',
      '123334333343333321',
      '123344433444333321',
      '123344433444333321',
      '123333333333333321',
      '123333333333333321',
      '123333444433333321',
      '123334111143333321',
      '.1233411114333321.',
      '.1233344443333321.',
      '..12333333333321..',
      '...122222222221...',
      '....1111111111....'
    ],
    stone: [
      '....1111111111....',
      '..11222222222211..',
      '.122222222222221.',
      '122223333333222221',
      '122233333333322221',
      '122334333343332221',
      '122344433444332221',
      '122344433444332221',
      '122333333333332221',
      '122333333333332221',
      '122333311333332221',
      '122333311333332221',
      '122333333333332221',
      '.122333333333221.',
      '..12222222222221..',
      '...111111111111...',
      '.....11111111.....'
    ],
    phantom: [
      '.....11111111.....',
      '...112222222211...',
      '..12222222222221..',
      '.1222222222222221.',
      '122222222222222221',
      '122223322233222221',
      '122233332333322221',
      '122233332333322221',
      '122222222222222221',
      '122222333322222221',
      '122223333332222221',
      '122222333322222221',
      '122222222222222221',
      '.1222222222222221.',
      '..12212212212221..',
      '...11..11..11.....',
      '....1...1...1.....'
    ]
  };
  const bossColors = {
    devourer: { '1': '#260e42', '2': '#69328e', '3': '#b65aa7', '4': '#ffbd55' },
    stone: { '1': '#241a3e', '2': '#5f5472', '3': '#9b8f95', '4': '#f1bf69' },
    phantom: { '1': '#241d4f', '2': '#6cbdbd', '3': '#e5faff', '4': '#fff3b1' }
  };
  function drawBoss() {
    if (!boss) return;
    const px = Math.round(boss.x - 36);
    const py = Math.round(boss.y - 35);
    if (boss.phase === 'warn') {
      const blink = Math.floor(elapsed * 8) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#ff6e7d';
        ctx.fillRect(px - 5, py - 5, 82, 82);
        ctx.fillStyle = '#1e0c3d';
        ctx.fillRect(px - 3, py - 3, 78, 78);
      }
    }
    if (boss.phase === 'attack' && boss.type === 'devourer' && !boss.spat) {
      ctx.strokeStyle = '#e883cf'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(roo.x, roo.y); ctx.lineTo(boss.x, boss.y + 25); ctx.stroke();
    }
    drawPixelSprite(ctx, bossSprites[boss.type], bossColors[boss.type], px, py, 4, false);
    if (boss.phase === 'attack' && boss.type === 'stone') {
      for (const rock of bossStones) {
        const rx = Math.round(rock.x - rock.size / 2), ry = Math.round(rock.y - rock.size / 2);
        ctx.fillStyle = '#27183c'; ctx.fillRect(rx - 2, ry - 2, rock.size + 4, rock.size + 4);
        ctx.fillStyle = '#8e8293'; ctx.fillRect(rx, ry, rock.size, rock.size);
        ctx.fillStyle = '#b3a3a1'; ctx.fillRect(rx + 4, ry + 4, rock.size - 14, 7);
        ctx.fillStyle = '#49395b'; ctx.fillRect(rx + 17, ry + 18, 7, 8);
      }
    }
    borderRect(23, 186, 314, 31, '#f6df9c', '#5a2c7e', '#230f42');
    pixelText(ctx, bossNames[boss.type] + '  ' + (boss.phase === 'warn' ? '!!' : boss.phase === 'attack' ? 'ATTACK' : 'INCOMING'), 180, 196, 10, '#f4ce7c', 'center');
  }
  function drawDecoys() {
    for (const copy of decoys) {
      if (copy.y < -30 || copy.y > H + 30) continue;
      drawPixelSprite(ctx, kangarooSprite,
        { '1': '#12365e', '2': '#1e5f82', '3': '#3a8dad', '4': '#8bd8ee', '5': '#e9ffff', '6': '#092a4e', '7': '#92ebfa' },
        Math.round(copy.x - 24), Math.round(copy.y - 28), 2, copy.vx < 0);
    }
  }

  function drawHud() {
    borderRect(8, 8, 116, 42, '#f6df9c', '#5d347f', '#24114b');
    pixelText(ctx, 'SCORE', 18, 14, 13, '#f6df9c');
    pixelText(ctx, String(score), 18, 29, 18, scoreFlash > 0 ? '#fff3be' : '#f0b541');

    borderRect(212, 8, 140, 42, '#f6df9c', '#5d347f', '#24114b');
    pixelText(ctx, `LEVEL ${level}`, 222, 14, 12, '#f6df9c');
    pixelText(ctx, `BEST ${best}`, 222, 29, 12, '#f0b541');

    borderRect(8, 56, 344, 18, '#f6df9c', '#5d347f', '#24114b');
    ctx.fillStyle = '#4a2b70';
    ctx.fillRect(14, 62, 332, 6);
    const progress = (catches % C.levels.catchesPerLevel) / C.levels.catchesPerLevel;
    ctx.fillStyle = '#f0b541';
    ctx.fillRect(14, 62, Math.round(332 * progress), 6);

    if (level >= C.levels.windFrom) {
      borderRect(118, 80, 124, 22, '#f6df9c', '#5d347f', '#24114b');
      const windLabel = Math.abs(wind) < 13 ? 'CALM' : wind > 0 ? 'WIND >' : '< WIND';
      pixelText(ctx, windLabel, 180, 86, 10, '#f6df9c', 'center');
    }

    if (toastTime > 0 && toast) {
      const alpha = clamp(toastTime * 2, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      borderRect(54, 110, 252, 26, '#f6df9c', '#5d347f', '#24114b');
      pixelText(ctx, toast, W / 2, 117, 12, '#fff1be', 'center');
      ctx.restore();
    }
  }

  function drawOverlay() {
    ctx.fillStyle = 'rgba(13, 6, 33, 0.86)';
    ctx.fillRect(0, 0, W, H);
    borderRect(18, 116, 324, 308, '#f6df9c', '#6b3a8f', '#24114b');
    pixelText(ctx, 'FLYING KANGAROO', W / 2, 143, 23, '#f0b541', 'center');
    pixelText(ctx, 'KICK', W / 2, 174, 24, '#f0b541', 'center');
    pixelText(ctx, 'ONE PADDLE / INFINITE CHAOS', W / 2, 218, 13, '#f6df9c', 'center');

    if (state === 'ready') {
      pixelText(ctx, 'CATCH THE ROO. STAY ALIVE.', W / 2, 259, 13, '#fff1be', 'center');
      pixelText(ctx, 'EDGE HITS SEND IT SIDEWAYS.', W / 2, 281, 13, '#fff1be', 'center');
      pixelText(ctx, 'CENTER HITS BUILD COMBOS.', W / 2, 303, 13, '#fff1be', 'center');
      pixelText(ctx, 'BOSSES EVERY 5 LEVELS.', W / 2, 328, 13, '#f0b541', 'center');
    } else if (state === 'pause') {
      pixelText(ctx, 'PAUSED', W / 2, 262, 21, '#fff1be', 'center');
      pixelText(ctx, 'TAP OR PRESS SPACE TO RESUME.', W / 2, 302, 13, '#fff1be', 'center');
    } else {
      pixelText(ctx, 'RUN OVER', W / 2, 253, 21, '#fff1be', 'center');
      pixelText(ctx, `SCORE ${score}  /  LEVEL ${level}`, W / 2, 287, 15, '#f6df9c', 'center');
      if (score === best && score > 0) pixelText(ctx, 'NEW PERSONAL BEST!', W / 2, 317, 14, '#f0b541', 'center');
    }

    borderRect(81, 361, 198, 42, '#f6df9c', '#c17b2a', '#f0b541');
    const label = state === 'ready' ? 'TAP TO START' : state === 'pause' ? 'TAP TO RESUME' : 'PLAY AGAIN';
    pixelText(ctx, label, W / 2, 374, 15, '#2b1738', 'center');

    pixelText(ctx, 'DRAG OR ARROWS TO MOVE', W / 2, 452, 14, '#f6df9c', 'center');
    pixelText(ctx, 'VISIT SHOP TO UNLOCK POWERS', W / 2, 477, 13, '#f0b541', 'center');
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(Math.round(rand(-shake * 10, shake * 10)), Math.round(rand(-shake * 6, shake * 6)));
    ctx.drawImage(background, 0, 0);

    for (const b of boxes) if (b.active) drawBox(b);
    drawBonus();
    drawBoss();
    drawDecoys();

    if (state === 'play') {
      for (const p of hintPoints()) {
        ctx.fillStyle = p.a > 0.6 ? '#fff1be' : p.a > 0.3 ? '#f0b541' : '#8f6c5a';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
      }
    }

    drawParticlesAndTrail();
    if (floatTimer > 0 && state === 'play') {
      ctx.fillStyle = '#8be8f2';
      for (let i = 0; i < 6; i++) {
        const x = Math.round(roo.x - 26 + (i % 3) * 24), y = Math.round(roo.y + 24 - (i % 2) * 34);
        ctx.fillRect(x, y, 4, 4);
      }
    }
    drawPaddle();
    drawRoo();
    drawHud();
    ctx.restore();

    if (state !== 'play') drawOverlay();
  }

// -------------------- Input and rendering --------------------
  function resize() {
    const s = Math.min(stage.clientWidth / W, stage.clientHeight / H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(0.2, s) * dpr;
    canvas.style.width = `${W * Math.max(0.2, s)}px`;
    canvas.style.height = `${H * Math.max(0.2, s)}px`;
    canvas.width = Math.round(W * px);
    canvas.height = Math.round(H * px);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw();
  }
  function movePaddle(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    paddle.x = clamp((event.clientX - rect.left) * W / rect.width, paddleW() / 2, W - paddleW() / 2);
  }
  canvas.addEventListener('pointermove', e => { if (state === 'play') movePaddle(e); });
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') canvas.setPointerCapture(e.pointerId);
    if (state === 'play') movePaddle(e);
    else tap();
  });
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (!shopModal.hidden) {
      if (key === 'escape') closeShop();
      return;
    }
    if (key === '1') { activateAbility('magnet'); return; }
    if (key === '2') { activateAbility('float'); return; }
    if (['arrowleft', 'arrowright', ' ', 'enter'].includes(key)) e.preventDefault();
    if (key === 'arrowleft') keys.left = true;
    if (key === 'arrowright') keys.right = true;
    if (e.repeat) return;
    if (key === ' ' || key === 'enter') tap();
    else if (key === 'p') togglePause();
    else if (key === 'm') {
      soundOn = !soundOn;
      updateControls();
      if (soundOn) ping('start');
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });
  shopButton.addEventListener('click', openShop);
  closeShopButton.addEventListener('click', closeShop);
  shopModal.addEventListener('click', e => { if (e.target === shopModal) closeShop(); });
  magnetButton.addEventListener('click', () => activateAbility('magnet'));
  floatButton.addEventListener('click', () => activateAbility('float'));
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', begin);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    updateControls();
    if (soundOn) ping('start');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') togglePause();
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  const STEP = C.physicsStep;
  let previousFrame = performance.now();
  let accumulator = 0;
  function frame(now) {
    accumulator += Math.min(0.05, (now - previousFrame) / 1000);
    previousFrame = now;
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
})();
