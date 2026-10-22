import { useEffect, useMemo, useState } from "react";
import { codeOfNumber, labelOf } from "../lib/gameData";
import { deckBackups, deckSaveFiles, deleteDeckBackup, onDeck, restoreDeck } from "../lib/deck";
import { roleOf } from "../lib/inventory";
import { LOCALES, t } from "../lib/i18n";
import { SKILL } from "../lib/links";
import { filesOfCharacter, modeOfCharacter, modeOfStash, organizeFiles } from "../lib/organize";
import { loadParser, saveFolder, statsOf } from "../lib/parseSaves";
import { describeStats } from "../lib/stats";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import { zip } from "../lib/zip";
import OrganizeDemo from "./OrganizeDemo";
import PageTitle from "./PageTitle";

const modeLabel = (mode, lang) => {
  const [core, version] = mode.split(":");
  return t(core === "HardCore" ? "hardcore" : "softcore", lang) + ({ Legacy: t("legacyMode", lang), Classic: t("classicMode", lang) }[version] ?? "");
};
const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const isSave = (name) => /\.d2[si]$/i.test(name);
const COMPANIONS = ["ctl", "key", "ma0", "map"]; // a character's other files, copied from the template for new mules

const sameBytes = (a, b) => a?.length === b.length && a.every((x, i) => x === b[i]);

// /organize: sort the mules and the chosen inbox pages of the shared stash (src/lib/organize.js), show what
// would happen, then hand the result back. On the web: a zip download of the whole organized folder (rawFiles: the
// files as last picked, kept in memory only; picker asks for them again). On the Steam Deck: the plugin backs
// up the save folder and writes. Emptied characters no new mule reuses can be ticked for deletion: the plugin
// deletes them after the backup, the web leaves them out of the zip.
export default function OrganizeView({ rawFiles, picker, onWritten, lang }) {
  const [roles] = useStoredState("roles", {});
  const [inboxes, setInboxes] = useStoredState("inbox", {}); // mode -> page numbers
  const [files, setFiles] = useState(null); // [{ name, bytes }]: saves, and on the web their other files
  const [folder, setFolder] = useState(null); // on the web: the folder organized, as picked
  const [wasm, setWasm] = useState(null);
  const [mode, setMode] = useState(null);
  // confirm: { name, action: "restore" | "delete" }, a backup button pressed once
  const [state, setState] = useState({}); // { plan, remove, error, busy, backup, downloaded, readError, confirm, restored, restoreError }
  const [backups, setBackups] = useState([]); // the plugin's backups, on the Deck
  const [reads, setReads] = useState(0); // bumped to read the files again

  useEffect(() => {
    // Cleared, or files picked one by one: nothing to organize (the page says to pick the folder)
    const picked = !onDeck && rawFiles && saveFolder(rawFiles);
    setFolder(picked ? picked.dir : null);
    if (!onDeck && !picked) return setFiles(null);
    let current = true; // a quicker second pick must not be overwritten by this read
    const read = onDeck ? deckSaveFiles() : Promise.resolve(picked.files);
    Promise.all([read, loadParser()]).then(async ([list, parser]) => {
      const loaded = await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), time: f.lastModified })));
      if (!current) return;
      setFiles(loaded);
      setWasm(parser);
      setState((s) => ({ backup: s.backup, restored: s.restored })); // read again after writing: keep saying where the backup is
    }, (e) => current && setState({ readError: e.message ?? String(e) }));
    if (onDeck) deckBackups().then(setBackups, () => setBackups([]));
    return () => (current = false);
  }, [reads, rawFiles]);
  // The files on disk are still the ones organized: the game may have saved since (played in between), and
  // handing back the organized ones would undo that. A picked file changed on disk can't be read at all.
  const unchanged = async (now) => {
    try {
      const bytes = await Promise.all(now.map(async (f) => new Uint8Array(await f.arrayBuffer())));
      return now.length === files.length && now.every((f, i) => sameBytes(files.find((o) => o.name === f.name)?.bytes, bytes[i]));
    } catch {
      return false;
    }
  };

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
      <OrganizeDemo lang={lang} />
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
        {!onDeck && !folder && (
          <>
            <p className="text-sm mb-4">{t(rawFiles ? "needWholeFolder" : "needFolder", lang)}</p>
            {picker}
          </>
        )}
      </>
    );

  const modes = [...new Set(saves.filter((s) => s.level != null).map((s) => s.mode))].sort();
  const current = modes.includes(mode) ? mode : modes.includes("SoftCore:Modern") ? "SoftCore:Modern" : modes[0];
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
  const download = async () => {
    try {
      if (!(await unchanged(saveFolder(rawFiles).files))) return setState({ error: t("savesChangedPick", lang) });
      const { files: out } = organizeFiles(files, wasm, options);
      const names = new Set(files.map((f) => f.name));
      const changed = new Map(out.map((f) => [f.name, f]));
      const companions = out.flatMap((f) =>
        f.template
          ? COMPANIONS.flatMap((ext) => {
              const from = files.find((o) => o.name === `${f.template}.${ext}`);
              const name = `${f.name.slice(0, -4)}.${ext}`;
              return from && !names.has(name) ? [{ name, bytes: from.bytes, time: from.time }] : [];
            })
          : [],
      );
      // The whole save folder as organized, not only what changed: a zip that looks like the organized saves
      // must be them, or putting it in place of the folder loses every character left as it was
      // Every file keeps its time (D2R lists characters by it): a rewritten save its own, a new mule its template's
      const gone = new Set(removeFiles);
      const timeOf = (name) => files.find((o) => o.name === name)?.time;
      const folder = [
        ...files.map((f) => (changed.has(f.name) ? { ...changed.get(f.name), time: f.time } : f)),
        ...out.filter((f) => !names.has(f.name)).map((f) => ({ ...f, time: timeOf(`${f.template}.d2s`) })),
        ...companions,
      ];
      const url = URL.createObjectURL(new Blob([zip(folder.filter((f) => !gone.has(f.name)))], { type: "application/zip" }));
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
      if (!(await unchanged(await deckSaveFiles()))) {
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
    } finally {
      deckBackups().then(setBackups, () => {}); // a failed write can still have made the backup that leads back
    }
  };

  const restore = async (name) => {
    setState({ ...state, busy: true });
    try {
      const response = await restoreDeck(name);
      const result = await response.json();
      if (result.running) setState({ restoreError: t("gameRunning", lang) });
      else if (!response.ok) setState({ restoreError: t("restoreFailed", lang, result.error) });
      else {
        setState({ restored: { name, backup: result.backup } });
        setReads(reads + 1);
        onWritten();
      }
    } catch (e) {
      setState({ restoreError: t("restoreFailed", lang, e.message ?? e) });
    } finally {
      deckBackups().then(setBackups, () => {});
    }
  };
  const deleteBackup = async (name) => {
    setState({ ...state, busy: true });
    try {
      const response = await deleteDeckBackup(name);
      if (!response.ok) setState({ restoreError: t("deleteBackupFailed", lang, (await response.json()).error) });
      else setState({});
      setBackups(await deckBackups());
    } catch (e) {
      setState({ restoreError: t("deleteBackupFailed", lang, e.message ?? e) });
    }
  };
  // A backup's name is when it was made: in UTC with a Z (shown in local time), or local time (older plugins)
  const when = (name) => {
    const [, y, mo, d, h, mi, s, utc] = name.match(/(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)(Z?)/) ?? [];
    if (!y) return name;
    const date = utc ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s);
    return date.toLocaleString(LOCALES[lang]);
  };

  const report = state.plan?.report;
  const remove = state.remove ?? []; // characters ticked for deletion
  const removeFiles = remove.flatMap((name) => filesOfCharacter(name, files.map((f) => f.name)));
  const names = (keys) => keys.map((k) => labelOf(k, lang)).join(t("listSeparator", lang));
  const trash = report?.moves.filter((m) => m.group === "TRASH" && m.stash) ?? [];
  return (
    <>
      <PageTitle label={t("organize", lang)} />
      {about}
      <div className="max-w-3xl space-y-8">
        {state.readError && <p className="text-red-400">{t("readFailed", lang, state.readError)}</p>}
        {folder && <p className="text-sm gothic-text-muted">{t("organizingFolder", lang, folder)}</p>}
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
                {remove.length > 0 && (
                  <p className="text-sm text-red-400">
                    {t(onDeck ? "deleteOnWrite" : "deleteFromZip", lang, remove.length, remove.join(t("listSeparator", lang)))}
                  </p>
                )}
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
                      {t("putBackSteps", lang).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {onDeck && backups.length > 0 && (
          <section className="space-y-3">
            <div className="section-head">
              <h2>{t("backups", lang)}</h2>
            </div>
            <p className="text-sm">{t("backupsAbout", lang)}</p>
            {state.restoreError && <p className="text-red-400">{state.restoreError}</p>}
            {state.restored && (
              <p className="gothic-text-gold break-all">{t("restored", lang, when(state.restored.name), state.restored.backup)}</p>
            )}
            <ul className="space-y-2">
              {backups.map((b) => (
                <li key={b.name} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span>{when(b.name)}</span>
                  {b.reason && <span className="text-sm">{t(b.reason === "restore" ? "backupBeforeRestore" : "backupBeforeOrganize", lang)}</span>}
                  {b.interrupted && <span className="text-sm text-red-400">{t("backupInterrupted", lang)}</span>}
                  <span className="text-sm gothic-text-muted">{t("backupCharacters", lang, b.characters)}</span>
                  {state.confirm?.name === b.name ? (
                    <>
                      {state.confirm.action === "delete" && <span className="text-sm text-red-400">{t("deleteBackupWarn", lang)}</span>}
                      <button
                        className="gothic-btn gothic-btn-small"
                        disabled={state.busy}
                        onClick={() => (state.confirm.action === "delete" ? deleteBackup(b.name) : restore(b.name))}
                      >
                        {state.confirm.action === "delete"
                          ? t(state.busy ? "deletingBackup" : "confirmDeleteBackup", lang)
                          : t(state.busy ? "restoring" : "confirmRestore", lang)}
                      </button>
                      <button className="text-sm gothic-text-muted" disabled={state.busy} onClick={() => setState({ ...state, confirm: null })}>
                        {t("cancel", lang)}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="gothic-btn gothic-btn-secondary gothic-btn-small"
                        onClick={() => setState({ ...state, confirm: { name: b.name, action: "restore" } })}
                      >
                        {t("restore", lang)}
                      </button>
                      <button className="text-sm gothic-text-muted" onClick={() => setState({ ...state, confirm: { name: b.name, action: "delete" } })}>
                        {t("deleteBackup", lang)}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
