
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalState } from './types';
import { initialState } from './store/mockData';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Connect from './pages/Connect';
import Inbox from './pages/Inbox';
import Kanban from './pages/Kanban';
import Users from './pages/Users';
import Settings from './pages/Settings';

// Fixed PrivateRoute definition by moving it outside App and explicitly typing props.
// This resolves the error: Property 'children' is missing in type '{}' but required in type '{ children: React.ReactNode; }'
interface PrivateRouteProps {
  children: React.ReactNode;
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, state, setState }) => {
  return state.currentUser ? (
    <Layout state={state} setState={setState}>
      {children}
    </Layout>
  ) : (
    <Navigate to="/login" />
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<GlobalState>(initialState);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setState={setState} />} />
        
        <Route path="/dashboard" element={
          <PrivateRoute state={state} setState={setState}>
            <Dashboard state={state} />
          </PrivateRoute>
        } />

        <Route path="/connect-whatsapp" element={
          <PrivateRoute state={state} setState={setState}>
            <Connect state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/inbox" element={
          <PrivateRoute state={state} setState={setState}>
            <Inbox state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/kanban" element={
          <PrivateRoute state={state} setState={setState}>
            <Kanban state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/users" element={
          <PrivateRoute state={state} setState={setState}>
            <Users state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute state={state} setState={setState}>
            <Settings state={state} setState={setState} />
          </PrivateRoute>
        } />

        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
};

export default App;
