import { FAQ } from "../lib/faq";
import { nameOf, t } from "../lib/i18n";
import PageTitle from "./PageTitle";

const COLUMNS = ["zh", "zh_tw", "en", "ko"];
const pick = (row, lang) => nameOf(Object.fromEntries(COLUMNS.map((c, i) => [c, row[i]])), lang);

// /faq: what the project is, privacy, where it lives
export default function Faq({ lang }) {
  return (
    <>
      <PageTitle label={t("faq", lang)} />
      <div className="max-w-2xl space-y-8">
        {FAQ.map(({ q, a, link }, i) => (
          <section key={i}>
            <h2 className="gothic-text-gold text-lg mb-2">{pick(q, lang)}</h2>
            <p className="leading-relaxed">{pick(a, lang)}</p>
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
