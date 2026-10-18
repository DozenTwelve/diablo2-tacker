import { useEffect, useMemo, useState } from "react";
import { codeOfNumber, labelOf } from "../lib/gameData";
import { deckSaveFiles, onDeck } from "../lib/deck";
import { roleOf } from "../lib/inventory";
import { t } from "../lib/i18n";
import { SKILL } from "../lib/links";
import { filesOfCharacter, modeOfCharacter, modeOfStash, organizeFiles } from "../lib/organize";
import { loadParser, statsOf } from "../lib/parseSaves";
import { describeStats } from "../lib/stats";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import { zip } from "../lib/zip";
import PageTitle from "./PageTitle";

const modeLabel = (mode, lang) => {
  const [core, version] = mode.split(":");
  return t(core === "HardCore" ? "hardcore" : "softcore", lang) + (version === "Legacy" ? t("legacyMode", lang) : "");
};
const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const isSave = (name) => /\.d2[si]$/i.test(name);
const COMPANIONS = ["ctl", "key", "ma0", "map"]; // a character's other files, copied from the template for new mules

// A picked folder can include subfolders (backups...): organize the one folder holding the most saves
function saveFolder(files) {
  const dirOf = (f) => (f.webkitRelativePath || f.name).split("/").slice(0, -1).join("/");
  const counts = new Map();
  for (const f of files.filter((f) => isSave(f.name))) counts.set(dirOf(f), (counts.get(dirOf(f)) ?? 0) + 1);
  const dir = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return files.filter((f) => dirOf(f) === dir);
}

// /organize: sort the mules and the chosen inbox pages of the shared stash (src/lib/organize.js), show what
// would happen, then hand the result back. On the web: a zip download of the changed files (rawFiles: the
// files as last picked, kept in memory only; picker asks for them again). On the Steam Deck: the plugin backs
// up the save folder and writes. Emptied characters no new mule reuses can be ticked for deletion: the plugin
// deletes them after the backup, the web lists their files to delete by hand.
export default function OrganizeView({ rawFiles, picker, onWritten, lang }) {
  const [roles] = useStoredState("roles", {});
  const [inboxes, setInboxes] = useStoredState("inbox", {}); // mode -> page numbers
  const [files, setFiles] = useState(null); // [{ name, bytes }]: saves, and on the web their other files
  const [wasm, setWasm] = useState(null);
  const [mode, setMode] = useState(null);
  const [state, setState] = useState({}); // { plan, remove, error, busy, backup, downloaded, readError }
  const [reads, setReads] = useState(0); // bumped to read the files again

  useEffect(() => {
    if (!onDeck && !rawFiles) return;
    const read = onDeck ? deckSaveFiles() : Promise.resolve(saveFolder(rawFiles));
    Promise.all([read, loadParser()]).then(async ([list, parser]) => {
      setFiles(await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
      setWasm(parser);
      setState((s) => ({ backup: s.backup })); // read again after writing: keep saying where the backup is
    }, (e) => setState({ readError: e.message ?? String(e) }));
  }, [reads, rawFiles]);

  // Characters (with their mode) and shared stash pages per mode, from the files as they are now;
  // a file that doesn't parse is listed with its error (organizing then refuses to run)
  const saves = useMemo(() => {
    if (!files || !wasm) return null;
    return files
      .filter((f) => isSave(f.name))
      .map(({ name, bytes }) => {
        try {
          if (/\.d2s$/i.test(name)) {
            const json = JSON.parse(wasm.parseD2s(bytes));
            return { name: name.slice(0, -4), mode: modeOfCharacter(json), level: json.character.level };
          }
          const pages = JSON.parse(wasm.parseD2i(bytes)).flatMap((tab, i) =>
            tab.tab_type === "Normal" ? [{ page: i + 1, items: tab.items.length }] : [],
          );
          return { name: name.slice(0, -4), mode: modeOfStash(name), pages };
        } catch (e) {
          return { name, error: e.message ?? String(e) };
        }
      });
  }, [files, wasm]);

  const about = (
    <div className="max-w-3xl space-y-3 text-sm mb-8">
      <p>{t("organizeAbout", lang)}</p>
      <ul className="space-y-1 pl-4">
        <li>
          <span className="gothic-text-gold">UW UA UJ SET</span> {t("muleMuseum", lang)}
        </li>
        <li>
          <span className="gothic-text-gold">DUP RW CHARM JEWEL RING MAG BASE MISC</span> {t("muleOther", lang)}
        </li>
        <li>
          <span className="gothic-text-gold">TRASH</span> {t("muleTrash", lang)}
        </li>
      </ul>
      <p>{t("organizeKit", lang)}</p>
      {!onDeck && <p>{t("organizeWeb", lang)}</p>}
      <p className="gothic-text-muted">
        {t("organizeOwn", lang)}{" "}
        <a href={SKILL} target="_blank" rel="noreferrer" className="gothic-text-gold">
          organize-stash
        </a>
      </p>
    </div>
  );

  if (!saves)
    return (
      <>
        <PageTitle label={t("organize", lang)} />
        {about}
        {state.readError && <p className="text-red-400">{t("readFailed", lang, state.readError)}</p>}
        {!onDeck && !rawFiles && (
          <>
            <p className="text-sm mb-4">{t("needFolder", lang)}</p>
            {picker}
          </>
        )}
      </>
    );

  const modes = [...new Set(saves.filter((s) => s.level != null).map((s) => s.mode))].sort();
  const current = mode ?? (modes.includes("SoftCore:Modern") ? "SoftCore:Modern" : modes[0]);
  const pages = saves.find((s) => s.pages && s.mode === current)?.pages ?? [];
  const inbox = (inboxes[current] ?? []).filter((n) => pages.some((p) => p.page === n));
  const mules = saves.filter((s) => s.level != null && s.mode === current && roleOf(s, roles) === "mule").map((s) => s.name);
  const options = { mode: current, mules, inbox };
  const setInbox = (list) => (setInboxes({ ...inboxes, [current]: list }), setState({}));

  const preview = () => {
    try {
      setState({ plan: organizeFiles(files, wasm, options) });
    } catch (e) {
      setState({ error: t("notWritten", lang, e.message ?? e) });
    }
  };
  // Organized again from the files as read, so what is handed back is exactly what was checked
  const download = () => {
    try {
      const { files: out } = organizeFiles(files, wasm, options);
      const names = new Set(files.map((f) => f.name));
      const companions = out.flatMap((f) =>
        f.template
          ? COMPANIONS.flatMap((ext) => {
              const from = files.find((o) => o.name === `${f.template}.${ext}`);
              const name = `${f.name.slice(0, -4)}.${ext}`;
              return from && !names.has(name) ? [{ name, bytes: from.bytes }] : [];
            })
          : [],
      );
      const url = URL.createObjectURL(new Blob([zip([...out, ...companions])], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `D2R-organized-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState({ ...state, downloaded: true });
    } catch (e) {
      setState({ error: t("notWritten", lang, e.message ?? e) });
    }
  };
  const write = async () => {
    setState({ ...state, busy: true });
    try {
      // The game may have saved since the page read the files (played in between): writing would undo that
      const now = await deckSaveFiles();
      const same = await Promise.all(
        now.map(async (f) => {
          const old = files.find((o) => o.name === f.name)?.bytes;
          const bytes = new Uint8Array(await f.arrayBuffer());
          return old?.length === bytes.length && old.every((x, i) => x === bytes[i]);
        }),
      );
      if (now.length !== files.length || same.includes(false)) {
        setReads(reads + 1);
        setState({ error: t("savesChanged", lang) });
        return;
      }
      // Characters to delete are not written first; the plugin deletes them after the backup
      const out = organizeFiles(files, wasm, options).files.filter((f) => !remove.some((name) => f.name === `${name}.d2s`));
      const response = await fetch("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: out.map((f) => ({ name: f.name, template: f.template, data: toBase64(f.bytes) })),
          delete: remove,
        }),
      });
      const result = await response.json();
      if (result.running) setState({ ...state, error: t("gameRunning", lang) });
      else if (!response.ok) setState({ error: t("writeFailed", lang, result.error) });
      else {
        setState({ backup: result.backup });
        setReads(reads + 1);
        onWritten();
      }
    } catch (e) {
      setState({ error: t("writeFailed", lang, e.message ?? e) });
    }
  };

  const report = state.plan?.report;
  const remove = state.remove ?? []; // characters ticked for deletion
  const removeFiles = remove.flatMap((name) => filesOfCharacter(name, files.map((f) => f.name)));
  const steps = [...t("putBackSteps", lang)];
  if (removeFiles.length) steps.splice(3, 0, t("putBackDelete", lang, removeFiles.join(t("listSeparator", lang))));
  const names = (keys) => keys.map((k) => labelOf(k, lang)).join(t("listSeparator", lang));
  const trash = report?.moves.filter((m) => m.group === "TRASH" && m.stash) ?? [];
  return (
    <>
      <PageTitle label={t("organize", lang)} />
      {about}
      <div className="max-w-3xl space-y-8">
        {state.readError && <p className="text-red-400">{t("readFailed", lang, state.readError)}</p>}
        {saves
          .filter((s) => s.error)
          .map((s) => (
            <p key={s.name} className="text-sm text-red-400">
              {s.name}: {s.error}
            </p>
          ))}
        {modes.length > 1 && (
          <div className="segmented" role="group" aria-label={t("gameMode", lang)}>
            {modes.map((m) => (
              <button key={m} className={m === current ? "active" : ""} aria-pressed={m === current} onClick={() => (setMode(m), setState({}))}>
                {modeLabel(m, lang)}
              </button>
            ))}
          </div>
        )}
        <section>
          <div className="section-head">
            <h2>{t("inboxPages", lang)}</h2>
            <button className="text-sm gothic-text-muted" onClick={() => setInbox(pages.map((p) => p.page))}>
              {t("selectAll", lang)}
            </button>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {pages.map(({ page, items }) => (
              <label key={page} className="gothic-checkbox">
                <input
                  type="checkbox"
                  checked={inbox.includes(page)}
                  onChange={(e) => setInbox(e.target.checked ? [...inbox, page].sort((a, b) => a - b) : inbox.filter((n) => n !== page))}
                />
                <span>
                  {t("sharedPage", lang, page)} <span className="gothic-text-muted">{t("itemCount", lang, items)}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="section-head">
            <h2>{t("mules", lang)}</h2>
            <Link to="/characters" className="text-sm gothic-text-muted">
              {t("changeMules", lang)}
            </Link>
          </div>
          <p className="text-sm break-words">{t("mulesToSort", lang, mules.length, mules.join(t("listSeparator", lang)))}</p>
        </section>
        <button className="gothic-btn" disabled={!inbox.length || !mules.length} onClick={preview}>
          {t("preview", lang)}
        </button>
        {!inbox.length && <p className="text-sm gothic-text-muted">{t("pickInbox", lang)}</p>}
        {state.error && <p className="text-red-400">{state.error}</p>}
        {state.backup && <p className="gothic-text-gold break-all">{t("written", lang, state.backup)}</p>}
        {report && (
          <section className="space-y-3">
            <div className="section-head">
              <h2>{t("preview", lang)}</h2>
            </div>
            <p>{t("reportMules", lang, report.newMules.length)}</p>
            <p>
              {t("reportMuseum", lang, report.inbox.museum.length)}
              {report.inbox.museum.length > 0 && <span className="gothic-text-gold">{t("colon", lang) + names(report.inbox.museum)}</span>}
            </p>
            <p>
              {t("reportDup", lang, report.inbox.dup.length)}
              {report.inbox.dup.length > 0 && <span className="gothic-text-muted">{t("colon", lang) + names(report.inbox.dup)}</span>}
            </p>
            <p>{t("reportTrash", lang, report.inbox.trash.length)}</p>
            {trash.length > 0 && (
              <ul className="text-sm pl-4 space-y-1">
                {trash.map((m, i) => (
                  <li key={i}>
                    {labelOf(m.key, lang)}
                    <span style={{ color: "var(--color-accent-blue)" }}>
                      {t("colon", lang)}
                      {describeStats(statsOf(m.item, codeOfNumber(m.item.code)), lang).join(t("listSeparator", lang))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p>{t("reportOther", lang, report.inbox.other)}</p>
            {report.dropped.length > 0 && <p className="gothic-text-muted">{t("reportDropped", lang, report.dropped.length)}</p>}
            {report.leftEmpty.length > 0 && (
              <div className="py-2 space-y-2">
                <div className="flex items-baseline gap-4">
                  <h3 className="gothic-text-gold">{t("leftEmpty", lang)}</h3>
                  <button className="text-sm gothic-text-muted" onClick={() => setState({ ...state, remove: report.leftEmpty })}>
                    {t("selectAll", lang)}
                  </button>
                </div>
                <p className="text-sm">{t("leftEmptyAsk", lang)}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {report.leftEmpty.map((name) => (
                    <label key={name} className="gothic-checkbox">
                      <input
                        type="checkbox"
                        checked={remove.includes(name)}
                        onChange={(e) => setState({ ...state, remove: e.target.checked ? [...remove, name] : remove.filter((n) => n !== name) })}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {onDeck ? (
              <>
                <p className="text-sm gothic-text-muted pt-2">{t("writeWarning", lang)}</p>
                <button className="gothic-btn" disabled={state.busy} onClick={write}>
                  {t(state.busy ? "writing" : "confirmWrite", lang)}
                </button>
              </>
            ) : (
              <>
                <button className="gothic-btn" onClick={download}>
                  {t("download", lang)}
                </button>
                {state.downloaded && (
                  <div className="panel text-sm">
                    <h3 className="gothic-text-gold mb-2">{t("putBack", lang)}</h3>
                    <ol className="list-decimal pl-5 space-y-1">
                      {steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
