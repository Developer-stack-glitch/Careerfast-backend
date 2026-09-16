const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let isFirebaseEnabled = false;

try {
  const serviceAccountPath = path.join(__dirname, "firebaseServiceAccount.json");
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    
    isFirebaseEnabled = true;
    console.log("✅ Firebase Admin Initialized");
  } else {
    console.warn("⚠️ Firebase Service Account file not found. Firebase features will be disabled.");
  }
} catch (error) {
  console.error("❌ Firebase Initialization Error:", error.message);
}

// Global variable to cache the wrapped messaging instance
let wrappedMessagingInstance = null;

// Override admin.messaging to return our wrapped version
const originalMessagingFn = admin.messaging;
const getWrappedMessaging = function() {
  if (wrappedMessagingInstance) return wrappedMessagingInstance;

  let msging = null;
  if (isFirebaseEnabled && typeof originalMessagingFn === "function") {
    try {
      msging = originalMessagingFn.apply(admin, arguments);
    } catch (err) {
      console.error("❌ FCM: Failed to initialize messaging instance:", err.message);
      isFirebaseEnabled = false; // Disable it if it fails to even get the instance
    }
  }

  wrappedMessagingInstance = {
    send: async (msg) => {
      if (!isFirebaseEnabled || !msging) {
        console.warn("⚠️ FCM: send() skipped (Firebase disabled)");
        return null;
      }
      try {
        return await msging.send(msg);
      } catch (err) {
        console.error("⚠️ FCM: send() error:", err.message);
        return null;
      }
    },
    subscribeToTopic: async (token, topic) => {
      if (!isFirebaseEnabled || !msging) {
        console.warn("⚠️ FCM: subscribeToTopic() skipped (Firebase disabled)");
        return { success: false, message: "Firebase disabled" };
      }
      try {
        return await msging.subscribeToTopic(token, topic);
      } catch (err) {
        console.error(`⚠️ FCM: subscribeToTopic(${topic}) error:`, err.message);
        return { success: false, message: err.message };
      }
    },
    unsubscribeFromTopic: async (token, topic) => {
      if (!isFirebaseEnabled || !msging) {
        console.warn("⚠️ FCM: unsubscribeFromTopic() skipped (Firebase disabled)");
        return { success: false, message: "Firebase disabled" };
      }
      try {
        return await msging.unsubscribeFromTopic(token, topic);
      } catch (err) {
        console.error(`⚠️ FCM: unsubscribeFromTopic(${topic}) error:`, err.message);
        return { success: false, message: err.message };
      }
    }
  };

  return wrappedMessagingInstance;
};

const customAdmin = new Proxy(admin, {
  get: function(target, prop) {
    if (prop === 'messaging') {
      return getWrappedMessaging;
    }
    return target[prop];
  }
});

module.exports = customAdmin;


