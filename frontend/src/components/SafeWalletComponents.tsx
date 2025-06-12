import React, { useState, useEffect } from 'react';

interface SafeWalletComponentsProps {
  children: (components: any) => React.ReactNode;
  fallback?: React.ReactNode;
}

const SafeWalletComponents: React.FC<SafeWalletComponentsProps> = ({ 
  children, 
  fallback = <div>Loading wallet...</div> 
}) => {
  const [components, setComponents] = useState<any>(null);

  useEffect(() => {
    const loadComponents = async () => {
      try {
        console.log('[SafeWalletComponents] Loading OnchainKit...');
        const [
          transactionModule,
          walletModule,
          identityModule
        ] = await Promise.all([
          import('@coinbase/onchainkit/transaction'),
          import('@coinbase/onchainkit/wallet'),
          import('@coinbase/onchainkit/identity')
        ]);

        setComponents({
          Transaction: transactionModule.Transaction,
          TransactionButton: transactionModule.TransactionButton,
          TransactionStatus: transactionModule.TransactionStatus,
          TransactionStatusLabel: transactionModule.TransactionStatusLabel,
          TransactionStatusAction: transactionModule.TransactionStatusAction,
          Wallet: walletModule.Wallet,
          ConnectWallet: walletModule.ConnectWallet,
          WalletDropdown: walletModule.WalletDropdown,
          WalletDropdownDisconnect: walletModule.WalletDropdownDisconnect,
          Address: identityModule.Address,
          Avatar: identityModule.Avatar,
          Name: identityModule.Name,
          Identity: identityModule.Identity
        });
      } catch (err) {
        console.error('[SafeWalletComponents] Failed to load OnchainKit:', err);
        // Set fallback components
        setComponents({
          Transaction: ({ children, onStatus }: any) => {
            useEffect(() => {
              if (onStatus) {
                onStatus({ statusName: 'error', statusData: { error: 'OnchainKit unavailable' } });
              }
            }, [onStatus]);
            return <div className="space-y-4">{children}</div>;
          },
          TransactionButton: ({ className, text }: any) => (
            <button 
              className={className} 
              disabled={true}
              title="Wallet components unavailable"
            >
              {text || 'Wallet Unavailable'}
            </button>
          ),
          TransactionStatus: ({ children }: any) => <div>{children}</div>,
          TransactionStatusLabel: () => <div className="text-sm text-muted-foreground">Status unavailable</div>,
          TransactionStatusAction: () => <div></div>,
          Wallet: ({ children }: any) => <div>{children}</div>,
          ConnectWallet: ({ children }: any) => (
            <button 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg"
              onClick={() => alert('Please connect your wallet manually via browser extension')}
            >
              {children || 'Connect Wallet'}
            </button>
          ),
          WalletDropdown: ({ children }: any) => <div>{children}</div>,
          WalletDropdownDisconnect: () => (
            <button 
              className="text-red-500 text-sm"
              onClick={() => window.location.reload()}
            >
              Disconnect
            </button>
          ),
          Address: () => <span className="font-mono text-sm">0x...0000</span>,
          Avatar: () => <div className="w-8 h-8 rounded-full bg-gray-300"></div>,
          Name: () => <span>Wallet</span>,
          Identity: ({ children }: any) => <div className="flex items-center gap-2">{children}</div>
        });
      }
    };

    loadComponents();
  }, []);

  if (!components) {
    return <>{fallback}</>;
  }

  return <>{children(components)}</>;
};

export default SafeWalletComponents; 