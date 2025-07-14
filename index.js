const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Cấu hình
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const API_URL = 'https://apihitclub.up.railway.app/api/taixiumd5';

// Khởi tạo bot Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Mảng lưu trữ chat ID của người dùng đã dùng /start
let users = [];

// Mảng lưu trữ 4 phiên gần nhất
let sessions = [];

// Hàm gửi tin nhắn cho tất cả người dùng
async function sendToAllUsers(message) {
    for (const userId of users) {
        try {
            await bot.sendMessage(userId, message);
            console.log(`Đã gửi tin nhắn tới ${userId}: ${message}`);
        } catch (error) {
            console.error(`Lỗi gửi tin nhắn tới ${userId}: ${error.message}`);
        }
    }
}

// Hàm lấy dữ liệu từ API
async function fetchSessionData() {
    try {
        const response = await axios.get(API_URL, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.status !== 200) {
            throw new Error('Lỗi khi gọi API: ' + response.status);
        }
        return response.data;
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu API:', error.message);
        return null;
    }
}

// Hàm tính khoảng cách giữa hai tổng điểm
function calculateDistance(total1, total2) {
    if (total1 === total2) {
        return 5; // Nếu tổng bằng nhau, khoảng cách là 5
    }
    return Math.abs(total1 - total2);
}

// Hàm dự đoán kết quả
async function predictResult() {
    if (sessions.length < 4) {
        const progress = sessions.length * 25;
        const message = `Bot đã chạy được ${progress}% / 100%`;
        await sendToAllUsers(message);
        return;
    }

    // Lấy tổng điểm của 4 phiên
    const totals = sessions.slice(-4).map(session => session.total);

    // Tính khoảng cách
    let distances = [];
    for (let i = 1; i < totals.length; i++) {
        distances.push(calculateDistance(totals[i - 1], totals[i]));
    }

    // Tính tổng khoảng cách
    const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);

    // Dự đoán kết quả
    let prediction;
    if (totalDistance < 3 || totalDistance > 18) {
        prediction = 'Cầu rất xấu, nên nghỉ!';
    } else {
        // Dự đoán ngược lại theo yêu cầu
        prediction = totalDistance <= 10 ? 'Tài' : 'Xỉu';
    }

    // Tạo tin nhắn kết quả
    const latestSession = sessions[sessions.length - 1];
    const message = `
Kết quả phiên gần nhất
#${latestSession.sessionId} : ${latestSession.result}
Tổng điểm ${latestSession.total} (${latestSession.dice1}-${latestSession.dice2}-${latestSession.dice3})
Dự đoán phiên tiếp theo: ${prediction}
    `;

    await sendToAllUsers(message);
}

// Xử lý lệnh /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!users.includes(chatId)) {
        users.push(chatId);
        console.log(`Người dùng ${chatId} đã khởi động bot.`);
    }
    bot.sendMessage(chatId, 'Bot đã khởi động! Bạn sẽ nhận được dự đoán khi có dữ liệu mới.');
});

// Hàm chính chạy bot
async function runBot() {
    while (true) {
        try {
            console.log('Gọi API...');
            const data = await fetchSessionData();
            if (data) {
                console.log('Dữ liệu API:', data);
                const session = {
                    result: data.result || 'Không có dữ liệu',
                    sessionId: data.sessionId || 'Không có dữ liệu',
                    total: data.total || 0,
                    dice1: data.dice1 || 0,
                    dice2: data.dice2 || 0,
                    dice3: data.dice3 || 0
                };

                if (sessions.length === 0 || sessions[sessions.length - 1].sessionId !== session.sessionId) {
                    sessions.push(session);
                    if (sessions.length > 4) {
                        sessions.shift(); // Giữ chỉ 4 phiên gần nhất
                    }
                    await predictResult();
                }
            } else {
                console.log('Không nhận được dữ liệu từ API.');
            }
        } catch (error) {
            console.error('Lỗi trong runBot:', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 30000)); // Chờ 30 giây
    }
}

// Chạy bot
runBot().catch((error) => {
    console.error('Lỗi khởi động bot:', error.message);
});
