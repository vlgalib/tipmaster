import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Copy, QrCode, AlertTriangle, Edit, LogOut } from 'lucide-react';
import { getStaff, searchUser } from '../services/api';
import AlertModal from '../components/AlertModal';
import { QRCodeCanvas } from 'qrcode.react';
import { useXmtp } from '../contexts/XmtpContext';
import SafeOnchainProvider from '../components/SafeOnchainProvider';
import SafeWalletComponents from '../components/SafeWalletComponents';
import { base } from 'viem/chains';
import type { LifecycleStatus } from '@coinbase/onchainkit/transaction';

// USDC contract address on Base mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const TipPageContent: React.FC = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  
  const [staff, setStaff] = useState<{ name: string; photoUrl: string } | null>(null);
  const [amount, setAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [copySuccessMessage, setCopySuccessMessage] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [customRecipient, setCustomRecipient] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [customRecipientPhoto, setCustomRecipientPhoto] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, title: string, message: string }>({ 
    show: false, 
    title: '', 
    message: '' 
  });
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<string>('');
  const [isWarmedUp, setIsWarmedUp] = useState(false);

  // Get XMTP functions, but with error handling
  let sendMessage: any = null;
  let connect: any = null;
  let isConnected = false;
  let warmupConversation: any = null;
  
  try {
    const xmtp = useXmtp();
    sendMessage = xmtp.sendMessage;
    connect = xmtp.connect;
    isConnected = xmtp.isConnected;
    warmupConversation = xmtp.warmupConversation;
  } catch (error) {
    console.warn('XMTP context not available:', error);
  }

  useEffect(() => {
    if (staffId) {
      getStaff(staffId).then(setStaff).catch(err => {
        console.error(err);
        navigate(`/staff-not-found?staffId=${encodeURIComponent(staffId)}`);
      });
    }
  }, [staffId, navigate]);
  
  useEffect(() => {
    if (copySuccessMessage) {
      const timer = setTimeout(() => setCopySuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccessMessage]);

  // Auto-warmup XMTP when wallet connects
  useEffect(() => {
    const warmupXmtp = async () => {
      if (isWalletConnected && staffId && warmupConversation && !isConnected) {
        try {
          console.log('[TipPage] 🔥 Starting automatic XMTP warmup...');
          // Add a small delay to ensure wallet is fully connected
          await new Promise(resolve => setTimeout(resolve, 2000));
          await warmupConversation(staffId);
          console.log('[TipPage] ✅ XMTP warmup completed');
          setIsWarmedUp(true);
        } catch (error) {
          console.warn('[TipPage] ❌ XMTP warmup failed:', error);
          // Retry once after a delay
          setTimeout(async () => {
            try {
              console.log('[TipPage] 🔄 Retrying XMTP warmup...');
              await warmupConversation(staffId);
              console.log('[TipPage] ✅ XMTP warmup retry successful');
              setIsWarmedUp(true);
            } catch (retryError) {
              console.warn('[TipPage] ❌ XMTP warmup retry failed:', retryError);
            }
          }, 5000);
        }
      }
    };

    warmupXmtp();
  }, [isWalletConnected, staffId, warmupConversation, isConnected]);

  // Monitor XMTP connection status and auto-enable when connected
  useEffect(() => {
    console.log('[TipPage] 🔍 XMTP Status Check:', {
      isConnected,
      isWarmedUp,
      warmupConversation: !!warmupConversation,
      isWalletConnected
    });
    
    // Remove automatic warmup state setting - user must manually warm up
  }, [isConnected, isWarmedUp, warmupConversation, isWalletConnected]);

  // Check wallet connection and get USDC balance
  const checkWalletAndBalance = async () => {
    try {
      if (!window.ethereum) {
        setIsWalletConnected(false);
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setIsWalletConnected(true);
        const userAddress = accounts[0];
        
        // ERC-20 balanceOf call
        const balanceOfData = '0x70a08231' + userAddress.slice(2).padStart(64, '0');
        
        const result = await window.ethereum.request({
          method: 'eth_call',
          params: [{
            to: USDC_ADDRESS,
            data: balanceOfData
          }, 'latest']
        });
        
        // Convert hex to decimal and adjust for 6 decimals (USDC)
        const balanceWei = parseInt(result, 16);
        const balance = (balanceWei / 1000000).toFixed(2); // USDC has 6 decimals
        setUsdcBalance(balance);
      } else {
        setIsWalletConnected(false);
        setUsdcBalance('0');
      }
    } catch (error) {
      console.error('Error checking wallet/balance:', error);
      setIsWalletConnected(false);
      setUsdcBalance('0');
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      console.log('[TipPage] Logging out...');
      
      // Disconnect wallet properly
      if (window.ethereum) {
        try {
          // For MetaMask and other injected wallets
          if (window.ethereum.disconnect) {
            await window.ethereum.disconnect();
          }
          
          // Clear wallet connection permissions
          if (window.ethereum.request) {
            try {
              await window.ethereum.request({
                method: 'wallet_revokePermissions',
                params: [{ eth_accounts: {} }]
              });
            } catch (revokeError) {
              console.warn('[TipPage] Could not revoke permissions:', revokeError);
            }
          }
        } catch (walletError) {
          console.warn('[TipPage] Wallet disconnect error:', walletError);
        }
        
        // Clear wallet-related storage
        localStorage.removeItem('walletconnect');
        localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
        localStorage.removeItem('wagmi.wallet');
        localStorage.removeItem('wagmi.connected');
        localStorage.removeItem('wagmi.cache');
        localStorage.removeItem('coinbaseWallet.addresses');
        
        // Clear IndexedDB wallet data
        try {
          const databases = await indexedDB.databases();
          databases.forEach(db => {
            if (db.name && (
              db.name.includes('wallet') || 
              db.name.includes('web3') || 
              db.name.includes('coinbase') ||
              db.name.includes('metamask') ||
              db.name.includes('walletconnect')
            )) {
              indexedDB.deleteDatabase(db.name);
              console.log(`[TipPage] Cleared ${db.name} database`);
            }
          });
        } catch (error) {
          console.warn('[TipPage] Could not clear IndexedDB:', error);
        }
      }
      
      // Update local state only
      setIsWalletConnected(false);
      setUsdcBalance('0');
      
      console.log('[TipPage] Logout completed successfully');
      
    } catch (error) {
      console.error('[TipPage] Error during logout:', error);
      // Still update state even if something fails
      setIsWalletConnected(false);
      setUsdcBalance('0');
    }
  };

  // Check and switch to Base network
  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const currentChainId = parseInt(chainId, 16);
          
          if (currentChainId !== 8453) { // Base mainnet chain ID
            setIsCorrectNetwork(false);
            // Automatically switch to Base network
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }], // 8453 in hex
              });
              setIsCorrectNetwork(true);
            } catch (switchError: any) {
              // If network isn't added, add it
              if (switchError.code === 4902) {
                try {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x2105',
                      chainName: 'Base',
                      nativeCurrency: {
                        name: 'Ether',
                        symbol: 'ETH',
                        decimals: 18,
                      },
                      rpcUrls: ['https://mainnet.base.org'],
                      blockExplorerUrls: ['https://basescan.org'],
                    }],
                  });
                  setIsCorrectNetwork(true);
                } catch (addError) {
                  console.error('Failed to add Base network:', addError);
                }
              }
            }
          } else {
            setIsCorrectNetwork(true);
          }
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
      
      // Check wallet connection status
      checkWalletAndBalance();
    };

    checkNetwork();

    if (window.ethereum) {
      const handleChainChanged = (chainId: string) => {
        const newChainId = parseInt(chainId, 16);
        setIsCorrectNetwork(newChainId === 8453);
        checkWalletAndBalance(); // Refresh balance when switching to Base
      };

      const handleAccountsChanged = () => {
        checkWalletAndBalance(); // Refresh balance when account changes
      };

      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Monitor wallet connection status periodically to catch OnchainKit connections
  useEffect(() => {
    const checkWalletStatus = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          const wasConnected = isWalletConnected;
          const isNowConnected = accounts.length > 0;
          
          if (!wasConnected && isNowConnected) {
            console.log('[TipPage] 🔗 Wallet connection detected, updating status...');
            await checkWalletAndBalance();
          } else if (wasConnected && !isNowConnected) {
            console.log('[TipPage] 🔌 Wallet disconnection detected');
            setIsWalletConnected(false);
            setUsdcBalance('0');
          }
        } catch (error) {
          console.warn('[TipPage] Error checking wallet status:', error);
        }
      }
    };

    // Check immediately
    checkWalletStatus();
    
    // Then check every 2 seconds to catch OnchainKit wallet connections
    const interval = setInterval(checkWalletStatus, 2000);
    
    return () => clearInterval(interval);
  }, [isWalletConnected]);

  const handleOnStatus = React.useCallback((status: LifecycleStatus) => {
    console.log('Transaction status:', status);
    
    const recipient = customRecipient || staffId;
    if (status.statusName === 'success' && recipient) {
      const tipAmount = customAmount ? parseFloat(customAmount) : amount;
      const { transactionReceipts } = status.statusData;
      const txHash = transactionReceipts?.[0]?.transactionHash;

      console.log(`Tip sent: ${tipAmount} USDC to ${recipient}, tx: ${txHash}`);

      // Send XMTP notification in background (non-blocking) - only if recipient is original staff
      if (txHash && !customRecipient && staffId) {
        const sendXmtpNotification = async () => {
          try {
            // Send notification only via frontend XMTP
            if (!isConnected && connect) {
              console.log('Connecting XMTP for notification...');
              await connect();
            }

            if (sendMessage && isConnected) {
              // Create structured tip notification (consistent with xmtpApi.ts)
              const tipNotification = {
                type: "tip-v1",
                amount: tipAmount,
                currency: "USDC",
                txHash: txHash,
                timestamp: new Date().toISOString(),
                message: message || `You received ${tipAmount} USDC tip!`,
                sender: "user", // Will be filled by XMTP context
                recipient: staffId,
                network: "base-mainnet"
              };
              
              console.log('Sending XMTP notification via frontend to:', staffId);
              await sendMessage(staffId, JSON.stringify(tipNotification));
              console.log('XMTP notification sent successfully via frontend');
            } else {
              console.log('XMTP not connected, skipping notification');
            }
          } catch (error) {
            console.error('Failed to send XMTP notification:', error);
            // Don't block the process due to XMTP errors
          }
        };

        sendXmtpNotification();
      }

      // Navigate to success page with transaction details
      navigate('/payment/success', {
        state: {
          txHash,
          amount: tipAmount,
          recipient: recipient, // Always use wallet address for the link
          recipientName: customRecipientName || staff?.name || 'Unknown', // Display name
          message: message || undefined,
          isCustomRecipient: !!customRecipient
        }
      });
    }
  }, [amount, customAmount, message, navigate, staff, staffId, customRecipient, customRecipientName, sendMessage, connect, isConnected]);

  const selectedAmount = customAmount ? parseFloat(customAmount) : amount;

  const createCalls = () => {
    const recipient = customRecipient || staffId;
    const amountInWei = BigInt(Math.round(selectedAmount * 1000000)); // USDC has 6 decimals
    
    return [{
      to: USDC_ADDRESS as `0x${string}`,
      data: `0xa9059cbb${recipient?.slice(2).padStart(64, '0')}${amountInWei.toString(16).padStart(64, '0')}` as `0x${string}`,
    }];
  };

  const copyAddress = () => {
    const addressToCopy = customRecipient || staffId || '';
    navigator.clipboard.writeText(addressToCopy);
    setCopySuccessMessage('Address copied to clipboard!');
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setAlertInfo({
          show: true,
          title: 'Wallet Not Found',
          message: 'Please install MetaMask or another Web3 wallet to continue.'
        });
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await checkWalletAndBalance();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setAlertInfo({
        show: true,
        title: 'Connection Failed',
        message: 'Failed to connect wallet. Please try again.'
      });
    }
  };

  const handleManualWarmup = async () => {
    if (!isWalletConnected) {
      setAlertInfo({
        show: true,
        title: 'Wallet Required',
        message: 'Please connect your wallet first to warm up XMTP.'
      });
      return;
    }

    if (!warmupConversation) {
      setAlertInfo({
        show: true,
        title: 'XMTP Not Available',
        message: 'XMTP service is not available. Please try again later.'
      });
      return;
    }

    const recipient = customRecipient || staffId;
    if (!recipient) {
      setAlertInfo({
        show: true,
        title: 'No Recipient',
        message: 'No recipient address available for warmup.'
      });
      return;
    }

    setIsWarmingUp(true);
    setWarmupStatus('Warming up XMTP connection...');

    try {
      console.log('[TipPage] 🔥 Starting manual XMTP warmup for:', recipient);
      
      const result = await warmupConversation(recipient);
      
      if (result?.success) {
        setWarmupStatus('✅ XMTP warmed up successfully! Next messages will be faster.');
        setIsWarmedUp(true);
        setTimeout(() => setWarmupStatus(''), 5000);
      } else {
        setWarmupStatus('⚠️ Warmup completed with warnings');
        setIsWarmedUp(true);
        setTimeout(() => setWarmupStatus(''), 5000);
      }
      
      console.log('[TipPage] ✅ Manual warmup completed:', result);
      
    } catch (error) {
      console.error('[TipPage] ❌ Manual warmup failed:', error);
      setWarmupStatus('❌ Warmup failed. You can still send messages.');
      setTimeout(() => setWarmupStatus(''), 5000);
      
      setAlertInfo({
        show: true,
        title: 'Warmup Failed',
        message: 'XMTP warmup failed, but you can still send messages. The first message might take longer.'
      });
    } finally {
      setIsWarmingUp(false);
    }
  };

  const handleRecipientEdit = async (value: string) => {
    setCustomRecipient(value);
    setSearchError('');
    
    if (value.trim() === '') {
      setCustomRecipientName('');
      setCustomRecipientPhoto('');
      return;
    }

    // Debounce search
    if (isSearching) return;
    
    setIsSearching(true);
    
    try {
      const result = await searchUser(value.trim());
      
      if (result.found) {
        setCustomRecipientName(result.user.name);
        setCustomRecipientPhoto(result.user.photoUrl);
        setSearchError('');
        
        // If searching by name, update the recipient address
        if (!value.startsWith('0x')) {
          setCustomRecipient(result.user.walletAddress);
        }
      } else {
        setCustomRecipientName('');
        setCustomRecipientPhoto('');
        setSearchError('User not found. Please enter a different name or wallet address.');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchError('Error searching for user. Please try again.');
      setCustomRecipientName('');
      setCustomRecipientPhoto('');
    } finally {
      setIsSearching(false);
    }
  };

  const resetToOriginalRecipient = () => {
    setCustomRecipient('');
    setCustomRecipientName('');
    setCustomRecipientPhoto('');
    setSearchError('');
    setIsEditingRecipient(false);
  };

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading staff information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AlertModal
        isOpen={alertInfo.show}
        onClose={() => setAlertInfo({ show: false, title: '', message: '' })}
        title={alertInfo.title}
        message={alertInfo.message}
      />

      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Home</span>
            </button>
            
            {/* Wallet Status and Logout */}
            {isWalletConnected ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg hover:bg-muted"
              >
                <LogOut size={16} />
                <span>Exit</span>
              </button>
            ) : (
              <SafeWalletComponents
                fallback={
                  <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
                    Loading...
                  </button>
                }
              >
                {({ ConnectWallet }) => (
                  <ConnectWallet>
                    <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                      Connect Wallet
                    </span>
                  </ConnectWallet>
                )}
              </SafeWalletComponents>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {/* Staff Profile Card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6 text-center">
          <div className="mb-4">
            <img 
              src={customRecipientPhoto || staff.photoUrl} 
              alt={customRecipientName || staff.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-border mx-auto mb-4"
            />
            <div className="flex items-center justify-center gap-2 mb-2">
              {!isEditingRecipient ? (
                                  <>
                    <h1 className="text-2xl font-bold text-foreground">{customRecipientName || staff.name}</h1>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIsEditingRecipient(true)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Edit recipient"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </>
              ) : (
                <div className="w-full max-w-xs">
                  <input
                    type="text"
                    value={customRecipient}
                    onChange={(e) => handleRecipientEdit(e.target.value)}
                    placeholder="Enter wallet address or name"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {isSearching && (
                    <div className="text-xs text-muted-foreground mt-1">Searching...</div>
                  )}
                  {searchError && (
                    <div className="text-xs text-red-500 mt-1">{searchError}</div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={resetToOriginalRecipient}
                      className="flex-1 text-xs py-1 px-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setIsEditingRecipient(false)}
                      className="flex-1 text-xs py-1 px-2 bg-primary text-primary-foreground rounded transition-colors"
                      disabled={searchError !== '' || isSearching}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {customRecipient ? 'Custom Recipient' : 'Service Professional'}
            </p>
          </div>
          
          {/* Recipient Address */}
          <div className="bg-muted rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                {(customRecipient || staffId)?.slice(0, 8)}...{(customRecipient || staffId)?.slice(-6)}
              </span>
              <button
                onClick={copyAddress}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy address"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          {/* QR Code Toggle */}
          <button
            onClick={() => setShowQR(!showQR)}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors text-sm"
          >
            <QrCode size={16} />
            {showQR ? 'Hide QR Code' : 'Show QR Code'}
          </button>

          {/* QR Code */}
          {showQR && (
            <div className="mt-4 p-4 bg-white rounded-lg inline-block">
              <QRCodeCanvas 
                value={`${window.location.origin}/tip/${staffId}`} 
                size={150} 
              />
            </div>
          )}
        </div>

        {/* Amount Selection */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Tip Amount</h2>
          
          {/* Preset Amounts */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[3, 5, 10, 15, 20, 25].map((presetAmount) => (
              <button
                key={presetAmount}
                onClick={() => {
                  setAmount(presetAmount);
                  setCustomAmount('');
                }}
                className={`py-3 px-4 rounded-lg border-2 transition-all font-semibold ${
                  amount === presetAmount && !customAmount
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary text-foreground hover:bg-primary/5'
                }`}
              >
                ${presetAmount}
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Custom Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter custom amount"
                className="w-full pl-8 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                min="0.01"
                max="10000"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={18} className="text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Optional Message</h3>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something nice... (optional)"
            className="w-full p-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            rows={3}
            maxLength={200}
          />
          <div className="text-xs text-muted-foreground mt-2 text-right">
            {message.length}/200
          </div>
        </div>

        {/* Network Warning */}
        {!isCorrectNetwork && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle size={20} />
              <div>
                <h4 className="font-semibold">Wrong Network</h4>
                <p className="text-sm mt-1">Please switch to Base network to send tips. Your wallet will be prompted to switch automatically.</p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Section */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Send Tip</h3>
          
          {/* USDC Balance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 text-sm font-medium">Your USDC Balance:</span>
              <span className="text-blue-900 font-semibold">${usdcBalance} USDC</span>
            </div>
          </div>
          
          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-semibold text-foreground">${selectedAmount.toFixed(2)} USDC</span>
            </div>
            {message && (
              <div className="mt-2 pt-2 border-t border-border">
                <span className="text-muted-foreground text-sm">Message:</span>
                <p className="text-foreground text-sm mt-1 italic">"{message}"</p>
              </div>
            )}
          </div>

          {/* XMTP Warmup Section */}
          {isWalletConnected && (
            <div className={`border rounded-lg p-3 mb-4 ${isWarmedUp ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isWarmedUp ? 'text-green-800' : 'text-orange-800'}`}>
                  {isWarmedUp ? '✅ XMTP Ready' : '⚠️ XMTP Warmup Required'}
                </span>
                <button
                  onClick={handleManualWarmup}
                  disabled={isWarmingUp || !warmupConversation}
                  className={`px-3 py-1 text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isWarmedUp 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isWarmingUp ? '🔥 Warming up...' : isWarmedUp ? '🔥 Warm up again' : '🔥 Warm up XMTP'}
                </button>
              </div>
              {warmupStatus && (
                <div className={`text-xs mt-1 ${isWarmedUp ? 'text-green-700' : 'text-orange-700'}`}>
                  {warmupStatus}
                </div>
              )}
              <div className={`text-xs mt-1 ${isWarmedUp ? 'text-green-600' : 'text-orange-600'}`}>
                {isWarmedUp 
                  ? 'XMTP is ready for fast message delivery. You can warm up again if needed.' 
                  : 'Please warm up XMTP before sending to ensure message delivery'
                }
              </div>
            </div>
          )}

          {/* Transaction Component */}
          {!isWalletConnected ? (
            <SafeWalletComponents
              fallback={
                <button 
                  onClick={connectWallet}
                  className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors"
                >
                  Connect Wallet
                </button>
              }
            >
              {({ ConnectWallet }) => (
                <div className="w-full">
                  <ConnectWallet>
                    <span className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors block text-center">
                      Connect Wallet
                    </span>
                  </ConnectWallet>
                </div>
              )}
            </SafeWalletComponents>
          ) : (
            <SafeWalletComponents
              fallback={
                <button 
                  className="w-full py-3 px-6 bg-muted text-muted-foreground font-semibold rounded-lg"
                  disabled
                >
                  Loading wallet components...
                </button>
              }
            >
              {({ Transaction, TransactionButton, TransactionStatus, TransactionStatusLabel, TransactionStatusAction }) => (
                <Transaction
                  calls={createCalls()}
                  onStatus={handleOnStatus}
                >
                  <TransactionButton 
                    className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    text={
                      !isCorrectNetwork 
                        ? 'Switch to Base Network' 
                        : parseFloat(usdcBalance) < selectedAmount
                        ? 'Insufficient USDC Balance'
                        : !isWarmedUp
                        ? 'Please warm up XMTP first'
                        : `Send $${selectedAmount.toFixed(2)} USDC Tip`
                    }
                    disabled={!isCorrectNetwork || parseFloat(usdcBalance) < selectedAmount || !isWarmedUp}
                  />
                  <TransactionStatus>
                    <TransactionStatusLabel />
                    <TransactionStatusAction />
                  </TransactionStatus>
                </Transaction>
              )}
            </SafeWalletComponents>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">
            🔒 Secure payments powered by Base blockchain. All transactions are verified and immutable.
          </p>
        </div>
      </div>

      {/* Copy Success Notification */}
      {copySuccessMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white font-semibold py-2 px-5 rounded-full shadow-lg animate-in fade-in zoom-in-95">
          {copySuccessMessage}
        </div>
      )}
    </div>
  );
};

// Main TipPage component wrapped in SafeOnchainProvider
const TipPage: React.FC = () => {
  return (
    <SafeOnchainProvider
      apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
      chain={base}
    >
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading wallet...</p>
          </div>
        </div>
      }>
        <TipPageContent />
      </Suspense>
    </SafeOnchainProvider>
  );
};

export default TipPage; 