#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define SERVICE_UUID        "00001234-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID "00005678-0000-1000-8000-00805f9b34fb"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;

bool deviceConnected = false;
bool oldDeviceConnected = false;

unsigned long lastUpdate = 0;

// 🔁 Callbacks
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("✅ Connected");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("❌ Disconnected");
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Starting BLE...");

  BLEDevice::init("SIDDU");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_READ
                    );

  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);

  BLEDevice::startAdvertising();

  Serial.println("🚀 BLE Ready");
}

void loop() {

  // 🔁 Handle reconnection properly
  if (!deviceConnected && oldDeviceConnected) {
    delay(200); // important
    pServer->startAdvertising();  // 🔥 correct restart
    Serial.println("🔁 Advertising Restarted");
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    Serial.println("📱 New Client Connected");
    oldDeviceConnected = deviceConnected;
  }

  // 📡 Send data only when connected
  if (deviceConnected && millis() - lastUpdate > 2000) {
    lastUpdate = millis();

    pCharacteristic->setValue("ACTIVE");
    pCharacteristic->notify();

    Serial.println("📡 Sent: ACTIVE");
  }

  delay(50);
}