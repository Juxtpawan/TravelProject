import { Link, useLocation } from 'react-router-dom';
import { AuthCard, LoginForm, SignupForm } from "../features/auth";
import { Compass, MapPin, Sparkles } from 'lucide-react';
import { HERO_IMAGES } from '../shared/heroImages';

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
    <main className="grid min-h-dvh bg-[#f7f8f6] lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <section className="relative isolate flex min-h-[13rem] items-end overflow-hidden bg-[#233c32] p-5 text-white sm:min-h-[18rem] sm:p-8 lg:min-h-dvh lg:p-12 xl:p-16">
        <img src={HERO_IMAGES[0].src} srcSet={HERO_IMAGES[0].srcSet} sizes="(min-width: 1024px) 58vw, 100vw" alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/20 to-black/5" />
        <Link to="/" className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/15 px-3.5 py-2 text-sm font-extrabold text-white backdrop-blur-md transition hover:bg-black/25 sm:left-8 sm:top-8 lg:left-12 lg:top-12">
          <Compass size={18} /> Travel<span className="text-[#34e0a1]">Project</span>
        </Link>
        <div className="relative z-20 max-w-xl">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f8d38b] sm:text-sm"><Sparkles size={15} /> Make room for a new story</p>
          <h2 className="text-2xl font-extrabold leading-tight [text-wrap:balance] sm:text-4xl lg:text-5xl">Find the places you’ll talk about for years.</h2>
          <p className="mt-3 hidden max-w-lg text-sm leading-6 text-white/85 sm:block sm:text-base">Save the places that inspire you and turn them into a trip that feels like yours.</p>
          <div className="mt-5 hidden items-center gap-2 text-sm font-semibold text-white/90 sm:flex"><MapPin size={16} className="text-[#f8d38b]" /> Explore more. Plan better. Go your way.</div>
        </div>
      </section>
      <section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#68756f] transition hover:text-pine">
              <Compass size={17} className="text-green-ink" /> Travel<span className="text-pine">Project</span>
            </Link>
          </div>
          <AuthCard
            title={isSignup ? 'Create your account' : 'Welcome back'}
            subtitle={isSignup ? 'Start planning your next trip.' : 'Log in to continue planning.'}
          >
            {isSignup ? <SignupForm /> : <LoginForm />}
          </AuthCard>
          <p className="mt-5 text-center text-xs leading-5 text-[#78857e]">Your saved trips and travel ideas stay together in one place.</p>
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
