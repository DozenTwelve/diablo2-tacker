# 🧙 Diablo II Set Tracker

> A lightweight, shareable Diablo II: Resurrected set collection tracker — powered by static JSON + React + Tailwind CSS.

### 🌐 Live Site

- (https://d2r.gardenstatevampire.space/)[https://d2r.gardenstatevampire.space/]
---

## 🧰 Features

- Track your Diablo II Set/Unique item collection
- Fully static & fast — no backend needed
- Automatically loads local JSON (or your own custom save)
- Built with performance and simplicity in mind

---

## ⚙️ Tech Stack

- **Frontend**: React + Tailwind CSS
- **Deployment**: Netlify + Cloudflare
- **Data Source**: Custom JSON files (scraped from multiple Diablo II websites)
- **Local Folder**: `Diablo2`

---

## 🐍 Data Gathering

Set & item data was collected using several Python scraping scripts targeting different D2R community websites.  
Because item info across sites is inconsistent and sometimes messy, a lot of normalization logic was written to generate a clean, structured dataset.

> Want to use your own custom item tracker?  
> Just replace the default JSON file (`/public/data.json`) with your own version.

---

## 🚀 Local Development

```bash
git clone https://github.com/YOUR_USERNAME/Diablo2.git
cd Diablo2
npm install
npm run dev
