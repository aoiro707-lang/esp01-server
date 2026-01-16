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

// --- GIAO DIỆN ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Manager</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 15px; }
        .card { background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #3498db; }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn-toggle { padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; }
        .ON { background: #2ecc71; color: white; }
        .OFF { background: #e74c3c; color: white; }
        .sched-section { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ddd; }
        .sched-item { display: flex; justify-content: space-between; padding: 6px; background: #f9f9f9; border-radius: 4px; margin-bottom: 5px; font-size: 13px; border: 1px solid #eee; }
        .input-group { background: #edf2f7; padding: 10px; border-radius: 8px; margin-bottom: 10px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
        input[type="time"] { border: 1px solid #cbd5e0; border-radius: 4px; padding: 4px; }
        .add-btn { background: #3182ce; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <h3 style="text-align:center;">IoT Control Center</h3>
    <div id="list">Đang tải dữ liệu...</div>

    <script>
        let devices = {};
        let isTyping = false; // Ngăn load lại khi đang nhập liệu

        async function load() {
            if (isTyping) return;
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) {}
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị online"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                // Dòng tiêu đề và nút ON/OFF
                h += '<div class="flex"><div><b style="color:#2c3e50; font-size:18px; cursor:pointer;" onclick="rename(\\''+id+'\\',\\''+d.name+'\\')">' + d.name + '</b><br><small style="color:#718096">WiFi: ' + d.wifi + '</small></div>';
                h += '<button class="btn-toggle '+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">' + d.state + '</button></div>';
                
                // Phần Hẹn giờ hiện sẵn
                h += '<div class="sched-section">';
                h += '<div class="input-group" onmousedown="isTyping=true" onfocusout="isTyping=false">';
                h += '<input type="time" id="t1-'+id+'"> - <input type="time" id="t2-'+id+'"> ';
                h += '<button class="add-btn" onclick="add(\\''+id+'\\')">Thêm ➕</button></div>';
                
                h += '<div id="list-'+id+'">';
                (d.schedules || []).forEach((s, i) => {
                    h += '<div class="sched-item"><span>🕒 ' + s.on + ' - ' + s.off + '</span>';
                    h += '<b onclick="del(\\''+id+'\\','+i+')" style="color:#e53e3e; cursor:pointer; padding: 0 5px;">✕</b></div>';
                });
                h += '</div></div></div>';
            });
            container.innerHTML = h;
        }

        async function toggle(id, st) {
            await fetch('/relay?id='+id+'&state='+st);
            loadDataImmediate();
        }

        async function add(id) {
            let t1 = document.getElementById('t1-'+id).value;
            let t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) {
                isTyping = false;
                await fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111');
                loadDataImmediate();
            } else alert("Chọn đủ giờ!");
        }

        async function del(id, i) {
            await fetch('/del-sched?id='+id+'&idx='+i);
            loadDataImmediate();
        }

        function rename(id, old) {
            let n = prompt("Tên mới:", old);
            if(n) fetch('/rename?id='+id+'&name='+encodeURIComponent(n)).then(loadDataImmediate);
        }

        async function loadDataImmediate() {
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
