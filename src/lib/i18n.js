// Every entry in src/data has en, zh (Simplified) and zh_tw (Traditional) names.
export const LANGS = { zh_tw: "繁", zh: "简", en: "EN" };

export const nameOf = (entry, lang) => entry?.[lang] ?? entry?.en ?? "?";

// UI strings as [Simplified, Traditional, English] (COLUMNS); functions take extra arguments.
const COLUMNS = ["zh", "zh_tw", "en"];
const UI = {
  title: ["暗黑破坏神 II 收藏追踪", "暗黑破壞神 II 收藏追蹤", "Diablo II Collection Tracker"],
  search: ["搜索", "搜尋", "Search"],
  uniques: ["暗金", "暗金", "Uniques"],
  sets: ["套装", "套裝", "Sets"],
  runewords: ["符文之语", "符文之語", "Runewords"],
  runes: ["符文", "符文", "Runes"],
  gems: ["宝石", "寶石", "Gems"],
  materials: ["材料", "材料", "Materials"],
  potions: ["药水", "藥水", "Potions"],
  characters: ["角色", "角色", "Characters"],
  mainCharacters: ["主力号", "主力號", "Main characters"],
  museumMules: ["图鉴骡子", "圖鑑騾子", "Collection mules"],
  otherMules: ["其他骡子", "其他騾子", "Other mules"],
  noCharacter: ["找不到这个角色", "找不到這個角色", "No such character"],
  reloadForGrid: ["这批存档是旧版本读取的，没有格子位置，请重新选择存档。", "這批存檔是舊版本讀取的，沒有格子位置，請重新選擇存檔。", "These saves were read by an older version and have no positions; please pick the saves again."],
  itemCount: [(n) => `${n} 件`, (n) => `${n} 件`, (n) => `${n} item${n === 1 ? "" : "s"}`],
  Amazon: ["亚马逊", "亞馬遜", "Amazon"],
  Sorceress: ["法师", "魔法使", "Sorceress"],
  Necromancer: ["死灵法师", "死靈法師", "Necromancer"],
  Paladin: ["圣骑士", "聖騎士", "Paladin"],
  Barbarian: ["野蛮人", "野蠻人", "Barbarian"],
  Druid: ["德鲁伊", "德魯伊", "Druid"],
  Assassin: ["刺客", "刺客", "Assassin"],
  Warlock: ["术士", "術士", "Warlock"],
  pickFolder: ["选择存档文件夹", "選擇存檔資料夾", "Pick save folder"],
  pickFiles: ["选择存档文件", "選擇存檔檔案", "Pick save files"],
  clear: ["清除", "清除", "Clear"],
  privacy: ["存档只在你的浏览器里解析，不会上传。", "存檔只在你的瀏覽器裡解析，不會上傳。", "Saves are read in your browser and never uploaded."],
  parsing: ["解析中…", "解析中…", "Reading…"],
  noSaves: ["还没有读取存档。选择 D2R 的存档文件夹（.d2s 角色和 .d2i 共享仓库）。", "還沒有讀取存檔。選擇 D2R 的存檔資料夾（.d2s 角色和 .d2i 共享倉庫）。", "No saves loaded yet. Pick your D2R save folder (.d2s characters and .d2i shared stashes)."],
  loaded: [
    (files, items, at) => `已读取 ${files} 个存档，共 ${items} 件物品（${at}）`,
    (files, items, at) => `已讀取 ${files} 個存檔，共 ${items} 件物品（${at}）`,
    (files, items, at) => `Read ${files} saves, ${items} items (${at})`,
  ],
  searchPlaceholder: ["搜索物品，中文或英文", "搜尋物品，中文或英文", "Search items, in English or Chinese"],
  noResults: ["没有找到", "沒有找到", "Nothing found"],
  tooMany: [(n) => `结果太多，只显示前 ${n} 个`, (n) => `結果太多，只顯示前 ${n} 個`, (n) => `Too many results, showing the first ${n}`],
  missing: ["缺失", "缺失", "Missing"],
  clickForCopies: [(n) => `点击查看全部 ${n} 件`, (n) => `點擊查看全部 ${n} 件`, (n) => `Click to see all ${n}`],
  setPieces: [(n) => `（${n} 件套装）`, (n) => `（${n} 件套裝）`, (n) => `(${n} Items)`],
  fullSet: ["完整套装", "完整套裝", "Full set"],
  ownedElsewhere: ["已有，不在这个骡子：", "已有，不在這個騾子：", "Owned, not in this mule:"],
  missingOnly: ["只看缺失", "只看缺失", "Missing only"],
  ethereal: ["无形", "無形", "Ethereal"],
  sockets: [(n) => `${n}孔`, (n) => `${n}孔`, (n) => `Socketed (${n})`],
  sharedStash: ["共享仓库", "共享倉庫", "Shared stash"],
  legacyStash: ["共享仓库（资料片）", "共享倉庫（資料片）", "Shared stash (old)"],
  sharedPage: [(n) => `第${n}页`, (n) => `第${n}頁`, (n) => `Page ${n}`],
  equipped: ["身上", "身上", "Equipped"],
  inventory: ["背包", "背包", "Inventory"],
  stash: ["储物箱", "儲物箱", "Stash"],
  cube: ["赫拉迪克方块", "赫拉迪克方塊", "Horadric Cube"],
  belt: ["腰带", "腰帶", "Belt"],
  merc: ["雇佣兵", "傭兵", "Mercenary"],
  socketed: ["镶嵌中", "鑲嵌中", "Socketed"],
  advanced: ["叠放页", "疊放頁", "Stack tab"],
  Normal: ["普通", "普通", "Normal"],
  Inferior: ["劣质", "劣質", "Low Quality"],
  Superior: ["精良", "精良", "Superior"],
  Magic: ["魔法", "魔法", "Magic"],
  Rare: ["稀有", "稀有", "Rare"],
  Craft: ["手工", "手工", "Crafted"],
  Set: ["套装", "套裝", "Set"],
  Unique: ["暗金", "暗金", "Unique"],
  colon: ["：", "：", ": "],
  listSeparator: ["、", "、", ", "],
};

export const t = (key, lang, ...args) => {
  const row = UI[key];
  const s = row?.[COLUMNS.indexOf(lang)] ?? row?.[COLUMNS.indexOf("en")] ?? key;
  return typeof s === "function" ? s(...args) : s;
};
