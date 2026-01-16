const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let devices = {}; 

app.get('/ping', (req, res) => {
    const { id, state: espPhysState } = req.query; // espPhysState: "ON" hoặc "OFF"
    if (!id) return res.send("No ID");
    
    if (!devices[id]) {
        devices[id] = { name: "Relay", state: "OFF", schedules: [], wifi: "Unknown" };
    }
    
    // Đối soát logic: Nếu Web (state) khác Thực tế (espPhysState) -> Gửi lệnh đồng bộ
    const webState = devices[id].state;
    if (espPhysState && webState !== espPhysState) {
        return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
    }
    res.send("OK");
});

app.get('/status', (req, res) => res.json(devices[req.query.id] || {}));
app.get('/all-data', (req, res) => res.json(devices));

app.get('/relay', (req, res) => { 
    if(devices[req.query.id]) devices[req.query.id].state = req.query.state; 
    res.send("OK"); 
});

// Các API khác giữ nguyên (add-sched, del-sched...)
app.listen(10000);
