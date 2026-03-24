const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ===== CONFIGURATION =====
const PORT = 3000;

// Supabase Setup
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://acgsmcxmesvsftzugeik.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZ3NtY3htZXN2c2Z0enVnZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzIzNTYsImV4cCI6MjA3Nzg0ODM1Nn0.EwiJajiscMqz1jHyyl-BDS4YIvc0nihBUn3m8pPUP1c';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Express App
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// In-memory storage for active alerts
let activeAlerts = [];
let connectedClients = [];

// In-memory storage for connected devices
let connectedDevices = {};  // {worker_id: {id, name, lastHeartbeat, status, battery, signal}}

async function fetchWorkerDetails(workerId) {
  try {
    const { data, error } = await supabase
      .from('emergency_profiles')
      .select('*')
      .eq('id', workerId)
      .single();

    if (error) {
      console.warn('⚠️  Worker not found in DB:', error.message);
      return {
        id: workerId,
        full_name: 'Unknown Worker',
        contact_1: 'N/A',
        blood_group: 'N/A'
      };
    }

    return data;
  } catch (dbError) {
    console.error('Database error:', dbError);
    return {
      id: workerId,
      full_name: 'Unknown Worker',
      contact_1: 'N/A',
      blood_group: 'N/A'
    };
  }
}

// ===== DEVICE HEARTBEAT TRACKING =====
// Track device activity
function recordDeviceActivity(workerId, workerDetails, latitude = null, longitude = null) {
  const previous = connectedDevices[workerId] || {};
  connectedDevices[workerId] = {
    worker_id: workerId,
    worker_name: workerDetails?.full_name || 'Unknown',
    contact: workerDetails?.contact_1 || 'N/A',
    blood_group: workerDetails?.blood_group || 'N/A',
    last_heartbeat: new Date().toISOString(),
    status: 'online',
    latitude,
    longitude,
    last_alert: previous.last_alert || null
  };
}

// Check device status and clean up offline devices (every 30 seconds)
setInterval(() => {
  const now = new Date();
  const OFFLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  for (const workerId in connectedDevices) {
    const device = connectedDevices[workerId];
    const lastHeartbeat = new Date(device.last_heartbeat);
    
    if (now - lastHeartbeat > OFFLINE_TIMEOUT) {
      device.status = 'offline';
    }
  }
  
  // Broadcast updated device list every 10 seconds
  broadcastDeviceStatus();
}, 10000);

// Broadcast device status to all dashboards
function broadcastDeviceStatus() {
  const message = JSON.stringify({
    type: 'devices',
    data: Object.values(connectedDevices)
  });

  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ===== WEBSOCKET SETUP =====
wss.on('connection', (ws) => {
  console.log('✅ Client connected to WebSocket');
  connectedClients.push(ws);

  // Send existing alerts and devices to newly connected client
  ws.send(JSON.stringify({
    type: 'init',
    alerts: activeAlerts,
    devices: Object.values(connectedDevices)
  }));

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    connectedClients = connectedClients.filter(client => client !== ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast to all connected clients
function broadcastAlert(alert) {
  const message = JSON.stringify({
    type: 'alert',
    data: alert
  });

  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ===== API ENDPOINTS =====

// Receive SOS Alert from ESP32
app.post('/api/worker-alert', async (req, res) => {
  try {
    const { worker_id, alert_type, latitude, longitude, timestamp, status } = req.body;

    console.log(`🚨 SOS Alert Received from Worker: ${worker_id}`);
    console.log(`   Location: ${latitude}, ${longitude}`);

    const workerDetails = await fetchWorkerDetails(worker_id);

    // Create alert object
    const alert = {
      id: `${worker_id}-${timestamp}`,
      worker_id,
      alert_type,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      status: 'active',
      worker_details: workerDetails,
      acknowledged_at: null,
      resolved_at: null
    };

    // Store in active alerts
    activeAlerts = activeAlerts.filter(a => a.worker_id !== worker_id);
    activeAlerts.unshift(alert);

    // Record device activity
    recordDeviceActivity(worker_id, workerDetails, latitude, longitude);
    connectedDevices[worker_id].last_alert = new Date().toISOString();

    // Broadcast to all connected dashboards
    broadcastAlert(alert);
    
    // Broadcast updated device status
    broadcastDeviceStatus();

    // Optional: Save to Supabase for history
    try {
      await supabase
        .from('worker_sos_alerts')
        .insert([alert]);
    } catch (saveError) {
      console.warn('⚠️  Could not save alert to DB:', saveError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Alert received and broadcasted',
      alert_id: alert.id
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// Receive device heartbeat from ESP32 (register device even without SOS)
app.post('/api/device-heartbeat', async (req, res) => {
  try {
    const { worker_id, latitude = null, longitude = null } = req.body;

    if (!worker_id) {
      return res.status(400).json({ error: 'worker_id is required' });
    }

    const workerDetails = await fetchWorkerDetails(worker_id);
    recordDeviceActivity(worker_id, workerDetails, latitude, longitude);
    broadcastDeviceStatus();

    res.status(200).json({ success: true, worker_id, status: 'online' });
  } catch (error) {
    console.error('Heartbeat processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get All Active Alerts
app.get('/api/worker-alerts', (req, res) => {
  res.json({
    total: activeAlerts.length,
    alerts: activeAlerts
  });
});

// Get All Connected Devices
app.get('/api/devices', (req, res) => {
  res.json({
    total: Object.keys(connectedDevices).length,
    devices: Object.values(connectedDevices)
  });
});

// Acknowledge Alert
app.put('/api/worker-alerts/:alert_id/acknowledge', (req, res) => {
  const alertId = req.params.alert_id;
  const alert = activeAlerts.find(a => a.id === alertId);

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  alert.acknowledged_at = new Date().toISOString();
  alert.status = 'acknowledged';

  broadcastAlert(alert);
  res.json({ success: true, alert });
});

// Resolve Alert
app.put('/api/worker-alerts/:alert_id/resolve', (req, res) => {
  const alertId = req.params.alert_id;
  const alertIndex = activeAlerts.findIndex(a => a.id === alertId);

  if (alertIndex === -1) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  const alert = activeAlerts[alertIndex];
  alert.resolved_at = new Date().toISOString();
  alert.status = 'resolved';

  broadcastAlert(alert);
  activeAlerts.splice(alertIndex, 1);

  res.json({ success: true, alert });
});

// Get Worker Details
app.get('/api/workers/:worker_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('emergency_profiles')
      .select('*')
      .eq('id', req.params.worker_id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', port: PORT });
});

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚨 Worker Safety Alert Server         ║
║  Port: ${PORT}                              ║
║  Status: ✅ Running                     ║
╚════════════════════════════════════════╝
  `);
  console.log(`📍 Dashboard: http://localhost:${PORT}/worker-dashboard.html`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
});
