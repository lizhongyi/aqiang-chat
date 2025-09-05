const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 配置CORS
app.use(cors());

// 创建图片存储目录
const UPLOAD_DIR = path.join(__dirname, 'chat-pics');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名，保留原始文件扩展名
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// 过滤只允许图片文件
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
// 提供图片访问服务
app.use('/chat-pics', express.static(UPLOAD_DIR));

// 图片上传路由
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有图片文件' });
    }
    
    // 返回图片的访问路径
    const imageUrl = `/chat-pics/${req.file.filename}`;
    res.json({
      success: true,
      imageUrl: imageUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 存储用户信息
const users = new Map(); // key: userId, value: { ws, status, partnerId, nickname, chatId }
const waitingQueue = []; // 等待匹配的用户队列

// 生成唯一用户ID
function generateUserId() {
  return uuidv4();
}

// 生成唯一聊天ID
function generateChatId() {
  return uuidv4();
}

// 发送消息给指定用户
function sendToUser(userId, message) {
  const user = users.get(userId);
  if (user && user.ws.readyState === WebSocket.OPEN) {
    user.ws.send(JSON.stringify(message));
  }
}

// 处理用户匹配
function handleMatching() {
  // 当等待队列中有至少两个用户时，进行匹配
  while (waitingQueue.length >= 2) {
    const user1Id = waitingQueue.shift();
    const user2Id = waitingQueue.shift();
    
    const user1 = users.get(user1Id);
    const user2 = users.get(user2Id);
    
    if (!user1 || !user2) continue;
    
    // 生成聊天ID
    const chatId = generateChatId();
    
    // 更新用户状态
    user1.status = 'chatting';
    user1.partnerId = user2Id;
    user1.chatId = chatId;
    users.set(user1Id, user1);
    
    user2.status = 'chatting';
    user2.partnerId = user1Id;
    user2.chatId = chatId;
    users.set(user2Id, user2);
    
    // 通知双方匹配成功
    sendToUser(user1Id, {
      type: 'match_found',
      chatId: chatId,
      partnerNickname: user2.nickname
    });
    
    sendToUser(user2Id, {
      type: 'match_found',
      chatId: chatId,
      partnerNickname: user1.nickname
    });
    
    console.log(`匹配成功: ${user1.nickname} (${user1Id}) 和 ${user2.nickname} (${user2Id}), 聊天ID: ${chatId}`);
  }
}

// 处理WebSocket连接
wss.on('connection', (ws) => {
  // 为新连接的用户生成ID
  const userId = generateUserId();
  console.log(`新用户连接: ${userId}`);
  
  // 初始化用户信息
  users.set(userId, {
    ws: ws,
    status: 'online', // online, waiting, chatting
    partnerId: null,
    chatId: null,
    nickname: '匿名用户' // 默认昵称
  });
  
  // 处理收到的消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const user = users.get(userId);
      
      if (!user) return;
      
      console.log(`收到来自 ${user.nickname} (${userId}) 的消息:`, data.type);
      
      switch (data.type) {
        case 'match_request':
          // 处理匹配请求
          if (user.status !== 'online') return;
          
          // 更新用户昵称
          if (data.nickname && data.nickname.trim()) {
            user.nickname = data.nickname.trim();
            users.set(userId, user);
          }
          
          // 将用户加入等待队列
          user.status = 'waiting';
          users.set(userId, user);
          waitingQueue.push(userId);
          
          // 尝试匹配
          handleMatching();
          break;
          
        case 'cancel_match':
          // 取消匹配请求
          if (user.status !== 'waiting') return;
          
          // 将用户从等待队列中移除
          const index = waitingQueue.indexOf(userId);
          if (index !== -1) {
            waitingQueue.splice(index, 1);
          }
          
          // 更新用户状态
          user.status = 'online';
          users.set(userId, user);
          break;
          
        case 'message':
          // 转发消息给聊天伙伴
          if (user.status !== 'chatting' || !user.partnerId) return;
          
          // 确保消息包含聊天ID
          if (data.chatId !== user.chatId) return;
          
          // 转发消息
          sendToUser(user.partnerId, {
            type: 'message',
            content: data.content,
            isImage: data.isImage || false,
            senderNickname: user.nickname,
            chatId: data.chatId
          });
          break;
          
        case 'typing':
          // 处理正在输入状态
          if (user.status !== 'chatting' || !user.partnerId) return;
          
          // 转发正在输入状态给聊天伙伴
          sendToUser(user.partnerId, {
            type: 'typing',
            isTyping: data.isTyping,
            senderNickname: user.nickname,
            chatId: user.chatId
          });
          break;
          
        case 'end_chat':
          // 结束聊天
          if (user.status !== 'chatting' || !user.partnerId) return;
          
          const partnerId = user.partnerId;
          const partner = users.get(partnerId);
          
          // 通知双方聊天结束
          sendToUser(userId, {
            type: 'system',
            content: '你已结束聊天'
          });
          
          if (partner) {
            sendToUser(partnerId, {
              type: 'user_disconnected',
              content: '对方已结束聊天'
            });
            
            // 更新伙伴状态
            partner.status = 'online';
            partner.partnerId = null;
            partner.chatId = null;
            users.set(partnerId, partner);
          }
          
          // 更新当前用户状态
          user.status = 'online';
          user.partnerId = null;
          user.chatId = null;
          users.set(userId, user);
          break;
      }
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    console.log(`用户断开连接: ${userId}`);
    
    const user = users.get(userId);
    if (user) {
      // 如果用户正在聊天，通知其伙伴
      if (user.status === 'chatting' && user.partnerId) {
        sendToUser(user.partnerId, {
          type: 'user_disconnected',
          content: '对方已断开连接'
        });
        
        // 更新伙伴状态
        const partner = users.get(user.partnerId);
        if (partner) {
          partner.status = 'online';
          partner.partnerId = null;
          partner.chatId = null;
          users.set(user.partnerId, partner);
        }
      } else if (user.status === 'waiting') {
        // 如果用户在等待队列中，将其移除
        const index = waitingQueue.indexOf(userId);
        if (index !== -1) {
          waitingQueue.splice(index, 1);
        }
      }
      
      // 从用户列表中移除
      users.delete(userId);
    }
  });
  
  // 处理错误
  ws.on('error', (error) => {
    console.error(`用户 ${userId} 发生错误:`, error);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`图片存储目录: ${UPLOAD_DIR}`);
  console.log(`图片访问路径: http://localhost:${PORT}/chat-pics/filename`);
});
