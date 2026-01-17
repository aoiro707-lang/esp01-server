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

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); } 
    catch (err) { console.error("Lỗi ghi file:", err); }
};

loadData();

// --- LOGIC PING THÔNG MINH ---
app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
        saveData();
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        // TRƯỜNG HỢP 1: Người dùng vừa bấm nút trên Web (< 15 giây)
        // Ưu tiên lệnh từ Web, ép ESP phải làm theo
        if (timeSinceLastClick < 15000) {
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // TRƯỜNG HỢP 2: ESP tự đổi trạng thái (do Hẹn giờ hoặc Nút bấm cứng)
        // Cập nhật trạng thái Web cho khớp với ESP (Nút web tự nhảy)
        else {
            if (serverWebState !== espPhysState) {
                console.log(`[Sync] Update Web to ${espPhysState} (by Device)`);
                devices[id].state = espPhysState;
                saveData();
            }
        }
    }
    res.send("OK");
});

app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state; 
        devices[req.query.id].lastUserAction = Date.now(); // Ghi lại lúc bấm nút
        saveData();
    }
    res.send("OK"); 
});

// Các API khác giữ nguyên...
app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); 
        saveData();
    }
    res.send("OK"); 
});
app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.splice(req.query.idx, 1); 
        saveData();
    }
    res.send("OK"); 
});
app.get('/rename', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].name = req.query.name; 
        saveData();
    }
    res.send("OK"); 
});

app.get('/', (req, res) => {
    // Giao diện HTML của bạn giữ nguyên nhưng hãy đảm bảo render() chạy mỗi 5s
    res.send(`... nội dung HTML của bạn ...`);
});

app.listen(10000);
