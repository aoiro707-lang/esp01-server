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
    <title>ESP01s Smart Hub</title>
    <style>
        body { font-family: sans-serif; text-align: center; background: #f0f2f5; padding: 20px; color: #333; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto 20px; }
        .btn { width: 45%; padding: 12px; margin: 5px; border-radius: 8px; border: none; cursor: pointer; color: white; font-weight: bold; transition: 0.3s; }
        .on { background: #2ecc71; } .on:active { background: #27ae60; }
        .off { background: #e74c3c; } .off:active { background: #c0392b; }
        .save { background: #3498db; width: 93%; margin-top: 15px; }
        .day-wrap { display: flex; justify-content: space-around; margin: 15px 0; flex-wrap: wrap; background: #f8f9fa; padding: 10px; border-radius: 8px; }
        .day-item { font-size: 11px; display: flex; flex-direction: column; align-items: center; }
        .wifi-status { color: #2ecc71; font-weight: bold; margin-bottom: 10px; font-size: 14px; }
        .sched-preview { background: #e8f4fd; padding: 10px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #3498db; text-align: left; font-size: 13px; }
        .day-tag { display: inline-block; background: #3498db; color: white; padding: 2px 6px; border-radius: 4px; margin: 2px; font-size: 10px; }
    </style>
</head>
<body>
    <div class="card">
        <h3>Hệ thống ESP01s</h3>
        <div class="wifi-status" id="wifi-info">Đang kiểm tra kết nối...</div>
        <hr style="opacity: 0.2;">
        <h4>Điều khiển nhanh</h4>
        <button class="btn on" onclick="fetch('/relay?state=ON')">BẬT</button>
        <button class="btn off" onclick="fetch('/relay?state=OFF')">TẮT</button>
    </div>

    <div class="card">
        <h3>Lập lịch định kỳ</h3>
        <div>
            Bật: <input type="time" id="tOn" value="${schedule.on}"> 
            Tắt: <input type="time" id="tOff" value="${schedule.off}">
        </div>
        
        <div class="day-wrap">
            <button onclick="toggleAll()" style="width:100%; margin-bottom:10px; cursor:pointer;">Chọn/Bỏ tất cả</button>
            ${['T2','T3','T4','T5','T6','T7','CN'].map((d, i) => `
                <div class="day-item">
                    <span>${d}</span>
                    <input type="checkbox" class="day" value="${i}" ${schedule.days[i] === '1' ? 'checked' : ''}>
                </div>
            `).join('')}
        </div>
        <button class="btn save" onclick="saveSchedule()">LƯU LỊCH VÀO THIẾT BỊ</button>

        <div id="sched-display" class="sched-preview">
            <strong>Lịch hiện tại:</strong> <span id="summary-text">Chưa cấu hình</span>
            <div id="summary-days"></div>
        </div>
    </div>

    <script>
        const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

        function toggleAll() {
            let checks = document.querySelectorAll('.day');
            let anyUnchecked = Array.from(checks).some(c => !c.checked);
            checks.forEach(c => c.checked = anyUnchecked);
        }

        function saveSchedule() {
            let dStr = "";
            let selectedDays = [];
            document.querySelectorAll('.day').forEach((c, i) => {
                if(c.checked) {
                    dStr += "1";
                    selectedDays.push(dayNames[i]);
                } else {
                    dStr += "0";
                }
            });
            
            let on = document.getElementById('tOn').value;
            let off = document.getElementById('tOff').value;
            
            fetch(\`/set-schedule?on=\${on}&off=\${off}&days=\${dStr}\`)
                .then(() => {
                    updateSchedUI(on, off, selectedDays);
                    alert("Đã lưu lịch trình!");
                });
        }

        function updateSchedUI(on, off, daysArray) {
            document.getElementById('summary-text').innerHTML = \`Bật lúc <b>\${on}</b>, Tắt lúc <b>\${off}</b>\`;
            document.getElementById('summary-days').innerHTML = daysArray.map(d => \`<span class="day-tag">\${d}</span>\`).join('');
        }

        function updateStatus() {
            fetch('/status').then(r => r.json()).then(data => {
                const wifiInfo = document.getElementById('wifi-info');
                if(data.online) {
                    wifiInfo.innerHTML = \`✅ \${data.wifi} Connected\`;
                    wifiInfo.style.color = "#2ecc71";
                } else {
                    wifiInfo.innerHTML = "❌ Device Offline";
                    wifiInfo.style.color = "#e74c3c";
                }
            });
        }

        // Khởi tạo hiển thị lịch lần đầu nếu đã có dữ liệu từ server
        window.onload = () => {
            let initialDays = [];
            let currentDays = "${schedule.days}";
            for(let i=0; i<7; i++) if(currentDays[i] === '1') initialDays.push(dayNames[i]);
            updateSchedUI("${schedule.on}", "${schedule.off}", initialDays);
            setInterval(updateStatus, 3000);
        };
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
