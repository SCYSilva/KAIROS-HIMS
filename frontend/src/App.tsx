// frontend/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// ── Shared Infrastructure ──────────────────────────────────────────────────
import { AuthProvider, useAuthContext } from './features/auth/context/AuthContext';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { MainLayout } from './shared/components/MainLayout';

// ── Auth Feature ──────────────────────────────────────────────────────────
import { Login } from './features/auth/pages/Login';

// ── 1. Staff Feature Pages ────────────────────────────────────────────────
import { CreateIncident } from './features/staff/pages/CreateIncident';
import MyIncidentsPage from './features/staff/pages/MyIncidentsPage';
import { StaffIncidentDetails } from './features/staff/pages/StaffIncidentDetails';

// ── 2. Investigator Feature Pages ─────────────────────────────────────────
import InvestigatorDashboard from './features/investigator/pages/InvestigatorDashboard';
import InvestigatorWorkspace from './features/investigator/pages/InvestigatorWorkspace';

// ── 3. Action Owner Feature Pages ─────────────────────────────────────────
import { ActionOwnerDashboard } from './features/action-owner/pages/ActionOwnerDashboard';
import ActionOwnerIncidentDetails from './features/action-owner/pages/ActionOwnerIncidentDetails';

// ── 4. Department Manager Feature Pages ────────────────────────────────────
import { ManagerDashboard } from './features/manager/pages/ManagerDashboard';
import { ManagerIncidentDetails } from './features/manager/pages/ManagerIncidentDetails';
import { ManagerAnalytics } from './features/manager/pages/ManagerAnalytics';
import { ManagerTeam } from './features/manager/pages/ManagerTeam';
import { LessonsLibrary } from './features/manager/pages/LessonsLibrary';
import { IncidentsList } from './features/manager/pages/IncidentsList';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

// Home router: Directs each user to their role-specific workspace landing page
const HomeRoute = () => {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[#0F1E42] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  switch (user?.role) {
    case 'INVESTIGATOR':
      return <InvestigatorDashboard />;
    case 'ACTION_OWNER':
      return <ActionOwnerDashboard />;
    case 'STAFF':
      return <MyIncidentsPage />;
    case 'MANAGER':
    case 'ADMIN':
      return <ManagerDashboard />;
    default:
      return <MyIncidentsPage />;
  }
};

// Smart Incident Route: Serves 4-Tab Clinical Governance to Managers, staff tracking view to others
const IncidentDetailsDispatcher = () => {
  const { user } = useAuthContext();
  if (user?.role === 'MANAGER' || user?.role === 'ADMIN') {
    return <ManagerIncidentDetails />;
  }
  return <StaffIncidentDetails />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster position="top-right" reverseOrder={false} />
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Shell */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={['MANAGER', 'STAFF', 'INVESTIGATOR', 'ACTION_OWNER', 'ADMIN']}
              />
            }
          >
            <Route element={<MainLayout />}>
              {/* Home Route */}
              <Route path="/" element={<HomeRoute />} />

              {/* Staff Routes */}
              <Route path="/my-incidents" element={<MyIncidentsPage />} />
              <Route path="/submit-incident" element={<CreateIncident />} />
              <Route path="/staff/incidents/:id" element={<StaffIncidentDetails />} />

              {/* Smart Incident Detail Route */}
              <Route path="/incidents/:id" element={<IncidentDetailsDispatcher />} />
              <Route path="/manager/incidents/:id" element={<ManagerIncidentDetails />} />

              {/* Investigator Routes */}
              <Route path="/investigator" element={<InvestigatorDashboard />} />
              <Route path="/investigator/:id" element={<InvestigatorWorkspace />} />

              {/* Action Owner Routes */}
              <Route path="/action-owner" element={<ActionOwnerDashboard />} />
              <Route path="/action-owner/:id" element={<ActionOwnerIncidentDetails />} />

              {/* Department Manager & Admin Workspace Routes */}
              <Route element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
                <Route path="/incidents" element={<IncidentsList />} />
                <Route path="/lessons" element={<LessonsLibrary />} />
                <Route path="/team" element={<ManagerTeam />} />
                <Route path="/analytics" element={<ManagerAnalytics />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;