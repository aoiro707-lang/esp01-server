const express = require('express');
const app = express();

// Khởi tạo dữ liệu mẫu cho 3 Relay
let devices = {
    "dev01": { 
        name: "Relay 01", 
        state: "OFF", 
        wifi: "Vinatoken_UCO", 
        lastPing: Date.now(),
        schedules: [] 
    },
    "dev02": { 
        name: "Relay 02", 
        state: "OFF", 
        wifi: "Vinatoken_UCO", 
        lastPing: Date.now(),
        schedules: [
            { on: "05:00", off: "06:00", days: "1111111" },
            { on: "18:00", off: "19:00", days: "1010100" }
        ] 
    },
    "dev03": { 
        name: "Relay 03", 
        state: "OFF", 
        wifi: "Vinatoken_UCO", 
        lastPing: Date.now(),
        schedules: [] 
    }
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP01s Control System</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 20px; color: #333; max-width: 500px; margin: auto; }
        .header { color: #e74c3c; font-weight: bold; font-size: 24px; margin-bottom: 5px; }
        .wifi-tag { display: inline-block; background: #e8fcf0; color: #2ecc71; padding: 5px 15px; border-radius: 5px; font-size: 14px; margin-bottom: 25px; }
        
        .device-card { border-bottom: 1px solid #f0f0f0; padding: 15px 0; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .dev-name { font-weight: bold; font-size: 18px; color: #000; }
        
        /* Switch gạt chuyên nghiệp */
        .switch { position: relative; display: inline-block; width: 55px; height: 28px; margin-right: 10px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #2ecc71; }
        input:checked + .slider:before { transform: translateX(26px); }

        .more-btn { cursor: pointer; font-size: 24px; color: #999; font-weight: bold; padding: 0 5px; transition: 0.2s; }
        .more-btn:hover { color: #333; }
        
        /* Khung cài đặt */
        .sched-box { border: 1.5px solid #2ecc71; border-radius: 8px; padding: 12px; margin-top: 15px; display: none; background: #fff; }
        .sched-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .day-wrap { display: flex; justify-content: space-between; width: 100%; border-top: 1px solid #eee; padding-top: 10px; }
        .day-item { font-size: 11px; text-align: center; color: #555; }
        .day-item input { margin-top: 5px; }
        .save-btn { cursor: pointer; font-size: 28px; color: #3498db; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); }
        
        /* Danh sách lịch hiển thị */
        .sched-item { display: flex; align-items: center; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #eee; }
        .on-time { color: #2ecc71; font-weight: bold; }
        .off-time { color: #e74c3c; font-weight: bold; }
        .days-text { color: #999; font-size: 12px; margin-left: 10px; font-style: italic; }
        .del-btn { color: #e74c3c; cursor: pointer; font-weight: bold; margin-left: auto; font-size: 16px; padding: 0 5px; }
    </style>
</head>
<body>
    <div class="header">ESP01s control system</div>
    <div class="wifi-tag" id="main-wifi">● Vinatoken_UCO Connected</div>

    <div id="device-list"></div>

    <script>
        let devData = ${JSON.stringify(devices)};
        const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

        function render() {
            let html = "";
            for (let id in devData) {
                let dev = devData[id];
                html += \`
                <div class="device-card">
                    <div class="row">
                        <span class="dev-name">\${dev.name}</span>
                        <div style="display:flex; align-items:center;">
                            <label class="switch">
                                <input type="checkbox" \${dev.state === 'ON' ? 'checked' : ''} onchange="toggleDev('\${id}', this.checked)">
                                <span class="slider"></span>
                            </label>
                            <span class="more-btn" onclick="toggleBox('\${id}')">...</span>
                        </div>
                    </div>
                    
                    <div id="box-\${id}" class="sched-box">
                        <div class="sched-row">
                            <span style="font-weight:bold; color:#555;">Schedule</span>
                            <span>ON <input type="time" id="on-\${id}"></span>
                            <span>OFF <input type="time" id="off-\${id}"></span>
                            <span class="save-btn" onclick="saveSched('\${id}')">💾</span>
                        </div>
                        <div class="day-wrap">
                            \${dayNames.map((d,i) => \`
                                <div class="day-item">\${d}<br><input type="checkbox" class="day-\${id}" value="\${i}"></div>
                            \`).join('')}
                            <div class="day-item">All<br><input type="checkbox" onchange="toggleAll('\${id}', this.checked)"></div>
                        </div>
                    </div>

                    <div id="list-\${id}" style="margin-top: 12px;">
                        \${dev.schedules.map((s, idx) => {
                            let days = [];
                            for(let i=0; i<7; i++) if(s.days[i]==='1') days.push(dayNames[i]);
                            let dTxt = days.length === 7 ? "Hàng ngày" : days.join(", ");
                            return \`
                            <div class="sched-item">
                                <span style="margin-right:8px;">🕒</span>
                                <span class="on-time">\${s.on}</span>
                                <span style="margin:0 5px; color:#ccc;">|</span>
                                <span class="off-time">\${s.off}</span>
                                <span class="days-text">(\${dTxt})</span>
                                <span class="del-btn" onclick="delSched('\${id}', \${idx})">✘</span>
                            </div>\`;
                        }).join('')}
                    </div>
                </div>\`;
            }
            document.getElementById('device-list').innerHTML = html;
        }

        function toggleBox(id) {
            let b = document.getElementById('box-' + id);
            b.style.display = b.style.display === 'block' ? 'none' : 'block';
        }

        function toggleDev(id, state) {
            fetch(\`/relay?id=\${id}&state=\${state ? 'ON' : 'OFF'}\`);
        }

        function toggleAll(id, check) {
            document.querySelectorAll('.day-' + id).forEach(i => i.checked = check);
        }

        function saveSched(id) {
            let on = document.getElementById('on-' + id).value;
            let off = document.getElementById('off-' + id).value;
            if(!on || !off) return alert("Vui lòng chọn giờ!");
            let days = "";
            document.querySelectorAll('.day-' + id).forEach(i => days += i.checked ? "1" : "0");
            if(days === "0000000") return alert("Vui lòng chọn ít nhất 1 ngày!");
            
            fetch(\`/add-sched?id=\${id}&on=\${on}&off=\${off}&days=\${days}\`).then(() => location.reload());
        }

        function delSched(id, idx) {
            if(confirm("Xóa lịch trình này?")) {
                fetch(\`/del-sched?id=\${id}&idx=\${idx}\`).then(() => location.reload());
            }
        }

        render();
    </script>
</body>
</html>
    `);
});

// Các API xử lý
app.get('/relay', (req, res) => {
    const { id, state } = req.query;
    if(devices[id]) devices[id].state = state;
    res.send("OK");
});

app.get('/add-sched', (req, res) => {
    const { id, on, off, days } = req.query;
    if(devices[id]) devices[id].schedules.push({ on, off, days });
    res.send("OK");
});

app.get('/del-sched', (req, res) => {
    const { id, idx } = req.query;
    if(devices[id]) devices[id].schedules.splice(idx, 1);
    res.send("OK");
});

app.get('/status', (req, res) => {
    const { id } = req.query;
    res.json(devices[id] || {});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server started...'));
