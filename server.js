const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

// --- API HỆ THỐNG ---
app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    if (!id) return res.send("No ID");
    if (!devices[id]) devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown" };
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/relay', (req, res) => { if(devices[req.query.id]) devices[req.query.id].state = req.query.state; res.send("OK"); });
app.get('/add-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); res.send("OK"); });
app.get('/del-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); res.send("OK"); });
app.get('/rename', (req, res) => { if(devices[req.query.id]) devices[req.query.id].name = req.query.name; res.send("OK"); });

// --- GIAO DIỆN WEB ---
app.get('/', (req, res) => {
    // Chúng ta dùng ký tự đặc biệt để bọc HTML tránh xung đột dấu backtick
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>IoT Control</title>
    <style>
        body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn { padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; font-weight: bold; }
        .btn-on { background: #2ecc71; color: white; }
        .btn-off { background: #95a5a6; color: white; }
        .sched-box { margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
</head>
<body>
    <h3>IoT ESP01s Control System</h3>
    <div id="list">Đang tải thiết bị...</div>

    <script>
        let devices = {};
        let openId = null;

        async function load() {
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) { console.log("Lỗi tải dữ liệu"); }
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị nào online"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                const btnClass = d.state === 'ON' ? 'btn-on' : 'btn-off';
                const nextState = d.state === 'ON' ? 'OFF' : 'ON';
                
                h += \`
                <div class="card">
                    <div class="flex">
                        <div>
                            <b style="color:#3498db; cursor:pointer" onclick="renameDevice('\${id}', '\${d.name}')">\${d.name}</b><br>
                            <small>WiFi: \${d.wifi}</small>
                        </div>
                        <div>
                            <button class="btn \${btnClass}" onclick="toggleRelay('\${id}', '\${nextState}')">\${d.state}</button>
                            <span style="cursor:pointer; margin-left:10px" onclick="toggleBox('\${id}')">...</span>
                        </div>
                    </div>
                    \${openId === id ? \`
                    <div class="sched-box">
                        <input type="time" id="t1-\${id}"> đến <input type="time" id="t2-\${id}">
                        <button onclick="addSched('\${id}')">Lưu</button>
                        <div id="sched-list-\${id}">
                            \${(d.schedules || []).map((s, i) => \`
                                <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:5px; background:#f9f9f9; padding:5px;">
                                    <span>🕒 \${s.on} - \${s.off}</span>
                                    <b style="color:red; cursor:pointer" onclick="delSched('\${id}', \${i})">✕</b>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                    \` : ''}
                </div>\`;
            });
            container.innerHTML = h;
        }

        function toggleBox(id) { openId = (openId === id) ? null : id; render(); }
        function toggleRelay(id, st) { fetch('/relay?id=' + id + '&state=' + st).then(load); }
        function renameDevice(id, old) { 
            let n = prompt("Tên mới:", old); 
            if(n) fetch('/rename?id=' + id + '&name=' + encodeURIComponent(n)).then(load); 
        }
        function addSched(id) {
            let t1 = document.getElementById('t1-' + id).value;
            let t2 = document.getElementById('t2-' + id).value;
            if(t1 && t2) fetch('/add-sched?id=' + id + '&on=' + t1 + '&off=' + t2 + '&days=1111111').then(load);
        }
        function delSched(id, i) { fetch('/del-sched?id=' + id + '&idx=' + i).then(load); }

        setInterval(load, 5000);
        load();
    </script>
</body>
</html>\`;
    res.send(htmlContent);
});

app.listen(10000);
