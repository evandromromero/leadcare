
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalState } from './types';
import { initialState } from './store/mockData';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Connect from './pages/Connect';
import Inbox from './pages/Inbox';
import Kanban from './pages/Kanban';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Receipts from './pages/Receipts';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClinics from './pages/admin/AdminClinics';
import AdminClinicDetail from './pages/admin/AdminClinicDetail';
import AdminLogin from './pages/admin/AdminLogin';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';
import { useAuth, AuthProvider } from './hooks/useAuth';

interface PrivateRouteProps {
  children: React.ReactNode;
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
  isAuthenticated: boolean;
  authLoading: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, state, setState, isAuthenticated, authLoading }) => {
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <Layout state={state} setState={setState}>
      {children}
    </Layout>
  ) : (
    <Navigate to="/login" />
  );
};

const AdminRoute: React.FC<{ children: React.ReactNode; isAuthenticated: boolean; authLoading: boolean; isSuperAdmin: boolean }> = ({ 
  children, isAuthenticated, authLoading, isSuperAdmin 
}) => {
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const [state, setState] = useState<GlobalState>(initialState);
  const { user, clinic, session, loading: authLoading, isImpersonating, impersonatedClinic } = useAuth();

  useEffect(() => {
    // Se está fazendo impersonate, usar a clínica do impersonate
    if (user && isImpersonating && impersonatedClinic) {
      setState(prev => ({
        ...prev,
        currentUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: impersonatedClinic.id,
          avatarUrl: user.avatarUrl || '',
          status: user.status,
        },
        selectedClinic: {
          id: impersonatedClinic.id,
          name: impersonatedClinic.name,
          idCode: impersonatedClinic.slug || '',
          logoUrl: impersonatedClinic.logoUrl || '',
        },
      }));
    } else if (user && clinic) {
      setState(prev => ({
        ...prev,
        currentUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId || '',
          avatarUrl: user.avatarUrl || '',
          status: user.status,
        },
        selectedClinic: {
          id: clinic.id,
          name: clinic.name,
          idCode: clinic.slug,
          logoUrl: clinic.logoUrl || '',
        },
      }));
    } else if (user && !clinic && user.role === 'SuperAdmin' && !isImpersonating) {
      // SuperAdmin sem clínica e sem impersonate
      setState(prev => ({
        ...prev,
        currentUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: '',
          avatarUrl: user.avatarUrl || '',
          status: user.status,
        },
        selectedClinic: null,
      }));
    } else if (!session && !authLoading) {
      setState(prev => ({
        ...prev,
        currentUser: null,
        selectedClinic: null,
      }));
    }
  }, [user, clinic, session, authLoading, isImpersonating, impersonatedClinic]);

  // Redirecionar SuperAdmin para /admin
  const getDefaultRoute = () => {
    if (user?.role === 'SuperAdmin') return '/admin';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={getDefaultRoute()} /> : <Login setState={setState} />} />
        
        {/* Admin Login - rota separada */}
        <Route path="/admin/login" element={
          session && user?.role === 'SuperAdmin' ? <Navigate to="/admin" /> : <AdminLogin />
        } />
        
        <Route path="/dashboard" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Dashboard state={state} />
          </PrivateRoute>
        } />

        <Route path="/connect-whatsapp" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Connect state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/inbox" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Inbox state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/kanban" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Kanban state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/users" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Users state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Settings state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/receipts" element={
          <PrivateRoute state={state} setState={setState} isAuthenticated={!!session} authLoading={authLoading}>
            <Receipts state={state} />
          </PrivateRoute>
        } />

        {/* Admin Routes - sem Layout de clínica */}
        <Route path="/admin" element={
          <AdminRoute isAuthenticated={!!session} authLoading={authLoading} isSuperAdmin={user?.role === 'SuperAdmin'}>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </AdminRoute>
        } />

        <Route path="/admin/clinics" element={
          <AdminRoute isAuthenticated={!!session} authLoading={authLoading} isSuperAdmin={user?.role === 'SuperAdmin'}>
            <AdminLayout>
              <AdminClinics />
            </AdminLayout>
          </AdminRoute>
        } />

        <Route path="/admin/clinics/:id" element={
          <AdminRoute isAuthenticated={!!session} authLoading={authLoading} isSuperAdmin={user?.role === 'SuperAdmin'}>
            <AdminLayout>
              <AdminClinicDetail />
            </AdminLayout>
          </AdminRoute>
        } />

        <Route path="/admin/settings" element={
          <AdminRoute isAuthenticated={!!session} authLoading={authLoading} isSuperAdmin={user?.role === 'SuperAdmin'}>
            <AdminLayout>
              <AdminSettings />
            </AdminLayout>
          </AdminRoute>
        } />

        <Route path="/admin/users" element={
          <AdminRoute isAuthenticated={!!session} authLoading={authLoading} isSuperAdmin={user?.role === 'SuperAdmin'}>
            <AdminLayout>
              <AdminUsers />
            </AdminLayout>
          </AdminRoute>
        } />

        <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
