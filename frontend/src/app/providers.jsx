import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ENV } from '../config/env';

// FIX: Direct file path instead of index.js barrel
import { AuthProvider } from '../features/auth';

export function AppProviders({ children }) {
  return (
      <GoogleOAuthProvider clientId={ENV.AUTH_CLIENT_ID}>
        <AuthProvider>
          <APIProvider apiKey={ENV.GOOGLE_MAPS_KEY}>
            <Toaster position="bottom-center" reverseOrder={false} />
            {children}
          </APIProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
  );
}
