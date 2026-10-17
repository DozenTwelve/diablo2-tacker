import { locationLines } from "../lib/inventory";

// Where every copy of one item is, e.g. "JavaZon · 儲物箱 · 無形 · 4孔 ×2".
export default function Locations({ records, lang }) {
  return (
    <ul className="text-sm gothic-text-muted">
      {locationLines(records, lang).map(({ text, count }) => (
        <li key={text}>
          {text}
          {count > 1 && <span className="gothic-text-gold"> ×{count}</span>}
        </li>
      ))}
    </ul>
  );
}
