const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

// --- CÁC ĐƯỜNG DẪN API ---
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
app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].state = req.query.state; 
    res.send("OK"); 
});
app.get('/add-sched', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].schedules.push({on:req.query.on, off:req.query.off, days:req.query.days}); 
    res.send("OK"); 
});
app.get('/del-sched', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].schedules.splice(req.query.idx, 1); 
    res.send("OK"); 
});
app.get('/rename', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].name = req.query.name; 
    res.send("OK"); 
});

// --- GIAO DIỆN WEB (SỬ DỤNG TEMPLATE AN TOÀN) ---
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP Manager</title>
    <style>
        body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }
        .card { background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .flex { display: flex; justify-content: space-between; align-items: center; }
        .btn { padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; font-weight: bold; }
        .btn-ON { background: #2ecc71; color: white; }
        .btn-OFF { background: #95a5a6; color: white; }
    </style>
</head>
<body>
    <h3>IoT ESP01s Dashboard</h3>
    <div id="list">Đang tải...</div>

    <script>
        let devices = {};
        let openId = null;

        async function load() {
            try {
                const r = await fetch('/all-data');
                devices = await r.json();
                render();
            } catch(e) { console.error(e); }
        }

        function render() {
            const container = document.getElementById('list');
            const ids = Object.keys(devices);
            if(ids.length === 0) { container.innerHTML = "Chưa có thiết bị online"; return; }
            
            let h = "";
            ids.forEach(id => {
                const d = devices[id];
                h += '<div class="card">';
                h += '<div class="flex"><div><b onclick="rename(\\''+id+'\\',\\''+d.name+'\\')" style="color:blue;cursor:pointer">' + d.name + '</b><br><small>' + d.wifi + '</small></div>';
                h += '<div><button class="btn btn-'+d.state+'" onclick="toggle(\\''+id+'\\',\\''+(d.state==='ON'?'OFF':'ON')+'\\')">' + d.state + '</button>';
                h += '<span onclick="show(\\''+id+'\\')" style="cursor:pointer;margin-left:10px">...</span></div></div>';
                
                if(openId === id) {
                    h += '<div style="margin-top:10px;border-top:1px solid #eee;padding-top:10px">';
                    h += '<input type="time" id="t1-'+id+'"> - <input type="time" id="t2-'+id+'"> <button onclick="add(\\''+id+'\\')">Lưu</button>';
                    (d.schedules || []).forEach((s, i) => {
                        h += '<div style="font-size:12px;display:flex;justify-content:space-between;margin-top:5px;background:#f9f9f9;padding:5px"><span>🕒 '+s.on+' - '+s.off+'</span><b onclick="del(\\''+id+'\\','+i+')" style="color:red;cursor:pointer">X</b></div>';
                    });
                    h += '</div>';
                }
                h += '</div>';
            });
            container.innerHTML = h;
        }

        function show(id) { openId = (openId === id) ? null : id; render(); }
        function toggle(id, st) { fetch('/relay?id='+id+'&state='+st).then(load); }
        function rename(id, old) { let n = prompt("Tên mới:", old); if(n) fetch('/rename?id='+id+'&name='+encodeURIComponent(n)).then(load); }
        function add(id) {
            let t1 = document.getElementById('t1-'+id).value, t2 = document.getElementById('t2-'+id).value;
            if(t1 && t2) fetch('/add-sched?id='+id+'&on='+t1+'&off='+t2+'&days=1111111').then(load);
        }
        function del(id, i) { fetch('/del-sched?id='+id+'&idx='+i).then(load); }

        setInterval(load, 5000);
        load();
    </script>
</body>
</html>`;
    res.send(html);
});

// Chạy server tại cổng 10000
app.listen(10000, () => {
    console.log("Server is running on port 10000");
});
