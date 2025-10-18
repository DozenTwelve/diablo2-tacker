import { useEffect, useState } from "react";
import setsData from "./data/sets.json";
import uniquesData from "./data/uniques.json";
import runewordsData from "./data/runewords.json";
import runesData from "./data/runes.json";

export default function App() {
  const [activeTab, setActiveTab] = useState("sets");
  const [expandMissing, setExpandMissing] = useState({});

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

  const [runeCounts, setRuneCounts] = useState(() => {
    const saved = localStorage.getItem("runeCounts");
    return saved ? JSON.parse(saved) : {};
  });

  const [lastImportedConfig, setLastImportedConfig] = useState(() => {
    const saved = localStorage.getItem("lastImportedConfig");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem("checkedItems", JSON.stringify(checkedItems));
    localStorage.setItem("muleMap", JSON.stringify(muleMap));
    localStorage.setItem("notes", JSON.stringify(notes));
    localStorage.setItem("runewordCounts", JSON.stringify(runewordCounts));
    localStorage.setItem("runeCounts", JSON.stringify(runeCounts));
  }, [checkedItems, muleMap, notes, runewordCounts, runeCounts]);

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

  const toggleMissingSection = (section) => {
    setExpandMissing((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const exportData = () => {
    const confirmed = window.confirm(
      "确认导出存档？\n\n文件将默认保存到下载文件夹。\n文件名：diablo2-tracker-save.json"
    );
    if (!confirmed) return;

    const data = {
      checkedItems,
      muleMap,
      notes,
      runewordCounts,
      runeCounts
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
      try {
        const data = JSON.parse(event.target.result);
        setCheckedItems(data.checkedItems || {});
        setMuleMap(data.muleMap || {});
        setNotes(data.notes || {});
        setRunewordCounts(data.runewordCounts || {});
        setRuneCounts(data.runeCounts || {});
        setLastImportedConfig(data);
        localStorage.setItem("lastImportedConfig", JSON.stringify(data));
      } catch (error) {
        alert("导入失败：文件格式不正确！");
        console.error("Failed to parse import data:", error);
      }
    };
    reader.readAsText(file);
  };

  const reloadConfiguration = () => {
    if (!lastImportedConfig) {
      alert("没有已保存的配置可以恢复！");
      return;
    }
    const confirmed = window.confirm("确认要恢复上次导入的配置吗？");
    if (!confirmed) return;
    
    setCheckedItems(lastImportedConfig.checkedItems || {});
    setMuleMap(lastImportedConfig.muleMap || {});
    setNotes(lastImportedConfig.notes || {});
    setRunewordCounts(lastImportedConfig.runewordCounts || {});
    setRuneCounts(lastImportedConfig.runeCounts || {});
  };

  const clearAllData = () => {
    const confirmed = window.confirm("你确定要清空所有记录吗？这将无法恢复！");
    if (!confirmed) return;

    setCheckedItems({});
    setMuleMap({});
    setNotes({});
    setRunewordCounts({});
    setRuneCounts({});
    localStorage.clear();
  };

  const invertSelection = () => {
    const confirmed = window.confirm("确认要反转当前页面的选择吗？");
    if (!confirmed) return;

    if (activeTab === "sets") {
      // For sets tab: invert all item checkboxes
      const newChecked = { ...checkedItems };
      Object.entries(setsData).forEach(([, set]) => {
        set.items.forEach((item) => {
          newChecked[item.name] = !newChecked[item.name];
        });
      });
      setCheckedItems(newChecked);
    } else if (activeTab === "uniques") {
      // For uniques tab: invert all unique item checkboxes
      const newChecked = { ...checkedItems };
      uniquesData.forEach((item) => {
        const key = `unique-${item.zh}`;
        newChecked[key] = !newChecked[key];
      });
      setCheckedItems(newChecked);
    } else if (activeTab === "runewords") {
      // For runewords: invert quantities (0 ↔ 1)
      const newCounts = { ...runewordCounts };
      Object.keys(runewordsData).forEach((en) => {
        const current = newCounts[en] || 0;
        newCounts[en] = current > 0 ? 0 : 1;
      });
      setRunewordCounts(newCounts);
    } else if (activeTab === "runes") {
      // For runes: invert quantities (0 ↔ 1)
      const newCounts = { ...runeCounts };
      Object.keys(runesData).forEach((rune) => {
        const current = newCounts[rune] || 0;
        newCounts[rune] = current > 0 ? 0 : 1;
      });
      setRuneCounts(newCounts);
    }
  };

  const handleRunewordCountChange = (key, newValue) => {
    setRunewordCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, newValue)
    }));
  };

  const handleRuneCountChange = (rune, newValue) => {
    setRuneCounts((prev) => ({
      ...prev,
      [rune]: Math.max(0, newValue)
    }));
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
  const ownedSetsCount = Object.entries(setsData).filter(([, set]) =>
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
    <div className="gothic-container">
      <div className="gothic-header">
        <h1>暗黑破坏神 II 装备追踪器</h1>
        <p className="gothic-text-muted">Diablo II Equipment Tracker</p>
      </div>

      {/* Control Buttons - Row 1 */}
      <div className="flex flex-wrap gap-4 mb-2 items-center">
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={exportData}
        >
          导出存档
        </button>
        <label className="gothic-btn gothic-btn-secondary gothic-btn-small" style={{ cursor: 'pointer', margin: 0 }}>
          导入存档
          <input
            type="file"
            accept="application/json"
            onChange={importData}
            className="gothic-hidden"
          />
        </label>
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={clearAllData}
        >
          清空所有记录
        </button>
        <div className="flex gap-2 ml-auto">
          <button
            className={`gothic-tab-btn ${activeTab === "sets" ? "active" : ""}`}
            onClick={() => setActiveTab("sets")}
          >
            套装
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "uniques" ? "active" : ""}`}
            onClick={() => setActiveTab("uniques")}
          >
            暗金
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "runewords" ? "active" : ""}`}
            onClick={() => setActiveTab("runewords")}
          >
            符文之语
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "runes" ? "active" : ""}`}
            onClick={() => setActiveTab("runes")}
          >
            符文
          </button>
        </div>
      </div>

      {/* Control Buttons - Row 2 */}
      <div className="flex gap-4 mb-6">
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={invertSelection}
          title="反转当前页面的选择"
        >
          反转选择
        </button>
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={reloadConfiguration}
          title="恢复上次导入的配置"
        >
          恢复配置
        </button>
      </div>

      {/* Sets View */}
      {activeTab === "sets" && (
        <div className="space-y-6">
          <div className="gothic-stat">
            套装收集：{ownedSetsCount} / {totalSetsCount}
          </div>
          <div className="gothic-progress-container">
            <div
              className="gothic-progress-bar"
              style={{ width: `${totalSetsCount > 0 ? (ownedSetsCount / totalSetsCount) * 100 : 0}%` }}
            />
            <div className="gothic-progress-label">
              {totalSetsCount > 0 ? Math.round((ownedSetsCount / totalSetsCount) * 100) : 0}%
            </div>
          </div>
          {Object.entries(setsData).map(([setName, set]) => (
            <div key={setName} className="gothic-card">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="gothic-text-gold">{set.chinese_name}</h3>
                  <p className="gothic-text-muted text-sm">({setName})</p>
                </div>
                <select
                  className="gothic-select"
                  value={muleMap[setName] || ""}
                  onChange={(e) => handleMuleChange(setName, e.target.value)}
                >
                  <option value="">选择骤子</option>
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={`Mule${i + 1}`}>
                      Mule{i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {set.items.map((item) => (
                  <label key={item.name} className="gothic-checkbox">
                    <input
                      type="checkbox"
                      checked={!!checkedItems[item.name]}
                      onChange={() => handleCheck(item.name)}
                    />
                    <span className="gothic-text-primary">
                      {item.name_zh}
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                className="gothic-textarea"
                placeholder="备注..."
                value={notes[setName] || ""}
                onChange={(e) => handleNoteChange(setName, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Uniques View */}
      {activeTab === "uniques" && (
        <div className="space-y-6">
          <div className="gothic-stat">
            暗金收集：{ownedUniquesCount} / {totalUniquesCount}
          </div>
          <div className="gothic-progress-container">
            <div
              className="gothic-progress-bar"
              style={{ width: `${totalUniquesCount > 0 ? (ownedUniquesCount / totalUniquesCount) * 100 : 0}%` }}
            />
            <div className="gothic-progress-label">
              {totalUniquesCount > 0 ? Math.round((ownedUniquesCount / totalUniquesCount) * 100) : 0}%
            </div>
          </div>
          {Object.entries(groupedUniques).map(([category, items]) => {
            const ownedCount = items.filter((item) => checkedItems[`unique-${item.zh}`]).length;
            return (
              <div key={category} className="gothic-card">
                <h3 className="gothic-text-gold mb-4">
                  {category}
                  <span className="gothic-text-muted" style={{ marginLeft: '1rem' }}>(
                    {ownedCount} / {items.length})</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item) => (
                    <label key={item.zh} className="gothic-checkbox">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[`unique-${item.zh}`]}
                        onChange={() => handleCheck(`unique-${item.zh}`)}
                      />
                      <span className="gothic-text-primary">{item.zh}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Runewords View */}
      {activeTab === "runewords" && (
        <div className="space-y-6">
          <div className="gothic-stat">
            符文之语：{
              Object.entries(runewordsData).filter(([en]) => runewordCounts[en] > 0).length
            } / {Object.keys(runewordsData).length}
          </div>
          <div className="gothic-progress-container">
            <div
              className="gothic-progress-bar"
              style={{ width: `${Object.keys(runewordsData).length > 0 ? (Object.entries(runewordsData).filter(([en]) => runewordCounts[en] > 0).length / Object.keys(runewordsData).length) * 100 : 0}%` }}
            />
            <div className="gothic-progress-label">
              {Object.keys(runewordsData).length > 0 ? Math.round((Object.entries(runewordsData).filter(([en]) => runewordCounts[en] > 0).length / Object.keys(runewordsData).length) * 100) : 0}%
            </div>
          </div>
          <div className="gothic-grid gothic-grid-3">
            {Object.entries(runewordsData).map(([en, { 中文名 }]) => (
              <div key={en} className="gothic-item-card">
                <div className="gothic-item-header">
                  <label className="gothic-checkbox" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!runewordCounts[en]}
                      onChange={() =>
                        handleRunewordCountChange(en, runewordCounts[en] ? 0 : 1)
                      }
                    />
                    <span className="gothic-item-name">{中文名}</span>
                  </label>
                </div>
                <p className="gothic-item-code" style={{ marginBottom: '1rem' }}>{en}</p>
                <div className="gothic-item-counter">
                  <button
                    className="gothic-counter-btn"
                    onClick={() => handleRunewordCountChange(en, Math.max(0, (runewordCounts[en] || 0) - 1))
                    }
                  >
                    －
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={runewordCounts[en] || 0}
                    onChange={(e) => handleRunewordCountChange(en, parseInt(e.target.value) || 0)}
                    style={{
                      width: '2.5rem',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      color: 'var(--color-gold)',
                      background: 'rgba(60, 60, 60, 0.8)',
                      border: '1px solid var(--color-border-metal)',
                      borderRadius: '4px',
                      padding: '0.25rem'
                    }}
                  />
                  <button
                    className="gothic-counter-btn"
                    onClick={() => handleRunewordCountChange(en, (runewordCounts[en] || 0) + 1)}
                  >
                    ＋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Runes View */}
      {activeTab === "runes" && (
        <div className="space-y-6">
          <div className="gothic-stat">
            符文收集：{
              Object.entries(runesData).filter(([rune]) => runeCounts[rune] > 0).length
            } / {Object.keys(runesData).length}
          </div>
          <div className="gothic-progress-container">
            <div
              className="gothic-progress-bar"
              style={{ width: `${Object.keys(runesData).length > 0 ? (Object.entries(runesData).filter(([rune]) => runeCounts[rune] > 0).length / Object.keys(runesData).length) * 100 : 0}%` }}
            />
            <div className="gothic-progress-label">
              {Object.keys(runesData).length > 0 ? Math.round((Object.entries(runesData).filter(([rune]) => runeCounts[rune] > 0).length / Object.keys(runesData).length) * 100) : 0}%
            </div>
          </div>
          <div className="gothic-grid gothic-grid-4">
            {Object.entries(runesData).map(([rune, { chinese_name }]) => (
              <div key={rune} className="gothic-item-card">
                <div className="gothic-item-header">
                  <label className="gothic-checkbox" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!runeCounts[rune]}
                      onChange={() =>
                        handleRuneCountChange(rune, runeCounts[rune] ? 0 : 1)
                      }
                    />
                    <span className="gothic-item-name">{chinese_name}</span>
                  </label>
                </div>
                <p className="gothic-item-code" style={{ marginBottom: '1rem' }}>{rune}</p>
                <div className="gothic-item-counter">
                  <button
                    className="gothic-counter-btn"
                    onClick={() => handleRuneCountChange(rune, Math.max(0, (runeCounts[rune] || 0) - 1))}
                  >
                    －
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={runeCounts[rune] || 0}
                    onChange={(e) => handleRuneCountChange(rune, parseInt(e.target.value) || 0)}
                    style={{
                      width: '2.5rem',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      color: 'var(--color-gold)',
                      background: 'rgba(60, 60, 60, 0.8)',
                      border: '1px solid var(--color-border-metal)',
                      borderRadius: '4px',
                      padding: '0.25rem'
                    }}
                  />
                  <button
                    className="gothic-counter-btn"
                    onClick={() => handleRuneCountChange(rune, (runeCounts[rune] || 0) + 1)}
                  >
                    ＋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Items Sections */}
      {activeTab === "sets" && missingSetItems.length > 0 && (
        <div className="gothic-divider" />
      )}
      {activeTab === "sets" && missingSetItems.length > 0 && (
        <div>
          <button
            className="gothic-collapse-btn"
            onClick={() => toggleMissingSection("sets")}
          >
            <span>缺失部件：{missingSetItems.length} 个</span>
            <span className="text-lg">{expandMissing["sets"] ? "▼" : "▶"}</span>
          </button>
          <div className={`gothic-collapse-content ${expandMissing["sets"] ? "open" : ""}`}>
            <ul>
              {missingSetItems.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.setName}</strong> → {item.itemNameZh}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "uniques" && missingUniques.length > 0 && (
        <div className="gothic-divider" />
      )}
      {activeTab === "uniques" && missingUniques.length > 0 && (
        <div>
          <button
            className="gothic-collapse-btn"
            onClick={() => toggleMissingSection("uniques")}
          >
            <span>未拥有的暗金：{missingUniques.length} 个</span>
            <span className="text-lg">{expandMissing["uniques"] ? "▼" : "▶"}</span>
          </button>
          <div className={`gothic-collapse-content ${expandMissing["uniques"] ? "open" : ""}`}>
            <ul>
              {missingUniques.map((item, idx) => (
                <li key={idx}>
                  {item.zh}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "runewords" && (() => {
        const missingRunewords = Object.entries(runewordsData).filter(([runewordKey]) => !(runewordCounts[runewordKey] > 0));
        return (
          missingRunewords && missingRunewords.length > 0 && (
            <>
              <div className="gothic-divider" />
              <div>
                <button
                  className="gothic-collapse-btn"
                  onClick={() => toggleMissingSection("runewords")}
                >
                  <span>未拥有的符文之语：{missingRunewords.length} 个</span>
                  <span className="text-lg">{expandMissing["runewords"] ? "▼" : "▶"}</span>
                </button>
                <div className={`gothic-collapse-content ${expandMissing["runewords"] ? "open" : ""}`}>
                  <ul>
                    {missingRunewords.map(([, { 中文名 }], idx) => (
                      <li key={idx}>
                        {中文名}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )
        );
      })()}

      {activeTab === "runes" && (() => {
        const missingRunes = Object.entries(runesData).filter(([runeKey]) => !(runeCounts[runeKey] > 0));
        return (
          missingRunes && missingRunes.length > 0 && (
            <>
              <div className="gothic-divider" />
              <div>
                <button
                  className="gothic-collapse-btn"
                  onClick={() => toggleMissingSection("runes")}
                >
                  <span>未拥有的符文：{missingRunes.length} 个</span>
                  <span className="text-lg">{expandMissing["runes"] ? "▼" : "▶"}</span>
                </button>
                <div className={`gothic-collapse-content ${expandMissing["runes"] ? "open" : ""}`}>
                  <ul>
                    {missingRunes.map(([, { chinese_name }], idx) => (
                      <li key={idx}>
                        {chinese_name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )
        );
      })()}
    </div>
  );
}
