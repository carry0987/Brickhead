# BRICKHEAD

[![Release](https://github.com/carry0987/Brickhead/actions/workflows/release.yml/badge.svg)](https://github.com/carry0987/Brickhead/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**BRICKHEAD** is a LEGO-style, top-down zombie survival shooter inspired by the arcade pacing of _Boxhead_. Defend compact arenas from escalating zombie hordes, maintain a combo to unlock weapons and upgrades, build temporary defenses, collect supply crates, and survive for as long as possible.

The game runs entirely in the browser. It is a static React application with no backend, accounts, telemetry service, network multiplayer, or cloud save system.

**Play it:** <https://carry0987.github.io/Brickhead/>

## Highlights

- **Four local game modes**
  - Solo survival
  - Local two-player co-op
  - Solo play with an AI partner
  - Local two-player deathmatch
- **18 built-in arenas** with distinct wall layouts, spawn markers, collision data, and tactical choke points.
- **10 weapons and equipment types**, including the pistol, UZI, shotgun, grenades, barrels, fake walls, mines, rockets, charge packs, and railgun.
- **58 combo milestones** that permanently unlock weapons and weapon upgrades during a run.
- **Zombie hordes and Red Devil bosses**, with configurable difficulty, game speed, collisions, boss spawns, friendly fire, explosion damage, and starting horde number.
- **Local co-op recovery mechanics**: stand near a downed teammate to revive them.
- **Supply crates** that replenish health or ammunition.
- **Map viewer and model studio** for inspecting arenas, spawn points, `.bbmodel` assets, bones, and animations.
- **Traditional Chinese and English UI**. Changing the language reloads the page so Canvas-rendered text and game state start in a consistent locale.
- **Browser-local persistence** for settings, control bindings, volume, and personal records.

## Game Modes

| Mode        | Description                                                             |
| ----------- | ----------------------------------------------------------------------- |
| Solo        | Survive zombie hordes alone and build the highest combo.                |
| Local Co-op | Two players share one screen, fight together, and revive one another.   |
| AI Partner  | Play solo with a configurable AI partner that can fight and revive you. |
| Deathmatch  | A local split-screen duel with all weapons available from the start.    |

## How to Play

### The core loop

1. Select a mode, character, and arena in the lobby.
2. Choose gameplay options such as difficulty, game speed, minimap visibility, and starting horde number.
3. Defeat enemies before the combo timer expires.
4. Reach combo milestones to unlock new weapons and upgrades.
5. Use walls, barrels, mines, explosives, and arena geometry to control horde paths.
6. Collect red supply crates to restore health or replenish ammunition.

The armory in the game shows every combo milestone and its unlock state.

### Default controls

All bindings can be changed in the lobby.

| Player | Move            | Fire / place equipment | Change weapon                     |
| ------ | --------------- | ---------------------- | --------------------------------- |
| P1     | `W` `A` `S` `D` | `Space` or `F`         | Number keys `1`–`0`, or `Q` / `E` |
| P2     | Arrow keys      | `/` or `Enter`         | `,` / `.`                         |

Solo players can also use the arrow keys as an alternate movement layout. The in-game HUD can switch between classic eight-direction shooting and mouse aiming.

## Technology

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Biome](https://biomejs.dev/)
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) for typed localization
- Canvas rendering for the battlefield, with React for the lobby, overlays, menus, and accessibility UI

## Project Structure

```text
src/
  components/      React lobby, modal, HUD, and battle UI components
  data/            Locale-neutral game catalogs, map loading, and model catalogs
  engine/          Combat, AI, pathfinding, world state, and Canvas rendering
  i18n/            Presentation adapters between stable game IDs and localized messages
  paraglide/       Generated Paraglide output; do not edit manually
  types/           Shared game and engine types
  utils/           Rendering, audio, storage, asset, and geometry utilities
i18n/
  messages/        zh-TW and English message catalogs
public/
  assets/          Maps, SVG effects, audio, and Blockbench model assets
```

### Localization model

Runtime game data uses stable IDs rather than display text. User-facing names, descriptions, room copy, combo labels, tips, and interface strings live in Paraglide message catalogs.
- Base locale: `en`
- Supported locales: `zh-TW`, `en`
- Locale preference: stored in browser `localStorage`
- The page title and descriptions update in the browser after a locale change.

When changing messages, regenerate the typed message functions:

```sh
pnpm i18n:compile
```

## Local Development

### Prerequisites

- Node.js compatible with the repository toolchain
- [pnpm](https://pnpm.io/)

### Install and run

```sh
pnpm install
pnpm dev
```

Vite prints the local development URL, normally `http://localhost:5173/`.

### Production preview

```sh
pnpm build
pnpm preview
```

## Quality Checks

Run the checks before opening a pull request:

```sh
pnpm i18n:compile
pnpm lint
pnpm typecheck
pnpm build
```

Format files with:

```sh
pnpm format
```

## Asset Paths and GitHub Pages

The project is deployed under the GitHub Pages repository subpath:

```text
/Brickhead/
```

Vite uses `/` in development and `/Brickhead/` for production builds. Use [`assetUrl()`](src/utils/assetUrl.ts) for runtime files in `public/assets` instead of hard-coding root-relative URLs. This keeps maps, audio, SVG effects, and model assets working in both environments.

The release workflow in [release.yml](.github/workflows/release.yml) deploys the generated `dist/` directory to GitHub Pages after Release Please creates a release from `main` or `master`.

## Persistence and Privacy

BRICKHEAD stores the following data only in the current browser:
- Gameplay settings
- Keyboard bindings
- Audio volume
- Personal best scores, survival time, combo, and arena records
- Selected locale

Clearing site data or browser storage resets these values. There is no account system and no server-side persistence.

## License

Licensed under the [Apache License 2.0](LICENSE).
