# PLAN — 分頁多影片與多軌音訊播放器（純 TypeScript）

## 目標與範圍
- 以「頁籤」切換不同素材組；每組包含 1–3 部影片與多軌音訊，組內皆已同步。
- 左側：上下兩個影片播放器，使用者可為上/下各自從該組影片清單中選擇來源（可同源或不同）。
- 右側：音訊「組別」選擇器與該組的多軌清單。每個音訊檔可選擇顯示「波形」與/或「頻譜」；播放中在圖上疊加目前播放位置（游標）。
- 支援「同一音軌輸出至左右」或「左右各選不同音軌」。
- 純瀏覽器、純 TS、無框架；支援 MP4 URL 與 YouTube 連結。
- 支援在波形／頻譜圖上點擊或拖曳以跳轉至指定時間，並同步所有影片與音訊。
- 每組影片支援對應之「樂譜行圖」播放：依時間切換每一行 PNG，切換時以上滑置換動畫呈現（模擬整頁往上移動）。
- 左/右聲道可獨立指定來源：影片音訊或任一音訊（或同一音訊雙聲道）。
- 無獨立進度條；以波形/頻譜圖（PNG）點擊或拖曳進行定位與播放控制。
- 波形、頻譜、樂譜皆為預先產生之 PNG；播放前預載完成後再開始互動。
- 響應式版面：桌機/橫向為左右分欄；手機直向自動改為上下堆疊。

## JSON 設定（可動態增減頁籤/音訊組別/樂譜/內容）
```json
{
  "tabs": [
    {
      "id": "home",
      "title": "Home",
      "videos": [
        { "id": "v1", "type": "mp4", "url": "https://example.com/home.mp4", "label": "Cam A" },
        { "id": "v2", "type": "youtube", "url": "https://youtu.be/XXXX", "label": "YouTube" }
      ],
      "audioGroups": [
        {
          "id": "g1",
          "label": "Home (Group A)",
          "tracks": [
            {
              "id": "a1",
              "url": "https://example.com/piano.mp3",
              "label": "Piano",
              "images": {
                "waveform": "media/home/audio/piano_wave.png",
                "spectrogram": "media/home/audio/piano_spec.png",
                "pxPerSecond": 100
              }
            },
            {
              "id": "a2",
              "url": "https://example.com/instrumental.mp3",
              "label": "Instrumental",
              "images": {
                "waveform": "media/home/audio/inst_wave.png",
                "spectrogram": "media/home/audio/inst_spec.png",
                "pxPerSecond": 100
              }
            }
          ]
        },
        {
          "id": "g2",
          "label": "Home (Group B)",
          "tracks": [
            {
              "id": "a3",
              "url": "https://example.com/mix1.mp3",
              "label": "Mix 1",
              "images": {
                "waveform": "media/home/audio/mix1_wave.png",
                "spectrogram": "media/home/audio/mix1_spec.png",
                "pxPerSecond": 100
              }
            }
          ]
        }
      ],
      "score": {
        "basePath": "media/score",
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
        },
        "clockSource": "left"
      },
      "preload": { "images": true }
    }
  ]
}
```
- `type`: `mp4` 或 `youtube`。
- `audioGroups`: 同一頁籤下可切換的音訊組別；每組含 4–6 軌不等。
- `tracks[].images.waveform/spectrogram`: 對應音軌的預渲染 PNG 路徑；可只提供其一。
- `tracks[].images.pxPerSecond`: 圖像時間對映比例；若缺省，則以音軌 duration 與實際渲染寬度推算。
- `defaults.routing.left/right`: 左右聲道來源；`{"type":"audio","id":"aX"}` 或 `{"type":"video","position":"top|bottom"}`。
- `defaults.clockSource`: 主時鐘來源，`left` 或 `right`（預設用左聲道）。
- `score.entries`: 依時間排序的「樂譜行」切換點；`file` 建議遵循 `media/score/<page>-<system>.png` 命名。
- `score.animation`: 切換動畫；`slideUp` 表示由下往上位移置換的效果。
- `score.preload.ahead`: 預先載入未來 N 行以避免切換頓挫。

## 介面與檔案結構
- `public/index.html`: 頁籤列（依 JSON 產生）、左側上下播放器、右側音軌清單＋波形/頻譜 `<img>` 容器、全域播放控制。
- `src/`
  - `main.ts`: 載入 JSON、產生 UI、繫結事件、狀態管理。
  - `config/types.ts`: 設定檔型別（`Tab`, `VideoSource`, `AudioTrack`, `Defaults`）。
  - `video/native.ts`: 控制 `<video>`（MP4），支援 `load(url) | play() | pause() | seek(t)`。
  - `video/youtube.ts`: IFrame Player 包裝；只作畫面與時間同步（音訊獨立）。
  - `audio/engine.ts`: Web Audio 路由（左右指派、增益、靜音、合併）。
  - `visuals/waveformImage.ts`: 顯示預渲染波形 PNG，負責縮放與游標覆蓋、點擊/拖曳定位。
  - `visuals/spectrogramImage.ts`: 顯示預渲染頻譜 PNG，游標覆蓋、點擊/拖曳定位。
  - `visuals/overlay.ts`: 視覺化共用：時間軸換算、縮放、游標繪製、座標→時間映射。
  - `state/group.ts`: 音訊組別切換、軌清單更新、左右輸出選擇的狀態管理。
  - `sync/controller.ts`: 主時鐘（以音訊為主），對齊影片 `currentTime`（超閾值校正）。
  - `interact/seek.ts`: 視覺化畫布點擊/拖曳→時間換算→觸發全域 `seek(t)`，並與影片同步。
  - `score/viewer.ts`: 樂譜行載入、顯示與切換；支援預載與快取。
  - `score/anim.ts`: 上滑置換動畫（CSS/Canvas），控制時序與 easing。
  - `score/sync.ts`: 依 `score.entries` 以音訊主時鐘安排切換；支援手動 seek 後的最近段落對齊。
  - `preload/assets.ts`: 預載波形/頻譜/樂譜 PNG 與顯示進度；完成後解鎖操作。

## UI 與互動流程
- 切換頁籤 → 卸載前一組、載入新組預設 `defaults`。
- 上/下播放器各自選取影片來源；右側先選「音訊組別」，再於該組清單中選擇輸出至左/右（或同軌雙聲道）。
- 每軌提供「波形」「頻譜」兩個切換/勾選（可同時）並即時重繪；預設值取自 `defaults.visuals` 或軌道 `visuals`。
 - 無獨立進度列；波形/頻譜圖片為主要交互面：點擊/拖曳→時間換算→ `engine.seek(t)` → 同步影片。
 - 播放/暫停 → 音訊為主時鐘；影片以定期校正（>80ms 時直接對齊）。
 - 波形/頻譜以圖片顯示，播放時以 `requestAnimationFrame` 更新游標（對齊 `AudioContext.currentTime`）。
 - 樂譜檢視：依 `score.entries` 在指定時間切換行圖；切換時觸發上滑動畫；seek 時重算應顯示之行並立即對位。
 - 左/右音源選擇下拉：提供「音軌清單」與「Video (Top)/(Bottom)」兩組來源可選；可任意組合左右。

## 同步與限制
- YouTube 僅作畫面，不將其音訊接入 Web Audio；以音訊 MP3 為主時鐘。
- CORS：MP4/MP3 需允許跨網域與 `crossorigin="anonymous"`；否則解碼與畫布可能失敗。
 - 自動播放政策：首次互動時 `AudioContext.resume()` 後才能播放。
 - 樂譜同步以音訊主時鐘為準；為避免抖動，切換採「預排隊列 + 閾值觸發」（例：提前 60ms 補正）。
 - 影片音訊來源僅支援 MP4 `<video>`（`MediaElementAudioSourceNode`）；YouTube 因 IFrame 限制不納入音訊路由。
 - 每個 `<video>` 僅能建立一個 `MediaElementAudioSourceNode`；引擎會共用此節點並以 `ChannelSplitterNode`/`GainNode` 路由至左/右。
 - 視覺化為 PNG，需在載入完成後方可互動；建議顯示預載進度。

## 里程碑（驗收）
1) 基礎架構與 JSON 載入（頁籤動態生成）。
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

## 建置與開發
- 純 TS：`tsc` 輸出 ESM；不引入框架。
- 靜態伺服器（擇一）：`python -m http.server` 或 `npx http-server public`。
- 型別與 Lint（可選）：`strict: true`，ESLint（no any、no implicit any）。
