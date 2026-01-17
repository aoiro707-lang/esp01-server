const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'devices_data.json');
let devices = {}; 

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) { devices = {}; }
};
const saveData = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); } 
    catch (err) { console.error("Save error:", err); }
};
loadData();

// API Ping: ESP sẽ gọi mỗi 5s
app.get('/ping', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id) return res.send("OK");
    
    // Tự động tạo nếu ID này chưa có trong file json
    if (!devices[id]) {
        devices[id] = { name: "Relay ESP", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        // Nếu người dùng KHÔNG bấm nút trên web (quá 15s) -> Web phải nghe theo ESP (Lịch trình)
        if (timeSinceLastClick > 15000) {
            if (devices[id].state !== espPhysState) {
                devices[id].state = espPhysState;
                saveData();
            }
            res.send("OK");
        } else {
            // Nếu người dùng VỪA BẤM nút trên web -> Ép ESP phải theo Web
            res.send(devices[id].state === "ON" ? "TURN_ON" : "TURN_OFF");
        }
    } else { res.send("OK"); }
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].state = req.query.state; 
        devices[req.query.id].lastUserAction = Date.now(); 
        saveData();
    }
    res.send("OK"); 
});
app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); 
        saveData();
    }
    res.send("OK"); 
});
app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) {
        devices[req.query.id].schedules.splice(req.query.idx, 1); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
    .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .flex { display: flex; justify-content: space-between; align-items: center; }
    .btn { padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
    .ON { background: #2ecc71; color: white; } .OFF { background: #95a5a6; color: white; }
    .input-area { margin-top: 10px; padding: 10px; background: #eee; border-radius: 8px; }
    input[type="time"] { padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
</style></head>
<body>
    <h3 style="text-align:center;">ESP Control Panel</h3>
    <div id="list">Đang tải...</div>
    <script>
        let editingId = null;
        async function load() {
            if (editingId) return; // Không reload khi đang nhập giờ để tránh mất con trỏ
            try {
                const r = await fetch('/all-data');
                const devices = await r.json();
                let h = "";
                Object.keys(devices).forEach(id => {
                    const d = devices[id];
                    h += '<div class="card"><div class="flex"><div><b>'+d.name+'</b><br><small>WiFi: '+d.wifi+'</small></div>';
                    h += '<div><button class="btn '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                    h += '<span onclick="setEdit(\\''+id+'\\')" style="cursor:pointer;margin-left:10px;">⚙</span></div></div>';
                    if(editingId === id) {
                        h += '<div class="input-area"><input type="time" id="t1"> đến <input type="time" id="t2"> <button onclick="add(\\''+id+'\\')">Lưu</button></div>';
                    }
                    (d.schedules || []).forEach((s, i) => {
                        h += '<div style="font-size:13px; margin-top:5px;">🕒 '+s.on+' - '+s.off+' <b onclick="del(\\''+id+'\\','+i+')" style="color:red;cursor:pointer">✕</b></div>';
                    });
                    h += '</div>';
                });
                document.getElementById('list').innerHTML = h || "Chưa có thiết bị nào.";
            } catch(e) {}
        }
        function setEdit(id) { editingId = (editingId === id) ? null : id; load(); }
        async function toggle(id, st) { await fetch('/relay?id='+id+'&state='+st); load(); }
        async function add(id) {
            const on = document.getElementById('t1').value, off = document.getElementById('t2').value;
            if(on && off) { await fetch('/add-sched?id='+id+'&on='+on+'&off='+off+'&days=1111111'); editingId = null; load(); }
        }
        async function del(id, i) { await fetch('/del-sched?id='+id+'&idx='+i); load(); }
        setInterval(load, 3000); load();
    </script></body></html>`);
});
app.listen(10000);
