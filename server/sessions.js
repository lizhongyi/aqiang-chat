const fs = require('fs');
const path = require('path');

// 会话存储路径
const SESSIONS_PATH = path.join(__dirname, '../data/sessions.json');
const DATA_DIR = path.dirname(SESSIONS_PATH);

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 加载会话数据
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const data = fs.readFileSync(SESSIONS_PATH, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('加载会话失败:', error);
    return {};
  }
}

// 保存会话数据
function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('保存会话失败:', error);
  }
}

// 获取所有会话
function getAllSessions() {
  return loadSessions();
}

// 获取用户会话
function getUserSession(userId) {
  const sessions = loadSessions();
  return sessions[userId];
}

// 保存用户会话
function saveUserSession(userId, sessionData) {
  const sessions = loadSessions();
  sessions[userId] = {
    ...sessionData,
    updatedAt: Date.now()
  };
  saveSessions(sessions);
}

// 移除用户会话
function removeUserSession(userId) {
  const sessions = loadSessions();
  if (sessions[userId]) {
    delete sessions[userId];
    saveSessions(sessions);
  }
}

// 清理过期会话（超过30分钟）
function cleanExpiredSessions() {
  const sessions = loadSessions();
  const now = Date.now();
  const EXPIRY_TIME = 30 * 60 * 1000; // 30分钟
  
  let cleaned = false;
  
  for (const [userId, session] of Object.entries(sessions)) {
    if (now - session.updatedAt > EXPIRY_TIME) {
      delete sessions[userId];
      cleaned = true;
    }
  }
  
  if (cleaned) {
    saveSessions(sessions);
  }
}

// 每10分钟清理一次过期会话
setInterval(cleanExpiredSessions, 10 * 60 * 1000);

module.exports = {
  getAllSessions,
  getUserSession,
  saveUserSession,
  removeUserSession,
  cleanExpiredSessions
};