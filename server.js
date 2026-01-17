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
            const content = fs.readFileSync(DATA_FILE, 'utf8');
            devices = content ? JSON.parse(content) : {};
        }
    } catch (err) { devices = {}; }
};

const saveData = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8'); } 
    catch (err) { console.error("Error saving data:", err); }
};

loadData();

app.get('/ping', (req, res) => {
    const { id, wifi, state: espPhysState } = req.query;
    if (!id) return res.send("No ID");
    
    // NẾU CHƯA CÓ THIẾT BỊ TRÊN WEB -> TỰ TẠO MỚI
    if (!devices[id]) {
        console.log(`New Device detected: ${id}`);
        devices[id] = { 
            name: "Thiết bị mới", 
            state: espPhysState || "OFF", 
            schedules: [], 
            wifi: wifi || "Unknown", 
            lastUserAction: 0 
        };
        saveData();
    }
    
    devices[id].wifi = wifi;
    devices[id].lastPing = Date.now();

    const serverWebState = devices[id].state;
    const timeSinceLastClick = Date.now() - (devices[id].lastUserAction || 0);

    if (espPhysState) {
        if (timeSinceLastClick < 20000) {
            if (serverWebState !== espPhysState) {
                return res.send(serverWebState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } else {
            if (serverWebState !== espPhysState) {
                devices[id].state = espPhysState;
                saveData();
            }
        }
    }
    res.send("OK");
});

// Các API còn lại giữ nguyên như bản trước...
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

// Giao diện HTML (Giữ nguyên logic openId để fix con trỏ)
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head>... (Giống code bản trước) ...</html>`);
});

app.listen(10000);
