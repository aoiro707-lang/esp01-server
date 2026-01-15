const express = require('express');
const app = express();

// Cấu trúc dữ liệu cho nhiều thiết bị
let devices = {
    "dev01": { 
        name: "Relay 01", 
        state: "OFF", 
        wifi: "Vinatoken_UCO", 
        lastPing: Date.now(),
        schedules: [] // Mảng chứa các lịch trình: {on: "02:06", off: "02:30", days: "1111111"}
    },
    "dev02": { name: "Relay 02", state: "OFF", wifi: "UNKNOWN", lastPing: 0, schedules: [] },
    "dev03": { name: "Relay 03", state: "OFF", wifi: "UNKNOWN", lastPing: 0, schedules: [] }
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP01s Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #fdfdfd; padding: 15px; }
        .header { color: #e74c3c; font-weight: bold; font-size: 20px; margin-bottom: 5px; }
        .wifi-tag { display: inline-block; background: #e8fcf0; color: #2ecc71; padding: 4px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 20px; }
        
        .device-card { border-bottom: 1px solid #eee; padding: 15px 0; max-width: 500px; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .dev-name { font-weight: bold; font-size: 16px; flex-grow: 1; }
        
        /* CSS Công tắc gạt */
        .switch { position: relative; display: inline-block; width: 50px; height: 26px; margin-right: 15px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #2ecc71; }
        input:checked + .slider:before { transform: translateX(24px); }

        .more-btn { cursor: pointer; font-size: 20px; color: #666; padding: 0 10px; }
        
        /* Khung Schedule */
        .sched-box { border: 1px solid #2ecc71; border-radius: 4px; padding: 10px; margin-top: 10px; display: none; }
        .sched-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
        .day-check { font-size: 10px; text-align: center; }
        .save-btn { cursor: pointer; color: #3498db; font-size: 22px; }
        .del-btn { color: #e74c3c; cursor: pointer; font-weight: bold; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="header">ESP01s control system</div>
    <div class="wifi-tag" id="main-wifi">● Vinatoken_UCO Connected</div>

    <div id="device-list"></div>

 // ... (Các phần CSS và dữ liệu giữ nguyên như bản trước) ...

<script>
    const dayNamesShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    function renderDevices() {
        let html = "";
        for (let id in devData) {
            let dev = devData[id];
            html += `
            <div class="device-card">
                <div class="row">
                    <span class="dev-name">${dev.name}</span>
                    <label class="switch">
                        <input type="checkbox" ${dev.state === 'ON' ? 'checked' : ''} onchange="toggleDev('${id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <span class="more-btn" onclick="toggleBox('${id}')">...</span>
                </div>
                
                <div id="box-${id}" class="sched-box">
                    <div class="sched-row">
                        <strong>Lập lịch</strong> 
                        ON <input type="time" id="on-${id}"> 
                        OFF <input type="time" id="off-${id}">
                        <span class="save-btn" onclick="saveSched('${id}')">💾</span>
                    </div>
                    <div class="sched-row" style="border-top: 1px solid #eee; padding-top:5px;">
                        ${dayNamesShort.map((d,i) => `
                            <div class="day-check">
                                ${d}<br><input type="checkbox" class="day-${id}" value="${i}">
                            </div>
                        `).join('')}
                        <div class="day-check">All<br><input type="checkbox" onchange="toggleAll('${id}', this.checked)"></div>
                    </div>
                </div>

                <div id="list-${id}" style="margin-top: 10px; font-size: 13px;">
                    ${dev.schedules.map((s, idx) => {
                        // Chuyển chuỗi "1101000" thành mảng các thứ (T2, T3, T5)
                        let activeDays = [];
                        for(let i=0; i<7; i++) {
                            if(s.days[i] === '1') activeDays.push(dayNamesShort[i]);
                        }
                        let daysText = activeDays.length === 7 ? "Hàng ngày" : activeDays.join(", ");

                        return `
                        <div style="display:flex; align-items:center; margin-bottom:5px; border-bottom: 1px dashed #eee; padding: 3px 0;">
                            <span style="margin-right:8px;">🕒</span>
                            <span style="color:#2ecc71; font-weight:bold;">${s.on}</span> 
                            <span style="margin: 0 5px;">|</span>
                            <span style="color:#e74c3c; font-weight:bold;">${s.off}</span>
                            <span style="color:#888; margin-left:10px; font-size:11px;">(${daysText})</span>
                            <span class="del-btn" onclick="delSched('${id}', ${idx})" style="margin-left:auto;">✘</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }
        document.getElementById('device-list').innerHTML = html;
    }
    
    // ... (Các hàm toggleDev, saveSched, delSched giữ nguyên) ...
</script>
</body>
</html>
    `);
});

// Các API xử lý lưu mảng Schedule (Bạn cần hoàn thiện logic lưu mảng này trên Render)
app.get('/add-sched', (req, res) => {
    const { id, on, off, days } = req.query;
    devices[id].schedules.push({ on, off, days });
    res.send("OK");
});

app.get('/del-sched', (req, res) => {
    const { id, idx } = req.query;
    devices[id].schedules.splice(idx, 1);
    res.send("OK");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running...'));
