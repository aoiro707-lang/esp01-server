const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

let devices = {};

// Đọc dữ liệu cũ từ file nếu có
if (fs.existsSync('data.json')) {
    try {
        devices = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    } catch (e) {
        devices = {};
    }
}

function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(devices, null, 2));
}

// API cho người dùng nhấn nút trên giao diện Web
app.get('/relay', (req, res) => {
    const { id, state } = req.query;
    if (id && devices[id]) {
        devices[id].state = state;
        devices[id].lastUserAction = Date.now(); // Lưu lại lúc người dùng bấm
        saveData();
        console.log(`[User] Device ${id} set to ${state}`);
    }
    res.send("OK");
});

// API cho ESP8266 Ping và đồng bộ trạng thái
app.get('/ping', (req, res) => {
    const { id, state: espPhysState, name, wifi } = req.query;
    if (!id) return res.send("No ID");

    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }

    devices[id].lastPing = Date.now();
    if (wifi) devices[id].wifi = wifi;

    const webState = devices[id].state;
    const lastAction = devices[id].lastUserAction || 0;
    const timeSinceClick = Date.now() - lastAction;

    // LOGIC ĐỒNG BỘ:
    if (espPhysState) {
        // 1. Nếu người dùng vừa bấm Web (< 10 giây) -> Ép ESP theo Web
        if (timeSinceClick < 10000) {
            if (webState !== espPhysState) {
                console.log(`[Sync] Force ESP to ${webState}`);
                return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // 2. Nếu ESP tự thay đổi (do Hẹn giờ) -> Cập nhật Web theo ESP
        else {
            if (webState !== espPhysState) {
                console.log(`[Sync] Web updated to ${espPhysState} (by Schedule)`);
                devices[id].state = espPhysState;
                saveData();
            }
        }
    }
    res.send("OK");
});

// API trả về thông tin thiết bị (tên, trạng thái, lịch trình)
app.get('/status', (req, res) => {
    const { id } = req.query;
    if (id && devices[id]) {
        res.json(devices[id]);
    } else {
        res.status(404).send("Not Found");
    }
});

// API cập nhật lịch trình từ Web lên Server
app.get('/update_schedule', (req, res) => {
    const { id, schedules } = req.query;
    if (id && devices[id]) {
        try {
            devices[id].schedules = JSON.parse(schedules);
            saveData();
            res.send("OK");
        } catch (e) {
            res.status(400).send("Invalid JSON");
        }
    } else {
        res.status(404).send("Not Found");
    }
});

// API liệt kê tất cả thiết bị (cho trang chủ giao diện)
app.get('/list', (req, res) => {
    res.json(devices);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
