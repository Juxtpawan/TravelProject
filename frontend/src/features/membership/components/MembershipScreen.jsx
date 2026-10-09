import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Compass, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth';
import { upgradeMembership } from '../api/membershipApi';

const plans = [
  {
    name: 'Explorer',
    tier: 'free',
    price: '$0',
    description: 'For getting started with a few trips and a flexible itinerary.',
    features: ['Save your trips', 'Build day-by-day plans', 'Explore destination guides'],
  },
  {
    name: 'Nomad',
    tier: 'premium',
    price: '$9.99',
    description: 'For travelers who want a little more help shaping every trip.',
    features: ['Everything in Explorer', 'Gemini itinerary drafts', 'More trip planning capacity'],
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    if (!user?.id) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const data = await upgradeMembership(user.id, 'premium');
      setMessage(data.message || 'Your membership has been updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Membership could not be updated. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container pb-16 pt-8 sm:pt-12">
      <header className="max-w-2xl border-b border-[#e5eae6] pb-7">
        <p className="flex items-center gap-2 text-sm font-bold text-pine"><Compass size={16} /> Membership</p>
        <h1 className="mt-2 text-3xl font-extrabold text-pine sm:text-4xl">Choose how you want to travel</h1>
        <p className="mt-3 text-[#66736b]">Simple plans for collecting ideas and turning them into trips.</p>
      </header>

      {message && <p role="status" className="mt-5 rounded-lg bg-[#edf8f0] p-4 text-sm font-medium text-[#17633f]">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{error}</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = (user?.subscription_tier || 'free') === plan.tier;
          const isPremium = plan.tier === 'premium';
          return (
            <article key={plan.tier} className={`flex flex-col rounded-lg border p-6 sm:p-8 ${isPremium ? 'border-green-medium bg-[#f1f8f3]' : 'border-[#e1e8e2] bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-pine">{plan.name}</p>
                  <h2 className="mt-2 text-3xl font-extrabold text-pine">{plan.price}<span className="ml-1 text-sm font-medium text-[#718077]">{isPremium ? '/ month' : ' / always'}</span></h2>
                </div>
                {isPremium && <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-pine"><Sparkles size={13} /> More planning tools</span>}
              </div>
              <p className="mt-4 min-h-12 text-sm leading-6 text-[#66736b]">{plan.description}</p>
              <ul className="mt-5 space-y-3 border-t border-[#dfe8e1] pt-5">
                {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2.5 text-sm text-[#35433d]"><Check size={16} className="shrink-0 text-pine" />{feature}</li>)}
              </ul>
              <div className="mt-auto pt-7">
                {isCurrent ? (
                  <button type="button" disabled className="h-11 w-full rounded-full border border-[#b9c9bd] bg-white text-sm font-bold text-[#526158]">Current plan</button>
                ) : isPremium && !user ? (
                  <Link to="/auth/login" className="flex h-11 w-full items-center justify-center rounded-full bg-btn-primary-bg text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">Sign in to upgrade</Link>
                ) : isPremium ? (
                  <button type="button" onClick={handleUpgrade} disabled={loading} className="h-11 w-full rounded-full bg-btn-primary-bg text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover disabled:opacity-50">{loading ? 'Updating…' : 'Choose Nomad'}</button>
                ) : (
                  <Link to="/explore" className="flex h-11 w-full items-center justify-center rounded-full border border-[#b9c9bd] text-sm font-bold text-[#35433d] hover:bg-white">Explore destinations</Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-xs leading-5 text-[#7b8980]">Membership upgrades are currently in test mode. Payments are not collected in this version.</p>
    </div>
  );
}