const fs = require('fs').promises;
const path = require('path');

// 存储路径配置
const DATA_DIR = path.join(__dirname, '../data');
const CHATS_FILE = path.join(DATA_DIR, 'active_chats.json');

// 初始化存储目录
async function initStorage() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  try {
    await fs.access(CHATS_FILE);
  } catch {
    await fs.writeFile(CHATS_FILE, JSON.stringify({}), 'utf8');
  }
}

// 加载所有聊天会话
async function loadChats() {
  await initStorage();
  try {
    const data = await fs.readFile(CHATS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('加载聊天会话失败:', error);
    return {};
  }
}

// 保存聊天会话
async function saveChats(chats) {
  await initStorage();
  try {
    await fs.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8');
  } catch (error) {
    console.error('保存聊天会话失败:', error);
  }
}

// 获取特定聊天
async function getChat(chatId) {
  const chats = await loadChats();
  return chats[chatId] || null;
}

// 保存特定聊天
async function saveChat(chatId, chatData) {
  const chats = await loadChats();
  chats[chatId] = {
    ...chatData,
    updatedAt: Date.now()
  };
  await saveChats(chats);
}

// 删除聊天
async function deleteChat(chatId) {
  const chats = await loadChats();
  if (chats[chatId]) {
    delete chats[chatId];
    await saveChats(chats);
  }
}

// 清理过期聊天（30分钟）
async function cleanExpiredChats() {
  const chats = await loadChats();
  const now = Date.now();
  const EXPIRY_TIME = 30 * 60 * 1000; // 30分钟
  
  let changed = false;
  Object.keys(chats).forEach(chatId => {
    if (now - chats[chatId].updatedAt > EXPIRY_TIME) {
      delete chats[chatId];
      changed = true;
    }
  });
  
  if (changed) {
    await saveChats(chats);
  }
}

// 每10分钟清理一次过期会话
setInterval(cleanExpiredChats, 10 * 60 * 1000);

module.exports = {
  loadChats,
  saveChats,
  getChat,
  saveChat,
  deleteChat,
  cleanExpiredChats
};