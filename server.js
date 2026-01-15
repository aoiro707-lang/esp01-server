const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    
    // Nếu thiếu ID, server sẽ báo lỗi 400 - Đây chính là nguyên nhân bạn thấy lỗi 400
    if (!id) {
        console.log("Lỗi: Nhận Ping nhưng không có ID");
        return res.status(400).send("Missing ID");
    }

    if (!devices[id]) {
        devices[id] = { 
            name: name || "Relay ESP", 
            state: "OFF", 
            schedules: [],
            wifi: wifi || "Unknown" 
        };
    }
    
    devices[id].wifi = wifi || devices[id].wifi;
    devices[id].lastPing = Date.now();
    console.log(`Thiết bị [${id}] đã Online từ WiFi: [${wifi}]`);
    res.send("OK");
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Group Manager</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; }
        .container { max-width: 600px; margin: auto; }
        .wifi-group { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .wifi-header { color: #2ecc71; font-weight: bold; border-bottom: 2px solid #f1f1f1; padding-bottom: 10px; margin-bottom: 15px; }
        .device-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #fafafa; }
        .dev-info { flex-grow: 1; }
        .dev-name { cursor: pointer; font-weight: bold; color: #3498db; text-decoration: underline; }
        .switch { position: relative; width: 46px; height: 22px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 22px; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .4s; }
        input:checked + .slider { background: #2ecc71; }
        input:checked + .slider:before { transform: translateX(24px); }
        .more-btn { cursor: pointer; font-size: 20px; color: #95a5a6; margin-left: 15px; }
        .sched-box { border-top: 1px solid #eee; margin-top: 10px; padding-top: 10px; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h2>IoT ESP01s Control System</h2>
        <div id="device-list">Đang tải thiết bị...</div>
    </div>
<script>
    let devices = {};
    let activeBoxId = null; // Biến ghi nhớ khung đang mở

    function render() {
        const listEl = document.getElementById('device-list');
        const groups = {};
        const ids = Object.keys(devices);
        if (ids.length === 0) { listEl.innerHTML = "Chưa có thiết bị nào Online"; return; }
        
        ids.forEach(id => {
            const wifi = devices[id].wifi || "Unknown WiFi";
            if (!groups[wifi]) groups[wifi] = [];
            groups[wifi].push({id, ...devices[id]});
        });

        let html = "";
        for (let wifi in groups) {
            html += `<div class="wifi-group"><div class="wifi-header">Wifi: ${wifi}</div>`;
            groups[wifi].forEach(dev => {
                // Kiểm tra xem box này có đang được mở không
                const displayStyle = (activeBoxId === dev.id) ? 'block' : 'none';
                
                html += `<div class="device-row">
                    <div class="dev-info">
                        <span class="dev-name" onclick="rename('${dev.id}', '${dev.name}')">${dev.name}</span>
                        <div style="font-size:10px; color:#999">ID: ${dev.id}</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" ${dev.state==='ON'?'checked':''} onchange="toggle('${dev.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <span class="more-btn" onclick="toggleSched('${dev.id}')">...</span>
                </div>
                <div id="box-${dev.id}" class="sched-box" style="display: ${displayStyle}">
                    <div style="background:#f9f9f9; padding:10px; border-radius:8px;">
                        <input type="time" id="on-${dev.id}"> đến <input type="time" id="off-${dev.id}">
                        <button onclick="addSched('${dev.id}')" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Lưu 💾</button>
                    </div>
                    <div id="list-${dev.id}" style="margin-top:10px;">
                        ${(dev.schedules || []).map((s, idx) => `
                            <div style="font-size:12px; margin-top:5px; display:flex; justify-content:space-between; background:#fff; padding:5px; border:1px solid #eee;">
                                <span>🕒 ${s.on} - ${s.off}</span>
                                <span style="color:red; cursor:pointer; font-weight:bold;" onclick="delSched('${dev.id}',${idx})">✕</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
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
        } catch (e) { console.error(e); }
    }

    function toggleSched(id) { 
        // Nếu bấm vào cái đang mở thì đóng lại, nếu bấm cái mới thì ghi nhớ ID đó
        activeBoxId = (activeBoxId === id) ? null : id;
        render(); // Vẽ lại ngay lập tức để hiện/ẩn
    }

    function addSched(id) {
        let on = document.getElementById('on-'+id).value;
        let off = document.getElementById('off-'+id).value;
        if(on && off) {
            fetch(`/add-sched?id=${id}&on=${on}&off=${off}&days=1111111`)
            .then(() => {
                alert("Đã lưu lịch trình!");
                updateData();
            });
        } else {
            alert("Vui lòng chọn đầy đủ giờ Bật và Tắt");
        }
    }

    function rename(id, old) { 
        let n = prompt("Tên mới:", old); 
        if(n) fetch(`/rename?id=${id}&name=${encodeURIComponent(n)}`).then(updateData); 
    }
    
    function toggle(id, s) { fetch(`/relay?id=${id}&state=${s?'ON':'OFF'}`); }
    function delSched(id, idx) { fetch(`/del-sched?id=${id}&idx=${idx}`).then(updateData); }

    setInterval(updateData, 5000); // Tăng lên 5 giây để tránh lag
    updateData();
</script>    
</body>
</html>
    `);
});

app.get('/ping', (req, res) => {
    const { id, wifi, name } = req.query;
    if (!id) return res.send("No ID");
    if (!devices[id]) devices[id] = { name: name || "Relay", state: "OFF", schedules: [] };
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/rename', (req, res) => { if(devices[req.query.id]) devices[req.query.id].name = req.query.name; res.send("OK"); });
app.get('/relay', (req, res) => { if(devices[req.query.id]) devices[req.query.id].state = req.query.state; res.send("OK"); });
app.get('/add-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); res.send("OK"); });
app.get('/del-sched', (req, res) => { if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); res.send("OK"); });

app.listen(10000);
