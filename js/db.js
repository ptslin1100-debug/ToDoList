// js/db.js
// Firestore 多人協作待辦清單資料庫服務

import {
  initFirebase,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "./firebase-config.js";

// 輔助函式：記錄協作動態日誌 (Activity Log)
export async function logActivity(listId, text, user, actionType = "update") {
  if (!listId || !user) return;
  const { db } = initFirebase();
  if (!db) return;

  try {
    const activitiesRef = collection(db, "lists", listId, "activities");
    await addDoc(activitiesRef, {
      text,
      actionType,
      user: {
        uid: user.uid,
        displayName: user.displayName || user.email || "成員",
        photoURL: user.photoURL || ""
      },
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("記錄活動日誌失敗:", err);
  }
}

// -------------------------------------------------------------
// 清單管理 (Lists)
// -------------------------------------------------------------

// 建立新清單
export async function createList(name, description = "", user) {
  const { db } = initFirebase();
  if (!db || !user) throw new Error("尚未登入或 Firebase 未就緒");

  const listsRef = collection(db, "lists");
  const userMemberInfo = {
    uid: user.uid,
    displayName: user.displayName || "未知使用者",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role: "owner"
  };

  const docRef = await addDoc(listsRef, {
    name: name.trim(),
    description: description.trim(),
    ownerId: user.uid,
    ownerEmail: user.email || "",
    ownerName: user.displayName || user.email || "未知使用者",
    members: [user.uid],
    memberDetails: [userMemberInfo],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 記錄建立清單動態
  await logActivity(docRef.id, `建立了清單「${name.trim()}」`, user, "create_list");

  return docRef.id;
}

// 監聽目前使用者所屬的所有清單 (包含自己建立與被邀請的)
export function subscribeUserLists(user, callback) {
  const { db } = initFirebase();
  if (!db || !user) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, "lists"),
    where("members", "array-contains", user.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const lists = [];
    snapshot.forEach((docSnap) => {
      lists.push({ id: docSnap.id, ...docSnap.data() });
    });
    // 本地依建立或更新時間排序
    lists.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
      return timeB - timeA;
    });
    callback(lists);
  }, (err) => {
    console.error("監聽清單列表失敗:", err);
  });
}

// 監聽特定清單的即時資訊 (成員、清單名稱等)
export function subscribeSingleList(listId, callback) {
  const { db } = initFirebase();
  if (!db || !listId) return () => {};

  const listRef = doc(db, "lists", listId);
  return onSnapshot(listRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error("監聽特定清單失敗:", err);
  });
}

// 透過清單代碼 (List ID) 加入現有清單
export async function joinListByCode(listId, user) {
  const { db } = initFirebase();
  if (!db || !user) throw new Error("尚未登入或 Firebase 未就緒");

  const cleanListId = listId.trim();
  const listRef = doc(db, "lists", cleanListId);
  const snap = await getDoc(listRef);

  if (!snap.exists()) {
    throw new Error("找不到此清單代碼，請確認代碼是否正確！");
  }

  const data = snap.data();
  if (data.members && data.members.includes(user.uid)) {
    return { id: cleanListId, ...data, alreadyMember: true };
  }

  const newMemberInfo = {
    uid: user.uid,
    displayName: user.displayName || user.email || "協作成員",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role: "member"
  };

  await updateDoc(listRef, {
    members: arrayUnion(user.uid),
    memberDetails: arrayUnion(newMemberInfo),
    updatedAt: serverTimestamp()
  });

  await logActivity(cleanListId, `加入了此協作清單`, user, "join");

  return { id: cleanListId, ...data, alreadyMember: false };
}

// 透過 Email 邀請成員加入清單
export async function inviteMemberByEmail(listId, email, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入或 Firebase 未就緒");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error("請輸入有效 Email");

  // 在 users 集合中搜尋此 Email 的使用者
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", cleanEmail));
  const querySnap = await getDocs(q);

  const listRef = doc(db, "lists", listId);

  if (!querySnap.empty) {
    // 找到該使用者
    const foundUserDoc = querySnap.docs[0];
    const foundUser = foundUserDoc.data();

    const newMemberInfo = {
      uid: foundUser.uid,
      displayName: foundUser.displayName || cleanEmail,
      email: cleanEmail,
      photoURL: foundUser.photoURL || "",
      role: "member"
    };

    await updateDoc(listRef, {
      members: arrayUnion(foundUser.uid),
      memberDetails: arrayUnion(newMemberInfo),
      updatedAt: serverTimestamp()
    });

    await logActivity(listId, `邀請了成員「${newMemberInfo.displayName}」加入`, currentUser, "invite");
    return { success: true, user: newMemberInfo, isExistingUser: true };
  } else {
    // 尚未註冊的使用者，記錄在 invitedEmails 欄位中
    await updateDoc(listRef, {
      invitedEmails: arrayUnion(cleanEmail),
      updatedAt: serverTimestamp()
    });

    await logActivity(listId, `發送協作邀請給「${cleanEmail}」`, currentUser, "invite");
    return { success: true, email: cleanEmail, isExistingUser: false };
  }
}

// 移除成員或主動退出清單
export async function removeMember(listId, memberUid, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const listRef = doc(db, "lists", listId);
  const snap = await getDoc(listRef);
  if (!snap.exists()) throw new Error("清單不存在");

  const data = snap.data();
  // 只有清單擁有人可以移除其他人，或成員可自行退出
  if (data.ownerId !== currentUser.uid && memberUid !== currentUser.uid) {
    throw new Error("只有清單擁有者可以移除其他協作成員");
  }

  // 擁有者不能退出自己建立的清單，除非刪除清單
  if (data.ownerId === memberUid && data.ownerId === currentUser.uid) {
    throw new Error("清單擁有者無法退出，若不再需要請選擇「刪除清單」");
  }

  const updatedMembers = (data.members || []).filter(id => id !== memberUid);
  const updatedMemberDetails = (data.memberDetails || []).filter(m => m.uid !== memberUid);

  await updateDoc(listRef, {
    members: updatedMembers,
    memberDetails: updatedMemberDetails,
    updatedAt: serverTimestamp()
  });

  const isSelf = memberUid === currentUser.uid;
  await logActivity(listId, isSelf ? `退出了協作清單` : `移除了成員`, currentUser, "leave");
}

// 刪除整份清單 (僅擁有者有權限)
export async function deleteList(listId, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const listRef = doc(db, "lists", listId);
  const snap = await getDoc(listRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.ownerId !== currentUser.uid) {
    throw new Error("只有清單擁有者可以刪除此清單！");
  }

  await deleteDoc(listRef);
}

// -------------------------------------------------------------
// 待辦事項管理 (Tasks)
// -------------------------------------------------------------

// 監聽特定清單底下的所有待辦事項 (即時多人同步)
export function subscribeTasks(listId, callback) {
  const { db } = initFirebase();
  if (!db || !listId) {
    callback([]);
    return () => {};
  }

  const tasksRef = collection(db, "lists", listId, "tasks");

  return onSnapshot(tasksRef, (snapshot) => {
    const tasks = [];
    snapshot.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 依完成狀態排序（未完成在先），同狀態依建立時間降序
    tasks.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    callback(tasks);
  }, (err) => {
    console.error("監聽待辦事項失敗:", err);
  });
}

// 新增待辦事項
export async function addTask(listId, taskData, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const tasksRef = collection(db, "lists", listId, "tasks");
  const newTask = {
    title: taskData.title.trim(),
    description: (taskData.description || "").trim(),
    priority: taskData.priority || "medium", // high, medium, low
    dueDate: taskData.dueDate || "",
    tag: (taskData.tag || "").trim(),
    completed: false,
    assignedTo: taskData.assignedTo || null, // { uid, displayName, photoURL }
    createdBy: {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || "成員",
      email: currentUser.email || "",
      photoURL: currentUser.photoURL || ""
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(tasksRef, newTask);

  // 更新清單的 updatedAt
  await updateDoc(doc(db, "lists", listId), {
    updatedAt: serverTimestamp()
  }).catch(() => {});

  // 記錄協作活動
  await logActivity(listId, `新增了任務「${newTask.title}」`, currentUser, "add_task");

  return docRef.id;
}

// 切換待辦事項完成狀態
export async function toggleTaskComplete(listId, taskId, isCompleted, taskTitle, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const taskRef = doc(db, "lists", listId, "tasks", taskId);
  await updateDoc(taskRef, {
    completed: isCompleted,
    completedAt: isCompleted ? serverTimestamp() : null,
    completedBy: isCompleted ? {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || "成員"
    } : null,
    updatedAt: serverTimestamp()
  });

  const actionText = isCompleted ? `完成了任務「${taskTitle}」` : `重新開啟了任務「${taskTitle}」`;
  await logActivity(listId, actionText, currentUser, isCompleted ? "complete_task" : "reopen_task");
}

// 編輯待辦事項
export async function updateTask(listId, taskId, updates, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const taskRef = doc(db, "lists", listId, "tasks", taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  if (updates.title) {
    await logActivity(listId, `更新了任務「${updates.title}」`, currentUser, "edit_task");
  }
}

// 刪除待辦事項
export async function deleteTask(listId, taskId, taskTitle, currentUser) {
  const { db } = initFirebase();
  if (!db || !currentUser) throw new Error("尚未登入");

  const taskRef = doc(db, "lists", listId, "tasks", taskId);
  await deleteDoc(taskRef);

  await logActivity(listId, `刪除了任務「${taskTitle}」`, currentUser, "delete_task");
}

// -------------------------------------------------------------
// 即時協作活動記錄 (Activity Feed)
// -------------------------------------------------------------

// 監聽特定清單的即時活動串流 (最新 15 則)
export function subscribeActivities(listId, callback) {
  const { db } = initFirebase();
  if (!db || !listId) {
    callback([]);
    return () => {};
  }

  const activitiesRef = collection(db, "lists", listId, "activities");
  const q = query(activitiesRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const activities = [];
    snapshot.forEach((docSnap) => {
      activities.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(activities.slice(0, 15));
  }, (err) => {
    console.warn("監聽活動串流失敗 (可能尚未建立索引或規則):", err);
  });
}
