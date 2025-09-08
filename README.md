# 通用音樂播放器（Universal Music Player）

以純瀏覽器、純 TypeScript 實作的多素材音樂播放介面：
- 以 URL 參數 `?piece=<folder-name>` 載入指定樂曲資料夾的 `config.json`。
- 同一樂曲內以「頁籤」切換素材組；頁籤以 Query String 切換為新網址 `?piece=...&tab=<tab-id>` 並重新載入，因此每個頁籤的播放狀態互不影響；左側可顯示上下兩個影片，右側管理多軌音訊與視覺化（波形/頻譜）。
- 支援以預渲染的樂譜行圖（`score/<page>-<system>.png`）依時間自動切換（詳見 PLAN.md 里程碑）。

目前狀態：已完成基本 UI 與設定載入、MP4 顯示與以 Query String 切換的頁籤導向雛型；YouTube、Web Audio 路由、互動式波形/頻譜與樂譜同步等核心功能將依里程碑逐步落實（見下方「里程碑」）。

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
- `index.html`：單頁入口與介面骨架（頁籤連結 / 左右分欄 / 載入中與錯誤顯示）。
- `css/`、`js/`：已編譯的樣式與 JavaScript；對應 `src/` 來源。
- 注意：請勿直接修改 `js/` 內檔案；所有程式碼變更請在 `src/` 進行後以 `npm run build` 產生對應輸出。
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
- `audioGroups[]`：音訊組別；每組含多軌 `tracks[]`，每軌僅需檔案 `url` 與 `label`。波形/頻譜圖檔不需在 config 指定；本專案已全面改以瀏覽器端動態產生視覺化。
  - `score`：`basePath`（相對於樂曲資料夾）、`entries[]`（按時間切換的樂譜行檔名與時間點）、動畫設定與預載範圍。
  - `defaults`：預設上/下影片、預設音訊組別與左右聲道路由（可指向音軌或正在播放的影片）。
- 網址參數：
  - `?piece=<folder-name>` 會載入 `<folder-name>/config.json`，並自動將相對路徑轉成實際 URL。
  - `&tab=<tab-id>` 指定啟動頁籤；點擊頁籤時也會以此參數導向並重新載入。
 - JSONC 支援：為了便於註解配置，`src/config/loader.ts` 會在瀏覽器端讀取檔案後移除 `//` 與 `/* ... */` 註解再解析；因此 `config.json` 可保留註解格式（建議保持副檔名為 `.json` 以利部署）。

## 媒體與命名規範
- 樂譜行圖：`<piece>/score/<page>-<system>.png`（兩個 1 起算整數）。
- 素材分桶：`home/`、`church/`、`home-midi/` 之下將檔案分置於 `audio/` 或 `video/`。
- 變體命名：沿用括號樣式，例如 `home_(Piano).mp3`, `home_(Instrumental).mp3`。
- 檔名字元：偏好 UTF-8；新增資產儘量避免空白（若需，請與現有風格一致）。

### 動態視覺化（不再依賴預存 PNG）
- 視覺化改為完全在瀏覽器端動態產生：解碼 MP3 之後以 Canvas 產出 data URL 顯示（不落地存檔）。
- 預設顯示尺寸：
  - 波形：4000×50 px（黑底、白色波形）
  - 頻譜：4000×200 px（近似 magma 色盤，實色背景，低頻在下）
- 仍保留離線產生腳本（選用）：可在需要時批次產生 PNG 檔供外部用途，但前端不再讀取該等 PNG。

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
- PR 提交規範：請勿包含 `js/` 或 `css/` 的手動修改；僅提交 `src/` 的來源變更與文件、媒體檔案等必要內容。

### 產生波形/頻譜 PNG（選用，離線批次）
- `scripts/gen-mp3-png.sh [-f] [-r DIR]`
  - 對 `DIR`（預設當前目錄）下所有 `*.mp3` 產生缺少的 `*.waveform.png`（4000×50）與 `*.spectrogram.png`（4000×200）。
  - `-f` 強制覆蓋已有 PNG。
  - 需要本機安裝 `ffmpeg`。

## 里程碑（摘自 PLAN.md）
1. URL 參數解析與頁籤連結（`?tab=`）生成＋重新載入導向
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
