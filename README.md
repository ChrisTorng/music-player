# 通用音樂播放器（Universal Music Player）

以純瀏覽器、純 TypeScript 實作的多素材音樂播放介面：
- 以 URL 參數 `?piece=<folder-name>` 載入指定樂曲資料夾的 `config.json`。
- 同一樂曲內以「頁籤」切換素材組；左側可顯示上下兩個影片，右側管理多軌音訊與視覺化（波形/頻譜 PNG）。
- 支援以預渲染的樂譜行圖（`score/<page>-<system>.png`）依時間自動切換（詳見 PLAN.md 里程碑）。

目前狀態：已完成基本 UI 與設定載入、MP4 顯示與頁籤/路由器雛型；YouTube、Web Audio 路由、互動式波形/頻譜與樂譜同步等核心功能將依里程碑逐步落實（見下方「里程碑」）。

## 快速開始
- 先備需求：Node.js 18+、npm；（選用）ffmpeg 用於媒體檔檢查與轉碼。
- 安裝與建置：
  - `npm install`
  - `npm run build`（將 `src/` 編譯產出到 `js/`）
- 啟動靜態伺服與預覽：
  - `npm run serve`（預設 http://localhost:8000）
  - 以瀏覽器開啟 `http://localhost:8000/?piece=Liszt-Liebesträume-No.3`
- CORS 注意事項：如載入跨網域 MP4/MP3，請確保伺服端允許跨域並設定 `<video>`/Fetch 為 `crossorigin="anonymous"`。

## 專案結構
- `index.html`：單頁入口與介面骨架（頁籤 / 左右分欄 / 載入中與錯誤顯示）。
- `css/`、`js/`：已編譯的樣式與 JavaScript；對應 `src/` 來源。
- `src/`：TypeScript 原始碼（`config/types.ts`, `config/loader.ts`, `main.ts` 等）。
- `Liszt-Liebesträume-No.3/`：範例樂曲資料夾，內含：
  - `config.json`：此樂曲的設定；所有路徑以資料夾為相對基準。
  - `home/`、`church/`、`home-midi/`：各自包含 `audio/` 與 `video/`。
  - `score/`：樂譜行圖，檔名遵循 `<page>-<system>.png`（1 起算的兩個整數）。
  - `image/`：參考或宣傳用圖片（例如縮圖、封面）。

## 設定（config.json）重點
完整格式與範例請見 PLAN.md；要點如下：
- `tabs[]`：每個頁籤一組素材。
  - `videos[]`：`{ id, type: 'mp4'|'youtube', url, label }`。
  - `audioGroups[]`：音訊組別；每組含多軌 `tracks[]`，每軌含檔案 `url` 與視覺圖 `images.waveform/spectrogram`（PNG）。
  - `score`：`basePath`（相對於樂曲資料夾）、`entries[]`（按時間切換的樂譜行檔名與時間點）、動畫設定與預載範圍。
  - `defaults`：預設上/下影片、預設音訊組別與左右聲道路由（可指向音軌或正在播放的影片）。
- 網址參數：`?piece=<folder-name>` 會載入 `<folder-name>/config.json`，並自動將相對路徑轉成實際 URL。

## 媒體與命名規範
- 樂譜行圖：`<piece>/score/<page>-<system>.png`（兩個 1 起算整數）。
- 素材分桶：`home/`、`church/`、`home-midi/` 之下將檔案分置於 `audio/` 或 `video/`。
- 變體命名：沿用括號樣式，例如 `home_(Piano).mp3`, `home_(Instrumental).mp3`。
- 檔名字元：偏好 UTF-8；新增資產儘量避免空白（若需，請與現有風格一致）。

## 媒體檢查與轉碼（建議）
- 快速清單檢視：`find <piece> -type f | sort`
- 檢視編碼：`ffmpeg -i <piece>/home/video/home.mp4 -hide_banner`
- 驗證可解碼性：`ffmpeg -v error -i <file> -f null -`
- 轉碼範例（H.264/AAC）：`ffmpeg -i input.mov -c:v libx264 -crf 20 -c:a aac output.mp4`
- 移除 Windows 區段串流：`find . -name '*:Zone.Identifier' -delete`
- 建議以 Git LFS 追蹤大型二進位：`git lfs track "*.mp4" "*.mp3" "*.png"`

## 開發與腳本
- 建置：`npm run build`
- 即時編譯：`npm run dev`
- 啟動本機伺服：`npm run serve`

## 里程碑（摘自 PLAN.md）
1. URL 參數解析與頁籤生成
2. 單組 MP4 播放＋全域播放控制
3. 音訊載入＋波形游標同步（音訊為主時鐘）
4. 音訊組別切換與動態軌清單
5. 左右聲道路由與音量
6. 頻譜 PNG 顯示與同步
7. 影片音訊路由（Top/Bottom 作為來源）
8. 點擊/拖曳波形/頻譜 PNG seek
9. 樂譜行切換與上滑動畫，同步 seek
10. 響應式排版（直向上下堆疊、橫向左右分欄）
11. YouTube 畫面支援與時間同步
12. 錯誤處理、預載進度與偏好保存

## 授權
本專案採用 MIT 授權。詳見 `LICENSE` 檔案。

