const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown" };
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    // Đối soát: Nếu trạng thái Web khác thực tế ESP, gửi lệnh đồng bộ
    const targetState = devices[id].state;
    if (espPhysState && targetState !== espPhysState) {
        return res.send(targetState === "ON" ? "TURN_ON" : "TURN_OFF");
    }
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));

// Khi nhấn nút trên Web, cập nhật mục tiêu mới ngay lập tức
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].state = req.query.state; 
    res.send("OK"); 
});

app.get('/add-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); res.send("OK"); });
app.get('/del-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); res.send("OK"); });
app.get('/rename', (req, res) => { if(devices[req.query.id]) devices[req.query.id].name = req.query.name; res.send("OK"); });

app.get('/', (req, res) => {
    // ... (Giữ nguyên phần HTML/JS Giao diện của bạn)
    res.send(`...`); 
});

app.listen(10000);
