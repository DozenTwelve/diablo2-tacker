import { useEffect, useState } from "react";
import { imageOf, labelOf } from "../lib/gameData";
import { t } from "../lib/i18n";
import { SET_GREEN } from "./StashGrid";

// The organize page's animation: a messy save folder organized, then a farming trip and organizing again.
// Drawn on a 1600x900 board in container units, so it scales with its width (and records as a video).
const v = (n) => `${n / 16}cqw`;

// Characters: [name, level]; level 1 ones are the mules, the last tile stands for the rest of the folder
const TILES = [
  ["Blizzy", 92], ["mule1", 1], ["SoJbank", 1], ["Hammerdin", 95],
  ["stuff", 1], ["Necro", 34], ["runewords", 1], ["charms", 1],
  ["Zonnie", 88], ["old_gear", 1], ["mule2", 1], ["Druid", 21],
  ["TestMule", 1], ["zzz", 1], ["junk", 1], ["+37", null],
];
const BOXES = ["UW", "UA", "UJ", "SET", "RW", "DUP", "CHARM", "TRASH"];
// What the mules hold: [key, base code, tile it starts on, box, slot]
const LOOT = [
  ["u:Windforce", "6lw", 4, 0, 0], ["u:Titan's Revenge", "ama", 1, 0, 1], ["u:The Oculus", "oba", 13, 0, 2],
  ["u:Harlequin Crest", "uap", 9, 1, 0], ["u:Shaftstop", "xhn", 10, 1, 1], ["u:War Traveler", "xtb", 4, 1, 2],
  ["u:Arachnid Mesh", "ulc", 12, 1, 3], ["u:The Stone of Jordan", "rin", 2, 2, 0], ["u:Mara's Kaleidoscope", "amu", 1, 2, 1],
  ["u:Annihilus", "cm1", 7, 2, 2], ["u:Hellfire Torch", "cm2", 7, 2, 3], ["s:79", "uth", 9, 3, 0], ["s:76", "zmb", 14, 3, 1],
  ["s:77", "amu", 10, 3, 2], ["w:32", "xtp", 6, 4, 0], ["w:128", "uit", 6, 4, 1], ["w:61", "7s8", 12, 4, 2],
  ["u:Harlequin Crest", "uap", 13, 5, 0], ["u:The Stone of Jordan", "rin", 2, 5, 1], ["m:cm3:Magic", "cm3", 7, 6, 0],
  ["m:cm1:Magic", "cm1", 14, 6, 1], ["m:cm1:Magic", "cm1", 14, 7, 0], ["m:jew:Magic", "jew", 4, 7, 1],
];
// Found later and dropped on the inbox page: [key, base code, box, slot]
const FINDS = [["u:The Grandfather", "7gd", 0, 3], ["s:78", "oba", 3, 3], ["u:Arachnid Mesh", "ulc", 5, 2], ["m:cm1:Magic", "cm1", 7, 2]];
// Collection slots still empty: [key, base code, box, slot]
const MISSING = [
  ["u:The Grandfather", "7gd", 0, 3], ["u:Death's Web", "7gw", 0, 4], ["u:Doombringer", "7b7", 0, 5],
  ["u:Griffon's Eye", "ci3", 1, 4], ["u:Tyrael's Might", "uar", 1, 5], ["u:Highlord's Wrath", "amu", 2, 4],
  ["u:Raven Frost", "rin", 2, 5], ["s:78", "oba", 3, 3], ["s:80", "xsk", 3, 4], ["s:70", "ba5", 3, 5],
];
// [ms, step, caption]; steps: 0 before, 1 mules picked, 2 sorted, 3 empty mules deleted, 4 finds dropped, 5 sorted again
const TIMELINE = [[0, 0, 0], [2800, 1, 1], [3800, 2, 1], [6000, 2, 2], [8000, 3, 3], [10400, 4, 4], [12800, 5, 5], [15400, 5, 6]];
const LOOP = 18500;

const tileXY = (i) => [40 + (i % 4) * 168, 195 + Math.floor(i / 4) * 168];
const boxXY = (b) => [760 + (b % 4) * 204, 195 + Math.floor(b / 4) * 186];
const slotXY = (b, s) => [boxXY(b)[0] + 10 + (s % 3) * 58, boxXY(b)[1] + 52 + Math.floor(s / 3) * 58];
const inboxXY = (s) => [790 + s * 58, 700];
const COLORS = { u: "#c7b377", w: "#c7b377", s: SET_GREEN, m: "#6969ff" };

function Item({ k, code, at: [x, y], size, lang, className = "", style }) {
  return (
    <div
      className={`demo-item ${className}`}
      title={labelOf(k, lang)}
      style={{ left: v(x), top: v(y), width: v(size), height: v(size), borderColor: COLORS[k[0]], ...style }}
    >
      <img src={imageOf({ key: k, code })} alt="" draggable={false} onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
    </div>
  );
}

export default function OrganizeDemo({ lang }) {
  const [at, setAt] = useState(0); // index into TIMELINE
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const timers = TIMELINE.slice(1).map(([ms], i) => setTimeout(() => setAt(i + 1), ms));
    timers.push(setTimeout(() => (setAt(0), setCycle((c) => c + 1)), LOOP));
    return () => timers.forEach(clearTimeout);
  }, [cycle]);
  const [, step, caption] = TIMELINE[at];
  const shown = step >= 1 ? 1 : 0;
  const filled = new Map(); // tile -> items placed on it so far
  const stage = step === 0 ? 0 : step <= 3 ? 1 : 2; // which of the three steps above is on

  return (
    // key: a new cycle starts from the messy folder without animating back to it
    <div key={cycle} className="organize-demo" role="img" aria-label={t("demoCaptions", lang).join(" ")}>
      <div className="demo-steps" style={{ left: v(40), top: v(24), fontSize: v(20) }}>
        {t("demoSteps", lang).map((label, i) => (
          <span key={i} className={i === stage ? "gothic-text-gold" : "gothic-text-muted"}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      <p key={caption} className="demo-caption" style={{ left: v(40), top: v(66), width: v(1520), fontSize: v(34) }}>
        {t("demoCaptions", lang)[caption]}
      </p>

      <div className="demo-heading" style={{ left: v(40), top: v(150), fontSize: v(22) }}>
        {t("demoSaves", lang, 53)}
      </div>
      {TILES.map(([name, level], i) => {
        const [x, y] = tileXY(i);
        const mule = level === 1;
        const state = level == null ? "more" : mule ? ["", "picked", "picked", "deleted", "deleted", "deleted"][step] : step >= 1 ? "kept" : "";
        return (
          <div key={name} className={`demo-tile moving ${state}`} style={{ left: v(x), top: v(y), width: v(154), height: v(156), padding: v(10) }}>
            {level == null ? (
              <span style={{ fontSize: v(40) }}>{name}</span>
            ) : (
              <>
                <div style={{ fontSize: v(20) }}>{name}</div>
                <div className="gothic-text-muted" style={{ fontSize: v(16) }}>
                  Lv {level}
                  {state === "kept" && <span className="gothic-text-gold"> · {t("demoKept", lang)}</span>}
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="demo-heading moving" style={{ left: v(760), top: v(150), fontSize: v(22), opacity: shown }}>
        {t("demoNewMules", lang)}
      </div>
      {BOXES.map((name, b) => {
        const [x, y] = boxXY(b);
        return (
          <div key={name} className="demo-box moving" style={{ left: v(x), top: v(y), width: v(188), height: v(172), padding: v(10), opacity: shown }}>
            <span className="demo-mule" style={{ fontSize: v(24) }}>{name}</span>
            <span className="gothic-text-muted" style={{ fontSize: v(14) }}> {t("demoKinds", lang)[b]}</span>
          </div>
        );
      })}
      {BOXES.flatMap((_, b) =>
        [0, 1, 2, 3, 4, 5].map((s) => {
          const [x, y] = slotXY(b, s);
          return <div key={`${b}-${s}`} className="demo-slot moving" style={{ left: v(x), top: v(y), width: v(52), height: v(52), opacity: shown }} />;
        }),
      )}
      {MISSING.map(([k, code, b, s]) => (
        <Item key={`${b}-${s}`} k={k} code={code} at={slotXY(b, s)} size={52} lang={lang} className="moving ghost" style={{ opacity: shown * 0.22 }} />
      ))}

      <div className="demo-heading moving" style={{ left: v(760), top: v(632), fontSize: v(22), opacity: shown }}>
        {t("demoInbox", lang)}
      </div>
      <div className="demo-box moving" style={{ left: v(760), top: v(670), width: v(800), height: v(112), opacity: shown }} />

      {LOOT.map(([k, code, tile, b, s], i) => {
        const n = filled.get(tile) ?? 0;
        filled.set(tile, n + 1);
        const [tx, ty] = tileXY(tile);
        const sorted = step >= 2;
        return (
          <Item
            key={i}
            k={k}
            code={code}
            at={sorted ? slotXY(b, s) : [tx + 12 + (n % 3) * 45, ty + 58 + Math.floor(n / 3) * 45]}
            size={sorted ? 52 : 40}
            lang={lang}
            className="moving"
            style={{ transitionDelay: step === 2 ? `${i * 60}ms` : "0ms" }}
          />
        );
      })}
      {FINDS.map(([k, code, b, s], i) => (
        <Item
          key={`find-${i}`}
          k={k}
          code={code}
          at={step >= 5 ? slotXY(b, s) : inboxXY(i)}
          size={52}
          lang={lang}
          className={`moving ${step >= 5 ? "landed" : ""}`}
          style={{ opacity: step >= 4 ? 1 : 0, transform: step >= 4 ? "none" : "scale(0.3)", transitionDelay: `${i * 180}ms` }}
        />
      ))}
    </div>
  );
}
