/* All gameplay tuning lives here. No build tools or dependencies needed. */
const CONFIG = Object.freeze({
  width: 360,
  height: 640,
  gravity: 900,
  gravityPerLevel: 0.045,
  maxGravity: 1450,
  kangarooRadius: 16,
  physicsStep: 1 / 120,
  wall: {
    kick: 285,
    maxBoostsPerFlight: 1, // Never allow endless wall-assisted flight.
    minReboundX: 150,
    maxHorizontalSpeed: 525
  },
  paddle: {
    w: 110, h: 12, y: 570,
    minW: 64, shrinkPerLevel: 7, perfectZone: 0.15,
    keyboardSpeed: 475, permanentWidthPerTier: 12
  },
  launch: {
    base: 685, perLevel: 14, maxSpeed: 960,
    maxAngleDeg: 59, perfectBoost: 1.06, randomDrift: 55
  },
  box: {
    w: 64, h: 21, fall: 50, fallPerLevel: 5,
    spawnEvery: 2.25, spawnMin: 1.2,
    bounce: { normal: 525, spring: 740, cracked: 515 },
    chances: { normal: 0.60, spring: 0.24, cracked: 0.16 },
    horizontalNudge: 65
  },
  wind: { strength: 155 },
  bonus: { fromLevel: 2, firstAfter: 7, minAfter: 8, maxAfter: 13, speed: 32, points: 35, coins: 8 },
  levels: { catchesPerLevel: 5, boxesFrom: 2, windFrom: 3, shrinkFrom: 4 },
  hint: { baseTime: 0.63, perLevel: 0.055, minTime: 0.24 },
  particles: { max: 85 },
  boss: {
    firstLevel: 5, everyLevels: 5,
    enterSpeed: 130, leaveSpeed: 150,
    warnSeconds: 1.65,
    devourSeconds: 3.9, stoneSeconds: 4.7, phantomSeconds: 5.2,
    devourHold: 0.65,
    stoneEvery: 0.62,
    rewardCoins: 45, rewardScore: 130
  },
  abilities: {
    magnetCooldown: 20, magnetSeconds: 3.3,
    floatCooldown: 24, floatSeconds: 2.1
  },
  shop: {
    startingCoins: 150,
    upgrades: {
      magnet: { label: 'MAGNET', description: 'Pull the roo toward your paddle. Activate with 1.', costs: [120, 185, 280] },
      float: { label: 'ANTI-GRAV', description: 'Brief low-gravity flight. Activate with 2.', costs: [150, 220, 330] },
      width: { label: 'WIDE PADDLE', description: '+12px paddle width per tier, automatically applied.', costs: [100, 170, 260] },
      shield: { label: 'EXTRA LIFE', description: 'Rescue one missed catch per tier, each run.', costs: [200, 380] }
    }
  }
});
