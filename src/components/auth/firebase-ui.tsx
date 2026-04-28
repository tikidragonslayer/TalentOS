// src/components/auth/firebase-ui.tsx
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { auth } from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';

// Type definition for the props
interface FirebaseUiProps {
  uiConfig: auth.Config;
  auth: any;
}

export const FirebaseUi = ({ uiConfig, auth }: FirebaseUiProps) => {
  useEffect(() => {
    // Dynamically import firebaseui to avoid SSR issues
    const firebaseui = import('firebaseui');

    firebaseui.then(fui => {
        const ui = fui.auth.AuthUI.getInstance() || new fui.auth.AuthUI(auth);
        
        const container = document.getElementById('firebaseui-auth-container');
        if (container) {
            ui.start('#firebaseui-auth-container', uiConfig);
        }
    });

    const unsubscribe = onAuthStateChanged(auth, user => {
        // Handle user state changes if needed, but context does most of this
    });

    return () => {
        unsubscribe();
        const ui = import('firebaseui').then(fui => fui.auth.AuthUI.getInstance());
        ui.then(instance => instance?.reset());
    };
  }, [uiConfig, auth]);

  return <div id="firebaseui-auth-container"></div>;
};
