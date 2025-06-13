import React from 'react';

const SmartWalletWarning: React.FC = () => {
  // Always show universal notification bar
  return (
    <div className="bg-blue-600 text-white text-center py-2 px-4 text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <span>ℹ️</span>
        <span>XMTP messaging works with Coinbase Wallet Extension and MetaMask. Smart Wallets are not supported - please use browser extensions.</span>
      </div>
    </div>
  );
};

export default SmartWalletWarning; 