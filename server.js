const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Thêm biến lưu lịch trình trên Server
let schedule = {
    timeOn: "00:00",
    timeOff: "00:00",
    days: "0000000", // T2 T3 T4 T5 T6 T7 CN
    active: false
};

let relayState = "OFF";
let wifiName = "UNKNOWN";
let lastPing = 0;
let timerEnd = 0; // Thời gian kết thúc hẹn giờ (Unix timestamp)

// --- TỰ ĐỘNG WAKE UP MỖI 9 PHÚT 59 GIÂY ---
const SERVER_URL = 'https://esp01-server-1.onrender.com/ping?wake=true';
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
    <h4>Lập lịch định kỳ</h4>
    <input type="time" id="tOn"> đến <input type="time" id="tOff">
    <div id="daySelector" style="margin: 10px 0;">
        <button onclick="toggleAll()">All</button><br>
        <input type="checkbox" class="day" value="0"> T2
        <input type="checkbox" class="day" value="1"> T3
        <input type="checkbox" class="day" value="2"> T4
        <input type="checkbox" class="day" value="3"> T5
        <input type="checkbox" class="day" value="4"> T6
        <input type="checkbox" class="day" value="5"> T7
        <input type="checkbox" class="day" value="6"> CN
    </div>
    <button class="btn on" onclick="saveSchedule()">LƯU LỊCH</button>
</div>
<script>
function toggleAll() {
    let checks = document.querySelectorAll('.day');
    let allSelected = Array.from(checks).every(c => c.checked);
    checks.forEach(c => c.checked = !allSelected);
}

function saveSchedule() {
    let days = "";
    document.querySelectorAll('.day').forEach(c => days += c.checked ? "1" : "0");
    let tOn = document.getElementById('tOn').value;
    let tOff = document.getElementById('tOff').value;
    fetch(`/set-schedule?on=${tOn}&off=${tOff}&days=\${days}`);
}
</script>

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
