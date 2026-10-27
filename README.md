# 🦘 Flying Kangaroo Kick

**PLAY HERE: [https://farairudokapopo-code.github.io/flying-kangaroo-kick/]**

**One paddle. One autonomous kangaroo. Infinite chaos.**

A free, mobile-friendly, retro pixel-art browser arcade game built with **vanilla JavaScript, HTML Canvas, and CSS**. Catch the hopping kangaroo, score perfect landings, survive giant floating mini-bosses, collect coins, and customize your paddle with permanent upgrades and skins.



## ✨ Features

- **Skill-based one-paddle gameplay.** You move the paddle; the kangaroo handles its own momentum, gravity, and wall rebounds. Paddle impact position changes the launch direction.
- **Unpredictable, but finite flight.** Each paddle flight gets at most one upward wall assist. The kangaroo cannot endlessly gain vertical energy by bouncing between the screen edges.
- **Progressive arcade difficulty.** Falling wooden, spring, and cracked platforms appear at level 2; wind starts at level 3; the paddle begins shrinking at level 4. Reach the next level every five successful paddle catches.
- **Three repeating mini-bosses.** See their unique attacks below.
- **Persistent coin economy.** Earn currency from catches, platform bounces, stars, and surviving bosses. Your wallet is saved in browser `localStorage`.
- **Four permanent upgrades.** Magnet, anti-gravity, wider paddle, and extra lives, with multiple purchasable tiers.
- **Four paddle skins.** Default Classic Gold, plus unlockable Neon Jade, Magma Block, and Void Crystal.
- **Built for phones and desktops.** Pointer/drag control, keyboard support, sharp pixel scaling, pause, restart, and optional arcade SFX. No ads, tracking, libraries, or build tools.

## 🎮 Controls

| Action | Desktop | Phone/tablet |
| --- | --- | --- |
| Start, resume, restart after a loss | `Space`, `Enter`, or tap the game | Tap the game |
| Move paddle | `←` / `→` or move pointer on the canvas | Drag or slide across the game |
| Activate magnet | `1` | Tap **1 · Magnet** |
| Activate anti-gravity | `2` | Tap **2 · Anti-Grav** |
| Pause / resume | `P` | **Pause** button |
| Toggle sounds | `M` | **SFX** button |
| Open shop | **Shop** button | **Shop** button |
| Restart run | **Restart** button | **Restart** button |

**Tip:** Aim for the center-colored section of the paddle for a perfect catch and combo points. Near-edge catches throw the kangaroo sideways.

## 👹 Mini-bosses

Mini-bosses arrive every five levels. Their unique encounters repeat after level 15, as a rotating boss roster.

| Level | Boss | Attack |
| --- | --- | --- |
| 5, 20, 35... | **The Devourer** | Floats down, warns you, vacuums the kangaroo into its mouth, then spits it out at an unpredictable speed and angle. |
| 10, 25, 40... | **Stonebreaker** | Rains stone blocks from above. A block collision violently redirects the kangaroo. |
| 15, 30, 45... | **The Phantom** | Creates two cyan decoy kangaroos. Keep tracking the *real brown/gold kangaroo* to catch it. |

Boss encounters have an entrance, warning phase, attack, and exit. Survive the full encounter for **45 coins and 130 points**. The bosses are hazards to outlast, not enemies to attack directly.



## 🛒 Shop and progression

Open **Shop** anytime. If you open it during a run, the game pauses and resumes when you close the shop.

| Upgrade | Tiers | Effect |
| --- | --- | --- |
| **Magnet** | 3 | Activate a temporary attraction field that steers the descending kangaroo toward your paddle. More tiers increase duration and strength. Cooldown: 20 seconds. |
| **Anti-Gravity** | 3 | Activate a brief low-gravity state, slowing the kangaroo's descent so you can reposition. More tiers extend duration. Cooldown: 24 seconds. |
| **Wide Paddle** | 3 | Permanently adds 12 pixels of catch width per tier to every run. |
| **Extra Life** | 2 | Automatically rescues one missed catch per tier, refreshed each run. |

Paddle cosmetics: **Classic Gold** (included), **Neon Jade**, **Magma Block**, and **Void Crystal**. Purchased skins can be equipped without paying again.

### Earning coins

| Event | Coins |
| --- | ---: |
| Standard catch | 3 |
| Perfect catch | 6 |
| Falling-box bounce | 1 |
| Collect a falling bonus star | 8 |
| Survive a complete mini-boss encounter | 45 |

Players begin with **150 starter coins** to try an upgrade. Coins and purchased upgrades are kept between runs. The personal best score is also saved on the current browser/device.

Anti-gravity is deliberately **time-limited** rather than infinite. Permanent weightlessness would remove the game's central challenge and risk reintroducing the same endless-flight issue that the wall-boost fix solved.

## 📁 Repository structure

```text
Flying-Kangaroo-Kick/
├── index.html          # Page, controls, and shop markup
├── style.css           # Retro 2D UI and responsive layout
├── config.js           # All game numbers, prices, boss tuning
├── game.js             # Simulation, bosses, shop, saving, sprite rendering
├── favicon.svg         # Pixel-art browser tab icon
├── .nojekyll            # Publish static files directly
├── README.md           # This file
└── assets/
    ├── gameplay.png
    ├── boss-devourer.png
    └── shop.png
```

## 🛠 Customize it

- **Gravity, paddle size, levels, wind and wall boosts:** edit `config.js`.
- **Boss frequency and encounter durations:** edit `CONFIG.boss` in `config.js`.
- **Skill durations, cooldowns and upgrade prices:** edit `CONFIG.abilities` and `CONFIG.shop`.
- **Pixel palettes, characters, enemy appearances:** edit the sprite arrays and draw functions inside `game.js`.
- **Header, buttons, shop layout:** edit `index.html` and `style.css`.

The entire game is intentionally dependency-free and designed for straightforward GitHub Pages hosting.

### Saved-data note

The game uses the browser's `localStorage` (key `fkk-progress-v2` for coins/upgrades/skins and `fkk-best` for the high score). Saves are **local to that browser and website origin**, not synced across devices. Clearing site data or switching to another browser can reset progress. No accounts or servers are involved.

