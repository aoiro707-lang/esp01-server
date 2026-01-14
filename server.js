const express = require('express');
const fetch = require('node-fetch');
const app = express();

let relayState = "OFF";
let wifiName = "UNKNOWN";
let lastPing = 0;
let timerEnd = 0; // Thời gian kết thúc hẹn giờ (Unix timestamp)

// --- TỰ ĐỘNG WAKE UP MỖI 9 PHÚT 59 GIÂY ---
const SERVER_URL = 'https://esp01-server.onrender-1.com/ping?wake=true';
setInterval(() => {
    fetch(SERVER_URL)
        .then(() => console.log('Self-ping thành công để giữ server thức!'))
        .catch(err => console.log('Self-ping lỗi: ', err));
}, 599000); // 9 phút 59 giây

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP01s Control</title>
    <style>
        body { font-family: sans-serif; text-align: center; background: #f4f4f4; padding: 20px; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); max-width: 350px; margin: auto; }
        .btn { width: 80%; padding: 15px; margin: 10px; font-size: 18px; border: none; border-radius: 8px; cursor: pointer; color: white; }
        .on { background: #2ecc71; } .off { background: #e74c3c; }
        .timer-btn { background: #3498db; width: 45%; padding: 10px; font-size: 14px; }
        .status { margin: 15px 0; font-weight: bold; }
        #countdown { color: blue; }
    </style>
</head>
<body>
    <div class="card">
        <h2>IOT ESP01s</h2>
        <div class="status" id="wifi">WiFi: --</div>
        <div class="status" id="relay">Relay: --</div>
        <div id="countdown"></div>

        <button class="btn on" onclick="ctrl('ON')">BẬT</button>
        <button class="btn off" onclick="ctrl('OFF')">TẮT</button>
        <hr>
        <h4>Hẹn giờ tắt (Phút)</h4>
        <button class="btn timer-btn" onclick="setTimer(1)">1 Phút</button>
        <button class="btn timer-btn" onclick="setTimer(10)">10 Phút</button>
        <button class="btn timer-btn" onclick="setTimer(30)">30 Phút</button>
    </div>

    <script>
        function ctrl(s) { fetch('/relay?state=' + s); }
        function setTimer(m) { fetch('/set-timer?min=' + m); }
        
        function update() {
            fetch('/status').then(r => r.json()).then(data => {
                document.getElementById('wifi').innerText = data.online ? "WiFi: " + data.wifi : "OFFLINE";
                document.getElementById('relay').innerText = "Trạng thái: " + data.state;
                if(data.timerLeft > 0) {
                    document.getElementById('countdown').innerText = "Tự tắt sau: " + data.timerLeft + "s";
                } else {
                    document.getElementById('countdown').innerText = "";
                }
            });
        }
        setInterval(update, 2000);
    </script>
</body>
</html>
    `);
});

// API cho ESP01s
app.get('/ping', (req, res) => {
    if(req.query.wifi) {
        wifiName = req.query.wifi;
        lastPing = Date.now();
    }
    res.send("OK");
});

// API lấy trạng thái
app.get('/status', (req, res) => {
    let now = Date.now();
    // Xử lý đếm ngược hẹn giờ
    let timeLeft = Math.max(0, Math.round((timerEnd - now) / 1000));
    if(timerEnd > 0 && now > timerEnd) {
        relayState = "OFF";
        timerEnd = 0;
    }

    res.json({
        online: (now - lastPing) < 15000,
        state: relayState,
        wifi: wifiName,
        timerLeft: timeLeft
    });
});

// API điều khiển
app.get('/relay', (req, res) => {
    relayState = req.query.state;
    if(relayState === "OFF") timerEnd = 0; // Hủy hẹn giờ nếu tắt thủ công
    res.json({state: relayState});
});

// API hẹn giờ
app.get('/set-timer', (req, res) => {
    let mins = parseInt(req.query.min);
    relayState = "ON";
    timerEnd = Date.now() + (mins * 60 * 1000);
    res.json({timer: mins});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running...'));
