# Prototype Wrapper v1.1 — Walkthrough Widget

## 簡介

一個**零依賴、單檔案**的可注入式腳本，為任何網頁原型加上互動式操作錄製與回放功能。使用 Shadow DOM 確保不影響原型頁面樣式。

## 使用方式

### 安裝

在目標 HTML 頁面的 `</body>` 前加入：

```html
<script src="/walkthrough-widget.js"></script>
```

### 模式切換

- **Reviewer 模式**（預設）：直接開啟頁面即可
- **Designer 模式**：在 URL 加上 `?mode=designer`

### Designer 模式（錄製）

1. 點擊右下角紅色 ⏺ 按鈕開啟面板
2. 點擊「Start Recording」開始錄製
3. 在頁面上操作（點擊、輸入、捲動、切換頁面）
4. 點擊 FAB（⏹）停止錄製
5. 輸入情境名稱並儲存
6. 可在面板中管理情境：重新命名、刪除、加入旁白

### Reviewer 模式（回放）

1. 點擊右下角藍色 ▶ 按鈕
2. 選擇要回放的情境
3. 系統自動執行每個步驟，附帶元素高亮與旁白
4. 底部控制列可暫停/繼續/停止
5. 點擊「Free Explore」退出回放自由瀏覽

### 匯出/匯入

Designer 面板中提供 JSON 匯出與匯入功能，方便分享情境給團隊成員。

### 旁白 (TTS)

在 Designer 面板的情境管理中，點擊「💬 Narration」可為每個步驟加入文字旁白。回放時會以文字疊層 + Web Speech API 語音朗讀。

## 技術細節

- 純 Vanilla JavaScript，無任何框架或建置步驟
- 所有 UI 透過 Shadow DOM 隔離
- 資料儲存在 `localStorage`（key: `pw-scenarios`）
- 支援跨頁導航自動恢復回放狀態（透過 `sessionStorage`）

## 儲存格式

```json
[{
  "id": "unique-id",
  "name": "Scenario 1",
  "createdAt": "2026-06-04T...",
  "steps": [{
    "type": "click|input|scroll|navigate",
    "selector": "CSS selector",
    "value": "input value",
    "url": "/path#hash",
    "scrollPos": [0, 100],
    "timestamp": 1717430400000,
    "rect": {"x":0,"y":0,"w":100,"h":40},
    "narration": "optional text"
  }]
}]
```
