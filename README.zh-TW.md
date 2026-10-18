![暗黑破壞神 II 收藏追蹤](docs/banner.jpg)

# 暗黑破壞神 II 收藏追蹤

[English](README.md)

讀取你的 D2R 存檔資料夾，一次看清整個倉庫：每件暗金、套裝、符文之語和符文在哪個角色或哪一頁倉庫、有幾件，以及還缺哪些。

**網站：[d2r.diamonddoge.org](https://d2r.diamonddoge.org)**

存檔在你的瀏覽器裡用 WebAssembly 解析，不會上傳。網站沒有後端、沒有帳號，也不收集任何資料。

## 能做什麼

- **圖鑑。** 暗金、套裝、符文之語、符文各一頁，顯示已有幾件、總共幾件，以及缺哪些。
- **搜尋。** 用四種語言的任何一種搜尋物品，不管有沒有，都能看到每一件在哪裡。
- **角色。** 每個角色的身上、背包、儲物箱、方塊和腰帶，照遊戲裡的格子畫出來，滑過去有物品說明。圖鑑騾子會畫出空位，空格就是還缺的。
- **流派配裝。** 為主力號選一個流派（共 22 個熱門流派），點裝備欄就能看到推薦裝備你有哪些、放在哪。清單整理自 [Maxroll](https://maxroll.gg/d2/category/guides) 的攻略，附原文連結，可能過時，僅供參考。
- **整理。** 按固定規則把騾子和勾選的共享倉庫頁整理進編號騾子：暗金和套裝放進固定的「圖鑑」位置，其餘依序是重複品、符文之語、咒符、珠寶、戒指和護身符、魔法物品、底材，以及可能是垃圾、留給你自己檢查的東西。網頁會核對每件物品都剛好保留一份，再把結果打包成 zip 給你下載，絕不會寫入你的存檔資料夾。
- **語言。** 繁體中文、簡體中文、英文、韓文，物品名稱用遊戲裡的官方譯名。

支援 PC 和 Steam Deck 上的單機（離線）角色，包括 Reign of the Warlock 資料片的存檔。戰網線上角色存在暴雪的伺服器上，讀不到；主機版不支援。

## 存檔在哪

- **Windows：** `%USERPROFILE%\Saved Games\Diablo II Resurrected`
- **Steam Deck：** 在遊戲的 Proton 資料夾裡，每台 Deck 的路徑都不一樣。

[docs/saves.md](docs/saves.md)（英文）寫了兩邊的詳細步驟、怎麼把存檔從 Deck 拷出來，以及整理好的存檔怎麼放回去：先退出遊戲、備份整個資料夾，再把新檔案複製進去。

## 用自己的規則整理

網頁只有一套固定的整理規則。想改規則，可以用 AI 程式助手（例如 Claude Code）執行 [organize-stash](.claude/skills/organize-stash/SKILL.md) skill。它會用 `scripts/organize.mjs` 帶你一步步來：先備份，再試跑並用白話說明結果，你同意後才寫入。

## Steam Deck 外掛（測試中）

[decky/](decky/README.md) 是一個 Decky Loader 外掛：在遊戲模式的快捷選單裡打開收藏，直接讀這台 Deck 的存檔，物品圖示從你安裝的遊戲裡提取。它也能直接在 Deck 上整理：遊戲執行中會拒絕寫入，寫入前先備份整個存檔資料夾，寫完再讀回來核對。目前還沒在真機上測試過。

## 開發

```bash
npm install
npm run dev
```

網站用 React 和 Vite。`src/lib/` 是邏輯（讀存檔、物品查詢、整理、翻譯），`src/components/` 是各個頁面。

- `wasm/` 包裝了 [d2s](https://github.com/ResurrectedTrader/d2s-rs)（MIT），用來讀寫 `.d2s` 角色和 `.d2i` 共享倉庫。編譯好的 `wasm/pkg/` 已提交，建置網站不需要 Rust。
- `src/data/*.json` 由遊戲本身的資料表和字串檔產生，從遊戲的 CASC 儲存裡提取（例如用 [casc-cli](https://github.com/ironsp4rk/casc-cli)）。原始遊戲檔案不會提交。
- 物品圖示從你自己的遊戲檔案轉成 `public/items/`，不進 git：本倉庫不含任何暴雪美術。沒有圖示時網站照樣能用，只是不顯示圖片。
- `src/data/builds.json` 是從 Maxroll 的「Gear Options」表格手動整理的。

各個指令的說明見[英文版 README](README.md#development)。[ROADMAP.md](ROADMAP.md)（英文）記錄了做過的計畫和原因。

## 授權

[GPL-3.0](LICENSE)。Diablo 和 Diablo II: Resurrected 是暴雪娛樂的商標，遊戲資料、物品名稱和美術的版權屬於暴雪。本專案與暴雪無關，也未經暴雪認可。
