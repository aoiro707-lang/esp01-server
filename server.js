const express = require('express');
const fetch = require('node-fetch');
const app = express();

let relayState = "OFF";
let wifiName = "UNKNOWN";
let lastPing = 0;

let schedule = {
    on: "00:00",
    off: "00:00",
    days: "0000000",
    version: 0
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP01s Smart Control</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; text-align: center; background: #f0f2f5; padding: 20px; color: #333; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto 20px; }
        .btn { width: 45%; padding: 12px; margin: 5px; border-radius: 8px; border: none; cursor: pointer; color: white; font-weight: bold; transition: 0.3s; }
        .on { background: #2ecc71; } .off { background: #e74c3c; }
        .save { background: #3498db; width: 93%; margin-top: 15px; }
        .clear { background: #95a5a6; width: 93%; margin-top: 5px; }
        .day-wrap { display: flex; justify-content: space-around; margin: 15px 0; flex-wrap: wrap; background: #f8f9fa; padding: 10px; border-radius: 8px; }
        .day-item { font-size: 11px; display: flex; flex-direction: column; align-items: center; }
        .wifi-status { font-weight: bold; margin-bottom: 10px; font-size: 14px; padding: 5px; border-radius: 20px; }
        .sched-preview { background: #e8f4fd; padding: 10px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3498db; text-align: left; }
        .day-tag { display: inline-block; background: #3498db; color: white; padding: 2px 6px; border-radius: 4px; margin: 2px; font-size: 10px; }
    </style>
</head>
<body>
    <div class="card">
        <h3>Hệ thống ESP01s</h3>
        <div id="wifi-info" class="wifi-status">Checking...</div>
        <hr style="opacity: 0.1">
        <h4>Điều khiển nhanh</h4>
        <button class="btn on" onclick="ctrl('ON')">BẬT</button>
        <button class="btn off" onclick="ctrl('OFF')">TẮT</button>
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
        <button class="btn save" onclick="saveSchedule()">LƯU LỊCH TRÌNH</button>
        <button class="btn clear" onclick="clearSchedule()">XÓA LỊCH TRÌNH</button>

        <div id="sched-display" class="sched-preview">
            <strong>Lịch hiện tại:</strong> <span id="summary-text">Chưa cấu hình</span>
            <div id="summary-days"></div>
        </div>
    </div>

    <script>
        const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

        function ctrl(s) { fetch('/relay?state=' + s); }

        function toggleAll() {
            let checks = document.querySelectorAll('.day');
            let anyUnchecked = Array.from(checks).some(c => !c.checked);
            checks.forEach(c => c.checked = anyUnchecked);
        }

        function saveSchedule() {
            let dStr = "";
            let selectedDays = [];
            document.querySelectorAll('.day').forEach((c, i) => {
                if(c.checked) { dStr += "1"; selectedDays.push(dayNames[i]); }
                else { dStr += "0"; }
            });
            let on = document.getElementById('tOn').value;
            let off = document.getElementById('tOff').value;
            
            fetch(\`/set-schedule?on=\${on}&off=\${off}&days=\${dStr}\`)
                .then(() => {
                    updateSchedUI(on, off, selectedDays);
                    alert("Đã lưu lịch!");
                });
        }

        function clearSchedule() {
            if(confirm("Bạn có chắc muốn xóa toàn bộ lịch trình?")) {
                fetch('/set-schedule?on=00:00&off=00:00&days=0000000')
                    .then(() => {
                        document.querySelectorAll('.day').forEach(c => c.checked = false);
                        updateSchedUI("00:00", "00:00", []);
                        alert("Đã xóa lịch!");
                    });
            }
        }

        function updateSchedUI(on, off, daysArray) {
            const summary = document.getElementById('summary-text');
            const daysDiv = document.getElementById('summary-days');
            if (on === "00:00" && off === "00:00") {
                summary.innerHTML = "Trống";
                daysDiv.innerHTML = "";
            } else {
                summary.innerHTML = \`Bật: <b>\${on}</b> | Tắt: <b>\${off}</b>\`;
                daysDiv.innerHTML = daysArray.map(d => \`<span class="day-tag">\${d}</span>\`).join('');
            }
        }

        function updateStatus() {
            fetch('/status').then(r => r.json()).then(data => {
                const wifiInfo = document.getElementById('wifi-info');
                if(data.online) {
                    wifiInfo.innerHTML = "● " + data.wifi + " Connected";
                    wifiInfo.style.background = "#eafaf1";
                    wifiInfo.style.color = "#2ecc71";
                } else {
                    wifiInfo.innerHTML = "○ Device Offline";
                    wifiInfo.style.background = "#fdedec";
                    wifiInfo.style.color = "#e74c3c";
                }
            });
        }

        window.onload = () => {
            let initialDays = [];
            let currentDays = "${schedule.days}";
            for(let i=0; i<7; i++) if(currentDays[i] === '1') initialDays.push(dayNames[i]);
            updateSchedUI("${schedule.on}", "${schedule.off}", initialDays);
            setInterval(updateStatus, 3000);
            updateStatus();
        };
    </script>
</body>
</html>
    `);
});

// API cho ESP01s Ping
app.get('/ping', (req, res) => {
    if(req.query.wifi) {
        wifiName = req.query.wifi;
        lastPing = Date.now();
    }
    res.send("OK");
});

app.get('/status', (req, res) => {
    // Tăng thời gian kiểm tra Online lên 45 giây để tránh báo Offline nhầm khi mạng lag
    res.json({
        state: relayState,
        wifi: wifiName,
        online: (Date.now() - lastPing) < 45000, 
        sched: schedule
    });
});

app.get('/set-schedule', (req, res) => {
    schedule.on = req.query.on;
    schedule.off = req.query.off;
    schedule.days = req.query.days;
    schedule.version++;
    res.json(schedule);
});

app.get('/relay', (req, res) => { relayState = req.query.state; res.send("OK"); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running...'));
