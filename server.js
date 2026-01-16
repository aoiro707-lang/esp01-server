const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

// --- API ---
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

// --- GIAO DIỆN ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Control</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 8px 15px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; min-width: 60px; }
        .ON { background: #2ecc71; color: white; }
        .OFF { background: #e74c3c; color: white; }
        .input-area { margin-top: 15px; padding: 10px; background: #f0f4f8; border-radius: 8px; border: 1px solid #dce4ec; }
        .sched-display { margin-top: 10px; }
        .sched-item { display: flex; justify-content: space-between; padding: 5px 8px; background: #fff; border: 1px solid #eee; border-radius: 5px; margin-top: 4px; font-size: 13px; color: #555; }
        input[type="time"] { border: 1px solid #ccc; border-radius: 4px; padding: 3px; }
        .save-btn { background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px; }
    </style>
</head>
<body>
    <h3 style="text-align:center; color:#2c3e50;">ESP01s Control System</h3>
    <div id="list">Đang tải...</div>

    <script>
        let devices = {};
        let openInputId = null; // Chỉ ID này mới hiện ô nhập liệu

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
            if(ids.length === 0) { container.innerHTML = "Trống"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                
                // Tiêu đề và Nút điều khiển
                h += '<div class="flex"><div><b style="color:#2980b9; cursor:pointer;" onclick="rename(\\''+id+'\\',\\''+d.name+'\\')">' + d.name + '</b><br><small>WiFi: ' + d.wifi + '</small></div>';
                h += '<div><button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">' + d.state + '</button>';
                h += '<span onclick="toggleInput(\\''+id+'\\')" style="cursor:pointer; margin-left:15px; font-weight:bold; color:#95a5a6;">...</span></div></div>';
                
                // PHẦN 1: Danh sách giờ đã set (LUÔN HIỆN)
                h += '<div class="sched-display">';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><span>🕒 ' + s.on + ' - ' + s.off + '</span>';
                    h += '<b onclick="del(\\''+id+'\\','+i+')" style="color:#e74c3c; cursor:pointer">✕</b></div>';
                });
                h += '</div>';

                // PHẦN 2: Ô nhập liệu (CHỈ HIỆN KHI BẤM "...")
                if(openInputId === id) {
                    h += '<div class="input-area">';
                    h += '<input type="time" id="t1-'+id+'"> - <input type="time" id="t2-'+id+'"> ';
                    h += '<button class="save-btn" onclick="add(\\''+id+'\\')">Lưu</button></div>';
                }

                h += '</div>';
            });
            container.innerHTML = h;
        }

        function toggleInput(id) { 
            openInputId = (openInputId === id) ? null : id; 
            render(); 
        }

        async function toggle(id, st) {
            await fetch('/relay?id='+id+'&state='+st);
            loadImmediate();
        }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value;
            let t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) {
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111');
                openInputId = null;
                loadImmediate();
            }
        }

        async function del(id, i) {
            await fetch('/del-sched?id='+id+'&idx='+i);
            loadImmediate();
        }

        function rename(id, old) {
            let n = prompt("Tên mới:", old);
            if(n) fetch('/rename?id='+id+'&name='+encodeURIComponent(n)).then(loadImmediate);
        }

        async function loadImmediate() {
            const r = await fetch('/all-data');
            devices = await r.json();
            render();
        }

        setInterval(load, 5000);
        load();
    </script>
</body>
</html>
    `);
});

app.listen(10000);
