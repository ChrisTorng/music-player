# PLAN — 通用音樂播放器（純 TypeScript）

## 目標與範圍
- 支援多首樂曲，透過 URL 參數 `?piece=<folder-name>` 決定載入哪個資料夾的 config.json。
- 以「頁籤」切換同一樂曲內不同素材組；每組包含 1–3 部影片與多軌音訊，組內皆已同步。
- 頁籤以 Query String 切換：點擊頁籤導向新網址 `?piece=...&tab=<tab-id>`，整頁重新載入並僅初始化該頁籤；不同頁籤互不共用播放狀態（不需在同頁維持多頁籤的獨立狀態）。
- 左側：上下兩個影片播放器，影片播放規則：
  - 上下影片必須不同，或僅播放上影片，或兩個都不播放
  - 不播放的影片無法選擇其音軌作為音源（只能選擇音訊檔）
  - 單一播放按鈕控制所有已選擇的影片和音訊同步播放
- 右側：音訊「組別」選擇器與該組的多軌清單。每個音訊檔可選擇顯示「波形」與/或「頻譜」；播放中在圖上疊加目前播放位置（游標）。
- 左右聲道路由：
  - 必須選擇音訊來源（不能無音訊播放）
  - 可選擇影片音軌（僅限正在播放的影片）或任一音訊檔
  - 支援「同一音軌輸出至左右」或「左右各選不同音軌」
- 純瀏覽器、純 TS、無框架；支援 MP4 URL 與 YouTube 連結。
- 支援在波形／頻譜圖上點擊或拖曳以跳轉至指定時間，並同步所有影片與音訊。
- 每組影片支援對應之「樂譜行圖」播放：依時間切換每一行 PNG，切換時以上滑置換動畫呈現（模擬整頁往上移動）。
- 無獨立進度條；以波形/頻譜圖（PNG）點擊或拖曳進行定位與播放控制。
- 波形/頻譜可為預先產生之 PNG；若缺圖，前端會動態以 MP3 解碼後即時繪製（不落地）。
  - 視覺化圖片尺寸：波形 4000×100 px、頻譜 4000×200 px。
- 響應式版面：桌機/橫向為左右分欄；手機直向自動改為上下堆疊。

## 架構設計
- 每首樂曲有獨立資料夾（如 `Liszt-Liebesträume-No.3/`）。
- 每個資料夾包含 `config.json` 與所有媒體檔案。
- config.json 內所有路徑均為相對於該資料夾的路徑。
- URL 參數：
  - `?piece=Liszt-Liebesträume-No.3` 載入對應資料夾設定。
  - `&tab=<tab-id>` 指定啟動的頁籤；省略時使用 `defaultTab` 或第一個頁籤。

## JSON 設定範例（相對路徑）
```json
{
  "tabs": [
    {
      "id": "home",
      "title": "Home",
      "videos": [
        { "id": "v1", "type": "mp4", "url": "home/video/home.mp4", "label": "Cam A" },
        { "id": "v2", "type": "youtube", "url": "https://youtu.be/XXXX", "label": "YouTube" }
      ],
      "audioGroups": [
        {
          "id": "g1",
          "label": "Home (Group A)",
          "tracks": [
            {
              "id": "a1",
              "url": "home/audio/piano.mp3",
              "label": "Piano"
            },
            {
              "id": "a2",
              "url": "home/audio/instrumental.mp3",
              "label": "Instrumental"
            }
          ]
        }
      ],
      "score": {
        "basePath": "score",
        "entries": [
          { "file": "1-1.png", "time": 0.0 },
          { "file": "1-2.png", "time": 8.2 },
          { "file": "1-3.png", "time": 16.4 }
        ],
        "animation": { "type": "slideUp", "durationMs": 180, "easing": "ease-out" },
        "preload": { "ahead": 2 }
      },
      "defaults": {
        "topVideoId": "v1",
        "bottomVideoId": null,
        "audioGroupId": "g1",
        "routing": {
          "left": { "type": "audio", "id": "a1" },
          "right": { "type": "audio", "id": "a1" }
        }
      }
    }
  ],
  "defaultTab": "home"
}
```
- `type`: `mp4` 或 `youtube`。
- `audioGroups`: 同一頁籤下可切換的音訊組別；每組含 4–6 軌不等。
- 圖片路徑不需在 config 指定：由 mp3 路徑自動推導（`.mp3` → `.waveform.png` / `.spectrogram.png`）。若 PNG 缺失，前端動態產生。
- 視覺時間對映：嚴格依「主音訊時長」與圖片顯示寬度換算；若取不到主音訊時長，禁止播放。
- `defaults.routing.left/right`: 左右聲道來源；`{"type":"audio","id":"aX"}` 或 `{"type":"video","position":"top|bottom"}`（僅限正在播放的影片）。
- `score.entries`: 依時間排序的「樂譜行」切換點；`file` 建議遵循 `score/<page>-<system>.png` 命名。
- `score.animation`: 切換動畫；`slideUp` 表示由下往上位移置換的效果。
- `score.preload.ahead`: 預先載入未來 N 行以避免切換頓挫。

## 介面與檔案結構
- `index.html`: 頁籤列（依 JSON 產生，作為帶有 `?tab=` 的連結）、左側上下播放器、右側音軌清單＋波形/頻譜 `<img>` 容器、全域播放控制。
- `src/`
  - `main.ts`: URL 參數解析、載入對應樂曲 config.json、產生 UI、繫結事件、狀態管理。
  - `config/loader.ts`: 動態載入指定樂曲資料夾的 config.json，處理相對路徑解析。
  - `config/types.ts`: 設定檔型別（`Tab`, `VideoSource`, `AudioTrack`, `Defaults`）。
  - `video/native.ts`: 控制 `<video>`（MP4），支援 `load(url) | play() | pause() | seek(t)`。
  - `video/youtube.ts`: IFrame Player 包裝；只作畫面與時間同步（音訊獨立）。
  - `audio/engine.ts`: Web Audio 路由（左右指派、增益、靜音、合併）。
  - `visuals/waveformImage.ts`: 顯示預渲染波形 PNG，負責縮放與游標覆蓋、點擊/拖曳定位。
  - `visuals/spectrogramImage.ts`: 顯示預渲染頻譜 PNG，游標覆蓋、點擊/拖曳定位。
  - `visuals/overlay.ts`: 視覺化共用：時間軸換算、縮放、游標繪製、座標→時間映射。
  - `state/group.ts`: 音訊組別切換、軌清單更新、左右輸出選擇的狀態管理。
  - `sync/controller.ts`: 主時鐘管理器，依音源類型動態決定時鐘基準，對齊影片 `currentTime`（超閾值校正）。
  - `interact/seek.ts`: 視覺化畫布點擊/拖曳→時間換算→觸發全域 `seek(t)`，並與影片同步。
  - `score/viewer.ts`: 樂譜行載入、顯示與切換；支援預載與快取。
  - `score/anim.ts`: 上滑置換動畫（CSS/Canvas），控制時序與 easing。
  - `score/sync.ts`: 依 `score.entries` 以音訊主時鐘安排切換；支援手動 seek 後的最近段落對齊。
  - `preload/assets.ts`: 預載波形/頻譜/樂譜 PNG 與顯示進度；完成後解鎖操作。

## UI 與互動流程
- 切換頁籤 → 以 `location.href = '?piece=...&tab=...'`（保留既有參數）導向並整頁重新載入；僅初始化新頁籤並套用其 `defaults`。因此無需在單頁內同時維護多個頁籤的播放進度或狀態。
- 影片選擇規則：
  - 上下影片選擇器，可選擇不同影片或僅選上影片或兩個都不選
  - 不能選擇相同影片播放於上下兩個位置
- 音訊路由設定：
  - 右側先選「音訊組別」，再於該組清單中選擇輸出至左/右（或同軌雙聲道）
  - 左/右聲道下拉選單：提供「音訊檔清單」與「正在播放的影片音軌」
  - 必須至少選擇一個音訊來源，不能無聲播放
- 每軌提供「波形」「頻譜」兩個切換/勾選（可同時）並即時重繪。
- 播放控制：
  - 單一播放/暫停按鈕控制所有選中的影片和音訊
  - 主時鐘邏輯：音訊檔優先 > 影片音軌，左聲道優先於右聲道
- 無獨立進度列；波形/頻譜圖片為主要交互面：點擊/拖曳→時間換算→ `engine.seek(t)` → 同步影片。
- 波形/頻譜以圖片顯示，播放時以 `requestAnimationFrame` 更新游標。
- 樂譜檢視：依 `score.entries` 在指定時間切換行圖；切換時觸發上滑動畫；seek 時重算應顯示之行並立即對位。

## 同步與限制
- 主時鐘優先權：
  1. 音訊檔優先：左右任一聲道選擇音訊檔時，以音訊檔為主時鐘
  2. 影片音軌次優：左右聲道都選擇影片音軌時，以正在播放的影片為主時鐘
  3. 左聲道優先：混合音源時，音訊檔優先於影片音軌作為主時鐘
- YouTube 僅作畫面，不將其音訊接入 Web Audio；YouTube 時間同步誤差可接受範圍 ±0.5 秒。
- CORS：MP4/MP3 需允許跨網域與 `crossorigin="anonymous"`；否則解碼與畫布可能失敗。
- 自動播放政策：首次互動時 `AudioContext.resume()` 後才能播放。
- 樂譜同步以主時鐘為準；為避免抖動，切換採「預排隊列 + 閾值觸發」（例：提前 60ms 補正）。
- 影片音訊來源僅支援 MP4 `<video>`（`MediaElementAudioSourceNode`）；YouTube 因 IFrame 限制不納入音訊路由。
- 每個 `<video>` 僅能建立一個 `MediaElementAudioSourceNode`；引擎會共用此節點並以 `ChannelSplitterNode`/`GainNode` 路由至左/右。
- 視覺化為 PNG，需在載入完成後方可互動；建議顯示預載進度。
- PNG 互動增強：使用 Canvas 覆蓋層提供拖拽預覽和時間顯示。
- 響應式 PNG：支援多解析度適配，手機使用較低解析度版本。

## 里程碑（驗收）
1) 基礎架構：URL 參數解析、動態載入樂曲資料夾的 config.json、頁籤連結（`?tab=`）生成與重新載入導向。
2) 單組：MP4 播放＋播放控制（上/下其中一個）。
3) 音訊載入＋波形繪製＋游標同步（以音訊為主時鐘）。
4) 新增「音訊組別」切換與動態軌清單（4–6 軌）。
5) 左右聲道路由：同音軌雙聲道／雙音軌分左右；音量控制。
6) 頻譜視覺化（PNG 顯示）：顯示與游標同步；可與波形同時顯示。
7) 影片音訊路由（Top/Bottom Video 作為來源）。
8) 點擊/拖曳波形與頻譜（PNG）實現 seek，同步影片。
9) 樂譜行切換與上滑動畫；seek 後正確對位。
10) 響應式排版：直向改上下堆疊，橫向左右分欄。
11) YouTube 畫面支援與時間同步（音訊仍以 MP3）。
12) 錯誤處理（CORS、載入失敗）、預載進度、設定保存（`localStorage`）。

## 風險與因應
- 視覺 PNG 檔體積與數量可能較大：控制解析度、啟用 WebP/AVIF、分組預載與快取釋放策略。
- 不同來源起始延遲：加入起播前對齊與播放中週期性校正。
- 手機瀏覽器限制：提供手動解鎖音訊按鈕與較低解析度選項。
- 樂譜圖片載入延遲：預載前後行；使用解碼提示 `HTMLImageElement.decode()`；必要時降解析度或使用 WebP。
- YouTube 同步精度限制：設計可接受誤差範圍，提供手動校正機制。
- CORS 失敗處理：提供明確錯誤提示和本地文件支援建議。
- 主時鐘切換：當用戶改變音源選擇時，平滑切換時鐘基準避免播放中斷。

## 建置與開發
- 純 TS：`tsc` 輸出 ESM；不引入框架。
- 靜態伺服器（擇一）：`python -m http.server` 或 `npx http-server public`。
- 型別與 Lint（可選）：`strict: true`，ESLint（no any、no implicit any）。
