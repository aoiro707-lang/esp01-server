// Thêm biến để lưu thời điểm người dùng bấm nút trên Web
// let devices = {};

app.get('/relay', (req, res) => { 
    const { id, state } = req.query;
    if(devices[id]) {
        devices[id].state = state; 
        // LƯU Ý: Đánh dấu người dùng vừa bấm nút
        devices[id].lastUserAction = Date.now(); 
        saveData();
    }
    res.send("OK"); 
});

app.get('/ping', (req, res) => {
    const { id, state: espPhysState } = req.query; // ON hoặc OFF từ ESP gửi lên
    if (!id || !devices[id]) return res.send("OK");

    const webState = devices[id].state;
    const lastAction = devices[id].lastUserAction || 0;
    const timeSinceClick = Date.now() - lastAction;

    // LOGIC CHỐNG XUNG ĐỘT:
    if (espPhysState) {
        // TRƯỜNG HỢP 1: Người dùng vừa bấm nút trong 10 giây qua
        // => Ưu tiên Web, ép ESP phải theo Web
        if (timeSinceClick < 10000) {
            if (webState !== espPhysState) {
                console.log("Force Sync Web -> ESP");
                return res.send(webState === "ON" ? "TURN_ON" : "TURN_OFF");
            }
        } 
        // TRƯỜNG HỢP 2: ESP tự thay đổi (do Hẹn giờ hoặc Nút bấm cứng)
        // => Ưu tiên ESP, cập nhật lại giao diện Web cho đúng thực tế
        else {
            if (webState !== espPhysState) {
                console.log("Sync ESP -> Web (Schedule detected)");
                devices[id].state = espPhysState; // Cập nhật database
                saveData();
                // Trả về OK, không gửi lệnh TURN_ON/OFF để tránh tắt relay
            }
        }
    }
    res.send("OK");
});
