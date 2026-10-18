// The /faq page: questions and answers as [Simplified, Traditional, English, Korean] like the UI strings,
// with an optional link after the answer. In the Steam Deck plugin, deck replaces the answer, or false hides the question.
import { REPO, SAVES_DOC, SKILL } from "./links";

export const FAQ = [
  {
    q: ["这是什么？", "這是什麼？", "What is this?", "이건 무엇인가요?"],
    a: [
      "一个看 D2R 单机收藏的网页：读取你的存档，列出每件暗金、套装、符文之语和符文在哪个角色身上、还缺哪些。这是个人做的开源项目，免费使用。",
      "一個看 D2R 單機收藏的網頁：讀取你的存檔，列出每件暗金、套裝、符文之語和符文在哪個角色身上、還缺哪些。這是個人做的開源專案，免費使用。",
      "A page for your offline D2R collection: it reads your saves and shows which character holds each unique, set item, runeword and rune, and which ones you are still missing. It's a free, open-source hobby project.",
      "D2R 오프라인 수집품을 보는 페이지입니다. 저장 파일을 읽어 고유, 세트, 룬어, 룬이 어느 캐릭터에 있는지, 무엇이 아직 없는지 보여 줍니다. 개인이 만든 무료 오픈소스 프로젝트입니다.",
    ],
  },
  {
    q: ["存档会上传吗？", "存檔會上傳嗎？", "Are my saves uploaded?", "저장 파일이 업로드되나요?"],
    a: [
      "不会。存档在你的浏览器里用 WebAssembly 解析，读到的结果只存在这个浏览器里。网站没有后端、没有账号，也不收集任何数据。",
      "不會。存檔在你的瀏覽器裡用 WebAssembly 解析，讀到的結果只存在這個瀏覽器裡。網站沒有後端、沒有帳號，也不收集任何資料。",
      "No. Saves are read in your browser with WebAssembly, and what is read stays in this browser. The site has no server side, no accounts, and collects no data.",
      "아니요. 저장 파일은 브라우저 안에서 WebAssembly로 읽고, 읽은 결과도 이 브라우저에만 남습니다. 서버, 계정, 데이터 수집이 없습니다.",
    ],
    deck: [
      "不会。插件在这台 Deck 上读存档，只提供给本机（127.0.0.1）的这个页面，不连外网，也不收集任何数据。",
      "不會。外掛在這台 Deck 上讀存檔，只提供給本機（127.0.0.1）的這個頁面，不連外網，也不收集任何資料。",
      "No. The plugin reads the saves on this Deck and serves them only to this page on the Deck itself (127.0.0.1); nothing goes online and no data is collected.",
      "아니요. 플러그인은 이 Deck의 저장 파일을 읽어 이 기기(127.0.0.1)의 이 페이지에만 보여 줍니다. 인터넷으로 보내지 않고 데이터도 수집하지 않습니다.",
    ],
  },
  {
    q: ["能读哪些存档？", "能讀哪些存檔？", "Which saves work?", "어떤 저장 파일을 읽을 수 있나요?"],
    a: [
      "PC 和 Steam Deck 上的单机（离线）角色，包括 Reign of the Warlock 资料片的存档。战网在线角色存在暴雪的服务器上，读不到；主机版也不支持。",
      "PC 和 Steam Deck 上的單機（離線）角色，包括 Reign of the Warlock 資料片的存檔。戰網線上角色存在暴雪的伺服器上，讀不到；主機版也不支援。",
      "Offline characters on PC and Steam Deck, including Reign of the Warlock saves. Online (Battle.net) characters live on Blizzard's servers and can't be read; consoles aren't supported.",
      "PC와 Steam Deck의 오프라인 캐릭터이며, Reign of the Warlock 저장 파일도 됩니다. 배틀넷 온라인 캐릭터는 블리자드 서버에 있어 읽을 수 없고, 콘솔은 지원하지 않습니다.",
    ],
  },
  {
    q: ["存档在哪？", "存檔在哪？", "Where are my saves?", "저장 파일은 어디에 있나요?"],
    a: [
      "Windows：%USERPROFILE%\\Saved Games\\Diablo II Resurrected。Steam Deck 的存档在 Proton 的文件夹里，每台的路径都不一样，步骤见说明文档。",
      "Windows：%USERPROFILE%\\Saved Games\\Diablo II Resurrected。Steam Deck 的存檔在 Proton 的資料夾裡，每台的路徑都不一樣，步驟見說明文件。",
      "Windows: %USERPROFILE%\\Saved Games\\Diablo II Resurrected. On a Steam Deck they're in a Proton folder whose path differs per Deck; the guide has the steps.",
      "Windows: %USERPROFILE%\\Saved Games\\Diablo II Resurrected. Steam Deck에서는 Proton 폴더 안에 있고 기기마다 경로가 다릅니다. 방법은 안내 문서를 보세요.",
    ],
    deck: false,
    link: SAVES_DOC,
  },
  {
    q: ["会改我的存档吗？", "會改我的存檔嗎？", "Does it change my saves?", "저장 파일을 바꾸나요?"],
    a: [
      "网页只读不写。「整理」页会把整理好的文件打包成 zip 让你下载，由你自己放回存档文件夹；放回去之前先备份。",
      "網頁只讀不寫。「整理」頁會把整理好的檔案打包成 zip 讓你下載，由你自己放回存檔資料夾；放回去之前先備份。",
      "The page only reads. The Organize page gives you the organized files as a zip download, and you copy them back into the save folder yourself; back it up first.",
      "페이지는 읽기만 합니다. 정리 페이지는 정리된 파일을 zip으로 내려받게 하고, 저장 폴더에 넣는 것은 직접 합니다. 넣기 전에 백업하세요.",
    ],
    deck: [
      "只有「整理」页会写，而且要你按「确认整理」。游戏开着时不写；写之前把整个存档文件夹备份到 Decky 的数据文件夹（backups），写完再读回来核对。其他页面只读不写。",
      "只有「整理」頁會寫，而且要你按「確認整理」。遊戲開著時不寫；寫之前把整個存檔資料夾備份到 Decky 的資料夾（backups），寫完再讀回來核對。其他頁面只讀不寫。",
      "Only the Organize page writes, and only when you confirm. It won't while the game runs; before writing it backs up the whole save folder to Decky's data folder (backups), and it reads the files back afterwards. Every other page only reads.",
      "정리 페이지만, 그것도 확인을 누를 때만 씁니다. 게임이 실행 중이면 쓰지 않고, 쓰기 전에 저장 폴더 전체를 Decky 데이터 폴더(backups)에 백업하며, 쓴 뒤 다시 읽어 확인합니다. 다른 페이지는 읽기만 합니다.",
    ],
  },
  {
    q: ["整理按什么规则？可以用自己的方式吗？", "整理按什麼規則？可以用自己的方式嗎？", "How does organizing sort things? Can I use my own way?", "정리는 어떤 규칙인가요? 내 방식으로 할 수 있나요?"],
    a: [
      "默认规则写在「整理」页上。想改规则，用 AI agent（例如 Claude Code）运行仓库里的 organize-stash skill，在里面改。",
      "預設規則寫在「整理」頁上。想改規則，用 AI agent（例如 Claude Code）執行倉庫裡的 organize-stash skill，在裡面改。",
      "The default rules are on the Organize page. To change them, run the repository's organize-stash skill with an AI agent (Claude Code, for example) and adjust it there.",
      "기본 규칙은 정리 페이지에 있습니다. 규칙을 바꾸려면 AI 에이전트(예: Claude Code)로 저장소의 organize-stash 스킬을 실행해 수정하세요.",
    ],
    link: SKILL,
  },
  {
    q: ["推荐装备是哪来的？", "推薦裝備是哪來的？", "Where does the recommended gear come from?", "추천 장비는 어디서 왔나요?"],
    a: [
      "整理自 Maxroll 的流派攻略，每个流派都附原文链接。攻略会过时，仅供参考。",
      "整理自 Maxroll 的流派攻略，每個流派都附原文連結。攻略會過時，僅供參考。",
      "From Maxroll's build guides; every build links its guide. Guides go out of date, so treat it as a suggestion.",
      "Maxroll 빌드 공략에서 가져왔고, 빌드마다 원문 링크가 있습니다. 공략은 오래될 수 있으니 참고만 하세요.",
    ],
  },
  {
    q: ["物品数据和图标呢？", "物品資料和圖示呢？", "What about the item data and icons?", "아이템 데이터와 아이콘은요?"],
    a: [
      "从游戏文件里提取。Diablo 是暴雪娱乐的商标，物品名称和图标的版权属于暴雪；本站与暴雪无关。",
      "從遊戲檔案裡提取。Diablo 是暴雪娛樂的商標，物品名稱和圖示的版權屬於暴雪；本站與暴雪無關。",
      "Extracted from the game files. Diablo is a trademark of Blizzard Entertainment, which owns the item names and icons; this site isn't affiliated with Blizzard.",
      "게임 파일에서 추출했습니다. Diablo는 블리자드 엔터테인먼트의 상표이며 아이템 이름과 아이콘의 저작권은 블리자드에 있습니다. 이 사이트는 블리자드와 관계가 없습니다.",
    ],
  },
  {
    q: ["Steam Deck 能用吗？", "Steam Deck 能用嗎？", "Does it work on a Steam Deck?", "Steam Deck에서 되나요?"],
    a: [
      "网页在 Deck 的桌面模式就能用。另外有一个 Decky Loader 插件，可以直接在游戏模式读这台 Deck 的存档，正在测试中。",
      "網頁在 Deck 的桌面模式就能用。另外有一個 Decky Loader 外掛，可以直接在遊戲模式讀這台 Deck 的存檔，正在測試中。",
      "The page works in the Deck's desktop mode. A Decky Loader plugin that reads the Deck's saves straight from game mode is being tested.",
      "페이지는 Deck의 데스크톱 모드에서 쓸 수 있습니다. 게임 모드에서 바로 저장 파일을 읽는 Decky Loader 플러그인은 테스트 중입니다.",
    ],
    deck: false,
  },
  {
    q: ["源代码在哪？网站架在哪？", "原始碼在哪？網站架在哪？", "Where is the source code, and where is the site hosted?", "소스 코드와 호스팅은요?"],
    a: [
      "源代码在 GitHub，网站部署在 Cloudflare Pages。有问题或建议，欢迎到 GitHub 开 issue。",
      "原始碼在 GitHub，網站部署在 Cloudflare Pages。有問題或建議，歡迎到 GitHub 開 issue。",
      "The source is on GitHub and the site is hosted on Cloudflare Pages. Questions and ideas are welcome as GitHub issues.",
      "소스 코드는 GitHub에 있고 사이트는 Cloudflare Pages에서 운영합니다. 질문이나 제안은 GitHub 이슈로 남겨 주세요.",
    ],
    link: REPO,
  },
];
