import * as admin from "firebase-admin";

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, "\n");
}

export function createFirebaseAdminApp(params: FirebaseAdminConfig) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: params.projectId,
            clientEmail: params.clientEmail,
            privateKey: privateKey,
        }),
        projectId: params.projectId,
    });
}

// Singleton initialization
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Fallback for build time if secrets aren't present (to prevent build crashes)
// In production runtime, these MUST be present.
const initConfig = {
    projectId: projectId || "mock-project-id",
    clientEmail: clientEmail || "mock@example.com",
    privateKey: privateKey || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----",
};

// Only initialize if credentials are available (skip during build if secrets aren't set)
if (!admin.apps.length && privateKey && clientEmail) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId || "veiled-ventures",
                clientEmail,
                privateKey: formatPrivateKey(privateKey),
            })
        });
    } catch (e) {
        console.error('Firebase Admin init failed', e);
    }
}

// Lazy getters so build doesn't crash when credentials aren't available
export const db = new Proxy({} as admin.firestore.Firestore, {
    get(_, prop) {
        return (admin.firestore() as any)[prop];
    }
});
export const auth = new Proxy({} as admin.auth.Auth, {
    get(_, prop) {
        return (admin.auth() as any)[prop];
    }
});
