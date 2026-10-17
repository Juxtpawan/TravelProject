import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

export default function useWishlistAccount() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const requireAccount = useCallback(() => {
    if (isLoading) return true;
    if (user) return false;
    const from = `${location.pathname}${location.search}${location.hash}`;
    navigate('/auth/signup', {
      state: {
        from,
        notice: 'Create an account to save places to your wishlist.',
      },
    });
    return true;
  }, [isLoading, location.hash, location.pathname, location.search, navigate, user]);

  return { user, isLoading, requireAccount };
}
