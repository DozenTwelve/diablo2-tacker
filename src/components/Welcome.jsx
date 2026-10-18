import { t } from "../lib/i18n";
import StashGrid from "./StashGrid";

// The front page before any saves are loaded: what the tracker does, the save picker, and a made-up
// inventory showing the idea (owned items lit, missing ones as dashed slots).
const DEMO = [
  ["u:Windforce", "6lw", 0, 0],
  ["u:Harlequin Crest", "uap", 2, 0],
  ["u:Griffon's Eye", "ci3", 2, 2, true],
  ["u:Tyrael's Might", "uar", 4, 0, true],
  ["u:Arachnid Mesh", "ulc", 4, 3],
  ["u:War Traveler", "xtb", 6, 0],
  ["s:65", "xmb", 6, 2, true], // Natalya's Soul
  ["u:The Stone of Jordan", "rin", 8, 0],
  ["u:Annihilus", "cm1", 8, 1, true],
  ["s:77", "amu", 8, 2], // Tal Rasha's Adjudication
  ["u:Raven Frost", "rin", 8, 3],
  ["u:Mara's Kaleidoscope", "amu", 9, 0],
  ["u:Hellfire Torch", "cm2", 9, 1],
  ["u:Highlord's Wrath", "amu", 9, 3, true],
].map(([key, code, x, y, missing]) => ({ key, code, x, y, missing, quality: key[0] === "s" ? "Set" : "Unique", count: 1, elsewhere: [] }));

export default function Welcome({ picker, lang }) {
  return (
    <div className="space-y-12">
      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] gap-x-16 gap-y-10 items-start pt-4">
        <div>
          <h1 className="page-title" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
            {t("welcomeTitle", lang)}
          </h1>
          <p className="text-lg mt-4 mb-8 max-w-xl">{t("welcomeLead", lang)}</p>
          {picker}
        </div>
        <figure>
          <StashGrid width={10} height={4} records={DEMO.filter((d) => !d.missing)} ghosts={DEMO.filter((d) => d.missing)} lang={lang} />
          <figcaption className="text-sm gothic-text-muted mt-2">{t("demoCaption", lang)}</figcaption>
        </figure>
      </section>
      <section className="max-w-4xl">
        <div className="section-head">
          <h2>{t("whatItDoes", lang)}</h2>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-12 gap-y-5">
          {t("features", lang).map(([term, text]) => (
            <div key={term}>
              <dt className="gothic-text-gold">{term}</dt>
              <dd className="text-sm mt-1">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
