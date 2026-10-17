// Quick access panel: open the tracker in Steam's browser, and pull the item icons out of the game files once.
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useEffect, useState } from "react";

type Status = { url: string; saves: number; game: boolean; icons: boolean };
const status = callable<[], Status>("status");
const extractIcons = callable<[], { count?: number; error?: string }>("extract_icons");

const zh = navigator.language.startsWith("zh");
const TEXT = {
  open: zh ? "打開收藏" : "Open collection",
  saves: (n: number) => (zh ? `找到 ${n} 個存檔` : `${n} saves found`),
  noSaves: zh ? "找不到存檔，先在這台 Deck 上玩一次 D2R 單機角色" : "No saves found; play an offline D2R character on this Deck first",
  extract: zh ? "從遊戲檔案提取物品圖標" : "Get item icons from the game files",
  again: zh ? "重新提取物品圖標（遊戲更新後）" : "Get item icons again (after a game update)",
  extracting: zh ? "提取中，約一分鐘…" : "Getting icons, about a minute…",
  noGame: zh ? "找不到 D2R 遊戲檔案，無法提取圖標" : "D2R game files not found, can't get icons",
  done: (n: number) => (zh ? `已提取 ${n} 個圖標` : `${n} icons ready`),
  failed: zh ? "提取圖標失敗" : "Getting icons failed",
};

function Content() {
  const [info, setInfo] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    status().then(setInfo);
  }, []);

  const extract = async () => {
    setBusy(true);
    const result = await extractIcons();
    setBusy(false);
    toaster.toast({ title: "D2R", body: result.error ? `${TEXT.failed}: ${result.error}` : TEXT.done(result.count ?? 0) });
    setInfo(await status());
  };

  if (!info) return null;
  return (
    <PanelSection>
      <PanelSectionRow>
        <div>{info.saves ? TEXT.saves(info.saves) : TEXT.noSaves}</div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={!info.saves}
          onClick={() => {
            Navigation.NavigateToExternalWeb(info.url);
            Navigation.CloseSideMenus();
          }}
        >
          {TEXT.open}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        {info.game ? (
          <ButtonItem layout="below" disabled={busy} onClick={extract}>
            {busy ? TEXT.extracting : info.icons ? TEXT.again : TEXT.extract}
          </ButtonItem>
        ) : (
          <div>{TEXT.noGame}</div>
        )}
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => ({
  name: "D2R Collection Tracker",
  titleView: <div className={staticClasses.Title}>D2R Collection Tracker</div>,
  content: <Content />,
  icon: (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 4 4 1.5V11c0 2.9-1.7 5.6-4 6.9-2.3-1.3-4-4-4-6.9V7.5L12 6Z" />
    </svg>
  ),
}));
