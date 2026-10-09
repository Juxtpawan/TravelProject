import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout'; // 1. IMPORT YOUR AUTH LAYOUT

// Pages
import HomePage from '../pages/HomePage';
import ExplorePage from '../pages/ExplorePage';
import DestinationPage from '../pages/DestinationPage';
import TripDetailsPage from '../pages/TripDetailsPage';
import TripPage from '../pages/TripPage'; 
import PricingPage from '../pages/PricingPage';
import ProfilePage from '../pages/ProfilePage';
import AiPlannerPage from '../pages/AiPlannerPage';

// Auth Components
import { LoginForm, SignupForm } from '../features/auth'; // 2. IMPORT FORMS

export const router = createBrowserRouter([
  // Bounded Layout: Standard pages that stay centered on desktop
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/trips', element: <TripPage/> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/ai', element: <AiPlannerPage /> },
    ],
  },
  
  // Immersive Layout: Full edge-to-edge workspaces (like the split map view)
  {
    element: <DashboardLayout />,
    children: [
      { path: '/trips/:tripId', element: <TripDetailsPage /> },
      { path: '/locations/:slug', element: <DestinationPage /> },
    ],
  },

  // 3. ADDED AUTHENTICATION ROUTES BLOCK
  {
    path: '/auth',
    element: <AuthLayout />, 
    children: [
      { path: '', element: <Navigate to="login" replace /> }, // Redirects /auth straight to /auth/login
      { path: 'login', element: <LoginForm /> },              // Maps to /auth/login
      { path: 'signup', element: <SignupForm /> },            // Maps to /auth/signup
    ],
  },
]);
