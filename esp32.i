#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WebServer.h>
#include <Preferences.h>

// ===== CONFIGURATION =====
#define WIFI_SSID "vivoX200"         // Change to your WiFi network name
#define WIFI_PASSWORD "123456789@@" // Change to your WiFi password
#define DEFAULT_SERVER_URL "http://10.248.180.156:3000"  // Default laptop server IP on LAN
#define WORKER_ID "58788297-ff08-45a8-8894-2caced2ca9dd"             // Unique ID for this worker (hardcoded)
#define HEARTBEAT_INTERVAL_MS 15000

// Pin Definitions
#define BUTTON_PIN 13 
#define LED_PIN 5     
#define GPS_RX 19
#define GPS_TX 18

// Objects
TinyGPSPlus gps;
HardwareSerial SerialGPS(2);
WiFiClient wifiClient;
WebServer configServer(80);
Preferences preferences;

String serverBaseUrl = DEFAULT_SERVER_URL;

// State Variables
bool lastButtonState = false;
unsigned long lastSosSentTime = 0;
unsigned long lastGpsSent = 0;
unsigned long lastBlinkTime = 0;
unsigned long lastHeartbeatSentTime = 0;
bool ledState = false;
bool sosModeActive = false;
unsigned long sosModeUntil = 0;
double currentLat = 0.0;
double currentLng = 0.0;

String escapeHtml(const String &input) {
  String out = input;
  out.replace("&", "&amp;");
  out.replace("<", "&lt;");
  out.replace(">", "&gt;");
  out.replace("\"", "&quot;");
  out.replace("'", "&#39;");
  return out;
}

String normalizeServerUrl(String url) {
  url.trim();
  if (url.length() == 0) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "http://" + url;
  }
  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }
  return url;
}

void loadSavedConfig() {
  preferences.begin("worker-safe", true);
  String savedUrl = preferences.getString("server_url", DEFAULT_SERVER_URL);
  preferences.end();

  savedUrl = normalizeServerUrl(savedUrl);
  if (savedUrl.length() > 0) {
    serverBaseUrl = savedUrl;
  }

  Serial.print("🌐 Active Server URL: ");
  Serial.println(serverBaseUrl);
}

void saveServerUrl(const String &url) {
  preferences.begin("worker-safe", false);
  preferences.putString("server_url", url);
  preferences.end();
}

void handleConfigPage() {
  String html =
    "<!doctype html><html><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>ESP32 Worker Config</title>"
    "<style>body{font-family:Arial,sans-serif;background:#0b1220;color:#fff;padding:20px;}"
    ".card{max-width:560px;margin:auto;background:#121a2b;border:1px solid #24324d;border-radius:10px;padding:20px;}"
    "h2{margin-top:0;}label{display:block;margin-top:14px;color:#9fb3d9;font-size:13px;}"
    "input{width:100%;padding:10px;border-radius:8px;border:1px solid #314366;background:#0f1727;color:#fff;}"
    "button{margin-top:16px;padding:10px 14px;border:0;border-radius:8px;background:#2dd4bf;color:#042f2e;font-weight:700;cursor:pointer;}"
    ".muted{color:#8aa0c8;font-size:13px;} .ok{color:#34d399;} .warn{color:#fbbf24;}</style></head><body>"
    "<div class='card'><h2>ESP32 Worker Safety Config</h2>"
    "<p class='muted'>Device IP: " + WiFi.localIP().toString() + "</p>"
    "<p class='muted'>Worker ID: " + String(WORKER_ID) + "</p>"
    "<p class='muted'>Current Server: <span class='ok'>" + escapeHtml(serverBaseUrl) + "</span></p>"
    "<form method='POST' action='/save'>"
    "<label>Server URL (example: http://10.248.180.156:3000)</label>"
    "<input name='server_url' value='" + escapeHtml(serverBaseUrl) + "' required>"
    "<button type='submit'>Save</button></form>"
    "<p class='muted'>After Save, device keeps this URL even after restart.</p>"
    "<p><a href='/status' style='color:#93c5fd'>View JSON status</a></p>"
    "</div></body></html>";

  configServer.send(200, "text/html", html);
}

void handleSaveConfig() {
  if (!configServer.hasArg("server_url")) {
    configServer.send(400, "text/plain", "Missing server_url");
    return;
  }

  String newUrl = normalizeServerUrl(configServer.arg("server_url"));
  if (newUrl.length() == 0) {
    configServer.send(400, "text/plain", "Invalid server_url");
    return;
  }

  serverBaseUrl = newUrl;
  saveServerUrl(serverBaseUrl);

  String html =
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Saved</title><style>body{font-family:Arial;background:#0b1220;color:#fff;padding:20px;}"
    ".card{max-width:560px;margin:auto;background:#121a2b;border:1px solid #24324d;border-radius:10px;padding:20px;}"
    "a{color:#93c5fd;}</style></head><body><div class='card'>"
    "<h3>Saved</h3><p>New Server URL: " + escapeHtml(serverBaseUrl) + "</p>"
    "<p>Device will use this immediately for heartbeat and SOS.</p>"
    "<p><a href='/'>Back</a></p></div></body></html>";

  Serial.print("✅ Server URL updated from web config: ");
  Serial.println(serverBaseUrl);
  configServer.send(200, "text/html", html);
}

void handleStatusJson() {
  StaticJsonDocument<256> doc;
  doc["worker_id"] = WORKER_ID;
  doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  doc["device_ip"] = WiFi.localIP().toString();
  doc["server_url"] = serverBaseUrl;
  doc["latitude"] = currentLat;
  doc["longitude"] = currentLng;

  String out;
  serializeJson(doc, out);
  configServer.send(200, "application/json", out);
}

void startConfigWebServer() {
  configServer.on("/", HTTP_GET, handleConfigPage);
  configServer.on("/save", HTTP_POST, handleSaveConfig);
  configServer.on("/status", HTTP_GET, handleStatusJson);
  configServer.begin();

  Serial.println("🛠️  Config web UI started");
  Serial.print("🌐 Open in browser: http://");
  Serial.println(WiFi.localIP());
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n🚀 Worker Safety Device Starting...");

  loadSavedConfig();
  
  // Connect to WiFi
  connectToWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    startConfigWebServer();
  }
}

// ===== WIFI CONNECTION =====
void connectToWiFi() {
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("📍 IP Address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("\n❌ WiFi Failed! Check credentials.");
    digitalWrite(LED_PIN, LOW);
  }
}

// ===== SEND SOS ALERT =====
bool sendSosAlert() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi Not Connected");
    return false;
  }

  HTTPClient http;
  
  // Create JSON Payload
  StaticJsonDocument<256> jsonDoc;
  jsonDoc["worker_id"] = WORKER_ID;
  jsonDoc["alert_type"] = "SOS";
  jsonDoc["latitude"] = currentLat;
  jsonDoc["longitude"] = currentLng;
  jsonDoc["timestamp"] = millis();
  jsonDoc["status"] = "active";
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  
  Serial.print("📤 Sending SOS Alert: ");
  Serial.println(jsonString);
  
  http.begin(wifiClient, serverBaseUrl + "/api/worker-alert");
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200 || httpCode == 201) {
    Serial.println("✅ SOS Alert Sent Successfully!");
    lastSosSentTime = millis();
    // Keep SOS mode visible on LED for at least 30 seconds after a send.
    sosModeActive = true;
    sosModeUntil = millis() + 30000;
    http.end();
    return true;
  } else {
    Serial.print("❌ Error: ");
    Serial.println(httpCode);
  }
  
  http.end();
  return false;
}

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;

  StaticJsonDocument<256> jsonDoc;
  jsonDoc["worker_id"] = WORKER_ID;
  jsonDoc["latitude"] = currentLat;
  jsonDoc["longitude"] = currentLng;
  jsonDoc["timestamp"] = millis();

  String jsonString;
  serializeJson(jsonDoc, jsonString);

  http.begin(wifiClient, serverBaseUrl + "/api/device-heartbeat");
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonString);
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("💓 Heartbeat sent");
    lastHeartbeatSentTime = millis();
    return true;
  }

  Serial.print("⚠️  Heartbeat failed: ");
  Serial.println(httpCode);
  return false;
}

// ===== MAIN LOOP =====
void loop() {
  configServer.handleClient();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      startConfigWebServer();
    }
  }

  // 1. GPS Handler - Update location data continuously
  while (SerialGPS.available() > 0) {
    if (gps.encode(SerialGPS.read())) {
      if (gps.location.isValid()) {
        currentLat = gps.location.lat();
        currentLng = gps.location.lng();
        Serial.print("📍 Location: ");
        Serial.print(currentLat, 6);
        Serial.print(", ");
        Serial.println(currentLng, 6);
      }
    }
  }

  // 2. Button Handler - SOS Trigger
  bool currentButtonState = (digitalRead(BUTTON_PIN) == LOW);

  if (currentButtonState && !lastButtonState) {
    // Button just pressed - Send SOS
    Serial.println("🚨 SOS BUTTON PRESSED!");
    sendSosAlert();
    lastButtonState = true;
  } else if (!currentButtonState && lastButtonState) {
    // Button released
    Serial.println("✋ Button Released");
    lastButtonState = false;
  } else if (currentButtonState && (millis() - lastSosSentTime > 30000)) {
    // Button held - Resend SOS every 30 seconds
    Serial.println("🔄 Resending SOS (Button Still Held)...");
    sendSosAlert();
  }

  // Auto-exit SOS display window when timer expires and button is not pressed.
  if (sosModeActive && !currentButtonState && millis() > sosModeUntil) {
    sosModeActive = false;
  }

  // 3. Device heartbeat so dashboard can show connected workers even without SOS
  if (millis() - lastHeartbeatSentTime >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
  }

  // 4. LED Status Indicator
  if (currentButtonState || sosModeActive) {
    // Blinking when SOS is active
    if (millis() - lastBlinkTime > 500) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkTime = millis();
    }
  } else if (WiFi.status() == WL_CONNECTED) {
    // Solid ON when connected
    digitalWrite(LED_PIN, HIGH);
  } else {
    // OFF when not connected
    digitalWrite(LED_PIN, LOW);
  }

  delay(100);
}