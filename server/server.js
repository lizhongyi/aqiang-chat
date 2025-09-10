const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 初始化Express与HTTP服务
const app = express();
const server = http.createServer(app);

// 配置Socket.io（开发环境允许跨域，生产环境需指定具体域名）
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 静态文件与图片上传配置
app.use(express.static(path.join(__dirname, '../public')));

// 图片上传目录配置
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 图片上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB限制
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 图片上传接口
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传图片' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, imageUrl: imageUrl });
});

// 提供上传图片访问
app.use('/uploads', express.static(uploadDir));

// 匹配逻辑核心变量
const waitingQueue = []; // 等待匹配队列
const activeChats = new Map(); // 活跃聊天会话
const CHAT_TIMEOUT = 60 * 10000; // 会话超时时间（10分钟）

// 性别显示文本转换
function getGenderDisplayText(genderCode) {
  switch (genderCode) {
    case 'male': return '♂';
    case 'female': return '♀';
    case 'unknown': return '*';
    default: return '*';
  }
}

// 匹配兼容性检查
function isCompatibleMatch(userA, userB) {
  const aAcceptsB = isUserAcceptable(userA, userB);
  const bAcceptsA = isUserAcceptable(userB, userA);
  return aAcceptsB && bAcceptsA;
}

function isUserAcceptable(userA, userB) {
  if (userA.genderPreference === 'any') return true;
  return userB.gender !== 'unknown' && userB.gender === userA.genderPreference;
}

// 寻找匹配用户
function findMatch(user) {
  if (waitingQueue.length === 0) {
    waitingQueue.push(user);
    return null;
  }

  const matchedIndex = waitingQueue.findIndex(potentialMatch => 
    isCompatibleMatch(user, potentialMatch)
  );

  if (matchedIndex !== -1) {
    return waitingQueue.splice(matchedIndex, 1)[0];
  }

  waitingQueue.push(user);
  return null;
}

// 处理匹配请求
function handleMatchRequest(socket, userData) {
  const user = {
    socket: socket,
    nickname: userData.nickname?.trim() || '匿名用户',
    gender: userData.gender || 'unknown',
    genderPreference: userData.genderPreference || 'any',
    waitingSince: Date.now()
  };

  // 提示未设置性别但有偏好的用户
  if (user.gender === 'unknown' && user.genderPreference !== 'any') {
    socket.emit('system_message', {
      content: '您设置了特定的性别偏好，但未设置自己的性别，可能会影响匹配结果'
    });
  }

  const matchedUser = findMatch(user);
  if (matchedUser) {
    const chatId = uuidv4();
    activeChats.set(chatId, {
      users: [user, matchedUser],
      createdAt: Date.now()
    });

    // 通知双方匹配成功
    user.socket.emit('match_found', {
      chatId: chatId,
      partnerNickname: matchedUser.nickname,
      partnerGender: matchedUser.gender
    });

    matchedUser.socket.emit('match_found', {
      chatId: chatId,
      partnerNickname: user.nickname,
      partnerGender: user.gender
    });

    // 发送带性别信息的系统消息
    // user.socket.emit('system_message', {
    //   content: `已匹配到聊天伙伴：${matchedUser.nickname}（性别：${getGenderDisplayText(matchedUser.gender)}）`,
    //   messageKey: 'matchFound'
    // });
    // matchedUser.socket.emit('system_message', {
    //   content: `已匹配到聊天伙伴：${user.nickname}（性别：${getGenderDisplayText(user.gender)}）`,
    //   messageKey: 'matchFound'
    // });
  } else {
    // socket.emit('system_message', {
    //   content: `正在等待符合条件的${getGenderDisplayText(user.genderPreference)}用户...`
    // });
  }
}

// 处理取消匹配
function handleCancelMatch(socket) {
  const index = waitingQueue.findIndex(user => user.socket === socket);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
    socket.emit('system_message', { content: '已取消匹配' });
  }
}

// 处理结束聊天
function handleEndChat(chatId, socket) {
  const chat = activeChats.get(chatId);
  if (!chat) return;

  chat.users.forEach(user => {
    if (user.socket !== socket) {
      user.socket.emit('user_disconnected', { chatId: chatId });
      user.socket.emit('system_message', { content: '聊天伙伴已结束聊天' });
    }
  });

  activeChats.delete(chatId);
}

// 处理消息转发
function handleMessage(chatId, message, senderSocket) {
  const chat = activeChats.get(chatId);
  if (!chat) return;

  chat.users.forEach(user => {
    if (user.socket !== senderSocket && user.socket.connected) {
      if (message.type === 'message') {
        user.socket.emit('new_message', {
          content: message.content,
          isImage: message.isImage,
          senderNickname: message.senderNickname,
          chatId: chatId
        });
      } else if (message.type === 'typing') {
        user.socket.emit('typing_status', {
          chatId: chatId,
          isTyping: message.isTyping
        });
      }
    }
  });
}

// 处理断开连接（不立即删除会话，等待重连）
function handleDisconnect(socket) {
  handleCancelMatch(socket);

  for (const [chatId, chat] of activeChats.entries()) {
    const userIndex = chat.users.findIndex(user => user.socket === socket);
    if (userIndex !== -1) {
      // 标记断开时间，不立即删除会话
      chat.users[userIndex] = {
        ...chat.users[userIndex],
        disconnectedAt: Date.now(),
        socket: socket
      };

      // 通知伙伴等待重连
      const partner = chat.users.find(user => user.socket !== socket);
      if (partner && partner.socket.connected) {
        // partner.socket.emit('system_message', {
        //   content: '聊天伙伴已断开连接，正在等待重连...'
        // });
        partner.socket.emit('user_disconnected', { chatId: chatId, isReconnecting: true });
      }
    }
  }

  console.log(`用户断开连接：${socket.id}`);
}

// Socket.io连接处理
io.on('connection', (socket) => {
  console.log(`新用户连接：${socket.id}`);

  // 会话验证（用于恢复聊天）
  socket.on('verify_chat', (data, callback) => {
    const { chatId } = data;
    if (!chatId) {
      return callback({ success: false, message: '聊天ID不能为空' });
    }

    const chat = activeChats.get(chatId);
    if (!chat) {
      return callback({ 
        success: false, 
        message: '聊天会话已失效（对方可能已离开或超时）' 
      });
    }

    // 检查当前用户是否为会话成员
    const currentUser = chat.users.find(user => user.socket.id === socket.id);
    if (!currentUser) {
      // 尝试重新关联断开的用户
      const disconnectedUser = chat.users.find(user => !user.socket.connected);
      if (disconnectedUser) {
        disconnectedUser.socket = socket;
        chat.users[chat.users.indexOf(disconnectedUser)] = disconnectedUser;
        activeChats.set(chatId, chat);

        const partner = chat.users.find(user => user.socket.id !== socket.id);
        callback({
          success: true,
          chatInfo: {
            partnerNickname: partner.nickname,
            partnerGender: partner.gender,
            userInfo: {
              nickname: disconnectedUser.nickname,
              gender: disconnectedUser.gender,
              genderPreference: disconnectedUser.genderPreference
            }
          }
        });

        //partner.socket.emit('system_message', { content: '聊天伙伴已重新连接' });
      } else {
        callback({ success: false, message: '你不是该聊天会话的成员' });
      }
    } else {
      const partner = chat.users.find(user => user.socket.id !== socket.id);
      callback({
        success: true,
        chatInfo: {
          partnerNickname: partner.nickname,
          partnerGender: partner.gender,
          userInfo: {
            nickname: currentUser.nickname,
            gender: currentUser.gender,
            genderPreference: currentUser.genderPreference
          }
        }
      });
    }
  });

  // 处理匹配请求
  socket.on('match_request', (userData) => {
    console.log(`用户 ${socket.id} 发起匹配请求：`, userData);
    handleMatchRequest(socket, userData);
  });

  // 处理取消匹配
  socket.on('cancel_match', () => {
    console.log(`用户 ${socket.id} 取消匹配`);
    handleCancelMatch(socket);
  });

  // 处理结束聊天
  socket.on('end_chat', (data) => {
    console.log(`用户 ${socket.id} 结束聊天：${data.chatId}`);
    handleEndChat(data.chatId, socket);
  });

  // 处理消息发送
  socket.on('new_message', (data) => {
    handleMessage(data.chatId, {
      type: 'message',
      content: data.content,
      isImage: data.isImage,
      senderNickname: data.senderNickname
    }, socket);
  });

  // 处理输入状态
  socket.on('typing_status', (data) => {
    handleMessage(data.chatId, {
      type: 'typing',
      isTyping: data.isTyping
    }, socket);
  });

  // 处理断开连接
  socket.on('disconnect', (reason) => {
    handleDisconnect(socket);
  });

  // 处理错误
  socket.on('error', (error) => {
    console.error(`Socket 错误：${error}`);
  });
});

// 定期清理超时会话（10秒检查一次）
setInterval(() => {
  const now = Date.now();
  for (const [chatId, chat] of activeChats.entries()) {
    const hasTimeoutUser = chat.users.some(user => 
      user.disconnectedAt && (now - user.disconnectedAt > CHAT_TIMEOUT)
    );

    if (hasTimeoutUser || chat.users.length < 2) {
      chat.users.forEach(user => {
        if (user.socket.connected) {
          user.socket.emit('system_message', {
            content: 'chat end'
          });
        }
      });
      activeChats.delete(chatId);
      console.log(`清理超时会话：${chatId}`);
    }
  }
}, 10000);

// 定期清理等待超时用户（5分钟）
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000;
  const timeoutUsers = [];

  waitingQueue.forEach((user, index) => {
    if (now - user.waitingSince > TIMEOUT) {
      timeoutUsers.push(index);
      if (user.socket.connected) {
        
        // user.socket.emit('system_message', {
        //   content: '匹配超时，未找到符合条件的聊天伙伴，请重试'
        // });
      }
    }
  });

  for (let i = timeoutUsers.length - 1; i >= 0; i--) {
    waitingQueue.splice(timeoutUsers[i], 1);
  }
}, 30000);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`Socket.io 服务运行在 ws://localhost:${PORT}`);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获异常：', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝：', reason);
});
