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

// --- NGĂN SERVER SLEEP (10 PHÚT) ---
const SERVER_URL = "https://esp01-server-1.onrender.com"; 
setInterval(() => {
    https.get(SERVER_URL, (res) => {}).on('error', (e) => {});
}, 600000); 

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

// --- API GỘP TẤT CẢ TRONG MỘT (GIẢM LATENCY) ---
app.get('/status', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id) return res.status(400).json({error: "No ID"});

    let changed = false;
    if (!devices[id]) {
        devices[id] = { name: "Relay_ESP", state: "OFF", schedules: [], wifi: "Unknown", lastUserAction: 0 };
        changed = true;
    }

    // Cập nhật thông tin từ ESP gửi lên
    if (wifi) { devices[id].wifi = wifi; changed = true; }
    devices[id].lastPing = Date.now();

    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    // Logic đồng bộ trạng thái thông minh
    if (espPhysState) {
        if (timeSinceLastClick < 15000) {
            // Trong 15s sau khi bấm web, giữ trạng thái web làm chuẩn
        } else if (devices[id].state !== espPhysState) {
            devices[id].state = espPhysState;
            changed = true;
        }
    }

    if (changed) saveData();
    res.json(devices[id]); // Trả về toàn bộ object bao gồm cả schedules
});

// Các API bổ trợ giữ nguyên logic cũ nhưng có saveData
app.get('/relay', (req, res) => {
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state;
        devices[req.query.id].lastUserAction = Date.now();
        saveData();
    }
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/add-sched', (req, res) => { /* logic cũ */ devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); saveData(); res.send("OK"); });
app.get('/del-sched', (req, res) => { /* logic cũ */ devices[req.query.id].schedules.splice(req.query.idx, 1); saveData(); res.send("OK"); });
app.get('/rename', (req, res) => { if(devices[req.query.id]) devices[req.query.id].name = req.query.name; saveData(); res.send("OK"); });

// Giao diện (Phần HTML đã gửi ở phản hồi trước, giữ nguyên)
app.get('/', (req, res) => { /* HTML Code */ });

app.listen(10000);
