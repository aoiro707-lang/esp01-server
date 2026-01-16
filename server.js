const express = require('express');
const cors = require('cors');
const fs = require('fs'); // Thêm thư viện đọc ghi file
const app = express();

app.use(cors());
app.use(express.json());

const DATA_FILE = './devices_data.json';
let devices = {};

// Tải dữ liệu từ file khi server khởi động
if (fs.existsSync(DATA_FILE)) {
    try {
        devices = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) { devices = {}; }
}

// Hàm lưu dữ liệu
const saveData = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(devices));
};

app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espState } = req.query;
    if (!id) return res.send("No ID");

    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown" };
    }

    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    
    // So sánh trạng thái UX và ESP
    const serverState = devices[id].state;
    if (serverState !== espState) {
        // Gửi lệnh điều chỉnh cho ESP
        return res.send(serverState === "ON" ? "TURN_ON" : "TURN_OFF");
    }
    res.send("OK");
});

// Cập nhật lại các route khác để có lệnh saveData()
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state; 
        saveData();
    }
    res.send("OK"); 
});

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

// ... Các route khác (rename, all-data...) giữ nguyên nhưng nhớ gọi saveData() khi thay đổi
