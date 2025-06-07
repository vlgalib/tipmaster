import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { initializeApp } from 'firebase/app'
import { firebaseConfig } from './firebaseConfig.ts'

// Initialize Firebase
initializeApp(firebaseConfig)

const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey="RGIKkTzUiN4utGWf23HFkKx0oUSUNDRL"
          chain={base}
        >
    <App />
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
