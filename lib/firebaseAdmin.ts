import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK - Hardcoded Initialization with Heartbeat System
 * FIX: Using direct credentials to bypass Vercel 500 errors permanently.
 * ADDED: Heartbeat logic to track if the engine is running in the background.
 */

function initializeFirebase(): admin.app.App {
  // Check if app is already initialized to prevent double loading
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Your Firebase Key is hardcoded here so it never fails on Vercel
  const serviceAccount = {
    "type": "service_account",
    "project_id": "bhaag-df531",
    "private_key_id": "3147179cb40549571be1826b1d9ce392b55c1b85",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2pjimHN0ONbcy\nWeZkbBTi3Y7Jlnu/cPb+NdlsD7/qZ9UmopH1Vh5ODvT++kLFIMVTP6/mUbS/JR5p\ntMBIFB3qgUH0HfSgJdSQaWmD9Pq8yFNG4jocMSuoDzZR9kAJ7gjbbDCe+ximX58t\neUlOPcjtLGH0Z6r3jV7O428b/pEHgedTYie3bM5fALLFnP252n20e1B7hKPiKHVj\nbebxvKeXd6ibn80CGvL4mRjW3hrcxzHP8/6KJ8xPcPYIzVKKubvtFrF3FAnAKm8a\nY0XLSgAL+NxDjp52CJsVRStyS8QYyAqxzdxBUc67h1funVRuRmIbg31xfnqFazGY\nuQJCYPtPAgMBAAECggEAEpRM/eTAvcHMDVSkwYFXDI7CCBKFKv+oOEqs/7eIa6U9\nQu1VkJG+im0uEcPOR/Qh7mpzj6evDaSOd+05g/t74Y9dcKIdcK74dOosIA6q9Moh\n4nt/sr9zs+g8O9EjSX9LqlpShdF/++iNLhiA0vMo/as+mZh0BTN9uejbtArMoOkz\nOMFtFHrK0j8ICWwGwFQJCCjD9a3ihzm2vaezojnOkOtbZPgP1Hi6M1r0w9MvwoHU\nGvpcxc+hsfokxMrzqYUzUzZf6mdky4IOrGhoo+FWhuFhtbNJZx/MFwlbQKKGNUOn\neB0XDZL/4r4WszHlN1fW7UY58EoLfTS4P/Y2LtdcPQKBgQDtsvFSxUAnLEoCMxyl\nqNpGgvxhpBOjz0+0v6teeGvv8kIlQ6U/w5AHpwQtrcYQrRZNXBMNw0jFnNIPXL9x\nnOq5vbhOEkYJexPoHS3lLpNiExzNn4a1G+sOToxtfNYPkV5V3D/7kjAGJu5Pw+1e\nh38hdlykzyJlhYV2bYQ4dbzEPQKBgQDEtj8viZglIfAlWfQY2EWI4khNlDAm/R8k\ni3k27qbW6guzmeVJCvy2vp1/ILlvjrEKq0X2vdTZg8wDQ5hariUl1/rKWvFmK6wX\ke6pAY4bjdbyR0rvuuDPgRpOydNfBKTL5yO7JA+VP49RlBglUUgAJXZxeC1HnyNd\nyjT0nUqaewKBgQDK4HAYtUKMLMD+H6HTwsqKZEIFFIWuysK9AtrBRwbZRWwvYg0o\n30GPRn3KfwcONK1UWcHpfUQfZjnj4sWDsuqknckw2Wftr57N/hmuApLIoody+TWA\XtPA4kn5KROLNgfOQK5biepzVccRTajLhdp8NQndoO06uTuwWMkBZ3w2AQKBgDAz\npDoG0lRPA6RzbV/lJuzK3gK8jCwRnF79Gj++rP0+ro1c6ZVDbvdsr/Ul1KqkYXeG\nzocOryh5pjUqjBu0Tn/+c4LAVCTAENRZuwyIyASydfg6Rf+GYG4YaZTi2buPzL32\nLog95t+gioLn8h660xTOGT7mvtmtAiKKWP2TyWMfAoGBAN3OdN+fSmZnyXzyDlPO\n3UUaBSV/vy2t+9iSLAGhQzLIRMax92Oxxr2OrfJ7SM6Gtm3bzxSIdlgXhwLRFHEW\nhUETMpR7FsItl+YEAjPmjPbKifWhLRX2aoNnMrHCJYid8BtDvPJ/TNSlZLgLv0cF\nkodZrWa43AkYtDina4hGX+5I\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-5pplx@bhaag-df531.iam.gserviceaccount.com",
    "client_id": "103129736761684397845",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-5pplx%40bhaag-df531.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  };

  // Handle private key formatting (replace escaped \n with actual newlines)
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('✅ Firebase Admin initialized with hardcoded key and Heartbeat system');
  return app;
}

let _db: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (!_db) {
    const app = initializeFirebase();
    _db = admin.firestore(app);
  }
  return _db;
}

// Exporting the database using a Proxy for lazy initialization
export const db: admin.firestore.Firestore = new Proxy(
  {} as admin.firestore.Firestore,
  {
    get(_target, prop, receiver) {
      const realDb = getDb();
      const value = Reflect.get(realDb, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(realDb);
      }
      return value;
    },
  }
);

/**
 * 💓 NEW: Heartbeat Function
 * Updates the 'system/status' document in Firestore with current time.
 * Use this in your Cron API to see if the engine is alive.
 */
export async function updateEngineHeartbeat() {
  try {
    const database = getDb();
    await database.collection('system').doc('status').set({
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      engineStatus: 'ONLINE',
      message: 'GitHub Auto-Pilot is running background tasks'
    }, { merge: true });
    console.log('💓 Heartbeat Updated: Engine is Online');
  } catch (error) {
    console.error('❌ Heartbeat Failed:', error);
  }
}
