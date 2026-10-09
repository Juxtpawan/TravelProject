import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuth } from '../api/useGoogleAuth';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The two social buttons shown under both LoginForm and SignupForm.
 * Google is live (you have the client ID). Apple is disabled/commented
 * until you have an Apple Developer key — swap it in later with no
 * other file needing to change.
 */
function SocialAuthButtons() {
  const { submit, isLoading } = useGoogleAuth();
  const [googleError, setGoogleError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setGoogleError('Google did not return an ID token. Please try again.');
      return;
    }

    setGoogleError('');
    try {
      await submit(credentialResponse.credential);
      navigate(location.state?.from || '/', { replace: true });
    } catch (error) {
      setGoogleError(error.response?.data?.error || error.message || 'Google sign-in failed. Please try again.');
    }
  };


  return (
    <div className="flex flex-col gap-3 items-center justify-center">
      <div className="flex w-full justify-center overflow-hidden">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setGoogleError('Google sign-in could not start. Check that this site is allowed in your Google OAuth settings.')}
          width="280"
          theme="outline"
          text="continue_with"
        />
      </div>
      {isLoading && <p role="status" className="text-center text-xs text-pine/70">Signing in with Google…</p>}
      {googleError && <p role="alert" className="w-full text-center text-sm text-red-600">{googleError}</p>}

      {/*
        Apple Sign In — uncomment once you have an Apple Developer key.
        1. npm i react-apple-signin-auth
        2. add APPLE_CLIENT_ID + APPLE_REDIRECT_URI to config/env.js
        3. uncomment below and remove the disabled button underneath

        import AppleSignin from 'react-apple-signin-auth';
        import { ENV } from '@/config/env';

        <AppleSignin
          authOptions={{
            clientId: ENV.APPLE_CLIENT_ID,
            scope: 'email name',
            redirectURI: ENV.APPLE_REDIRECT_URI,
            usePopup: true,
          }}
          onSuccess={(response) => submit(response.authorization.id_token)}
          onError={(error) => console.error(error)}
          render={(renderProps) => (
            <button
              onClick={renderProps.onClick}
              disabled={renderProps.disabled}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray text-sm font-medium text-pine hover:bg-gray transition-colors"
            >
              Continue with Apple
            </button>
          )}
        />
      */}
      {/* <button
        type="button"
        disabled
        title="Apple Sign In needs an Apple Developer key — not configured yet"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray text-sm font-medium text-pine/40 cursor-not-allowed"
      >
        Continue with Apple (coming soon)
      </button> */}
    </div>
  );
}

export default SocialAuthButtons;