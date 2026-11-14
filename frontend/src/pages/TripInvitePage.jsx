import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { requestTripAccess } from '../features/trips/api/tripsApi';

export default function TripInvitePage() {
  const { tripId, token } = useParams();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Checking your invite…');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/auth/login', { replace: true, state: { from: `/trips/invite/${tripId}/${token}`, notice: 'Sign in or create an account to request access to this trip.' } });
      return;
    }
    let live = true;
    requestTripAccess(tripId, token).then(result => {
      if (!live) return;
      if (result.status === 'accepted') {
        setStatus('accepted'); setMessage('You already have access to this trip.');
        navigate(`/trips/${tripId}`, { replace: true });
      } else {
        setStatus('pending'); setMessage(`Your request to join ${result.tripTitle || 'this trip'} was sent. The trip owner will notify you when they respond.`);
      }
    }).catch(error => {
      if (live) { setStatus('error'); setMessage(error?.response?.data?.error || 'This invite could not be used.'); }
    });
    return () => { live = false; };
  }, [isLoading, user, tripId, token, navigate]);

  return <main className="app-container grid min-h-[55vh] place-items-center py-12"><section className="w-full max-w-md rounded-3xl border border-[#dce8df] bg-white p-6 text-center shadow-sm sm:p-8">
    <h1 className="text-2xl font-extrabold text-pine">Trip collaboration invite</h1>
    <p className="mt-3 text-sm leading-6 text-[#66736b]">{message}</p>
    {status === 'pending' && <p className="mt-4 rounded-xl bg-[#f2f8f3] px-4 py-3 text-xs text-[#526158]">You’re requesting access as <strong>{user?.name || user?.username || user?.email}</strong>.</p>}
    {status === 'error' && <Link to="/trips" className="mt-5 inline-flex rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-white">Go to my trips</Link>}
  </section></main>;
}
