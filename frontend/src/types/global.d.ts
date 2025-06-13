declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (data: any) => void) => void;
      removeListener: (event: string, callback: (data: any) => void) => void;
      disconnect?: () => Promise<void>;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
    };
    coinbaseWalletExtension?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (data: any) => void) => void;
      removeListener: (event: string, callback: (data: any) => void) => void;
    };
    // Removed deprecated web3 interface - Coinbase Wallet no longer injects it
  }
}

export {}; 