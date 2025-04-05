import React, { useEffect, useState } from "react";
import setsData from "./data/sets.json";
import uniquesData from "./data/uniques.json";
import runewordsData from "./data/runewords.json";

export default function App() {
  const [activeTab, setActiveTab] = useState("sets");

  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem("checkedItems");
    return saved ? JSON.parse(saved) : {};
  });

  const [muleMap, setMuleMap] = useState(() => {
    const saved = localStorage.getItem("muleMap");
    return saved ? JSON.parse(saved) : {};
  });

  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem("notes");
    return saved ? JSON.parse(saved) : {};
  });

  const [runewordCounts, setRunewordCounts] = useState(() => {
    const saved = localStorage.getItem("runewordCounts");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("checkedItems", JSON.stringify(checkedItems));
    localStorage.setItem("muleMap", JSON.stringify(muleMap));
    localStorage.setItem("notes", JSON.stringify(notes));
    localStorage.setItem("runewordCounts", JSON.stringify(runewordCounts));
  }, [checkedItems, muleMap, notes, runewordCounts]);

  const handleCheck = (key) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleMuleChange = (setName, mule) => {
    setMuleMap({ ...muleMap, [setName]: mule });
  };

  const handleNoteChange = (setName, note) => {
    setNotes({ ...notes, [setName]: note });
  };

  const handleRunewordCountChange = (key, delta) => {
    setRunewordCounts((prev) => {
      const current = prev[key] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [key]: newValue };
    });
  };

  const exportData = () => {
    const data = {
      checkedItems,
      muleMap,
      notes,
      runewordCounts
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "diablo2-tracker-save.json";
    link.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target.result);
      setCheckedItems(data.checkedItems || {});
      setMuleMap(data.muleMap || {});
      setNotes(data.notes || {});
      setRunewordCounts(data.runewordCounts || {});
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    const confirmed = window.confirm("你确定要清空所有记录吗？这将无法恢复！");
    if (!confirmed) return;

    setCheckedItems({});
    setMuleMap({});
    setNotes({});
    setRunewordCounts({});
    localStorage.clear();
};

  const missingSetItems = Object.entries(setsData).flatMap(([setName, set]) =>
    set.items
      .filter((item) => !checkedItems[item.name])
      .map((item) => ({
        setName,
        itemName: item.name,
        itemNameZh: item.name_zh
      }))
  );

  const groupedUniques = uniquesData.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const missingUniques = uniquesData.filter(
    (item) => !checkedItems[`unique-${item.zh}`]
  );
  
  // 套装统计：完整拥有的套装数量
  const ownedSetsCount = Object.entries(setsData).filter(([setName, set]) =>
    set.items.every((item) => checkedItems[item.name])
  ).length;

  // 套装总数
  const totalSetsCount = Object.keys(setsData).length;

  // 暗金统计：拥有的暗金数量
  const ownedUniquesCount = uniquesData.filter(
    (item) => checkedItems[`unique-${item.zh}`]
  ).length;

  // 暗金总数
  const totalUniquesCount = uniquesData.length;

  return (
    <div 
      className="max-w-4xl mx-auto p-4 text-gray-800"    
    >
      <h1 className="text-3xl font-bold mb-4 font-gothic text-yellow-500 tracking-widest">暗黑破坏神 II 装备追踪器</h1>

      {/* 导出/导入 + 分类按钮 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
          onClick={exportData}
        >
          导出存档
        </button>
        <label className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded cursor-pointer">
          导入存档
          <input
            type="file"
            accept="application/json"
            onChange={importData}
            className="hidden"
          />
        </label>
      {/* 清空按钮 */}
        <button
          className="bg-gray-800 hover:bg-red-700 text-white px-4 py-2 rounded"
          onClick={clearAllData}
        >
        清空所有记录
        </button>
        <div className="flex gap-2 ml-auto">
          <button
            className={`px-3 py-1 rounded ${
              activeTab === "sets" ? "bg-green-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setActiveTab("sets")}
          >
            套装
          </button>
          <button
            className={`px-3 py-1 rounded ${
              activeTab === "uniques" ? "bg-yellow-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setActiveTab("uniques")}
          >
            暗金
          </button>
          <button
            className={`px-3 py-1 rounded ${
              activeTab === "runewords" ? "bg-red-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setActiveTab("runewords")}
          >
            符文之语
          </button>
        </div>
      </div>

      {/* 套装视图 */}
      {activeTab === "sets" && (
        <div className="space-y-6">
          <div className="text-lg font-semibold text-green-500 dark:text-green-500">
            套装收集：{ownedSetsCount} / {totalSetsCount}
          </div>
          {Object.entries(setsData).map(([setName, set]) => (
            <div key={setName} className="border rounded-lg shadow p-4 bg-white">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-lg">
                  {set.chinese_name} <span className="text-gray-500">({setName})</span>
                </div>
                <select
                  className="border p-1 text-sm rounded"
                  value={muleMap[setName] || ""}
                  onChange={(e) => handleMuleChange(setName, e.target.value)}
                >
                  <option value="">选择骡子</option>
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={`Mule${i + 1}`}>
                      Mule{i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {set.items.map((item) => (
                  <label key={item.name} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!checkedItems[item.name]}
                      onChange={() => handleCheck(item.name)}
                    />
                    <span>
                      {item.name_zh} ({item.name})
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                className="w-full border rounded p-2 text-sm"
                placeholder="备注..."
                value={notes[setName] || ""}
                onChange={(e) => handleNoteChange(setName, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* 暗金视图 */}
      {activeTab === "uniques" && (
        <div className="space-y-6">
          <div className="text-lg font-semibold text-yellow-500 dark:text-yellow-500">
            暗金收集：{ownedUniquesCount} / {totalUniquesCount}
          </div>
          {Object.entries(groupedUniques).map(([category, items]) => {
            const ownedCount = items.filter((item) => checkedItems[`unique-${item.zh}`]).length;
            return (
              <div key={category} className="border rounded-lg shadow p-4 bg-white">
                <h2 className="text-lg font-semibold mb-2 text-gray-700">
                  {category}（{ownedCount} / {items.length}）
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => (
                    <label key={item.zh} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[`unique-${item.zh}`]}
                        onChange={() => handleCheck(`unique-${item.zh}`)}
                      />
                      <span>{item.zh} ({item.en})</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 符文之语视图 */}
       {activeTab === "runewords" && (
  <div className="space-y-6">
    <div className="text-lg font-semibold text-red-500 dark:text-red-500">
      符文之语：{
        Object.entries(runewordsData).filter(([en]) => runewordCounts[en] > 0).length
      } / {Object.keys(runewordsData).length}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {Object.entries(runewordsData).map(([en, { 中文名 }]) => (
        <div
          key={en}
          className="rounded-xl border border-gray-200 p-4 shadow bg-white flex flex-col justify-between hover:shadow-md transition"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={!!runewordCounts[en]}
                onChange={() =>
                  handleRunewordCountChange(en, runewordCounts[en] ? -runewordCounts[en] : 1)
                }
              />
              <span className="font-semibold">{中文名}</span>
            </label>
            <span className="text-sm text-gray-500">{en}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-lg leading-none"
              onClick={() => handleRunewordCountChange(en, -1)}
            >
              −
            </button>
            <span className="w-6 text-center font-mono">{runewordCounts[en] || 0}</span>
            <button
              className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-lg leading-none"
              onClick={() => handleRunewordCountChange(en, 1)}
            >
              ＋
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* 缺失列表 */}
      {activeTab === "sets" && missingSetItems.length > 0 && (
        <div className="mt-10 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <h2 className="text-lg font-semibold mb-2">缺失部件：</h2>
          <ul className="list-disc list-inside text-sm">
            {missingSetItems.map((item, idx) => (
              <li key={idx}>
                {item.setName} - {item.itemNameZh} ({item.itemName})
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "uniques" && missingUniques.length > 0 && (
        <div className="mt-10 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <h2 className="text-lg font-semibold mb-2">未拥有的暗金：</h2>
          <ul className="list-disc list-inside text-sm">
            {missingUniques.map((item, idx) => (
              <li key={idx}>
                {item.zh} ({item.en})
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "runewords" && (
        <div className="mt-10 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <h2 className="text-lg font-semibold mb-2">未拥有的符文之语：</h2>
          <ul className="list-disc list-inside text-sm">
            {Object.entries(runewordsData)
              .filter(([en]) => !(runewordCounts[en] > 0))
              .map(([en, { 中文名 }], idx) => (
                <li key={idx}>
                  {中文名} ({en})
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
