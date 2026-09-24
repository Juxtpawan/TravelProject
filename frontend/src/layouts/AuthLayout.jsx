import { Link, useLocation } from 'react-router-dom';
import { AuthCard, LoginForm, SignupForm } from "../features/auth";

/**
 * Centered card layout for /auth/login and /auth/signup. Swaps which form
 * it renders based on the current path — no separate LoginPage/SignupPage
 * needed, though you can still create those in pages/ if you'd rather keep
 * routing explicit; this works either way since the logic lives here.
 */
function AuthLayout() {
  const location = useLocation();
  const isSignup = location.pathname.includes('signup');

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand px-4">
      <div className="w-full flex flex-col items-center">
        <Link to="/" className="mb-8 text-2xl font-bold text-pine">
          Travel<span className="text-moss">Project</span>
        </Link>

        <AuthCard
          title={isSignup ? 'Create your account' : 'Welcome back'}
          subtitle={isSignup ? 'Start planning your next trip.' : 'Log in to continue planning.'}
        >
          {isSignup ? <SignupForm /> : <LoginForm />}
        </AuthCard>
      </div>
    </div>
  );
}

export default AuthLayout;