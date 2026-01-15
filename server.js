const express = require('express');
const app = express();

// Biến lưu trữ toàn bộ thiết bị
let devices = {}; 

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Group Manager</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; padding: 20px; color: #333; }
        .container { max-width: 600px; margin: auto; }
        h2 { text-align: center; color: #2c3e50; }
        .wifi-group { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .wifi-header { color: #2ecc71; font-weight: bold; border-bottom: 2px solid #f1f1f1; padding-bottom: 10px; margin-bottom: 15px; display: flex; align-items: center; }
        .wifi-header::before { content: "●"; margin-right: 8px; font-size: 18px; }
        .device-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #fafafa; }
        .dev-info { flex-grow: 1; }
        .dev-name { cursor: pointer; font-weight: bold; color: #3498db; font-size: 16px; text-decoration: underline; }
        .dev-id { font-size: 10px; color: #999; display: block; }
        
        /* Switch gạt */
        .switch { position: relative; width: 46px; height: 22px; margin-left: 10px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 22px; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .4s; }
        input:checked + .slider { background: #2ecc71; }
        input:checked + .slider:before { transform: translateX(24px); }

        .more-btn { cursor: pointer; font-size: 20px; color: #95a5a6; margin-left: 15px; font-weight: bold; }
        .sched-box { border-top: 1px solid #eee; margin-top: 10px; padding-top: 10px; display: none; background: #fdfdfd; }
        .empty-state { text-align: center; color: #95a5a6; padding: 40px; background: white; border-radius: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>IoT ESP01s Control System</h2>
        <div id="device-list">
            <div class="empty-state">Đang chờ thiết bị kết nối...</div>
        </div>
    </div>

    <script>
        let devices = {};

        function render() {
            const listEl = document.getElementById('device-list');
            const groups = {};
            
            // Nhóm thiết bị theo WiFi
            const ids = Object.keys(devices);
            if (ids.length === 0) {
                listEl.innerHTML = '<div class="empty-state">Chưa có thiết bị nào Online</div>';
                return;
            }

            ids.forEach(id => {
                const wifi = devices[id].wifi || "Unknown WiFi";
                if (!groups[wifi]) groups[wifi] = [];
                groups[wifi].push({id, ...devices[id]});
            });

            let html = "";
            for (let wifi in groups) {
                html += \`<div class="wifi-group">
                    <div class="wifi-header">Wifi: \${wifi}</div>\`;
                
                groups[wifi].forEach(dev => {
                    html += \`
                    <div class="device-row">
                        <div class="dev-info">
                            <span class="dev-name" onclick="rename('\${dev.id}', '\${dev.name}')">\${dev.name}</span>
                            <span class="dev-id">ID: \${dev.id}</span>
                        </div>
                        <label class="switch">
                            <input type="checkbox" \${dev.state==='ON'?'checked':''} onchange="toggle('\${dev.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span class="more-btn" onclick="toggleSched('\${dev.id}')">...</span>
                    </div>
                    <div id="box-\${dev.id}" class="sched-box">
                        <div style="margin-bottom:10px;">
                            <input type="time" id="on-\${dev.id}"> đến <input type="time" id="off-\${dev.id}">
                            <button onclick="addSched('\${dev.id}')">Lưu 💾</button>
                        </div>
                        <div id="list-\${dev.id}">
                            \${dev.schedules.map((s, idx) => \`
                                <div style="font-size:12px; color:#666; display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #eee;">
                                    <span>🕒 \${s.on} - \${s.off} (Hàng ngày)</span>
                                    <span style="color:red; cursor:pointer;" onclick="delSched('\${dev.id}', \${idx})">✕</span>
                                </div>
                            \`).join('')}
                        </div>
                    </div>\`;
                });
                html += "</div>";
            }
            listEl.innerHTML = html;
        }

        async function updateData() {
            try {
                const res = await fetch('/all-data');
                devices = await res.json();
                render();
            } catch (e) { console.error("Lỗi cập nhật:", e); }
        }

        function rename(id, oldName) {
            let n = prompt("Nhập tên mới:", oldName);
            if(n) fetch(\`/rename?id=\${id}&name=\${encodeURIComponent(n)}\`).then(updateData);
        }

        function toggle(id, s) { fetch(\`/relay?id=\${id}&state=\${s?'ON':'OFF'}\`); }
        
        function toggleSched(id) {
            let el = document.getElementById('box-'+id);
            el.style.display = el.style.display === 'block' ? 'none' : 'block';
        }

        function addSched(id) {
            let on = document.getElementById('on-'+id).value;
            let off = document.getElementById('off-'+id).value;
            if(!on || !off) return;
            fetch(\`/add-sched?id=\${id}&on=\${on}&off=\${off}&days=1111111\`).then(updateData);
        }

        function delSched(id, idx) {
            fetch(\`/del-sched?id=\${id}&idx=\${idx}\`).then(updateData);
        }

        // Cập nhật dữ liệu mỗi 3 giây
        setInterval(updateData, 3000);
        updateData();
    </script>
</body>
</html>
    `);
});

// --- API HỖ TRỢ ---
app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    if (!id) return res.send("Missing ID");
    if (!devices[id]) {
        devices[id] = { name: name || "Thiết bị mới", state: "OFF", schedules: [] };
    }
    devices[id].wifi = wifi || "Unknown";
    devices[id].lastPing = Date.now();
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));

app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));

app.get('/rename', (req, res) => {
    if (devices[req.query.id]) devices[req.query.id].name = req.query.name;
    res.send("OK");
});

app.get('/relay', (req, res) => {
    if (devices[req.query.id]) devices[req.query.id].state = req.query.state;
    res.send("OK");
});

app.get('/add-sched', (req, res) => {
    if (devices[req.query.id]) devices[req.query.id].schedules.push({ on: req.query.on, off: req.query.off, days: req.query.days });
    res.send("OK");
});

app.get('/del-sched', (req, res) => {
    if (devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1);
    res.send("OK");
});

app.listen(10000, () => console.log("Server đang chạy cổng 10000"));
