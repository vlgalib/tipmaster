import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebaseConfig';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import TipPage from './pages/TipPage';
import SendTipPage from './pages/SendTipPage';
import StaffNotFoundPage from './pages/StaffNotFoundPage';
import DashboardPage from './pages/DashboardPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentErrorPage from './pages/PaymentErrorPage';
import XmtpDebugPage from './pages/XmtpDebugPage';

// Initialize Firebase
initializeApp(firebaseConfig);

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/send-tip" element={<SendTipPage />} />
            <Route path="/tip/:staffId" element={<TipPage />} />
            <Route path="/staff-not-found" element={<StaffNotFoundPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/error" element={<PaymentErrorPage />} />
            <Route path="/xmtp-debug" element={<XmtpDebugPage />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
