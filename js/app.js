// js/app.js
// TeamTask 多人協作待辦清單主應用程式邏輯

import {
  getFirebaseConfig,
  saveFirebaseConfig,
  resetFirebaseConfig,
  isFirebaseConfigured,
  initFirebase
} from "./firebase-config.js";

import {
  subscribeToAuth,
  loginWithGoogle,
  logout,
  getCurrentUser,
  formatAuthError
} from "./auth.js";

import {
  createList,
  subscribeUserLists,
  subscribeSingleList,
  joinListByCode,
  inviteMemberByEmail,
  removeMember,
  deleteList,
  subscribeTasks,
  addTask,
  toggleTaskComplete,
  updateTask,
  deleteTask,
  subscribeActivities
} from "./db.js";

// 全域狀態
let currentActiveListId = null;
let currentListMeta = null;
let currentTasks = [];
let currentFilter = "all"; // all | active | completed
let currentSearchKeyword = "";
let unsubscribeTasks = null;
let unsubscribeListMeta = null;
let unsubscribeActivities = null;
let userLists = [];

// =============================================================
// DOM 元素選取
// =============================================================
const DOM = {
  // Navigation & Auth
  authView: document.getElementById("auth-view"),
  unauthView: document.getElementById("unauth-view"),
  userAvatar: document.getElementById("user-avatar"),
  userName: document.getElementById("user-name"),
  userEmail: document.getElementById("user-email"),
  googleLoginBtn: document.getElementById("google-login-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  openConfigBtn: document.getElementById("open-config-btn"),
  configStatusDot: document.getElementById("config-status-dot"),
  apiKeyBanner: document.getElementById("api-key-banner"),
  bannerConfigBtn: document.getElementById("banner-config-btn"),
  mobileMenuBtn: document.getElementById("mobile-menu-btn"),
  sidebar: document.getElementById("sidebar"),

  // Sidebar Lists
  listsContainer: document.getElementById("lists-container"),
  listCountBadge: document.getElementById("list-count-badge"),
  openNewListModal: document.getElementById("open-new-list-modal"),
  openJoinListModal: document.getElementById("open-join-list-modal"),

  // Main Views
  noListView: document.getElementById("no-list-view"),
  activeListView: document.getElementById("active-list-view"),
  emptyStateNewListBtn: document.getElementById("empty-state-new-list-btn"),
  emptyStateJoinBtn: document.getElementById("empty-state-join-btn"),

  // Active List Header
  activeListTitle: document.getElementById("active-list-title"),
  activeListDesc: document.getElementById("active-list-desc"),
  activeListRoleBadge: document.getElementById("active-list-role-badge"),
  headerMemberStack: document.getElementById("header-member-stack"),
  openShareModalBtn: document.getElementById("open-share-modal-btn"),
  toggleActivityBtn: document.getElementById("toggle-activity-btn"),
  deleteListBtn: document.getElementById("delete-list-btn"),

  // Task Input & Form
  addTaskForm: document.getElementById("add-task-form"),
  newTaskTitle: document.getElementById("new-task-title"),
  newTaskPriority: document.getElementById("new-task-priority"),
  newTaskDueDate: document.getElementById("new-task-due-date"),
  newTaskAssignee: document.getElementById("new-task-assignee"),
  newTaskTag: document.getElementById("new-task-tag"),

  // Filters & Tasks
  filterTabs: document.querySelectorAll(".filter-tab"),
  taskSearchInput: document.getElementById("task-search-input"),
  progressBarFill: document.getElementById("progress-bar-fill"),
  progressText: document.getElementById("progress-text"),
  tasksContainer: document.getElementById("tasks-container"),

  // Activity Drawer
  activityDrawer: document.getElementById("activity-drawer"),
  closeActivityDrawer: document.getElementById("close-activity-drawer"),
  activityFeedContainer: document.getElementById("activity-feed-container"),

  // Modals
  configModal: document.getElementById("config-modal"),
  closeConfigModal: document.getElementById("close-config-modal"),
  cancelConfigBtn: document.getElementById("cancel-config-btn"),
  firebaseConfigForm: document.getElementById("firebase-config-form"),
  configPasteArea: document.getElementById("config-paste-area"),
  parseConfigBtn: document.getElementById("parse-config-btn"),
  resetConfigBtn: document.getElementById("reset-config-btn"),
  cfgApiKey: document.getElementById("cfg-apiKey"),
  cfgProjectId: document.getElementById("cfg-projectId"),
  cfgAuthDomain: document.getElementById("cfg-authDomain"),
  cfgAppId: document.getElementById("cfg-appId"),
  cfgMessagingSenderId: document.getElementById("cfg-messagingSenderId"),

  newListModal: document.getElementById("new-list-modal"),
  closeNewListModal: document.getElementById("close-new-list-modal"),
  cancelNewListBtn: document.getElementById("cancel-new-list-btn"),
  createListForm: document.getElementById("create-list-form"),
  newListName: document.getElementById("new-list-name"),
  newListDescInput: document.getElementById("new-list-desc-input"),

  joinListModal: document.getElementById("join-list-modal"),
  closeJoinListModal: document.getElementById("close-join-list-modal"),
  cancelJoinListBtn: document.getElementById("cancel-join-list-btn"),
  joinListForm: document.getElementById("join-list-form"),
  joinListCodeInput: document.getElementById("join-list-code-input"),

  shareModal: document.getElementById("share-modal"),
  closeShareModal: document.getElementById("close-share-modal"),
  shareListCode: document.getElementById("share-list-code"),
  copyCodeBtn: document.getElementById("copy-code-btn"),
  shareListUrl: document.getElementById("share-list-url"),
  copyUrlBtn: document.getElementById("copy-url-btn"),
  inviteEmailForm: document.getElementById("invite-email-form"),
  inviteEmailInput: document.getElementById("invite-email-input"),
  modalMemberCount: document.getElementById("modal-member-count"),
  modalMembersList: document.getElementById("modal-members-list"),

  editTaskModal: document.getElementById("edit-task-modal"),
  closeEditTaskModal: document.getElementById("close-edit-task-modal"),
  cancelEditTaskBtn: document.getElementById("cancel-edit-task-btn"),
  editTaskForm: document.getElementById("edit-task-form"),
  editTaskId: document.getElementById("edit-task-id"),
  editTaskTitle: document.getElementById("edit-task-title"),
  editTaskDesc: document.getElementById("edit-task-desc"),
  editTaskPriority: document.getElementById("edit-task-priority"),
  editTaskDueDate: document.getElementById("edit-task-due-date"),
  editTaskAssignee: document.getElementById("edit-task-assignee"),
  editTaskTag: document.getElementById("edit-task-tag"),

  toastContainer: document.getElementById("toast-container")
};

// =============================================================
// Toast 提示通知函式
// =============================================================
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const bgColors = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-slate-800 text-white"
  };
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    warning: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };

  toast.className = `toast px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-sm"></i>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button class="ml-2 hover:opacity-80 p-0.5"><i class="fa-solid fa-xmark"></i></button>
  `;

  toast.querySelector("button").onclick = () => toast.remove();
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================
// Firebase 設定狀態與彈窗邏輯
// =============================================================
function updateConfigUI() {
  const configured = isFirebaseConfigured();
  const config = getFirebaseConfig();

  DOM.cfgApiKey.value = config.apiKey || "";
  DOM.cfgProjectId.value = config.projectId || "to-do-list-511f9";
  DOM.cfgAuthDomain.value = config.authDomain || "to-do-list-511f9.firebaseapp.com";
  DOM.cfgAppId.value = config.appId || "";
  DOM.cfgMessagingSenderId.value = config.messagingSenderId || "";

  if (configured) {
    DOM.configStatusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
    DOM.configStatusDot.title = "Firebase 已配置";
    DOM.apiKeyBanner.classList.add("hidden");
  } else {
    DOM.configStatusDot.className = "w-2 h-2 rounded-full bg-amber-400";
    DOM.configStatusDot.title = "尚未設定 API Key";
    DOM.apiKeyBanner.classList.remove("hidden");
  }
}

function setupConfigModal() {
  const openModal = () => DOM.configModal.classList.remove("hidden");
  const closeModal = () => DOM.configModal.classList.add("hidden");

  DOM.openConfigBtn.addEventListener("click", openModal);
  DOM.bannerConfigBtn.addEventListener("click", openModal);
  DOM.closeConfigModal.addEventListener("click", closeModal);
  DOM.cancelConfigBtn.addEventListener("click", closeModal);

  // 快速貼上並解析 config 代碼
  DOM.parseConfigBtn.addEventListener("click", () => {
    const raw = DOM.configPasteArea.value;
    if (!raw.trim()) {
      showToast("請先在文字框中貼入 Firebase 代碼", "warning");
      return;
    }

    const apiKeyMatch = raw.match(/apiKey:\s*["']([^"']+)["']/);
    const authDomainMatch = raw.match(/authDomain:\s*["']([^"']+)["']/);
    const appIdMatch = raw.match(/appId:\s*["']([^"']+)["']/);
    const senderIdMatch = raw.match(/messagingSenderId:\s*["']([^"']+)["']/);

    if (apiKeyMatch) DOM.cfgApiKey.value = apiKeyMatch[1];
    if (authDomainMatch) DOM.cfgAuthDomain.value = authDomainMatch[1];
    if (appIdMatch) DOM.cfgAppId.value = appIdMatch[1];
    if (senderIdMatch) DOM.cfgMessagingSenderId.value = senderIdMatch[1];

    showToast("已成功自動解析欄位！請點選「儲存並重新連線」", "success");
  });

  // 儲存設定表單
  DOM.firebaseConfigForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newConfig = {
      apiKey: DOM.cfgApiKey.value.trim(),
      authDomain: DOM.cfgAuthDomain.value.trim(),
      projectId: "to-do-list-511f9",
      appId: DOM.cfgAppId.value.trim(),
      messagingSenderId: DOM.cfgMessagingSenderId.value.trim()
    };

    saveFirebaseConfig(newConfig);
    updateConfigUI();
    closeModal();
    showToast("Firebase 設定已儲存！正在重新載入應用...", "success");

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });

  // 重置設定
  DOM.resetConfigBtn.addEventListener("click", () => {
    if (confirm("確定要重設為預設設定嗎？")) {
      resetFirebaseConfig();
      updateConfigUI();
      showToast("已重置為預設設定", "info");
    }
  });
}

// =============================================================
// 使用者登入 / 登出邏輯
// =============================================================
function setupAuth() {
  DOM.googleLoginBtn.addEventListener("click", async () => {
    if (!isFirebaseConfigured()) {
      showToast("請先點擊「Firebase 設定」填入 API Key 才能進行 Google 登入！", "warning");
      DOM.configModal.classList.remove("hidden");
      return;
    }

    DOM.googleLoginBtn.disabled = true;
    DOM.googleLoginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>登入中...`;

    try {
      const user = await loginWithGoogle();
      if (user) {
        showToast(`歡迎回來，${user.displayName || "使用者"}！`, "success");
      }
    } catch (err) {
      console.error("登入錯誤:", err);
      showToast(formatAuthError(err), "error");
    } finally {
      DOM.googleLoginBtn.disabled = false;
      DOM.googleLoginBtn.innerHTML = `
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Google 登入</span>
      `;
    }
  });

  DOM.logoutBtn.addEventListener("click", async () => {
    if (confirm("確定要登出 Google 帳號嗎？")) {
      await logout();
      showToast("已成功登出", "info");
      selectActiveList(null);
    }
  });

  // 監聽 Auth 變化
  subscribeToAuth((user, isReady) => {
    if (user) {
      DOM.unauthView.classList.add("hidden");
      DOM.authView.classList.remove("hidden");
      DOM.userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=6366f1&color=fff`;
      DOM.userName.textContent = user.displayName || "Google 使用者";
      DOM.userEmail.textContent = user.email || "";

      // 監聽使用者的清單列表
      subscribeUserLists(user, handleUserListsUpdate);

      // 檢查網址是否有代碼參數 (例如 #listId 或 ?list=listId)
      handleUrlInviteParam(user);
    } else {
      DOM.unauthView.classList.remove("hidden");
      DOM.authView.classList.add("hidden");
      DOM.listsContainer.innerHTML = `
        <div class="text-center py-10 text-slate-400 text-xs">
          <i class="fa-regular fa-folder-open text-2xl mb-2 text-slate-300 block"></i>
          請先登入 Google 帳號以載入或建立協作清單
        </div>
      `;
      DOM.listCountBadge.textContent = "0";
      selectActiveList(null);
    }
  });
}

// 處理 URL 邀請連結自動加入
async function handleUrlInviteParam(user) {
  const hash = window.location.hash.replace("#", "").trim();
  const params = new URLSearchParams(window.location.search);
  const targetListId = hash || params.get("list");

  if (targetListId && targetListId.length > 5) {
    try {
      const res = await joinListByCode(targetListId, user);
      showToast(res.alreadyMember ? "已載入協作清單" : "成功加入新協作清單！", "success");
      selectActiveList(targetListId);
    } catch (e) {
      console.warn("自動載入 URL 清單失敗:", e);
    }
  }
}

// =============================================================
// 清單管理 (Lists)
// =============================================================
function handleUserListsUpdate(lists) {
  userLists = lists;
  DOM.listCountBadge.textContent = lists.length;

  if (lists.length === 0) {
    DOM.listsContainer.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs">
        <i class="fa-solid fa-clipboard-list text-2xl mb-2 text-slate-300 block"></i>
        尚無協作清單，點擊上方按鈕建立或加入！
      </div>
    `;
    if (!currentActiveListId) {
      selectActiveList(null);
    }
    return;
  }

  DOM.listsContainer.innerHTML = "";
  const currentUser = getCurrentUser();

  lists.forEach((list) => {
    const isOwner = currentUser && list.ownerId === currentUser.uid;
    const isActive = currentActiveListId === list.id;
    const memberCount = (list.members || []).length;

    const item = document.createElement("div");
    item.className = `p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between border ${
      isActive 
        ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-semibold shadow-sm" 
        : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700"
    }`;

    item.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="w-7 h-7 rounded-lg ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"} flex items-center justify-center flex-shrink-0 text-xs">
          <i class="fa-solid fa-list-check"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs truncate font-medium">${escapeHtml(list.name)}</div>
          <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span><i class="fa-regular fa-user text-[9px]"></i> ${memberCount} 人</span>
            <span>•</span>
            <span class="${isOwner ? "text-indigo-600 font-medium" : ""}">${isOwner ? "擁有者" : "成員"}</span>
          </div>
        </div>
      </div>
      ${isActive ? `<i class="fa-solid fa-chevron-right text-[10px] text-indigo-600 ml-1"></i>` : ""}
    `;

    item.addEventListener("click", () => {
      selectActiveList(list.id);
    });

    DOM.listsContainer.appendChild(item);
  });

  // 若當前沒有選取清單，預設選取第一份
  if (!currentActiveListId && lists.length > 0) {
    selectActiveList(lists[0].id);
  }
}

// 切換選取指定清單
function selectActiveList(listId) {
  // 清除先前的即時監聽
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }
  if (unsubscribeListMeta) {
    unsubscribeListMeta();
    unsubscribeListMeta = null;
  }
  if (unsubscribeActivities) {
    unsubscribeActivities();
    unsubscribeActivities = null;
  }

  currentActiveListId = listId;

  if (!listId) {
    DOM.noListView.classList.remove("hidden");
    DOM.activeListView.classList.add("hidden");
    window.location.hash = "";
    return;
  }

  window.location.hash = listId;
  DOM.noListView.classList.add("hidden");
  DOM.activeListView.classList.remove("hidden");

  // 監聽清單即時中繼資料 (名稱、成員等)
  unsubscribeListMeta = subscribeSingleList(listId, (meta) => {
    if (!meta) {
      showToast("此清單可能已被刪除或您已被移除", "warning");
      selectActiveList(null);
      return;
    }
    currentListMeta = meta;
    renderListHeader(meta);
    populateAssigneeSelects(meta.memberDetails || []);
  });

  // 監聽待辦事項
  unsubscribeTasks = subscribeTasks(listId, (tasks) => {
    currentTasks = tasks;
    renderTasks();
  });

  // 監聽即時動態
  unsubscribeActivities = subscribeActivities(listId, (activities) => {
    renderActivityFeed(activities);
  });

  // 重新渲染側邊欄選中狀態
  if (userLists.length > 0) {
    handleUserListsUpdate(userLists);
  }
}

// 渲染清單 Header 資訊
function renderListHeader(meta) {
  const currentUser = getCurrentUser();
  const isOwner = currentUser && meta.ownerId === currentUser.uid;

  DOM.activeListTitle.textContent = meta.name || "未命名清單";
  DOM.activeListDesc.textContent = meta.description || "點擊右方「邀請成員」即可與隊友共同編輯待辦事項。";

  DOM.activeListRoleBadge.textContent = isOwner ? "擁有者" : "協作成員";
  DOM.activeListRoleBadge.className = isOwner
    ? "px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
    : "px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200";

  DOM.deleteListBtn.title = isOwner ? "刪除此清單" : "退出此清單";

  // 渲染成員頭像堆疊
  const members = meta.memberDetails || [];
  DOM.headerMemberStack.innerHTML = "";

  // 最多顯示 4 個頭像
  const displayMembers = members.slice(0, 4);
  displayMembers.forEach((member) => {
    const img = document.createElement("img");
    img.className = "w-6 h-6 rounded-full border-2 border-white object-cover shadow-sm";
    img.src = member.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName || "Member")}&background=6366f1&color=fff`;
    img.alt = member.displayName || "成員";
    img.title = `${member.displayName || "成員"} (${member.email || ""})`;
    DOM.headerMemberStack.appendChild(img);
  });

  if (members.length > 4) {
    const more = document.createElement("div");
    more.className = "w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold border-2 border-white flex items-center justify-center shadow-sm";
    more.textContent = `+${members.length - 4}`;
    DOM.headerMemberStack.appendChild(more);
  }

  // 點擊頭像堆疊開啟邀請彈窗
  DOM.headerMemberStack.onclick = () => openShareModal();
}

// 填入指派成員選單
function populateAssigneeSelects(members) {
  const optionsHtml = `
    <option value="">指派人員...</option>
    ${members.map(m => `
      <option value="${m.uid}">${escapeHtml(m.displayName || m.email || "成員")}</option>
    `).join("")}
  `;

  DOM.newTaskAssignee.innerHTML = optionsHtml;
  DOM.editTaskAssignee.innerHTML = `
    <option value="">無指派</option>
    ${members.map(m => `
      <option value="${m.uid}">${escapeHtml(m.displayName || m.email || "成員")}</option>
    `).join("")}
  `;
}

// =============================================================
// 待辦事項 (Tasks) 渲染與互動
// =============================================================
function renderTasks() {
  const container = DOM.tasksContainer;
  const filtered = currentTasks.filter((task) => {
    // 狀態篩選
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;

    // 關鍵字搜尋
    if (currentSearchKeyword) {
      const kw = currentSearchKeyword.toLowerCase();
      const matchTitle = (task.title || "").toLowerCase().includes(kw);
      const matchDesc = (task.description || "").toLowerCase().includes(kw);
      const matchTag = (task.tag || "").toLowerCase().includes(kw);
      const matchAssignee = (task.assignedTo?.displayName || "").toLowerCase().includes(kw);
      return matchTitle || matchDesc || matchTag || matchAssignee;
    }
    return true;
  });

  // 更新進度條
  const total = currentTasks.length;
  const completedCount = currentTasks.filter(t => t.completed).length;
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  DOM.progressBarFill.style.width = `${percentage}%`;
  DOM.progressText.textContent = `${completedCount}/${total} (${percentage}%)`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
        <i class="fa-solid fa-inbox text-3xl mb-2 text-slate-300"></i>
        <span>${currentSearchKeyword ? "查無符合條件的待辦事項" : "尚無待辦事項，立即在上方新增！"}</span>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = `p-3.5 bg-white border ${
      task.completed ? "border-slate-100 bg-slate-50/50" : "border-slate-200"
    } rounded-xl card-shadow card-shadow-hover flex items-start gap-3 transition`;

    // 優先級標籤顏色
    let priorityBadge = "";
    if (task.priority === "high") {
      priorityBadge = `<span class="badge-priority-high px-2 py-0.5 text-[10px] font-bold rounded-md">🔥 高</span>`;
    } else if (task.priority === "medium") {
      priorityBadge = `<span class="badge-priority-medium px-2 py-0.5 text-[10px] font-bold rounded-md">中</span>`;
    } else {
      priorityBadge = `<span class="badge-priority-low px-2 py-0.5 text-[10px] font-bold rounded-md">低</span>`;
    }

    // 截止日期格式化與逾期判斷
    let dueHtml = "";
    if (task.dueDate) {
      const today = new Date().toISOString().split("T")[0];
      const isOverdue = !task.completed && task.dueDate < today;
      dueHtml = `
        <span class="flex items-center gap-1 text-[11px] ${isOverdue ? "text-rose-600 font-semibold" : "text-slate-500"}">
          <i class="fa-regular fa-calendar text-[10px]"></i>
          ${task.dueDate} ${isOverdue ? "(已逾期)" : ""}
        </span>
      `;
    }

    // 指派人員資訊
    let assigneeHtml = "";
    if (task.assignedTo) {
      assigneeHtml = `
        <span class="flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">
          <i class="fa-regular fa-user text-[10px]"></i>
          ${escapeHtml(task.assignedTo.displayName || "指派人員")}
        </span>
      `;
    }

    // 標籤
    let tagHtml = "";
    if (task.tag) {
      tagHtml = `
        <span class="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
          #${escapeHtml(task.tag)}
        </span>
      `;
    }

    // 建立者與完成者
    const authorName = task.createdBy?.displayName || "成員";
    const completedInfo = task.completed && task.completedBy?.displayName 
      ? `• 已由 ${escapeHtml(task.completedBy.displayName)} 完成` 
      : "";

    card.innerHTML = `
      <!-- Checkbox -->
      <div class="pt-0.5">
        <input type="checkbox" class="custom-checkbox" ${task.completed ? "checked" : ""}>
      </div>

      <!-- Main Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span class="task-title text-sm font-semibold text-slate-800 ${task.completed ? "completed" : ""}">
            ${escapeHtml(task.title)}
          </span>
          ${priorityBadge}
          ${tagHtml}
        </div>

        ${task.description ? `
          <p class="text-xs text-slate-500 mb-2 whitespace-pre-wrap">${escapeHtml(task.description)}</p>
        ` : ""}

        <div class="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-slate-400">
          ${dueHtml}
          ${assigneeHtml}
          <span>由 ${escapeHtml(authorName)} 建立 ${completedInfo}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1 opacity-80 hover:opacity-100 transition">
        <button class="edit-task-btn p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100" title="編輯任務">
          <i class="fa-regular fa-pen-to-square text-xs"></i>
        </button>
        <button class="delete-task-btn p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="刪除任務">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    `;

    // 勾選完成狀態
    const checkbox = card.querySelector(".custom-checkbox");
    checkbox.addEventListener("change", async () => {
      const currentUser = getCurrentUser();
      try {
        await toggleTaskComplete(currentActiveListId, task.id, checkbox.checked, task.title, currentUser);
      } catch (err) {
        checkbox.checked = !checkbox.checked;
        showToast("切換狀態失敗: " + err.message, "error");
      }
    });

    // 編輯按鈕
    card.querySelector(".edit-task-btn").addEventListener("click", () => {
      openEditTaskModal(task);
    });

    // 刪除按鈕
    card.querySelector(".delete-task-btn").addEventListener("click", async () => {
      if (confirm(`確定要刪除「${task.title}」嗎？`)) {
        const currentUser = getCurrentUser();
        try {
          await deleteTask(currentActiveListId, task.id, task.title, currentUser);
          showToast("已刪除任務", "info");
        } catch (err) {
          showToast("刪除失敗: " + err.message, "error");
        }
      }
    });

    container.appendChild(card);
  });
}

// =============================================================
// 即時協作動態串流 (Activity Feed)
// =============================================================
function renderActivityFeed(activities) {
  const container = DOM.activityFeedContainer;
  if (activities.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">尚無動態記錄</div>`;
    return;
  }

  container.innerHTML = "";
  activities.forEach((act) => {
    const item = document.createElement("div");
    item.className = "flex items-start gap-2.5 text-xs text-slate-600 border-b border-slate-50 pb-2.5";

    const avatar = act.user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(act.user?.displayName || "U")}&background=e0e7ff&color=4f46e5`;
    const timeStr = act.createdAt?.toDate ? act.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "剛剛";

    item.innerHTML = `
      <img src="${avatar}" class="w-5 h-5 rounded-full object-cover flex-shrink-0 mt-0.5 border border-slate-200">
      <div class="flex-1 min-w-0">
        <div><strong class="text-slate-800">${escapeHtml(act.user?.displayName || "成員")}</strong> ${escapeHtml(act.text)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${timeStr}</div>
      </div>
    `;

    container.appendChild(item);
  });
}

// =============================================================
// 表單與事件監聽
// =============================================================

// 新增任務表單
function setupTaskForms() {
  DOM.addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) {
      showToast("請先登入 Google 帳號！", "warning");
      return;
    }
    if (!currentActiveListId) {
      showToast("請先選擇或建立清單", "warning");
      return;
    }

    const title = DOM.newTaskTitle.value.trim();
    if (!title) return;

    let assignedTo = null;
    const assigneeUid = DOM.newTaskAssignee.value;
    if (assigneeUid && currentListMeta?.memberDetails) {
      const found = currentListMeta.memberDetails.find(m => m.uid === assigneeUid);
      if (found) {
        assignedTo = { uid: found.uid, displayName: found.displayName, photoURL: found.photoURL || "" };
      }
    }

    const taskData = {
      title,
      priority: DOM.newTaskPriority.value,
      dueDate: DOM.newTaskDueDate.value,
      tag: DOM.newTaskTag.value.trim(),
      assignedTo
    };

    try {
      await addTask(currentActiveListId, taskData, currentUser);
      DOM.newTaskTitle.value = "";
      DOM.newTaskTag.value = "";
      showToast("已新增待辦事項！", "success");
    } catch (err) {
      showToast("新增失敗: " + err.message, "error");
    }
  });

  // 篩選標籤點擊
  DOM.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.filterTabs.forEach(t => {
        t.classList.remove("active", "bg-white", "text-indigo-700", "shadow-sm");
        t.classList.add("text-slate-600");
      });
      tab.classList.add("active", "bg-white", "text-indigo-700", "shadow-sm");
      tab.classList.remove("text-slate-600");

      currentFilter = tab.dataset.filter;
      renderTasks();
    });
  });

  // 關鍵字搜尋
  DOM.taskSearchInput.addEventListener("input", (e) => {
    currentSearchKeyword = e.target.value.trim();
    renderTasks();
  });

  // 動態抽屜切換
  DOM.toggleActivityBtn.addEventListener("click", () => {
    DOM.activityDrawer.classList.toggle("hidden");
  });
  DOM.closeActivityDrawer.addEventListener("click", () => {
    DOM.activityDrawer.classList.add("hidden");
  });
}

// 建立清單 Modal 邏輯
function setupNewListModal() {
  const openModal = () => {
    const user = getCurrentUser();
    if (!user) {
      showToast("請先登入 Google 帳號！", "warning");
      return;
    }
    DOM.newListModal.classList.remove("hidden");
    DOM.newListName.focus();
  };
  const closeModal = () => DOM.newListModal.classList.add("hidden");

  DOM.openNewListModal.addEventListener("click", openModal);
  DOM.emptyStateNewListBtn.addEventListener("click", openModal);
  DOM.closeNewListModal.addEventListener("click", closeModal);
  DOM.cancelNewListBtn.addEventListener("click", closeModal);

  DOM.createListForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const name = DOM.newListName.value.trim();
    const desc = DOM.newListDescInput.value.trim();

    if (!name) return;

    try {
      const newListId = await createList(name, desc, user);
      DOM.newListName.value = "";
      DOM.newListDescInput.value = "";
      closeModal();
      showToast("已成功建立協作清單！", "success");
      selectActiveList(newListId);
    } catch (err) {
      showToast("建立失敗: " + err.message, "error");
    }
  });
}

// 加入清單 Modal 邏輯
function setupJoinListModal() {
  const openModal = () => {
    const user = getCurrentUser();
    if (!user) {
      showToast("請先登入 Google 帳號！", "warning");
      return;
    }
    DOM.joinListModal.classList.remove("hidden");
    DOM.joinListCodeInput.focus();
  };
  const closeModal = () => DOM.joinListModal.classList.add("hidden");

  DOM.openJoinListModal.addEventListener("click", openModal);
  DOM.emptyStateJoinBtn.addEventListener("click", openModal);
  DOM.closeJoinListModal.addEventListener("click", closeModal);
  DOM.cancelJoinListBtn.addEventListener("click", closeModal);

  DOM.joinListForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const code = DOM.joinListCodeInput.value.trim();

    if (!code) return;

    try {
      const res = await joinListByCode(code, user);
      DOM.joinListCodeInput.value = "";
      closeModal();
      showToast(res.alreadyMember ? "您已經是此清單成員！" : "已成功加入協作清單！", "success");
      selectActiveList(code);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// 分享與邀請 Modal 邏輯
function setupShareModal() {
  const closeModal = () => DOM.shareModal.classList.add("hidden");
  DOM.closeShareModal.addEventListener("click", closeModal);
  DOM.openShareModalBtn.addEventListener("click", () => openShareModal());

  // 複製清單代碼
  DOM.copyCodeBtn.addEventListener("click", () => {
    const code = DOM.shareListCode.value;
    navigator.clipboard.writeText(code).then(() => {
      showToast("清單代碼已複製到剪貼簿！", "success");
    }).catch(() => {
      showToast("請手動選取代碼並複製", "info");
    });
  });

  // 複製專屬邀請網址
  DOM.copyUrlBtn.addEventListener("click", () => {
    const url = DOM.shareListUrl.value;
    navigator.clipboard.writeText(url).then(() => {
      showToast("專屬邀請連結已複製到剪貼簿！", "success");
    }).catch(() => {
      showToast("請手動選取網址並複製", "info");
    });
  });

  // 透過 Email 邀請
  DOM.inviteEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const email = DOM.inviteEmailInput.value.trim();

    if (!email || !currentActiveListId) return;

    try {
      const res = await inviteMemberByEmail(currentActiveListId, email, currentUser);
      DOM.inviteEmailInput.value = "";
      if (res.isExistingUser) {
        showToast(`已成功邀請 ${email} 加入！`, "success");
      } else {
        showToast(`已發送協作記錄給 ${email} (對方登入後即可存取)`, "info");
      }
    } catch (err) {
      showToast("邀請失敗: " + err.message, "error");
    }
  });

  // 刪除 / 退出清單按鈕
  DOM.deleteListBtn.addEventListener("click", async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentActiveListId || !currentListMeta) return;

    const isOwner = currentListMeta.ownerId === currentUser.uid;

    if (isOwner) {
      if (confirm(`【警告】您是此清單「${currentListMeta.name}」的擁有者。\n確定要徹底刪除此清單與所有待辦事項嗎？`)) {
        try {
          await deleteList(currentActiveListId, currentUser);
          showToast("已刪除清單", "info");
          selectActiveList(null);
        } catch (err) {
          showToast("刪除清單失敗: " + err.message, "error");
        }
      }
    } else {
      if (confirm(`確定要退出「${currentListMeta.name}」協作清單嗎？`)) {
        try {
          await removeMember(currentActiveListId, currentUser.uid, currentUser);
          showToast("已退出此清單", "info");
          selectActiveList(null);
        } catch (err) {
          showToast("退出失敗: " + err.message, "error");
        }
      }
    }
  });
}

function openShareModal() {
  if (!currentActiveListId || !currentListMeta) return;

  const url = `${window.location.origin}${window.location.pathname}#${currentActiveListId}`;
  DOM.shareListCode.value = currentActiveListId;
  DOM.shareListUrl.value = url;

  // 渲染成員清單
  const members = currentListMeta.memberDetails || [];
  DOM.modalMemberCount.textContent = `${members.length} 位`;
  DOM.modalMembersList.innerHTML = "";

  const currentUser = getCurrentUser();
  const isOwner = currentUser && currentListMeta.ownerId === currentUser.uid;

  members.forEach((m) => {
    const isMemberOwner = m.uid === currentListMeta.ownerId;
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs";

    row.innerHTML = `
      <div class="flex items-center gap-2.5">
        <img class="w-7 h-7 rounded-full object-cover border border-slate-200" 
          src="${m.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.displayName || "U")}&background=6366f1&color=fff`}">
        <div>
          <div class="font-semibold text-slate-800">${escapeHtml(m.displayName || "成員")} ${m.uid === currentUser?.uid ? "(你)" : ""}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(m.email || "")}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          isMemberOwner ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"
        }">${isMemberOwner ? "擁有者" : "協作成員"}</span>
        ${isOwner && !isMemberOwner ? `
          <button class="remove-member-btn text-rose-500 hover:text-rose-700 p-1" title="移除成員">
            <i class="fa-solid fa-user-xmark"></i>
          </button>
        ` : ""}
      </div>
    `;

    if (isOwner && !isMemberOwner) {
      row.querySelector(".remove-member-btn").onclick = async () => {
        if (confirm(`確定要將「${m.displayName}」從此清單移除嗎？`)) {
          try {
            await removeMember(currentActiveListId, m.uid, currentUser);
            showToast("已移除成員", "info");
          } catch (err) {
            showToast("移除失敗: " + err.message, "error");
          }
        }
      };
    }

    DOM.modalMembersList.appendChild(row);
  });

  DOM.shareModal.classList.remove("hidden");
}

// 編輯任務 Modal 邏輯
function setupEditTaskModal() {
  const closeModal = () => DOM.editTaskModal.classList.add("hidden");
  DOM.closeEditTaskModal.addEventListener("click", closeModal);
  DOM.cancelEditTaskBtn.addEventListener("click", closeModal);

  DOM.editTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    const taskId = DOM.editTaskId.value;
    if (!taskId || !currentActiveListId) return;

    let assignedTo = null;
    const assigneeUid = DOM.editTaskAssignee.value;
    if (assigneeUid && currentListMeta?.memberDetails) {
      const found = currentListMeta.memberDetails.find(m => m.uid === assigneeUid);
      if (found) {
        assignedTo = { uid: found.uid, displayName: found.displayName, photoURL: found.photoURL || "" };
      }
    }

    const updates = {
      title: DOM.editTaskTitle.value.trim(),
      description: DOM.editTaskDesc.value.trim(),
      priority: DOM.editTaskPriority.value,
      dueDate: DOM.editTaskDueDate.value,
      tag: DOM.editTaskTag.value.trim(),
      assignedTo
    };

    try {
      await updateTask(currentActiveListId, taskId, updates, currentUser);
      closeModal();
      showToast("已儲存任務變更！", "success");
    } catch (err) {
      showToast("儲存失敗: " + err.message, "error");
    }
  });
}

function openEditTaskModal(task) {
  DOM.editTaskId.value = task.id;
  DOM.editTaskTitle.value = task.title || "";
  DOM.editTaskDesc.value = task.description || "";
  DOM.editTaskPriority.value = task.priority || "medium";
  DOM.editTaskDueDate.value = task.dueDate || "";
  DOM.editTaskTag.value = task.tag || "";
  DOM.editTaskAssignee.value = task.assignedTo?.uid || "";

  DOM.editTaskModal.classList.remove("hidden");
  DOM.editTaskTitle.focus();
}

// 手機版側邊欄切換
function setupMobileMenu() {
  DOM.mobileMenuBtn.addEventListener("click", () => {
    DOM.sidebar.classList.toggle("hidden");
  });
}

// =============================================================
// 主程式啟動
// =============================================================
function initApp() {
  updateConfigUI();
  setupConfigModal();
  setupAuth();
  setupTaskForms();
  setupNewListModal();
  setupJoinListModal();
  setupShareModal();
  setupEditTaskModal();
  setupMobileMenu();

  // 若尚未設定 Firebase，自動提示使用者設定
  if (!isFirebaseConfigured()) {
    setTimeout(() => {
      DOM.configModal.classList.remove("hidden");
    }, 600);
  }
}

// DOMContentLoaded 啟動
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
