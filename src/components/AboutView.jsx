import { FAQ } from "../lib/faq";
import { nameOf, t } from "../lib/i18n";
import { REPO } from "../lib/links";
import { onDeck } from "../lib/deck";
import PageTitle from "./PageTitle";

const COLUMNS = ["zh", "zh_tw", "en", "ko"];
const pick = (row, lang) => nameOf(Object.fromEntries(COLUMNS.map((c, i) => [c, row[i]])), lang);

// /about: the source code, then questions on what the project is, privacy, where it lives
export default function AboutView({ lang }) {
  return (
    <>
      <PageTitle label={t("about", lang)} />
      <div className="max-w-2xl space-y-8">
        <p>
          {t("sourceCode", lang)}{t("colon", lang)}
          <a href={REPO} target="_blank" rel="noreferrer" className="gothic-text-gold break-all">
            {REPO.replace(/^https:\/\//, "")}
          </a>
        </p>
        <div className="section-head">
          <h2>{t("faq", lang)}</h2>
        </div>
        {FAQ.filter((f) => !onDeck || f.deck !== false).map(({ q, a, deck, link }, i) => (
          <section key={i}>
            <h3 className="gothic-text-gold text-lg mb-2">{pick(q, lang)}</h3>
            <p className="leading-relaxed">{pick((onDeck && deck) || a, lang)}</p>
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="text-sm gothic-text-gold break-all">
                {link.replace(/^https:\/\//, "")}
              </a>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
