import React, { type ReactNode, Suspense } from 'react';

interface SafeOnchainProviderProps {
  children: ReactNode;
  apiKey?: string;
  chain: any;
  config?: any;
}

/**
 * Safe wrapper for OnchainKitProvider that handles React 19 compatibility issues
 */
const SafeOnchainProvider: React.FC<SafeOnchainProviderProps> = ({ 
  children, 
  apiKey, 
  chain, 
  config 
}) => {
  // Fallback for when OnchainKit has issues
  const [hasOnchainKitError, setHasOnchainKitError] = React.useState(false);

  if (hasOnchainKitError) {
    console.warn('OnchainKit failed to load, using fallback mode');
    return <div>{children}</div>;
  }

  try {
    // Lazy load OnchainKitProvider to catch import errors
    const LazyOnchainProvider = React.lazy(async () => {
      try {
        const { OnchainKitProvider } = await import('@coinbase/onchainkit');
        return {
          default: ({ children }: { children: ReactNode }) => (
            <OnchainKitProvider
              apiKey={apiKey}
              chain={chain}
              config={{
                appearance: {
                  mode: 'dark',
                  theme: 'default',
                  primaryColor: '#6366f1',
                  borderRadius: 12,
                  style: {
                    // Font and Shape
                    '--ock-font-family': 'Inter, system-ui, sans-serif',
                    '--ock-border-radius': '12px',
                    '--ock-border-radius-inner': '8px',
                    
                    // Modal and Overlay - CRITICAL for fixing transparency
                    '--ock-overlay-background': 'rgba(169, 26, 26)',
                    '--ock-modal-background': 'hsl(var(--card))',
                    '--ock-modal-border': '1px solid hsl(var(--border))',
                    '--ock-modal-backdrop-filter': 'blur(8px)',
                    '--ock-modal-box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    '--ock-modal-border-radius': '12px',
                    '--ock-modal-padding': '24px',
                    '--ock-modal-width': '400px',
                    '--ock-modal-max-width': '90vw',
                    
                    // Text Colors
                    '--ock-text-inverse': 'hsl(var(--background))',
                    '--ock-text-foreground': 'hsl(var(--foreground))',
                    '--ock-text-foreground-muted': 'hsl(var(--muted-foreground))',
                    '--ock-text-error': 'hsl(var(--destructive))',
                    '--ock-text-primary': '#6366f1',
                    '--ock-text-success': 'hsl(var(--primary))',
                    '--ock-text-warning': '#f59e0b',
                    '--ock-text-disabled': 'hsl(var(--muted-foreground))',
                    
                    // Background Colors
                    '--ock-bg-default': 'hsl(var(--card))',
                    '--ock-bg-default-hover': 'hsl(var(--muted))',
                    '--ock-bg-default-active': 'hsl(var(--muted))',
                    '--ock-bg-alternate': 'hsl(var(--background))',
                    '--ock-bg-alternate-hover': 'hsl(var(--muted))',
                    '--ock-bg-alternate-active': 'hsl(var(--muted))',
                    '--ock-bg-inverse': 'hsl(var(--foreground))',
                    '--ock-bg-inverse-hover': 'hsl(var(--foreground))',
                    '--ock-bg-inverse-active': 'hsl(var(--foreground))',
                    '--ock-bg-primary': '#6366f1',
                    '--ock-bg-primary-hover': '#5855eb',
                    '--ock-bg-primary-active': '#4f46e5',
                    '--ock-bg-primary-washed': 'rgba(99, 102, 241, 0.1)',
                    '--ock-bg-primary-disabled': 'hsl(var(--muted))',
                    '--ock-bg-secondary': 'hsl(var(--muted))',
                    '--ock-bg-secondary-hover': 'hsl(var(--muted))',
                    '--ock-bg-secondary-active': 'hsl(var(--muted))',
                    '--ock-bg-error': 'hsl(var(--destructive))',
                    '--ock-bg-warning': '#f59e0b',
                    '--ock-bg-success': 'hsl(var(--primary))',
                    '--ock-bg-default-reverse': 'hsl(var(--background))',
                    
                    // Icon Colors
                    '--ock-icon-color-primary': '#6366f1',
                    '--ock-icon-color-foreground': 'hsl(var(--foreground))',
                    '--ock-icon-color-foreground-muted': 'hsl(var(--muted-foreground))',
                    '--ock-icon-color-inverse': 'hsl(var(--background))',
                    '--ock-icon-color-error': 'hsl(var(--destructive))',
                    '--ock-icon-color-success': 'hsl(var(--primary))',
                    '--ock-icon-color-warning': '#f59e0b',
                    
                    // Border Colors
                    '--ock-border-line-primary': '#6366f1',
                    '--ock-border-line-default': 'hsl(var(--border))',
                    '--ock-border-line-heavy': 'hsl(var(--border))',
                    '--ock-border-line-inverse': 'hsl(var(--background))',
                    
                    // Button styling
                    '--ock-button-border-radius': '8px',
                    '--ock-button-padding': '12px 16px',
                    '--ock-button-font-weight': '600',
                    '--ock-button-background': '#6366f1',
                    '--ock-button-background-hover': '#5855eb',
                    '--ock-button-color': '#ffffff',
                    '--ock-button-border': '1px solid #6366f1',
                    '--ock-button-shadow': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    
                    // Input styling
                    '--ock-input-background': 'hsl(var(--background))',
                    '--ock-input-border': 'hsl(var(--border))',
                    '--ock-input-border-radius': '8px',
                    '--ock-input-padding': '12px',
                    '--ock-input-color': 'hsl(var(--foreground))',
                    '--ock-input-placeholder-color': 'hsl(var(--muted-foreground))',
                    
                    // Focus trap and accessibility - FIXED
                    '--ock-focus-ring-color': '#6366f1',
                    '--ock-focus-ring-width': '2px',
                    '--ock-focus-ring-offset': '2px',
                    '--ock-focus-trap-background': 'rgba(0, 0, 0, 0.85)',
                    '--ock-focus-trap-backdrop-filter': 'blur(8px)',
                    '--ock-focus-trap-z-index': '9999',
                    
                    // Dialog/Modal focus trap styling
                    '--ock-dialog-overlay-background': 'rgba(0, 0, 0, 0.85)',
                    '--ock-dialog-overlay-backdrop-filter': 'blur(8px)',
                    '--ock-dialog-content-background': 'hsl(var(--card))',
                    '--ock-dialog-content-border': '1px solid hsl(var(--border))',
                    '--ock-dialog-content-border-radius': '12px',
                    '--ock-dialog-content-box-shadow': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    
                    // Wallet list styling
                    '--ock-wallet-list-background': 'hsl(var(--card))',
                    '--ock-wallet-list-border': '1px solid hsl(var(--border))',
                    '--ock-wallet-list-item-background': 'hsl(var(--card))',
                    '--ock-wallet-list-item-background-hover': 'hsl(var(--muted))',
                    '--ock-wallet-list-item-border': '1px solid hsl(var(--border))',
                    '--ock-wallet-list-item-border-radius': '8px',
                    '--ock-wallet-list-item-padding': '12px',
                    
                    // Shadow
                    '--ock-shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    '--ock-shadow-lg': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  }
                },
                wallet: {
                  display: 'modal',
                  termsUrl: '',
                  privacyUrl: '',
                  // Show existing wallet connection options instead of creating new ones
                  smartWalletOnly: false,
                  // Disable showing Coinbase wallet creation as first option
                  coinbaseWalletPreference: 'eoaOnly',
                },
                ...config
              }}
            >
              {children}
            </OnchainKitProvider>
          ),
        };
      } catch (error) {
        console.error('Failed to load OnchainKit:', error);
        setHasOnchainKitError(true);
        // Return a fallback component
        return {
          default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        };
      }
    });

    return (
      <Suspense fallback={<div>Loading...</div>}>
        <LazyOnchainProvider>
          {children}
        </LazyOnchainProvider>
      </Suspense>
    );
  } catch (error) {
    console.error('Error in SafeOnchainProvider:', error);
    return <div>{children}</div>;
  }
};

export default SafeOnchainProvider; 