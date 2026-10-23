# Demo PaperTrade

A frontend-only demo of **PaperTrade**, a simulated crypto and stock trading platform where users trade with virtual money.

**Everything in this demo is simulated.** There is no backend, no database and no real market data. A small in-browser mock (`src/demo/`) answers every API call and drives a fake price feed that random-walks every two seconds. Assets, prices, other traders, chats and the leaderboard are fictional. Nothing is saved between page reloads.

## What you can try
- Browse markets and asset pages with price charts
- Place market and limit orders (limit orders fill when the fake price crosses them)
- Portfolio, P&L and analytics charts, CSV export
- Friends, messages, notifications and a leaderboard
- Settings: profile, deposit

Sign-in is bypassed: you are logged in as `demo`. Logging out and in again with any credentials brings you back.

Not available in the demo: two-factor auth, OAuth, avatar upload, password change, account deletion and PDF export.

## About the project
PaperTrade started as a team project at 42 / Codam by mtaranti (Marco Tarantino), rgoossen, pkhvorov and livliege. The full version has a NestJS + Prisma + PostgreSQL backend with live CoinGecko and Finnhub price feeds over WebSockets. This repository contains only its React frontend, adapted to run standalone.

## Stack
React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Recharts, lightweight-charts, i18next.

## Run locally
```bash
npm ci
npm run dev      # http://localhost:3000
npm run build
```

## Deploy
It is a static Vite app. On Vercel, import the repo and keep the defaults (framework: Vite). `vercel.json` rewrites all routes to `index.html`.
