import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, ExternalLink } from 'lucide-react';

const PaymentSuccessPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { amount?: number; recipient?: string; recipientName?: string; txHash?: string } || {};
  const { amount, recipient, recipientName, txHash } = state;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-md p-8 text-center bg-gray-800 rounded-lg shadow-lg">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-gray-300 mb-6">
          You have successfully sent <strong>${amount} USDC</strong> to {recipientName || recipient || 'the staff member'}.
        </p>
        
        {(recipient || txHash) && (
            <div className="text-left bg-gray-700 p-4 rounded-md mb-6">
                {recipient && (
                  <>
                    <p className="text-sm text-gray-400">Recipient:</p>
                    <p className="font-semibold text-sm break-all">{recipient}</p>
                  </>
                )}
                {txHash && (
                    <>
                        <p className="text-sm text-gray-400 mt-2">Transaction:</p>
                        <a 
                            href={`https://basescan.org/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm break-all text-indigo-400 hover:text-indigo-300 flex items-center gap-2 transition-colors"
                        >
                            <span>{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                            <ExternalLink size={14} />
                        </a>
                    </>
                )}
            </div>
        )}

        <div className="space-y-4">
          {recipient && (
            <Link
              to={`/tip/${recipient}`}
              className="w-full block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              Send Another Tip
            </Link>
          )}
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

export default PaymentSuccessPage; 