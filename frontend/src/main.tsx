// Global polyfills for XMTP SDK
import { Buffer } from 'buffer';
import process from 'process';

// CRITICAL: Complete SES bypass for XMTP
try {
  // Disable all SES mechanisms
  (window as any).__DISABLE_SES__ = true;
  (window as any).DISABLE_SES = true;
  
  // Override lockdown before it can be called
  if ((window as any).lockdown) {
    (window as any).lockdown = () => {
      console.log('[SES] Lockdown disabled for XMTP compatibility');
    };
  }
  
  // Override harden function
  if ((window as any).harden) {
    (window as any).harden = (obj: any) => obj;
  }
  
  // Disable SES error reporting
  (window as any).reportError = () => {};
  
  // Ensure global objects are available BEFORE any SES code
  (window as any).globalThis = window;
  (window as any).global = window;
  (window as any).self = window;
  
  // Set up polyfills early
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  
  console.log('[SES] Successfully disabled SES for XMTP');
} catch (error) {
  console.error('[SES] Failed to disable SES:', error);
}

// Override SES to prevent XMTP blocking
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ').toString();
  // Suppress SES deprecated warnings and lockdown warnings
  if (message.includes('SES') || 
      message.includes('dateTaming') || 
      message.includes('mathTaming') ||
      message.includes('lockdown-install') ||
      message.includes('deprecated and does nothing') ||
      message.includes('Removing unpermitted intrinsics') ||
      message.includes('toTemporalInstant') ||
      message.includes('The \'dateTaming\' option is deprecated') ||
      message.includes('The \'mathTaming\' option is deprecated')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Also override console.log to filter SES messages
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.join(' ').toString();
  if (message.includes('SES') && (
      message.includes('dateTaming') || 
      message.includes('mathTaming') ||
      message.includes('Removing unpermitted intrinsics'))) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

// Override console.error to filter XMTP internal errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ').toString();
  if (message.includes('key_package_cleaner_worker') || 
      message.includes('sync worker error storage error: Record not found') ||
      message.includes('Record not found inbox_id')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Override error handler to prevent SES errors from breaking XMTP
const originalOnerror = window.onerror;
window.onerror = (msg, source, lineno, colno, error) => {
  if (msg?.toString?.().includes?.('Permission denied') || 
      msg?.toString?.().includes?.('SES') ||
      source?.includes?.('lockdown')) {
    console.log('[SES] Suppressed SES error:', msg);
    return true; // Prevent default error handling
  }
  return originalOnerror?.(msg, source, lineno, colno, error);
};

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import SafeOnchainProvider from './components/SafeOnchainProvider'
import { XmtpProvider } from './contexts/XmtpContext'

const queryClient = new QueryClient()

// Base mainnet chain configuration
const base = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
    public: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
  testnet: false,
} as const;

// Enable dark mode for OnchainKit
document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <SafeOnchainProvider
            apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
            chain={base}
            config={{
              appearance: {
                name: 'TipMaster',
                logo: '/favicon.svg',
                mode: 'dark',
                theme: 'dark',
              },
            }}
          >
            <XmtpProvider>
              <App />
            </XmtpProvider>
          </SafeOnchainProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
