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
    catch (err) { console.error("Lỗi ghi file:", err); }
};
loadData();

// Các API ping, relay, add-sched, del-sched giữ nguyên như code cũ của bạn...
app.get('/ping', (req, res) => {
    const { id, wifi, name, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    if (!devices[id]) {
        devices[id] = { name: name || "Relay", state: "OFF", schedules: [], wifi: wifi || "Unknown", lastUserAction: 0 };
        saveData();
    }
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();
    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);
    if (espPhysState) {
        if (timeSinceLastClick < 15000) {
            if (serverWebState !== espPhysState) return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
        } else {
            if (serverWebState !== espPhysState) { devices[id].state = espPhysState; saveData(); }
        }
    }
    res.send("OK");
});

app.get('/all-data', (req, res) => res.json(devices));
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) { devices[req.query.id].state = req.query.state; devices[req.query.id].lastUserAction = Date.now(); saveData(); }
    res.send("OK"); 
});
app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) { devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); saveData(); }
    res.send("OK"); 
});
app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) { devices[req.query.id].schedules.splice(req.query.idx, 1); saveData(); }
    res.send("OK"); 
});

// --- GIAO DIỆN HTML CẬP NHẬT ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Control Smart</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; color: #333; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
        .ON { background: #2ecc71; color: white; }
        .OFF { background: #95a5a6; color: white; }
        
        .sched-list { margin-top: 15px; }
        .sched-item { display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #fff; border-bottom: 1px solid #eee; }
        .sched-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        
        /* Style cho nhãn các Thứ (giống hình bạn gửi) */
        .day-label { 
            background: #3498db; color: white; font-size: 11px; font-weight: bold;
            padding: 3px 6px; border-radius: 4px; min-width: 22px; text-align: center;
        }

        .input-area { margin-top: 15px; padding: 15px; background: #f0f4f8; border-radius: 8px; }
        .days-picker { display: flex; gap: 5px; margin: 12px 0; overflow-x: auto; padding-bottom: 5px; }
        .day-box { font-size: 12px; text-align: center; background: white; padding: 5px; border-radius: 4px; border: 1px solid #ddd; min-width: 35px; }
        .save-btn { background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h3 style="text-align:center;">ESP01s Smart Sync</h3>
    <div id="list">Đang tải...</div>

    <script>
        let devices = {};
        let openInputId = null;
        const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

        async function load() {
            if (openInputId !== null) return;
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) {}
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div><b style="color:#2980b9; font-size:18px;">'+d.name+'</b><br><small>Wifi: '+d.wifi+'</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">'+d.state+'</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-size:20px;">⚙</span></div></div>';
                
                h += '<div class="sched-list">';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item">';
                    h += '<div class="sched-info">';
                    h += '<span>🕒 <b>' + s.on + ' - ' + s.off + '</b></span>';
                    
                    // Logic hiển thị nhãn các thứ
                    if (s.days) {
                        for(let j=0; j<7; j++) {
                            if(s.days[j] === '1') {
                                h += '<span class="day-label">' + DAY_NAMES[j] + '</span>';
                            }
                        }
                    }
                    
                    h += '</div>';
                    h += '<b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer; padding: 5px;">✕</b>';
                    h += '</div>';
                });
                h += '</div>';

                if(openInputId === id) {
                    h += '<div class="input-area">';
                    h += '<input type="time" id="t1-'+id+'"> - <input type="time" id="t2-'+id+'">';
                    h += '<div class="days-picker">';
                    DAY_NAMES.forEach((name, index) => {
                        h += '<div class="day-box">' + name + '<br><input type="checkbox" class="day-check-'+id+'" value="'+index+'" checked></div>';
                    });
                    h += '</div>';
                    h += '<button class="save-btn" onclick="add(\\''+id+'\\')">Lưu lịch hẹn</button>';
                    h += '</div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function toggleInput(id) { openInputId = (openInputId === id) ? null : id; render(); }
        async function toggle(id, st) { devices[id].state = st; render(); await fetch('/relay?id='+id+'&state='+st); }
        async function del(id, i) { if(confirm("Xóa lịch này?")) { await fetch('/del-sched?id='+id+'&idx='+i); load(); } }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            let dArr = ["0","0","0","0","0","0","0"];
            document.querySelectorAll('.day-check-'+id).forEach(el => { if(el.checked) dArr[el.value] = "1"; });
            if(t1 && t2) {
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days='+dArr.join(""));
                openInputId = null; load();
            }
        }

        setInterval(load, 3000);
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
