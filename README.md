# 🚨 SATEY Worker Safety - SOS Alert System

Simple worker safety system: ESP32 button → SMS alert → Real-time dashboard.

## ⚡ Quick Setup (5 minutes)

### 1️⃣ Install Backend
```bash
npm install
npm start
```

### 2️⃣ Configure ESP32 (esp32.i)
Edit **lines 9-11**:
```cpp
#define WIFI_SSID "YOUR_WIFI"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define SERVER_URL "http://192.168.1.100:3000"  // Your PC IP
#define WORKER_ID "unique-id"
```

Find your PC IP:
- Windows: `ipconfig` → IPv4 Address
- Mac: `ifconfig`
- Linux: `hostname -I`

### 3️⃣ Setup Supabase
Create table `emergency_profiles`:
```sql
CREATE TABLE emergency_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  contact_1 TEXT,
  blood_group TEXT
);
```

Add credentials to `.env`

### 4️⃣ Open Dashboard
```
http://localhost:3000/worker-dashboard.html
```

## 🎯 How It Works

1. Worker presses button on ESP32
2. ESP32 sends WiFi alert to server
3. Server fetches worker details from Supabase
4. Dashboard shows alert + location on map
5. Responder acknowledges/resolves

## 📁 Project Structure

```
├─ server.js                  ← Backend (Node.js + WebSocket)
├─ worker-dashboard.html      ← Dashboard UI
├─ esp32.i                    ← ESP32 firmware  
├─ package.json               ← Dependencies
├─ .env.example              ← Config template
├─ setup.bat                 ← Windows auto-setup
│
├─ index.html                ← Main emergency dashboard
├─ emergency-profile.html    ← Profile viewer
├─ helplines.html            ← Helpline list
│
├─ css/style.css             ← Styles
├─ js/                       ← JavaScript files
│  ├─ app.js
│  ├─ map.js
│  ├─ supabase.js
│  └─ helplines.js
```

## 🚀 Start Server

```bash
npm start
```

Output:
```
╔════════════════════════════════════════╗
║  🚨 Worker Safety Alert Server         ║
║  Port: 3000                            ║
║  Status: ✅ Running                    ║
╚════════════════════════════════════════╝
```

## 📊 Dashboard Features

**Left Sidebar:**
- 📱 Connected Devices (online/offline workers)
- 🚨 Active SOS Alerts
- Statistics (Active, Device, Total)

**Right Map:**
- 🗺️ Leaflet.js map
- 🚨 Alert location markers
- Click marker for worker details

**Actions:**
- ACK = Mark as seen
- RESOLVE = Close alert

## 🔌 API Endpoints

```
POST   /api/worker-alert              ← ESP32 sends alert
GET    /api/worker-alerts             ← Get all alerts
GET    /api/devices                   ← Get connected devices
PUT    /api/worker-alerts/{id}/acknowledge
PUT    /api/worker-alerts/{id}/resolve
GET    /api/health                    ← Server health
```

## 🧪 Test Alert

```bash
curl -X POST http://localhost:3000/api/worker-alert \
  -H "Content-Type: application/json" \
  -d "{\"worker_id\":\"test\",\"alert_type\":\"SOS\",\"latitude\":28.7,\"longitude\":77.1,\"timestamp\":123,\"status\":\"active\"}"
```

## 🔧 ESP32 Requirements

**Libraries:**
- WiFi (built-in)
- HTTPClient (built-in)
- ArduinoJson
- TinyGPS++

**Hardware:**
- ESP32 Dev Module
- Push button on GPIO 13
- LED on GPIO 5 (optional)
- GPS module (optional)

## 📝 Environment (.env)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
PORT=3000
```

## ⚠️ Troubleshooting

**ESP32 can't connect WiFi**
- Check SSID/password spelling
- Ensure 2.4GHz network (not 5GHz)

**Server won't start**
- Check port 3000 not in use
- Run: `npm install` again

**Dashboard not showing alerts**
- Check server running: `npm start`
- Check browser console (F12) for errors

**Worker details show "Unknown"**
- Check Supabase table exists
- Verify worker_id matches database

---

**Ready?** Start with `npm start` then open the dashboard! 🚀
