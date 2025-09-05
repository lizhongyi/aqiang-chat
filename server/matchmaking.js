
// 后端匹配逻辑实现 (灵活处理性别保密和偏好不限的场景)
const WebSocket = require('ws');
const uuid = require('uuid');

// 存储等待匹配的用户队列
const waitingQueue = [];

// 存储活跃的聊天会话
const activeChats = new Map();

// 匹配逻辑核心函数 - 灵活模式
function findMatch(user) {
    // 如果队列为空，将用户加入队列等待
    if (waitingQueue.length === 0) {
        waitingQueue.push(user);
        return null;
    }
    
    // 尝试找到符合条件的匹配
    const matchedIndex = waitingQueue.findIndex(potentialMatch => 
        isCompatibleMatch(user, potentialMatch)
    );
    
    // 如果找到匹配的用户
    if (matchedIndex !== -1) {
        const matchedUser = waitingQueue.splice(matchedIndex, 1)[0];
        return matchedUser;
    }
    
    // 没有找到匹配的用户，加入队列等待
    waitingQueue.push(user);
    return null;
}

// 兼容匹配检查 - 核心匹配逻辑
function isCompatibleMatch(userA, userB) {
    // 检查用户A是否接受用户B
    const aAcceptsB = isUserAcceptable(userA, userB);
    // 检查用户B是否接受用户A
    const bAcceptsA = isUserAcceptable(userB, userA);
    
    // 必须双向接受才视为匹配
    return aAcceptsB && bAcceptsA;
}

// 检查用户A是否接受用户B作为聊天对象
function isUserAcceptable(userA, userB) {
    // 用户A的偏好是"不限"时：
    // - 接受任何性别的用户B（包括保密）
    if (userA.genderPreference === 'any') {
        return true;
    }
    
    // 用户A有特定偏好（男/女）时：
    // - 用户B的性别必须明确设置（不能是保密）
    // - 并且必须符合用户A的偏好
    return userB.gender !== 'unknown' && userB.gender === userA.genderPreference;
}

// 处理新的匹配请求
function handleMatchRequest(ws, userData) {
    // 验证用户是否提供了必要信息
    const user = {
        ...userData,
        ws: ws,
        waitingSince: Date.now(),
        // 确保性别和偏好有默认值
        gender: userData.gender || 'unknown',
        genderPreference: userData.genderPreference || 'any'
    };
    
    // 如果用户未设置自己的性别且有特定偏好，发送提示
    if (user.gender === 'unknown' && user.genderPreference !== 'any') {
        user.ws.send(JSON.stringify({
            type: 'system',
            content: '您设置了特定的性别偏好，但未设置自己的性别，可能会影响匹配结果'
        }));
    }
    
    // 尝试寻找匹配
    const matchedUser = findMatch(user);
    
    // 如果找到匹配
    if (matchedUser) {
        // 创建聊天会话ID
        const chatId = uuid.v4();
        
        // 存储活跃聊天
        activeChats.set(chatId, {
            users: [user, matchedUser],
            createdAt: Date.now()
        });
        
        // 通知双方匹配成功
        user.ws.send(JSON.stringify({
            type: 'match_found',
            chatId: chatId,
            partnerNickname: matchedUser.nickname,
            partnerGender: matchedUser.gender // 可能是'unknown'（保密）
        }));
        
        matchedUser.ws.send(JSON.stringify({
            type: 'match_found',
            chatId: chatId,
            partnerNickname: user.nickname,
            partnerGender: user.gender // 可能是'unknown'（保密）
        }));
    } else {
        // 告知用户进入等待队列
        user.ws.send(JSON.stringify({
            type: 'system',
            content: `正在等待符合条件的${getGenderText(user.genderPreference)}...`
        }));
    }
}

// 辅助函数：将性别代码转换为显示文本
function getGenderText(genderCode) {
    switch(genderCode) {
        case 'male': return '男性用户';
        case 'female': return '女性用户';
        default: return '聊天伙伴（不限性别）';
    }
}

// 处理取消匹配请求
function handleCancelMatch(ws) {
    // 从等待队列中移除用户
    const index = waitingQueue.findIndex(user => user.ws === ws);
    if (index !== -1) {
        waitingQueue.splice(index, 1);
        ws.send(JSON.stringify({
            type: 'system',
            content: '已取消匹配'
        }));
    }
}

// 处理结束聊天
function handleEndChat(chatId, ws) {
    const chat = activeChats.get(chatId);
    if (!chat) return;
    
    // 通知对方聊天已结束
    chat.users.forEach(user => {
        if (user.ws !== ws) {
            user.ws.send(JSON.stringify({
                type: 'user_disconnected',
                chatId: chatId
            }));
        }
    });
    
    // 从活跃聊天中移除
    activeChats.delete(chatId);
}

// 处理消息转发
function handleMessage(chatId, message, senderWs) {
    const chat = activeChats.get(chatId);
    if (!chat) return;
    
    // 转发消息给聊天中的其他用户
    chat.users.forEach(user => {
        if (user.ws !== senderWs && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify(message));
        }
    });
}

// 处理用户断开连接
function handleDisconnect(ws) {
    // 从等待队列中移除
    handleCancelMatch(ws);
    
    // 检查是否在活跃聊天中，并通知对方
    for (const [chatId, chat] of activeChats.entries()) {
        if (chat.users.some(user => user.ws === ws)) {
            handleEndChat(chatId, ws);
            break;
        }
    }
}

// 定期清理长时间等待的用户（5分钟）
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟
    
    // 找出超时用户的索引
    const timeoutUsers = [];
    waitingQueue.forEach((user, index) => {
        if (now - user.waitingSince > timeout) {
            timeoutUsers.push(index);
            // 通知用户匹配超时
            if (user.ws.readyState === WebSocket.OPEN) {
                user.ws.send(JSON.stringify({
                    type: 'system',
                    content: '匹配超时，未找到符合条件的聊天伙伴，请重试'
                }));
            }
        }
    });
    
    // 从队列中移除超时用户（从后往前移除，避免索引问题）
    for (let i = timeoutUsers.length - 1; i >= 0; i--) {
        waitingQueue.splice(timeoutUsers[i], 1);
    }
}, 30000); // 每30秒检查一次

module.exports = {
    handleMatchRequest,
    handleCancelMatch,
    handleEndChat,
    handleMessage,
    handleDisconnect
};
