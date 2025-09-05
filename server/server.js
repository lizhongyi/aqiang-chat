// 服务器主文件 (Node.js/Express + WebSocket)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { 
    handleMatchRequest, 
    handleCancelMatch, 
    handleEndChat, 
    handleMessage, 
    handleDisconnect 
} = require('./matchmaking');

// 初始化Express应用
const app = express();
const server = http.createServer(app);

// 配置静态文件目录
app.use(express.static(path.join(__dirname, '../public')));

// 配置图片上传
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制5MB
    },
    fileFilter: (req, file, cb) => {
        // 只允许图片文件
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
    
    // 返回图片URL
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({
        success: true,
        imageUrl: imageUrl
    });
});

// 提供上传的图片访问
app.use('/uploads', express.static(uploadDir));

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 处理WebSocket连接
wss.on('connection', (ws) => {
    console.log('新客户端连接');
    
    // 处理客户端发送的消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('收到消息:', data.type);
            
            // 根据消息类型处理
            switch (data.type) {
                case 'match_request':
                    // 处理匹配请求
                    handleMatchRequest(ws, {
                        nickname: data.nickname,
                        gender: data.gender || 'unknown',
                        genderPreference: data.genderPreference || 'any'
                    });
                    break;
                    
                case 'cancel_match':
                    // 处理取消匹配
                    handleCancelMatch(ws);
                    break;
                    
                case 'end_chat':
                    // 处理结束聊天
                    handleEndChat(data.chatId, ws);
                    break;
                    
                case 'message':
                case 'typing':
                    // 转发消息或输入状态
                    handleMessage(data.chatId, data, ws);
                    break;
                    
                default:
                    console.log('未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('处理消息错误:', error);
            console.error('消息内容:', message.toString());
        }
    });
    
    // 处理连接关闭
    ws.on('close', () => {
        console.log('客户端断开连接');
        handleDisconnect(ws);
    });
    
    // 处理错误
    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket服务器运行在 ws://localhost:${PORT}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});
