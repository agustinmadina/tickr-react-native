# Tickr React Native

**A crypto portfolio tracker built from scratch in React Native and Expo. Android, iOS and the web, from one TypeScript codebase.**

![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS%20%7C%20Web-5B8DEF)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![React%20Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020)

A sample project: a portfolio tracker with live prices, streamed from Coinbase over a WebSocket,
and the same three targets from a single codebase.

The interesting part of this repository is not the feature set, it is the architecture. Clean
architecture, one dependency rule, and the same UI running on a phone and in a browser. The
decisions worth defending are written down next to the code that makes them.

---

## What is actually shared

React Native shares the business logic by default and the UI by convention, and this project leans
into both.

| | Android | iOS | Web |
|---|---|---|---|
| Business logic and networking | shared | shared | shared |
| Screens, charts and animations | shared | shared | shared |
| Platform-specific code | Expo entry | same Expo entry | same Expo entry |

There is no `MainActivity`, no `ContentView.swift` and no `index.html` per platform. Expo Router
resolves the same route tree on all three, and the storage adapter is the only file that knows which
platform it is on.

## Architecture

Clean architecture, with the same dependency rule as the Kotlin project, enforced by tooling rather
than by convention. `ui` never imports `data`, `domain` imports nothing but the standard library,
and `core/` holds no business types.

```
packages/
  core/
    common/     backoff, deferred, clock. No platform, no business types.
    domain/     UseCase, FlowUseCase, Result. The base classes.
    network/    fetch wrapper, socket wrapper, reconnecting feed.
    storage/    KeyValueStore and JsonStore behind one interface.
    ui/         theme, tokens, formatters, Skia components.
  features/
    portfolio/
      domain/   models, repository interfaces, computePortfolio. Pure.
      data/     Coinbase repositories, DTOs, Zod schemas, mappers.
      ui/       screens, Zustand store, UI models.
      di/       the composition root.
apps/
  mobile/       Expo app: Expo Router routes, storage adapter, providers.
```

```mermaid
graph TD
    subgraph entry["Expo entry, one tree for all three targets"]
        ROUTER["app/<br/>Expo Router"]
    end

    MOBILE["apps/mobile<br/>providers + storage adapter"]

    subgraph feature["feature-portfolio"]
        UI["ui<br/>screens, Zustand store"]
        DOMAIN["domain<br/>models, computePortfolio<br/>zero frameworks"]
        DATA["data<br/>repositories, DTOs, Zod"]
        DI["di<br/>composition root"]
    end

    subgraph core["core, domain-agnostic"]
        COREUI["core/ui"]
        CORENET["core/network"]
        CORESTORE["core/storage"]
        COREDOMAIN["core/domain"]
    end

    ROUTER --> MOBILE
    MOBILE --> UI
    MOBILE --> DI

    UI --> DOMAIN
    DATA --> DOMAIN
    DI --> UI
    DI --> DATA
    DI --> DOMAIN

    UI --> COREUI
    DATA --> CORENET
    DATA --> CORESTORE
    DOMAIN --> COREDOMAIN

    UI -. "no dependency:<br/>a screen cannot reach<br/>an implementation" .-> DATA

    linkStyle 14 stroke:#F2555A,stroke-dasharray:4 4
```

The dashed line is the one that matters. npm workspaces do not enforce it on their own, so the
guarantee is built with `eslint-plugin-boundaries` and a violation fails `npm run lint`. It is
enforceable, not free.

A few decisions worth the click if you are reviewing this technically:

- **`domain` has no framework dependencies at all.** No Zustand, no Zod, no fetch, no React. It is
  plain TypeScript, which is what makes `computePortfolio` testable without a DOM or a mock.
- **The composition root is a function, not a container.** [`createAppStore`](packages/features/portfolio/di/src/index.ts:40)
  takes its dependencies as arguments and returns the store. That is the whole of the DI layer, and
  it is why there is no container to keep in step.
- **Merging streams happens in the store, never in a component.** The portfolio is holdings and
  prices combined; doing that in a screen is how screens grow until nobody can say where a value
  came from. Components read one pre-merged value.
- **Navigation is the file tree, not a library.** The destination is a route under `app/`, so the
  same tree resolves on the phone and in the browser without a second navigation graph.

## The API layer, both halves of it

| | Endpoint | Why |
|---|---|---|
| **WebSocket** | `wss://ws-feed.exchange.coinbase.com` | Live prices, pushed. No polling, so no rate limit to manage |
| **REST** | `api.exchange.coinbase.com/products` | The catalogue of assets you can actually add |

Both are public: no API key, no account, nothing to hide in a secret. That is deliberate, and it is
what makes the web build possible at all, since a browser has no server to keep a key behind. The
Coinbase endpoints are CORS-open by design, so the browser build calls the exchange directly.

You can only add assets the exchange actually quotes, chosen from the catalogue. Typing a symbol by
hand would let you add something that never receives a price and sits blank for ever.

## Stack

| Concern | Choice |
|---|---|
| UI | React Native, Expo |
| Async | `AsyncIterable` and `AbortController`, no stream library |
| Networking | `fetch` and the `WebSocket` API, both platform-provided |
| Validation | Zod, at the DTO boundary |
| State | Zustand, read through selectors |
| Charts | `@shopify/react-native-skia`, one Canvas for all three targets |
| Animation | Reanimated worklets, with a hand-rolled formatter for the UI thread |
| Persistence | react-native-mmkv on native, its localStorage shim on web |
| DI | functions, constructor injection |
| Tests | Vitest |
| Build | npm workspaces, Turborepo, Expo Router |

React Native 0.81.5, React 19.1.0, Expo SDK 54, on the New Architecture, Hermes and Fabric.

## How the three targets are kept honest

The interesting problems in this project are the ones you only meet when the UI is shared too:

- **Recomposition is automatic; re-rendering is not.** Compose tracks which state each composable
  read and recomposes only those. React has no such tracking, and prices arrive several times a
  second, so a component that reads the whole store re-renders several times a second.
  [`usePortfolio`](packages/features/portfolio/ui/src/store/usePortfolio.ts:26) forces every read
  through a selector that returns a primitive or a stable reference. It is the difference between a
  list that scrolls and a list that stutters.
- **Worklets cannot use `Intl`.** Reanimated runs animations in a separate JavaScript context with
  no `Intl`, so currency formatting has to be hand-rolled inside the worklet.
  [`AnimatedAmount.tsx`](packages/core/ui/src/component/AnimatedAmount.tsx) carries a
  `formatWorklet` for exactly this reason, and it is invisible until the animation renders `NaN`.
- **One storage seam, two engines.** MMKV does not exist in a browser, so the storage adapter picks
  MMKV on native and falls back to `localStorage` on web. The web path does not import MMKV at all,
  which is what keeps the native module out of the bundle.
- **One pointer abstraction for finger and mouse.** The chart is scrubbable with a finger on a phone
  and with a hovering cursor in a browser, from a single Skia component.
- **The web bundle is compiled, not shipped.** `expo export` produces a static site, and the same
  code that runs on the phone hydrates in the browser.

## Three behaviours that look like bugs and are not

Three behaviours in the price feed look like mistakes and are not. They are kept, with comments
explaining why, because "fixing" them silently changes behaviour the app depends on.

1. **The failure counter resets on the first message, not on connect.** A socket that connects and
   then immediately drops would otherwise reset the backoff every time and reconnect in a tight loop.
2. **A clean close is treated as a disconnect.** Coinbase closes the socket cleanly on some errors.
   Treating a clean close as "done" would end the feed silently.
3. **A dropped feed is logged, not surfaced.** The UI keeps the last known prices and shows a stale
   indicator rather than an error. A price that is a minute old is more useful than an empty screen.

## Quality gates

```shell
npm run typecheck     # tsc across every package
npm run lint          # includes the architecture boundaries
npm test              # vitest
```

**26 specs** covering the parts where being wrong is expensive and invisible: money arithmetic with
an unpriced holding, a zero cost basis, recovering yesterday's price from a percentage,
resubscribing the feed when holdings change, persistence surviving a restart, and the chart range
maths.

## Who built this

**Agustin Madina**, mobile engineer. Ten years shipping apps, from solo-founder MVPs to products
with fifty engineers and millions of users.

Products for **Disney**, **NewsCorp**, **WWE**, **MarketWatch** and **Deloitte**. The last five
years in wallets, payments and decentralized identity: multi-chain transaction signing for Bitcoin,
XRP and Solana, debit card and ACH flows, and a refactor of a production wallet from RxJava to
Coroutines and from views to Compose without pausing delivery.

This is a sample project: a small product, a real architecture, in the stack most teams already
have, and an honest account of what that costs. The decisions I would defend in a review are
written down next to the code that makes them, including the ones where the trade-off is real.

- [LinkedIn](https://www.linkedin.com/in/agustin-madina/)
- [github.com/agustinmadina](https://github.com/agustinmadina)
- agustinmadina@gmail.com

## Running it

```shell
npm install

npm run typecheck     # tsc across every package
npm run lint          # includes the architecture boundaries
npm test              # vitest

npm run mobile        # Expo dev server
npm run web           # the web build, which is the reason this exists
```

For a static export of the web target:

```shell
npx expo export --platform web --output-dir dist-web
```

## Status

The portfolio persists across restarts on all three platforms, so what you add stays added.

**Not SQLDelight and not a database.** A portfolio is a handful of rows read and written whole, so a
serialised document in each platform's own store is proportionate: MMKV on native, `localStorage` on
web, behind one adapter. MMKV is synchronous, so the read on startup does not flash an empty state.

## What is not here

- **No component tests.** The pure logic is tested; the screens are not. The screens are mostly
  layout, and the layout is verified by looking at it.
- **No E2E.**
- **No CI.** The web build is not deployed on every push to `main`, yet.
