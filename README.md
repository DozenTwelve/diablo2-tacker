# 🧙 Diablo II Set Tracker

> A lightweight, shareable Diablo II: Resurrected set collection tracker — powered by static JSON + React + Tailwind CSS.

### 🌐 Live Site

- https://d2r.gardenstatevampire.space/
---

## 🧰 Features

- Track every Diablo II set, unique, runeword, and rune in one place
- Bilingual interface with a persistent CN ↔ EN toggle
- Fully static & fast — no backend needed
- LocalStorage saves progress plus import/export of tracker state
- Built with performance and simplicity in mind

---

## ⚙️ Tech Stack

- **Frontend**: React + Tailwind CSS
- **Deployment**: Netlify + Cloudflare
- **Data Source**: Custom JSON files (scraped from multiple Diablo II websites)
- **Local Folder**: `Diablo2`

---

## 🐍 Data Files

- `src/data/sets.json` — Chinese set names grouped by full set; English metadata in `src/data/sets_en.json`
- `src/data/uniques.json` — Chinese unique items grouped by slot; English references in `src/data/uniqueitems_en.json`
- `src/data/runewords.json` — Chinese runeword labels; English names in `src/data/runes_en.json`
- `src/data/runes.json` — Rune labels, with English-only display plus Chinese subtext when the CN locale is active

Each tab reads both the localized and English datasets so the UI can switch languages instantly.  
Progress, mule assignments, notes, and counters persist in `localStorage`; exports use `diablo2-tracker-save.json`.

---

## 🚀 Local Development

```bash
git clone https://github.com/YOUR_USERNAME/diablo2-set-tracker.git
cd diablo2-set-tracker
npm install
npm run dev
```

### Build & Lint

```bash
npm run lint
npm run build
```
