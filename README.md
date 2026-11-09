# 📋 TeamTask 多人協作待辦清單 (ToDoList)

這是一個現代化、支援 **Google 登入** 與 **多人即時協作** 的待辦清單 Web 應用程式，專為 Firebase 專案 **`to-do-list-511f9`** 所打造。

---

## 🌟 主要功能特點

1. **Google 帳號登入 (Firebase Auth)**：
   - 支援一鍵 Google 彈窗登入與帳號狀態持久化。
   - 自動同步使用者暱稱、Email 與 Google 頭像。

2. **多人即時協作 (Cloud Firestore 即時同步)**：
   - **多專案／清單管理**：使用者可建立多份獨立清單（例如「產品開發衝刺」、「家庭採購」）。
   - **成員邀請與加入**：
     - **代碼邀請**：每份清單擁有專屬 List ID 代碼，複製給隊友即可直接加入。
     - **專屬連結**：支援網址自動帶入邀請代碼（例如 `http://localhost:8080/#listId`）。
     - **Email 邀請**：直接輸入成員 Email 發送協作授權。
   - **毫秒級即時同步**：任何成員新增、勾選完成、修改優先級或刪除任務，其他成員的畫面都會即時更新，無須手動重新整理頁面。
   - **任務指派 (Assignee)**：可指派特定待辦事項給清單內的協作成員。
   - **協作成員狀態堆疊**：清單標題旁即時顯示協作成員的頭像堆疊。
   - **即時活動動態串流 (Activity Feed)**：即時顯示隊友的最新操作記錄（如「小明 完成了任務：修復前端 Bug」）。

3. **強大待辦管理與現代化 UI**：
   - 優先級設定（🔥 高、中、低色彩徽章標籤）。
   - 截止日期（逾期自動標註醒目紅色提示）。
   - 自訂分類標籤（例如 `#前端`、`#重要`）。
   - 狀態篩選（全部、進行中、已完成）與即時搜尋功能。
   - 整體清單完成進度條與百分比計算。

---

## 📁 檔案結構

```
ToDoList/
├── index.html               # 網頁主架構 (Tailwind CSS, Font Awesome, 響應式佈局)
├── css/
│   └── style.css            # 自訂微互動動畫、玻璃擬態與樣式
├── js/
│   ├── firebase-config.js   # Firebase SDK 初始化與設定管理
│   ├── auth.js              # Google 登入驗證與狀態管理
│   ├── db.js                # Firestore 即時同步、清單與任務 CRUD
│   └── app.js               # 主應用控制器、UI 互動與事件綁定
├── firestore.rules          # Firestore 安全規則 (複製至 Firebase 控制台)
├── start-server.ps1         # 輕量級本機 HTTP 伺服器 PowerShell 腳本
├── start-server.bat         # 雙擊即可一鍵啟動本機伺服器
└── README.md                # 專案說明文件
```

---

## 🚀 快速啟動方式

由於應用程式採用標準 ES 模組與 Firebase Web SDK，在瀏覽器中建議透過 HTTP 協定運行（避免瀏覽器 `file://` 的 CORS 安全限制）：

### 方法一：一鍵啟動（推薦）
在 Windows 檔案總管中，直接**雙擊執行 `start-server.bat`**：
1. 程式會自動啟動本地伺服器（預設為 `http://localhost:8080`）。
2. 自動在您的預設瀏覽器中開啟 TeamTask 待辦清單應用程式。

### 方法二：使用現有的開發工具
若您有安裝 VSCode、Node.js 或 Python，可在 `ToDoList` 目錄下執行：
- **VSCode Live Server**：右鍵點擊 `index.html` 選擇 `Open with Live Server`。
- **Python**：`python -m http.server 8080`
- **Node.js / npx**：`npx serve .`

---

## ⚙️ Firebase 專案設定指南 (`to-do-list-511f9`)

本專案已為您預先設定專案 ID 為 **`to-do-list-511f9`**。為確保 Google 登入與多人協作順暢運作，請在 [Firebase Console](https://console.firebase.google.com/) 進行以下四項快速確認：

### 1. 取得 Web App 設定 (API Key)
1. 進入 [Firebase Console 專案設定](https://console.firebase.google.com/project/to-do-list-511f9/settings/general)。
2. 在「**您的應用程式**」區塊中，若尚未建立 Web 應用程式，點擊 **新增應用程式 (Web 圖示 `</>`)** 並命名為 `ToDoList`。
3. 複製產生的 `firebaseConfig` 內容（包含 `apiKey`、`appId` 等）。
4. **填入設定**：
   - 方式 A：開啟本網頁後，點擊右上角「**Firebase 設定**」，直接將該段代碼貼入文字框，點擊「**自動解析**」並「**儲存並重新連線**」。
   - 方式 B：直接開啟 `js/firebase-config.js`，將 `DEFAULT_FIREBASE_CONFIG` 中的 `apiKey` 與 `appId` 填入即可。

### 2. 啟用 Google 登入提供者
1. 進入 Firebase 控制台左側選單的 **Authentication** > **Sign-in method**。
2. 點擊 **Google**。
3. 將開關切換為 **啟用 (Enabled)**，選擇專案支援電子郵件後點擊 **儲存 (Save)**。

### 3. 設定授權網域 (Authorized Domains)
1. 在 **Authentication** > **Settings** > **Authorized domains** 頁籤中。
2. 確認 `localhost` 已在名單中（預設會自動包含）。

### 4. 啟用 Cloud Firestore 資料庫與規則
1. 進入 Firebase 控制台左側選單的 **Firestore Database**。
2. 點擊 **建立資料庫 (Create database)**，選擇位置（如 `asia-east1`）並選擇「以測試模式啟動」。
3. 進入 **Rules (規則)** 標籤頁，將本專案內的 `firestore.rules` 檔案內容完整貼上並點擊 **發布 (Publish)**。

---

## 👥 如何進行多人協作測試

1. 使用者 A 在瀏覽器打開 `http://localhost:8080`，點擊 **Google 登入**，點擊「**新增清單**」（例如命名為「專案進度清單」）。
2. 清單建立後，點擊清單上方的「**邀請成員**」按鈕，點擊「**複製代碼**」或「**複製連結**」。
3. 使用者 B 在另一個瀏覽器視窗或無痕視窗開啟網址，使用另一個 Google 帳號登入。
4. 使用者 B 點擊側邊欄的「**加入清單**」，貼上使用者 A 的清單代碼：
   - 使用者 A 與使用者 B 現在已即時同步！
   - 任一方新增待辦、打勾完成、指派成員，另一方畫面將在不到一秒內自動更新！
