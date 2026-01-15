const express = require('express');
const fetch = require('node-fetch');
const app = express();

let relayState = "OFF";
let wifiName = "UNKNOWN";
let lastPing = 0;

// Cấu trúc lưu lịch trình mới
let schedule = {
    on: "00:00",
    off: "00:00",
    days: "0000000", // T2 T3 T4 T5 T6 T7 CN
    version: 0       // Dùng để ESP biết khi nào có lịch mới để tải
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP01s Smart Schedule</title>
    <style>
        body { font-family: sans-serif; text-align: center; background: #f4f4f4; padding: 20px; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); max-width: 380px; margin: auto; margin-bottom: 20px; }
        .btn { width: 45%; padding: 12px; margin: 5px; border-radius: 8px; border: none; cursor: pointer; color: white; font-weight: bold; }
        .on { background: #2ecc71; } .off { background: #e74c3c; }
        .save { background: #3498db; width: 93%; margin-top: 15px; }
        .day-wrap { display: flex; justify-content: space-around; margin: 15px 0; flex-wrap: wrap; }
        .day-item { font-size: 12px; display: flex; flex-direction: column; }
    </style>
</head>
<body>
    <div class="card">
        <h3>Điều khiển nhanh</h3>
        <button class="btn on" onclick="fetch('/relay?state=ON')">BẬT</button>
        <button class="btn off" onclick="fetch('/relay?state=OFF')">TẮT</button>
    </div>

    <div class="card">
        <h3>Lịch trình hệ thống</h3>
        <div style="margin-bottom:10px;">
            Bật: <input type="time" id="tOn" value="${schedule.on}"> 
            Tắt: <input type="time" id="tOff" value="${schedule.off}">
        </div>
        
        <div class="day-wrap">
            <button onclick="toggleAll()" style="width:100%; margin-bottom:10px; border-radius:5px; border:1px solid #ccc;">Chọn tất cả / Bỏ chọn</button>
            ${['T2','T3','T4','T5','T6','T7','CN'].map((d, i) => `
                <div class="day-item">
                    <span>${d}</span>
                    <input type="checkbox" class="day" value="${i}" ${schedule.days[i] === '1' ? 'checked' : ''}>
                </div>
            `).join('')}
        </div>
        <button class="btn save" onclick="saveSchedule()">LƯU LỊCH VÀO THIẾT BỊ</button>
    </div>

    <script>
        function toggleAll() {
            let checks = document.querySelectorAll('.day');
            let anyUnchecked = Array.from(checks).some(c => !c.checked);
            checks.forEach(c => c.checked = anyUnchecked);
        }

        function saveSchedule() {
            let dStr = "";
            document.querySelectorAll('.day').forEach(c => dStr += c.checked ? "1" : "0");
            let on = document.getElementById('tOn').value;
            let off = document.getElementById('tOff').value;
            
            // Fix lỗi Syntax: Sử dụng escape cho dấu $
            fetch(\`/set-schedule?on=\${on}&off=\${off}&days=\${dStr}\`)
                .then(() => alert("Lịch trình đã được gửi tới Server!"));
        }
    </script>
</body>
</html>
    `);
});

app.get('/set-schedule', (req, res) => {
    schedule.on = req.query.on;
    schedule.off = req.query.off;
    schedule.days = req.query.days;
    schedule.version++; // Tăng version để ESP nhận biết có thay đổi
    res.json(schedule);
});

app.get('/status', (req, res) => {
    res.json({
        state: relayState,
        wifi: wifiName,
        online: (Date.now() - lastPing) < 20000,
        sched: schedule // Gửi kèm lịch để ESP kiểm tra version
    });
});

// Các endpoint /relay và /ping giữ nguyên...
app.get('/relay', (req, res) => { relayState = req.query.state; res.send(relayState); });
app.get('/ping', (req, res) => { wifiName = req.query.wifi; lastPing = Date.now(); res.send("OK"); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
