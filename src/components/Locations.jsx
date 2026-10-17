import { locationLines } from "../lib/inventory";

// Where every copy of one item is, e.g. "JavaZon · 儲物箱 · 無形 · 4孔 ×2", with its stats.
export default function Locations({ records, lang }) {
  return (
    <ul className="text-sm space-y-2 mt-2">
      {locationLines(records, lang).map(({ text, stats, count }) => (
        <li key={[text, ...stats].join("\n")}>
          <span className="gothic-text-muted">{text}</span>
          {count > 1 && <span className="gothic-text-gold"> ×{count}</span>}
          {stats.map((line, i) => (
            <div key={i} className="pl-4" style={{ color: "var(--color-accent-blue)" }}>
              {line}
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
