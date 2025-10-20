import { useEffect, useState, useMemo } from "react";
import setsData from "./data/sets.json";
import setsDataEn from "./data/sets_en.json";
import uniquesData from "./data/uniques.json";
import uniqueItemsEnData from "./data/uniqueitems_en.json";
import runewordsData from "./data/runewords.json";
import runewordsDataEn from "./data/runes_en.json";
import runesData from "./data/runes.json";

const UNIQUE_CATEGORY_TRANSLATIONS = {
  頭盔: "Helms",
  護甲: "Armor",
  盾牌: "Shields",
  腰帶: "Belts",
  鞋子: "Boots",
  手套: "Gloves",
  戒指: "Rings",
  護身符: "Amulets",
  咒符: "Charms",
  珠寶: "Jewels",
  刀劍: "Swords",
  匕首: "Daggers",
  斧: "Axes",
  長柄武器: "Polearms",
  長矛: "Spears",
  短棒: "Clubs",
  釘鎚: "Maces",
  重槌: "Mauls",
  權杖: "Scepters",
  法杖: "Staves",
  法珠: "Orbs",
  魔杖: "Wands",
  拳刃: "Claws",
  弓: "Bows",
  弩: "Crossbows",
  標槍: "Javelins",
  投擲武器: "Throwing Weapons"
};

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

  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("language");
    return saved === "cn" ? "cn" : "en";
  });

  useEffect(() => {
    localStorage.setItem("checkedItems", JSON.stringify(checkedItems));
    localStorage.setItem("muleMap", JSON.stringify(muleMap));
    localStorage.setItem("notes", JSON.stringify(notes));
    localStorage.setItem("runewordCounts", JSON.stringify(runewordCounts));
    localStorage.setItem("runeCounts", JSON.stringify(runeCounts));
    localStorage.setItem("language", language);
  }, [checkedItems, muleMap, notes, runewordCounts, runeCounts, language]);

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
      language === "cn"
        ? "确认导出存档？\n\n文件将默认保存到下载文件夹。\n文件名：diablo2-tracker-save.json"
        : "Export your save?\n\nThe file will be saved to your Downloads folder by default.\nFilename: diablo2-tracker-save.json"
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
      } catch {
        alert(language === "cn" ? "导入失败：文件格式不正确！" : "Import failed: invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const reloadConfiguration = () => {
    if (!lastImportedConfig) {
      alert(language === "cn" ? "没有已保存的配置可以恢复！" : "No saved configuration to restore!");
      return;
    }
    const confirmed = window.confirm(
      language === "cn" ? "确认要恢复上次导入的配置吗？" : "Restore the last imported configuration?"
    );
    if (!confirmed) return;
    
    setCheckedItems(lastImportedConfig.checkedItems || {});
    setMuleMap(lastImportedConfig.muleMap || {});
    setNotes(lastImportedConfig.notes || {});
    setRunewordCounts(lastImportedConfig.runewordCounts || {});
    setRuneCounts(lastImportedConfig.runeCounts || {});
  };

  const clearAllData = () => {
    const confirmed = window.confirm(
      language === "cn"
        ? "你确定要清空所有记录吗？这将无法恢复！"
        : "Clear all records? This cannot be undone!"
    );
    if (!confirmed) return;

    setCheckedItems({});
    setMuleMap({});
    setNotes({});
    setRunewordCounts({});
    setRuneCounts({});
    localStorage.clear();
    localStorage.setItem("language", language);
  };

  const invertSelection = () => {
    const confirmed = window.confirm(
      language === "cn"
        ? "确认要反转当前页面的选择吗？"
        : "Invert all selections on this tab?"
    );
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

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "cn" ? "en" : "cn"));
  };

  // Memoize expensive calculations
  const { missingSetItems, ownedSetsCount, totalSetsCount } = useMemo(() => {
    const items = Object.entries(setsData).flatMap(([setName, set]) =>
      set.items
        .filter((item) => !checkedItems[item.name])
        .map((item) => ({
          setName,
          setNameZh: set.chinese_name,
          itemName: item.name,
          itemNameZh: item.name_zh
        }))
    );
    const owned = Object.entries(setsData).filter(([, set]) =>
      set.items.every((item) => checkedItems[item.name])
    ).length;
    return {
      missingSetItems: items,
      ownedSetsCount: owned,
      totalSetsCount: Object.keys(setsData).length
    };
  }, [checkedItems]);

  const { groupedUniques, missingUniques, ownedUniquesCount, totalUniquesCount } = useMemo(() => {
    const grouped = uniquesData.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});
    const missing = uniquesData.filter((item) => !checkedItems[`unique-${item.zh}`]);
    const owned = uniquesData.filter((item) => checkedItems[`unique-${item.zh}`]).length;
    return {
      groupedUniques: grouped,
      missingUniques: missing,
      ownedUniquesCount: owned,
      totalUniquesCount: uniquesData.length
    };
  }, [checkedItems]);

  // Memoize Mule options to avoid recreating on every render
  const MULE_OPTIONS = useMemo(() => [...Array(10)].map((_, i) => i + 1), []);

  const isChinese = language === "cn";
  const setEnglishNameMap = useMemo(() => {
    return Object.entries(setsDataEn).reduce((acc, [setKey, value]) => {
      acc[setKey] = value?.name || setKey;
      return acc;
    }, {});
  }, []);
  const uniqueEnglishNameMap = useMemo(() => {
    return Object.values(uniqueItemsEnData).reduce((acc, item) => {
      if (item?.index) {
        acc[item.index] = item.index;
      }
      return acc;
    }, {});
  }, []);
  const runewordEnglishNameMap = useMemo(() => {
    return Object.entries(runewordsDataEn).reduce((acc, [key, value]) => {
      acc[key] = value?.["*Rune Name"] || key;
      return acc;
    }, {});
  }, []);

  return (
    <div className="gothic-container">
      <div className="gothic-header">
        <h1>{isChinese ? "暗黑破坏神 II 装备追踪器" : "Diablo II Equipment Tracker"}</h1>
        <p className="gothic-text-muted">
          {isChinese ? "Diablo II Equipment Tracker" : "暗黑破坏神 II 装备追踪器"}
        </p>
      </div>

      {/* Control Buttons - Row 1 */}
      <div className="flex flex-wrap gap-4 mb-2 items-center">
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={exportData}
        >
          {isChinese ? "导出存档" : "Export Save"}
        </button>
        <label className="gothic-btn gothic-btn-secondary gothic-btn-small" style={{ cursor: 'pointer', margin: 0 }}>
          {isChinese ? "导入存档" : "Import Save"}
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
          {isChinese ? "清空所有记录" : "Clear All Records"}
        </button>
        <div className="flex gap-2 ml-auto">
          <button
            className={`gothic-tab-btn ${activeTab === "sets" ? "active" : ""}`}
            onClick={() => setActiveTab("sets")}
          >
            {isChinese ? "套装" : "Sets"}
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "uniques" ? "active" : ""}`}
            onClick={() => setActiveTab("uniques")}
          >
            {isChinese ? "暗金" : "Uniques"}
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "runewords" ? "active" : ""}`}
            onClick={() => setActiveTab("runewords")}
          >
            {isChinese ? "符文之语" : "Runewords"}
          </button>
          <button
            className={`gothic-tab-btn ${activeTab === "runes" ? "active" : ""}`}
            onClick={() => setActiveTab("runes")}
          >
            {isChinese ? "符文" : "Runes"}
          </button>
        </div>
      </div>

      {/* Control Buttons - Row 2 */}
      <div className="flex gap-4 mb-6">
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={invertSelection}
          title={isChinese ? "反转当前页面的选择" : "Invert selection on this tab"}
        >
          {isChinese ? "反转选择" : "Invert Selection"}
        </button>
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={reloadConfiguration}
          title={isChinese ? "恢复上次导入的配置" : "Restore the last imported configuration"}
        >
          {isChinese ? "恢复配置" : "Restore Configuration"}
        </button>
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={toggleLanguage}
          title={isChinese ? "切换界面语言" : "Toggle interface language"}
        >
          {isChinese ? "EN" : "CN"}
        </button>
      </div>

      {/* Sets View */}
      {activeTab === "sets" && (
        <div className="space-y-6">
          <div className="gothic-stat">
            {isChinese
              ? `套装收集：${ownedSetsCount} / ${totalSetsCount}`
              : `Sets collected: ${ownedSetsCount} / ${totalSetsCount}`}
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
              <div className="flex justify-between items-start mb-4 gap-4">
                <div className="flex-1">
                  <h3 className="gothic-text-gold">
                    {isChinese ? set.chinese_name : setEnglishNameMap[setName] || setName}
                  </h3>
                  {isChinese && (
                    <p className="gothic-text-muted text-sm">({setName})</p>
                  )}
                </div>
                <select
                  className="gothic-select gothic-select-compact"
                  value={muleMap[setName] || ""}
                  onChange={(e) => handleMuleChange(setName, e.target.value)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <option value="">{isChinese ? "选择" : "Select"}</option>
                  {MULE_OPTIONS.map((i) => (
                    <option key={i} value={`Mule${i}`}>
                      Mule{i}
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
                      {isChinese ? item.name_zh : item.name}
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                className="gothic-textarea"
                placeholder={isChinese ? "备注..." : "Notes..."}
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
            {isChinese
              ? `暗金收集：${ownedUniquesCount} / ${totalUniquesCount}`
              : `Uniques collected: ${ownedUniquesCount} / ${totalUniquesCount}`}
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
                  {isChinese ? category : UNIQUE_CATEGORY_TRANSLATIONS[category] || category}
                  <span className="gothic-text-muted" style={{ marginLeft: '1rem' }}>(
                    {ownedCount} / {items.length})</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {items.map((item) => (
                    <label key={item.zh} className="gothic-checkbox">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[`unique-${item.zh}`]}
                        onChange={() => handleCheck(`unique-${item.zh}`)}
                      />
                      <span className="gothic-text-primary">
                        {isChinese
                          ? item.zh
                          : uniqueEnglishNameMap[item.en] || item.en}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Runewords View */}
      {activeTab === "runewords" && (() => {
        const totalRunewords = Object.keys(runewordsData).length;
        const ownedRunewords = Object.entries(runewordsData).filter(([en]) => runewordCounts[en] > 0).length;
        const progressPercent = totalRunewords > 0 ? (ownedRunewords / totalRunewords) * 100 : 0;
        return (
          <div className="space-y-6">
            <div className="gothic-stat">
              {isChinese
                ? `符文之语：${ownedRunewords} / ${totalRunewords}`
                : `Runewords tracked: ${ownedRunewords} / ${totalRunewords}`}
            </div>
            <div className="gothic-progress-container">
              <div
                className="gothic-progress-bar"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="gothic-progress-label">
                {Math.round(progressPercent)}%
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
                      <span className="gothic-item-name">
                        {isChinese ? 中文名 : runewordEnglishNameMap[en] || en}
                      </span>
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
        );
      })()}

      {/* Runes View */}
      {activeTab === "runes" && (() => {
        const totalRunes = Object.keys(runesData).length;
        const ownedRunes = Object.entries(runesData).filter(([rune]) => runeCounts[rune] > 0).length;
        const progressPercent = totalRunes > 0 ? (ownedRunes / totalRunes) * 100 : 0;
        return (
          <div className="space-y-6">
            <div className="gothic-stat">
              {isChinese
                ? `符文收集：${ownedRunes} / ${totalRunes}`
                : `Runes tracked: ${ownedRunes} / ${totalRunes}`}
            </div>
            <div className="gothic-progress-container">
              <div
                className="gothic-progress-bar"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="gothic-progress-label">
                {Math.round(progressPercent)}%
              </div>
            </div>
            <div className="gothic-grid gothic-grid-4">
              {Object.entries(runesData).map(([rune, { chinese_name }]) => (
                <div key={rune} className="gothic-item-card">
                  <div
                    className="gothic-item-header"
                    style={{ marginBottom: isChinese ? "0.25rem" : "1rem" }}
                  >
                    <label className="gothic-checkbox" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={!!runeCounts[rune]}
                        onChange={() =>
                          handleRuneCountChange(rune, runeCounts[rune] ? 0 : 1)
                        }
                      />
                      <span className="gothic-item-name">{rune}</span>
                    </label>
                  </div>
                  {isChinese && (
                    <p className="gothic-item-code" style={{ marginBottom: '1rem' }}>
                      {chinese_name}
                    </p>
                  )}
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
        );
      })()}

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
            <span>
              {isChinese
                ? `缺失部件：${missingSetItems.length} 个`
                : `Missing set pieces: ${missingSetItems.length}`}
            </span>
            <span className="text-lg">{expandMissing["sets"] ? "▼" : "▶"}</span>
          </button>
          <div className={`gothic-collapse-content ${expandMissing["sets"] ? "open" : ""}`}>
            <ul>
              {missingSetItems.map((item, idx) => (
                <li key={idx}>
                  <strong>
                    {isChinese
                      ? item.setNameZh
                      : setEnglishNameMap[item.setName] || item.setName}
                  </strong>{" "}
                  →{" "}
                  {isChinese ? item.itemNameZh : item.itemName}
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
            <span>
              {isChinese
                ? `未拥有的暗金：${missingUniques.length} 个`
                : `Missing uniques: ${missingUniques.length}`}
            </span>
            <span className="text-lg">{expandMissing["uniques"] ? "▼" : "▶"}</span>
          </button>
          <div className={`gothic-collapse-content ${expandMissing["uniques"] ? "open" : ""}`}>
            <ul>
              {missingUniques.map((item, idx) => (
                <li key={idx}>
                  {isChinese
                    ? item.zh
                    : uniqueEnglishNameMap[item.en] || item.en}
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
                  <span>
                    {isChinese
                      ? `未拥有的符文之语：${missingRunewords.length} 个`
                      : `Missing runewords: ${missingRunewords.length}`}
                  </span>
                  <span className="text-lg">{expandMissing["runewords"] ? "▼" : "▶"}</span>
                </button>
                <div className={`gothic-collapse-content ${expandMissing["runewords"] ? "open" : ""}`}>
                  <ul>
                    {missingRunewords.map(([runewordKey, { 中文名 }], idx) => (
                      <li key={idx}>
                        {isChinese
                          ? 中文名
                          : runewordEnglishNameMap[runewordKey] || runewordKey}
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
                  <span>
                    {isChinese
                      ? `未拥有的符文：${missingRunes.length} 个`
                      : `Missing runes: ${missingRunes.length}`}
                  </span>
                  <span className="text-lg">{expandMissing["runes"] ? "▼" : "▶"}</span>
                </button>
                <div className={`gothic-collapse-content ${expandMissing["runes"] ? "open" : ""}`}>
                  <ul>
                    {missingRunes.map(([runeKey, { chinese_name }], idx) => (
                      <li key={idx}>
                        {isChinese ? chinese_name : runeKey}
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
