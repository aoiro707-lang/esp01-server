const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'devices_data.json');
let devices = {}; 

// Keep-alive để Render không sleep
const SERVER_URL = "https://esp01-server-1.onrender.com"; 
setInterval(() => {
    https.get(SERVER_URL, (res) => {}).on('error', (e) => {});
}, 600000); 

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            console.log("-> Dữ liệu đã nạp.");
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); 
    } catch (err) { console.error("Lỗi lưu file:", err); }
};

loadData();

// --- API ĐỒNG BỘ CHÍNH ---
app.get('/status', (req, res) => {
    const { id, wifi, state: espState } = req.query;
    if (!id) return res.json({ error: "No ID" });

    if (!devices[id]) {
        devices[id] = { name: "Thiết bị mới", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }

    devices[id].lastPing = Date.now();
    if (wifi) devices[id].wifi = wifi;

    // Logic: Chỉ cập nhật trạng thái từ ESP lên Server nếu người dùng KHÔNG bấm nút trên Web trong 30s qua
    const timeSinceLastAction = Date.now() - (devices[id].lastUserAction || 0);
    if (espState && timeSinceLastAction > 30000) {
        if (devices[id].state !== espState) {
            devices[id].state = espState;
            saveData();
        }
    }

    res.json(devices[id]);
});

app.get('/relay', (req, res) => { 
    const { id, state } = req.query;
    if(devices[id]) {
        devices[id].state = state; 
        devices[id].lastUserAction = Date.now(); // Đánh dấu vừa thao tác thủ công
        saveData();
    }
    res.send("OK"); 
});

app.get('/all-data', (req, res) => res.json(devices));

app.get('/add-sched', (req, res) => { 
    const { id, on, off, days } = req.query;
    if(devices[id]) {
        devices[id].schedules.push({ on, off, days }); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/del-sched', (req, res) => { 
    const { id, idx } = req.query;
    if(devices[id] && devices[id].schedules[idx]) {
        devices[id].schedules.splice(idx, 1); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/rename', (req, res) => { 
    const { id, name } = req.query;
    if(devices[id]) {
        devices[id].name = name; 
        saveData();
    }
    res.send("OK"); 
});

// --- GIAO DIỆN (Giữ nguyên Style của bạn) ---
app.get('/', (req, res) => {
    // Phần HTML giữ nguyên như code cũ của bạn vì nó đã hoạt động tốt
    // Lưu ý: Đảm bảo fetch tới các endpoint /status và /relay đúng ID
    res.sendFile(path.join(__dirname, 'index.html')); // Hoặc dán chuỗi HTML cũ của bạn vào đây
});

app.listen(10000, '0.0.0.0', () => console.log("Server running on port 10000"));
