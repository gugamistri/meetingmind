/**
 * Application Router Configuration
 * 
 * Defines all routes for the application with lazy loading and error boundaries
 */

import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// Lazy load components for code splitting
const Dashboard = React.lazy(() => import('../components/dashboard/Dashboard'));

// Placeholder components for other routes
const MeetingHistory = React.lazy(() => import('../pages/MeetingHistory'));
const MeetingDetails = React.lazy(() => import('../pages/MeetingDetails'));
const Settings = React.lazy(() => import('../pages/Settings'));
const CalendarManagement = React.lazy(() => import('../pages/CalendarManagement'));

// Loading component
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Root layout component
const RootLayout = () => (
  <AppShell>
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  </AppShell>
);

// Error component
const ErrorPage = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
      <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
      <a href="/" className="text-emerald-600 hover:text-emerald-700">
        Return to Dashboard
      </a>
    </div>
  </div>
);

// Router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'meetings',
        element: <MeetingHistory />,
      },
      {
        path: 'meetings/:id',
        element: <MeetingDetails />,
      },
      {
        path: 'meetings/:id/edit',
        element: <MeetingDetails />, // Reuse with edit mode
      },
      {
        path: 'meetings/:id/transcription',
        element: <MeetingDetails />, // Reuse with transcription focus
      },
      {
        path: 'meetings/:id/summary',
        element: <MeetingDetails />, // Reuse with summary focus
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'calendar',
        element: <CalendarManagement />,
      },
    ],
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;