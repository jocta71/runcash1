import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Componentes de layout
import Layout from '../components/Layout/Layout';

// Páginas públicas
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import PlansPage from '../pages/PlansPage';
import SubscriptionRequiredPage from '../pages/SubscriptionRequiredPage';
import RoulettePreviewPage from '../pages/RoulettePreviewPage';

// Páginas protegidas por autenticação e assinatura
import DashboardPage from '../pages/DashboardPage';
import RouletteListPage from '../pages/RouletteListPage';
import RouletteDetailsPage from '../pages/RouletteDetailsPage';
import SubscriptionSuccessPage from '../pages/SubscriptionSuccessPage';
import MySubscriptionPage from '../pages/MySubscriptionPage';

// Guards de rotas
import PrivateRoute from '../components/RouteGuards/PrivateRoute';
import SubscriptionRoute from '../components/RouteGuards/SubscriptionRoute';

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        {/* Páginas públicas */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/login" element={<Layout><LoginPage /></Layout>} />
        <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
        <Route path="/plans" element={<Layout><PlansPage /></Layout>} />
        <Route path="/subscription-required" element={<Layout><SubscriptionRequiredPage /></Layout>} />
        <Route path="/preview" element={<Layout><RoulettePreviewPage /></Layout>} />
        
        {/* Página de sucesso de assinatura */}
        <Route path="/subscription/success" element={
          <PrivateRoute>
            <Layout><SubscriptionSuccessPage /></Layout>
          </PrivateRoute>
        } />
        
        {/* Páginas que requerem autenticação */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Layout><DashboardPage /></Layout>
          </PrivateRoute>
        } />
        
        <Route path="/dashboard/subscription" element={
          <PrivateRoute>
            <Layout><MySubscriptionPage /></Layout>
          </PrivateRoute>
        } />
        
        {/* Páginas que requerem assinatura */}
        <Route path="/roulettes" element={
          <SubscriptionRoute>
            <Layout><RouletteListPage /></Layout>
          </SubscriptionRoute>
        } />
        
        <Route path="/roulette/:id" element={
          <SubscriptionRoute>
            <Layout><RouletteDetailsPage /></Layout>
          </SubscriptionRoute>
        } />
        
        {/* Rota 404 - Página não encontrada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes; 