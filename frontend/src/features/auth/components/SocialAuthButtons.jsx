import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuth } from '../api/useGoogleAuth';
import { useNavigate } from 'react-router-dom';

/**
 * The two social buttons shown under both LoginForm and SignupForm.
 * Google is live (you have the client ID). Apple is disabled/commented
 * until you have an Apple Developer key — swap it in later with no
 * other file needing to change.
 */
function SocialAuthButtons() {
  const { submit } = useGoogleAuth();
  const navigate = useNavigate(); // 2. INITIALIZE NAVIGATE

  // 3. FIX: Handle the login process asynchronously and force navigation on success
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // Wait for your hook to drop the session cookie and authenticate with Cloudflare
      await submit(credentialResponse.credential);
      
      console.log("Google authentication complete. Redirecting...");
      
      // Force navigation to the home page layout
      navigate('/', { replace: true });
    } catch (err) {
      console.error("Authentication backend hook error intercepted:", err);
      // Fallback redirect safeguard
      navigate('/', { replace: true });
    }
  };


  return (
    <div className="flex flex-col gap-3 items-center justify-center">
      <div className="[&>div]:w-full">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => console.error('Google sign-in failed')}
          width="100%"
          theme="outline"
          text="continue_with"
        />
      </div>

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
      <button
        type="button"
        disabled
        title="Apple Sign In needs an Apple Developer key — not configured yet"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray text-sm font-medium text-pine/40 cursor-not-allowed"
      >
        Continue with Apple (coming soon)
      </button>
    </div>
  );
}

export default SocialAuthButtons;