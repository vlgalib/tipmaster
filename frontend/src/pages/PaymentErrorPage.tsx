import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const errorMessages: { [key: string]: string } = {
  TransactionFailed: 'The transaction was cancelled or failed. Please check your wallet and try again.',
  InsufficientFunds: 'You have insufficient funds to complete this transaction.',
  Default: 'An unknown error occurred. Please try again later.',
};

const PaymentErrorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const errorCode = searchParams.get('message') || 'Default';
  const errorMessage = errorMessages[errorCode] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-md p-8 text-center bg-gray-800 rounded-lg shadow-lg">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
        <p className="text-gray-300 mb-6">
          {errorMessage}
        </p>
        
        <div className="text-left bg-gray-700 p-4 rounded-md mb-6">
            <h3 className="font-semibold mb-2">Common Solutions:</h3>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Ensure your wallet is connected to the Base network.</li>
                <li>Check if you have enough USDC for the tip.</li>
                <li>Make sure you have a small amount of ETH for gas fees.</li>
            </ul>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate(-1)} // Go back to the previous page
            className="w-full block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="w-full block bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-md"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentErrorPage; 