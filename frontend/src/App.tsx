import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import TipPage from './pages/TipPage';
import SendTipPage from './pages/SendTipPage';
import StaffNotFoundPage from './pages/StaffNotFoundPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentErrorPage from './pages/PaymentErrorPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/send-tip" element={<SendTipPage />} />
        <Route path="/tip/:staffId" element={<TipPage />} />
        <Route path="/staff-not-found" element={<StaffNotFoundPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/error" element={<PaymentErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
