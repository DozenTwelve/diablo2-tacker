// Every entry in src/data has en, zh (Simplified) and zh_tw (Traditional) names.
export const LANGS = { zh_tw: "繁", zh: "简" };

export const nameOf = (entry, lang) => entry?.[lang] ?? entry?.en ?? "?";

// UI strings as [Simplified, Traditional]; functions take extra arguments.
const UI = {
  title: ["暗黑破坏神 II 收藏追踪", "暗黑破壞神 II 收藏追蹤"],
  search: ["搜索", "搜尋"],
  uniques: ["暗金", "暗金"],
  sets: ["套装", "套裝"],
  runewords: ["符文之语", "符文之語"],
  runes: ["符文", "符文"],
  gems: ["宝石", "寶石"],
  materials: ["材料", "材料"],
  potions: ["药水", "藥水"],
  characters: ["角色", "角色"],
  mainCharacters: ["主力号", "主力號"],
  museumMules: ["图鉴骡子", "圖鑑騾子"],
  otherMules: ["其他骡子", "其他騾子"],
  noCharacter: ["找不到这个角色", "找不到這個角色"],
  reloadForGrid: ["这批存档是旧版本读取的，没有格子位置，请重新选择存档。", "這批存檔是舊版本讀取的，沒有格子位置，請重新選擇存檔。"],
  itemCount: [(n) => `${n} 件`, (n) => `${n} 件`],
  Amazon: ["亚马逊", "亞馬遜"],
  Sorceress: ["法师", "魔法使"],
  Necromancer: ["死灵法师", "死靈法師"],
  Paladin: ["圣骑士", "聖騎士"],
  Barbarian: ["野蛮人", "野蠻人"],
  Druid: ["德鲁伊", "德魯伊"],
  Assassin: ["刺客", "刺客"],
  Warlock: ["术士", "術士"],
  pickFolder: ["选择存档文件夹", "選擇存檔資料夾"],
  pickFiles: ["选择存档文件", "選擇存檔檔案"],
  clear: ["清除", "清除"],
  privacy: ["存档只在你的浏览器里解析，不会上传。", "存檔只在你的瀏覽器裡解析，不會上傳。"],
  parsing: ["解析中…", "解析中…"],
  noSaves: ["还没有读取存档。选择 D2R 的存档文件夹（.d2s 角色和 .d2i 共享仓库）。", "還沒有讀取存檔。選擇 D2R 的存檔資料夾（.d2s 角色和 .d2i 共享倉庫）。"],
  loaded: [
    (files, items, at) => `已读取 ${files} 个存档，共 ${items} 件物品（${at}）`,
    (files, items, at) => `已讀取 ${files} 個存檔，共 ${items} 件物品（${at}）`,
  ],
  searchPlaceholder: ["搜索物品，中文或英文", "搜尋物品，中文或英文"],
  noResults: ["没有找到", "沒有找到"],
  tooMany: [(n) => `结果太多，只显示前 ${n} 个`, (n) => `結果太多，只顯示前 ${n} 個`],
  missing: ["缺失", "缺失"],
  ownedElsewhere: ["已有，不在这个骡子：", "已有，不在這個騾子："],
  missingOnly: ["只看缺失", "只看缺失"],
  ethereal: ["无形", "無形"],
  sockets: [(n) => `${n}孔`, (n) => `${n}孔`],
  sharedStash: ["共享仓库", "共享倉庫"],
  legacyStash: ["共享仓库（资料片）", "共享倉庫（資料片）"],
  sharedPage: [(n) => `第${n}页`, (n) => `第${n}頁`],
  equipped: ["身上", "身上"],
  inventory: ["背包", "背包"],
  stash: ["储物箱", "儲物箱"],
  cube: ["赫拉迪克方块", "赫拉迪克方塊"],
  belt: ["腰带", "腰帶"],
  merc: ["雇佣兵", "傭兵"],
  socketed: ["镶嵌中", "鑲嵌中"],
  advanced: ["叠放页", "疊放頁"],
  Normal: ["普通", "普通"],
  Inferior: ["劣质", "劣質"],
  Superior: ["精良", "精良"],
  Magic: ["魔法", "魔法"],
  Rare: ["稀有", "稀有"],
  Craft: ["手工", "手工"],
  Set: ["套装", "套裝"],
  Unique: ["暗金", "暗金"],
};

export const t = (key, lang, ...args) => {
  const s = UI[key]?.[lang === "zh" ? 0 : 1] ?? key;
  return typeof s === "function" ? s(...args) : s;
};
