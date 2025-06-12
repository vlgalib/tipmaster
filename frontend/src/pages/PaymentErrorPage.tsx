import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';

const PaymentErrorPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { error?: string } || {};
  const { error } = state;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-md p-8 text-center bg-gray-800 rounded-lg shadow-lg">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
        <p className="text-gray-300 mb-6">
          Unfortunately, your transaction could not be completed.
        </p>
        
        {error && (
          <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-600 font-medium">Error Details:</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => window.history.back()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            <ArrowLeft size={20} />
            Try Again
          </button>
          <Link
            to="/"
            className="w-full block bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentErrorPage; 