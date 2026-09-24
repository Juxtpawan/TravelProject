import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout'; // 1. IMPORT YOUR AUTH LAYOUT

// Pages
import HomePage from '../pages/HomePage';
import ExplorePage from '../pages/ExplorePage';
import TripDetailsPage from '../pages/TripDetailsPage';
import TripPage from '../pages/TripPage'; 

// Auth Components
import { LoginForm, SignupForm } from '../features/auth'; // 2. IMPORT FORMS

export const router = createBrowserRouter([
  // Bounded Layout: Standard pages that stay centered on desktop
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { 
        path: '/trips', 
        element: <TripPage/>
      },
    ],
  },
  
  // Immersive Layout: Full edge-to-edge workspaces (like the split map view)
  {
    element: <DashboardLayout />,
    children: [
      { path: '/trips/:tripId', element: <TripDetailsPage /> },
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
