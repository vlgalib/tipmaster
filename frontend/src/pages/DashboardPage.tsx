import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { QRCodeCanvas } from 'qrcode.react';
import { DollarSign, AlertTriangle, LogOut, Copy, TrendingUp, Eye, EyeOff, Edit, Save, X, MessageCircle, RefreshCw } from 'lucide-react';
import { getStaff, registerStaff } from '../services/api';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useXmtp } from '../contexts/XmtpContext';


interface XmtpMessage {
  id: string;
  content: string;
  senderAddress?: string;
  from?: string;
  sent: Date;
  senderPhoto?: string;
  transactionHash?: string;
  source?: string;
}

interface StaffData {
  name: string;
  photoUrl: string;
  walletAddress?: string;
  createdAt?: { seconds: number };
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use wagmi useAccount like AuthPage does
  const { address: currentWalletAddress, isConnected } = useAccount();
  
  const {
    connect: connectXmtp,
    disconnect: disconnectXmtp,
    isConnected: isXmtpConnected,
    isConnecting: isXmtpConnecting,
    isSmartWallet,
    getConversationHistory
  } = useXmtp();

  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [addressVisible, setAddressVisible] = useState(false);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [xmtpMessages, setXmtpMessages] = useState<XmtpMessage[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [copySuccessMessage, setCopySuccessMessage] = useState('');

  // Monitor wallet connection via wagmi
  useEffect(() => {
    console.log('[Dashboard] 🔍 Wallet check:', { 
      isConnected, 
      currentWalletAddress, 
      location: location.pathname,
      hasLocationState: !!location.state 
    });
    
    // Log wallet type for debugging
    if (window.ethereum?.isCoinbaseWallet) {
      console.log('[Dashboard] 🟦 Coinbase Wallet detected');
    } else if (window.ethereum?.isMetaMask) {
      console.log('[Dashboard] 🦊 MetaMask detected');
    } else if (window.ethereum) {
      console.log('[Dashboard] 🔗 Generic wallet detected');
    }

    if (!isConnected || !currentWalletAddress) {
      console.log('[Dashboard] ❌ No wallet connected, redirecting to auth');
      console.log('[Dashboard] 🔍 Redirect reason:', { 
        isConnected, 
        currentWalletAddress, 
        hasLocationState: !!location.state 
      });
      navigate('/auth');
      return;
    }

    console.log('[Dashboard] ✅ Wallet connected:', currentWalletAddress);
    // Get USDC balance
    getUsdcBalance(currentWalletAddress);
  }, [isConnected, currentWalletAddress, navigate, location]);

  // Get USDC balance
  const getUsdcBalance = async (address: string) => {
    try {
      console.log('[Dashboard] 💰 Fetching USDC balance for:', address);
      
      // Check if we're on Base network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);
      
      if (currentChainId !== 8453) {
        console.warn('[Dashboard] ⚠️ Not on Base network (chainId:', currentChainId, '), setting balance to 0');
        setUsdcBalance('0');
        return;
      }
      
      // USDC contract address on Base mainnet
      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      // ERC-20 balanceOf call
      const balanceOfData = '0x70a08231' + address.slice(2).padStart(64, '0');
      
      console.log('[Dashboard] 📞 Making eth_call with data:', balanceOfData);
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: USDC_ADDRESS,
          data: balanceOfData
        }, 'latest']
      });
      
      console.log('[Dashboard] 📋 Raw result from eth_call:', result);
      
      // Validate result
      if (!result || typeof result !== 'string' || !result.startsWith('0x')) {
        console.error('[Dashboard] ❌ Invalid result format:', result);
        setUsdcBalance('0');
        return;
      }
      
      // Convert hex to decimal and adjust for 6 decimals (USDC)
      const balanceWei = parseInt(result, 16);
      
      if (isNaN(balanceWei)) {
        console.error('[Dashboard] ❌ Failed to parse balance as number:', result);
        setUsdcBalance('0');
        return;
      }
      
      const balance = (balanceWei / 1000000).toFixed(2); // USDC has 6 decimals
      console.log('[Dashboard] ✅ USDC balance calculated:', balance);
      setUsdcBalance(balance);
    } catch (error) {
      console.error('[Dashboard] ❌ Error fetching USDC balance:', error);
      setUsdcBalance('0');
    }
  };

  // Check if user came from registration
  useEffect(() => {
    const state = location.state as { newStaffProfile?: StaffData };
    if (state?.newStaffProfile) {
      setStaffData(state.newStaffProfile);
      setEditName(state.newStaffProfile.name || '');
      console.log('✅ Loaded staff data from registration:', state.newStaffProfile);
    }
  }, [location.state]);

  // Load staff data if not from registration
  useEffect(() => {
    if (currentWalletAddress && !staffData) {
      setLoading(true);
      getStaff(currentWalletAddress)
        .then(staff => {
          setStaffData(staff);
          setEditName(staff?.name || '');
        })
        .catch(error => {
          console.error("Failed to fetch staff data", error);
          if (error.message.includes('not found')) navigate('/');
        })
        .finally(() => setLoading(false));
    } else if (staffData) {
      setLoading(false);
    }
  }, [currentWalletAddress, staffData, navigate]);

  // Auto-connect XMTP when wallet is connected (with retry limit)
  const [xmtpRetryCount, setXmtpRetryCount] = useState(0);
  const maxRetries = 2; // 2 auto-retries, then manual connection required
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Smart Wallets require longer timeout but should still try XMTP
    if (isSmartWallet) {
      console.log('[Dashboard] 🤖 Smart Wallet detected - using extended timeout for XMTP');
    }
    
    if (currentWalletAddress && !isXmtpConnected && !isXmtpConnecting && xmtpRetryCount < maxRetries) {
      console.log(`[Dashboard] Scheduling XMTP auto-connect for address: ${currentWalletAddress} (attempt ${xmtpRetryCount + 1}/${maxRetries})`);
      
      // Debounce the connection attempt to prevent rapid retries
      timeoutId = setTimeout(async () => {
        try {
          await connectXmtp();
          setXmtpRetryCount(0); // Reset retry count on success
        } catch (error) {
          console.warn(`⚠️ Failed to auto-connect XMTP (attempt ${xmtpRetryCount + 1}):`, error);
          setXmtpRetryCount(prev => prev + 1);
          
          if (xmtpRetryCount + 1 >= maxRetries) {
            console.error('❌ XMTP auto-connect failed after maximum retries. Manual connection required.');
          }
        }
      }, 5000); // Single 5 second delay
    } else if (xmtpRetryCount >= maxRetries) {
      console.log('[Dashboard] XMTP auto-connect disabled after maximum retries. Use manual connect button.');
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentWalletAddress, isXmtpConnected, isXmtpConnecting, connectXmtp, xmtpRetryCount]);

  // Load XMTP message history
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  
  const loadMessages = useCallback(async (showRefreshIndicator = false) => {
    if (!isXmtpConnected || !currentWalletAddress) return;
    
    if (showRefreshIndicator) setIsRefreshingMessages(true);
    
    let retryCount = 0;
    const maxRetries = 3;
    let isComponentMounted = true;
    
    const loadMessagesInternal = async () => {
      try {
        console.log(`[Dashboard] Loading XMTP messages (attempt ${retryCount + 1}/${maxRetries + 1})`);
        const messages = await getConversationHistory();
        
        if (isComponentMounted) {
          setXmtpMessages(messages);
          console.log(`📨 Loaded ${messages.length} XMTP messages`);
          retryCount = 0; // Reset retry count on success
        }
      } catch (error) {
        console.error(`[Dashboard] Failed to load XMTP messages (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < maxRetries && isComponentMounted) {
          retryCount++;
          console.log(`[Dashboard] Retrying in 5 seconds... (${retryCount}/${maxRetries})`);
          setTimeout(() => {
            if (isComponentMounted) {
              loadMessagesInternal();
            }
          }, 5000);
        } else {
          console.warn('[Dashboard] Max retries reached for XMTP message loading');
        }
      } finally {
        if (showRefreshIndicator) setIsRefreshingMessages(false);
      }
    };

    await loadMessagesInternal();
    
    return () => {
      isComponentMounted = false;
    };
  }, [isXmtpConnected, currentWalletAddress, getConversationHistory]);

  useEffect(() => {
    if (isXmtpConnected && currentWalletAddress) {
      // Initial load
      loadMessages();
      
      // Refresh messages every 60 seconds (reduced frequency)
      const interval = setInterval(() => {
        loadMessages();
      }, 60000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [isXmtpConnected, currentWalletAddress, loadMessages]);

  // Parse tip messages from XMTP content
  const tipMessages = React.useMemo(() => {
    console.log('[Dashboard] 🔍 Processing messages for filtering:', {
      totalMessages: xmtpMessages.length,
      sampleMessages: xmtpMessages.slice(0, 3).map(msg => ({
        id: msg.id,
        content: msg.content?.substring(0, 100),
        senderAddress: msg.senderAddress || msg.from,
        sent: msg.sent,
        source: msg.source || 'unknown'
      }))
    });

    // Log all messages for debugging
    xmtpMessages.forEach((msg, index) => {
      console.log(`[Dashboard] Message ${index + 1}:`, {
        id: msg.id,
        content: msg.content,
        contentType: typeof msg.content,
        contentLength: msg.content?.length,
        senderAddress: msg.senderAddress || msg.from,
        sent: msg.sent,
        source: msg.source
      });
    });

    const filtered = xmtpMessages.filter(msg => {
      if (!msg.content) {
        console.log('[Dashboard] ⚠️ Message without content:', msg);
        return false;
      }

      try {
        // Try to parse as JSON first
        const content = JSON.parse(msg.content);
        const isValidTip = content.type === 'tip-v1' || content.type === 'tip' || content.type === 'transaction';
        if (isValidTip) {
          console.log('[Dashboard] ✅ Found JSON tip message:', {
            type: content.type,
            amount: content.amount,
            currency: content.currency,
            txHash: content.txHash,
            message: content.message,
            timestamp: content.timestamp,
            senderAddress: msg.senderAddress || msg.from
          });
        }
        return isValidTip;
      } catch (e) {
        // Fallback to text-based filtering
        const hasKeywords = msg.content.includes('tip') || 
               msg.content.includes('USDC') || 
               msg.content.includes('received') ||
               msg.content.includes('Transaction:') ||
               msg.content.includes('$') ||
               msg.content.includes('💰') ||
               msg.content.includes('✅') ||
               msg.content.includes('tip') ||
               msg.content.includes('USD') ||
               msg.content.includes('amount') ||
               msg.content.includes('payment') ||
               msg.content.includes('sent') ||
               /\d+\.\d+/.test(msg.content); // Numbers with decimals
        
        if (hasKeywords) {
          console.log('[Dashboard] ✅ Found text-based tip message:', {
            content: msg.content.substring(0, 100),
            senderAddress: msg.senderAddress || msg.from,
            matchedKeywords: [
              msg.content.includes('tip') && 'tip',
              msg.content.includes('USDC') && 'USDC',
              msg.content.includes('$') && '$',
              /\d+\.\d+/.test(msg.content) && 'decimal_number'
            ].filter(Boolean)
          });
        }
        
        return hasKeywords;
      }
    });
    
    console.log('[Dashboard] 📊 Filtering results:', {
      totalMessages: xmtpMessages.length,
      filteredMessages: filtered.length,
      filteredIds: filtered.map(m => m.id)
    });
    
    return filtered.sort((a, b) => new Date(b.sent).getTime() - new Date(a.sent).getTime());
  }, [xmtpMessages]);

  // Enhanced tip amount extraction
  const extractTipAmountFromMessage = (message: XmtpMessage): number => {
    try {
      const content = JSON.parse(message.content);
      if (content.type === 'tip' && content.amount) {
        return parseFloat(content.amount);
      }
    } catch (e) {
      // Fallback to regex extraction
      const match = message.content.match(/\$(\d+(?:\.\d{1,2})?)/);
      if (match) return parseFloat(match[1]);
    }
    return 0;
  };

  // Format tip message for display
  const formatTipMessage = (msg: XmtpMessage): React.ReactNode => {
    try {
      // Try to parse as JSON first
      const content = JSON.parse(msg.content);
      
      if (content.type === 'tip-v1' || content.type === 'tip' || content.type === 'transaction') {
        const amount = content.amount || 0;
        const currency = content.currency || 'USDC';
        const txHash = content.txHash;
        const message = content.message || '';
        
        return (
          <div className="space-y-2">
            <div className="font-medium text-green-400">
              💰 You received {amount} {currency}
            </div>
            
            {message && (
              <div className="text-sm text-gray-600 mt-1">
                📝 Message: "{message}"
              </div>
            )}
            
            {txHash && (
              <div className="mt-2">
                <a 
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  🔗 View Transaction
                </a>
              </div>
            )}
          </div>
        );
      }
    } catch (e) {
      // Fallback to text processing for non-JSON messages
      console.log('[Dashboard] Processing as text message:', msg.content);
    }
    
    // Fallback formatting for text messages
    let message = msg.content;
    
    // Extract amount using regex
    const amountMatch = message.match(/(\d+\.?\d*)\s*(USDC|USD|\$)/i);
    const txHashMatch = message.match(/(0x[a-fA-F0-9]{64})/);
    
    return (
      <div className="space-y-2">
        {amountMatch && (
          <div className="font-medium text-green-400">
            💰 Received tip: {amountMatch[1]} USDC
          </div>
        )}
        
        <div className="text-sm text-gray-600 mt-1">
          {message}
        </div>
        
        {txHashMatch && (
          <div className="mt-2">
            <a 
              href={`https://basescan.org/tx/${txHashMatch[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              🔗 View Transaction
            </a>
          </div>
        )}
      </div>
    );
  };

  // Log tip messages count only when it changes
  const [lastTipCount, setLastTipCount] = useState(0);
  useEffect(() => {
    if (tipMessages.length !== lastTipCount) {
      setLastTipCount(tipMessages.length);
      if (tipMessages.length > 0) {
        console.log(`[Dashboard] Found ${tipMessages.length} tip messages out of ${xmtpMessages.length} total`);
      }
    }
  }, [tipMessages.length, xmtpMessages.length, lastTipCount]);

  // Calculate statistics from tip messages
  const stats = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalAmount = 0;
    let todayAmount = 0;
    let weekAmount = 0;
    let monthAmount = 0;

    tipMessages.forEach(msg => {
      let amount = 0;
      let messageDate = new Date(msg.sent); // fallback date
      
      try {
        // Try to parse as JSON first
        const content = JSON.parse(msg.content);
        if (content.type === 'tip-v1' || content.type === 'tip' || content.type === 'transaction') {
          amount = parseFloat(content.amount) || 0;
          
          // Use timestamp from message content if available
          if (content.timestamp) {
            messageDate = new Date(content.timestamp);
          }
        }
      } catch (e) {
        // Fallback to regex extraction for text messages
        const amountMatch = msg.content.match(/(\d+\.?\d*)\s*(USDC|USD|\$)/i);
        if (amountMatch) {
          amount = parseFloat(amountMatch[1]) || 0;
        }
        // Keep messageDate as msg.sent for non-JSON messages
      }

      if (amount > 0) {
        totalAmount += amount;

        // Check if message is from today
        if (messageDate >= today) {
          todayAmount += amount;
        }
        
        // Check if message is from this week
        if (messageDate >= thisWeek) {
          weekAmount += amount;
        }
        
        // Check if message is from this month
        if (messageDate >= thisMonth) {
          monthAmount += amount;
        }
      }
    });

    console.log('[Dashboard] 📊 Stats calculation:', {
      totalMessages: tipMessages.length,
      totalAmount,
      todayAmount,
      weekAmount,
      monthAmount,
      today: today.toISOString(),
      thisWeek: thisWeek.toISOString(),
      thisMonth: thisMonth.toISOString()
    });

    return {
      total: totalAmount,
      today: todayAmount,
      week: weekAmount,
      month: monthAmount,
      count: tipMessages.length
    };
  }, [tipMessages]);

  useEffect(() => {
    if (copySuccessMessage) {
      const timer = setTimeout(() => setCopySuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccessMessage]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditPhoto(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhotoToStorage = async (file: File, walletAddress: string): Promise<string> => {
    try {
      const storage = getStorage();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `staff-photos/${walletAddress}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Failed to upload photo. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    if (!currentWalletAddress || !editName.trim()) return;
    
    setIsUpdatingProfile(true);
    try {
      let photoUrl = staffData?.photoUrl || '';
      
      if (editPhoto) {
        photoUrl = await uploadPhotoToStorage(editPhoto, currentWalletAddress);
      }
      
      await registerStaff({
        walletAddress: currentWalletAddress,
        name: editName.trim(),
        photoUrl,
      });
      
      setStaffData({
        name: editName.trim(),
        photoUrl,
      });
      
      setIsEditingProfile(false);
      setEditPhoto(null);
      setEditPhotoPreview(null);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditName(staffData?.name || '');
    setEditPhoto(null);
    setEditPhotoPreview(null);
  };

  const handleLogout = async () => {
    try {
      console.log('[Dashboard] Logging out...');
      
      // Disconnect XMTP if connected
      if (disconnectXmtp) {
        try {
          disconnectXmtp();
          console.log('[Dashboard] XMTP disconnected');
        } catch (xmtpError) {
          console.warn('[Dashboard] XMTP disconnect error:', xmtpError);
        }
      }
      
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
              console.warn('[Dashboard] Could not revoke permissions:', revokeError);
            }
          }
        } catch (walletError) {
          console.warn('[Dashboard] Wallet disconnect error:', walletError);
        }
      }
      
      // Clear any cached wallet data
      if (typeof window !== 'undefined') {
        // Clear specific wallet-related items first
        localStorage.removeItem('walletconnect');
        localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
        localStorage.removeItem('wagmi.wallet');
        localStorage.removeItem('wagmi.connected');
        localStorage.removeItem('wagmi.cache');
        localStorage.removeItem('coinbaseWallet.addresses');
        
        // Then clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear IndexedDB wallet connections
        try {
          if ('indexedDB' in window) {
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
                console.log(`[Dashboard] Cleared ${db.name} database`);
              }
            });
          }
        } catch (dbError) {
          console.warn('[Dashboard] Error clearing IndexedDB:', dbError);
        }
      }
      
      // Clear local application state
      setStaffData(null);
      setUsdcBalance('0');
      setXmtpMessages([]);
      setIsEditingProfile(false);
      
      console.log('[Dashboard] Logout complete, navigating to home');
      
      // Navigate to home and force reload for clean state
      navigate('/', { replace: true });
      
      // Force page reload to ensure complete disconnection
      setTimeout(() => {
        window.location.reload();
      }, 100);
      
    } catch (error) {
      console.error('[Dashboard] Error during logout:', error);
      // Force navigation and reload even if something fails
      navigate('/', { replace: true });
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  const copyAddress = () => {
    if (!currentWalletAddress) return;
    navigator.clipboard.writeText(currentWalletAddress);
    setCopySuccessMessage('Wallet address copied to clipboard!');
  };

  const copyTipUrl = () => {
    if (!currentWalletAddress) return;
    const tipUrl = `${window.location.origin}/tip/${currentWalletAddress}`;
    navigator.clipboard.writeText(tipUrl);
    setCopySuccessMessage('Tip URL copied to clipboard!');
  };



  const downloadQRCode = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `tip-qr-${staffData?.name || 'code'}.png`;
      link.href = canvas.toDataURL();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!staffData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-destructive" size={48} />
          <h2 className="text-xl font-semibold text-foreground mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">Please register first to access the dashboard.</p>
          <button 
            onClick={() => navigate('/auth')}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              {/* Profile Section */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src={staffData.photoUrl} 
                    alt={staffData.name} 
                    className="w-12 h-12 rounded-full border-2 border-border object-cover"
                                      onError={(e) => {
                    // Create a simple colored avatar with initials instead of external API
                    const canvas = document.createElement('canvas');
                    canvas.width = 100;
                    canvas.height = 100;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      // Generate color from name
                      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
                      const colorIndex = staffData.name.charCodeAt(0) % colors.length;
                      ctx.fillStyle = colors[colorIndex];
                      ctx.fillRect(0, 0, 100, 100);
                      
                      // Add initials
                      ctx.fillStyle = 'white';
                      ctx.font = 'bold 40px Arial';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      const initials = staffData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      ctx.fillText(initials, 50, 50);
                    }
                    e.currentTarget.src = canvas.toDataURL();
                  }}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full border-2 border-card flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                      <Edit size={10} className="text-primary-foreground" />
                    </button>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {staffData.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">Welcome back!</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span className="text-sm font-medium text-foreground">
                    {addressVisible ? currentWalletAddress : `${currentWalletAddress?.slice(0, 6)}...${currentWalletAddress?.slice(-4)}`}
                  </span>
                  <button
                    onClick={() => setAddressVisible(!addressVisible)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {addressVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={copyAddress}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* XMTP Status and Connect Button */}
              <div className="flex items-center gap-2">
                {isSmartWallet && !isXmtpConnected && !isXmtpConnecting ? (
                  <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 rounded-lg" title="Smart Wallet detected - XMTP may take longer to connect">
                    <div className="w-2 h-2 bg-warning rounded-full"></div>
                    <span className="text-sm font-medium text-warning">Smart Wallet (Extended timeout)</span>
                    <MessageCircle size={14} className="text-warning" />
                  </div>
                ) : isXmtpConnected ? (
                  <div className="flex items-center gap-2 bg-success/10 px-3 py-2 rounded-lg">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-sm font-medium text-success">XMTP Connected</span>
                    <MessageCircle size={14} className="text-success" />
                  </div>
                ) : xmtpRetryCount >= maxRetries ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-error/10 px-3 py-2 rounded-lg">
                      <div className="w-2 h-2 bg-error rounded-full"></div>
                      <span className="text-sm font-medium text-error">XMTP Failed</span>
                    </div>
                    <button
                      onClick={() => {
                        setXmtpRetryCount(0);
                        connectXmtp().catch(console.error);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                      title="Retry XMTP connection"
                    >
                      <MessageCircle size={14} />
                      <span className="text-sm font-medium">Retry</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => connectXmtp().catch(console.error)}
                    disabled={isXmtpConnecting}
                    className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
                    title="Connect to XMTP to receive message notifications"
                  >
                    {isXmtpConnecting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Connecting...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle size={14} />
                        <span className="text-sm font-medium">Connect XMTP</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors"
                title="Exit Dashboard"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
          onClick={handleCancelEdit}
        >
          <div 
            className="bg-card rounded-xl border border-border p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Edit Profile</h2>
              <button
                onClick={handleCancelEdit}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Photo Upload */}
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <img 
                    src={editPhotoPreview || staffData.photoUrl} 
                    alt="Profile preview"
                    className="w-20 h-20 rounded-full border-4 border-border object-cover"
                  />
                </div>
                <input
                  type="file"
                  onChange={handlePhotoChange}
                  className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all"
                  accept="image/*"
                />
              </div>
              
              {/* Name Input */}
              <div>
                <label htmlFor="editName" className="block text-sm font-medium text-foreground mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  placeholder="Enter your name"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isUpdatingProfile || !editName.trim()}
                  className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdatingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats and QR */}
          <div className="lg:col-span-1 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* USDC Balance */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    Current balance
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">USDC Balance</p>
                <p className="text-2xl font-bold text-foreground">{usdcBalance} USDC</p>
              </div>

              {/* Today's Tips */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    Today
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Today's Tips</p>
                <p className="text-2xl font-bold text-foreground">${stats.today.toFixed(2)} USDC</p>
              </div>

              {/* This Week */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    This week
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">This Week</p>
                <p className="text-2xl font-bold text-foreground">${stats.week.toFixed(2)} USDC</p>
              </div>

              {/* This Month */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    This month
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">This Month</p>
                <p className="text-2xl font-bold text-foreground">${stats.month.toFixed(2)} USDC</p>
              </div>

              {/* Total Received */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    {stats.count} total tips
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total Received</p>
                <p className="text-2xl font-bold text-foreground">${stats.total.toFixed(2)} USDC</p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Your Tip QR Code</h2>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-2"
                >
                  {showQR ? (
                    <>
                      <EyeOff size={16} />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye size={16} />
                      Show
                    </>
                  )}
                </button>
              </div>

              {showQR && (
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-white rounded-xl">
                    <QRCodeCanvas 
                      value={`${window.location.origin}/tip/${currentWalletAddress}`} 
                      size={200} 
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Customers can scan this QR code to send you tips directly
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={copyTipUrl}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                      >
                        <Copy size={14} />
                        Copy Link
                      </button>
                      <button
                        onClick={downloadQRCode}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                      >
                        <Save size={14} />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>


          </div>
          
          {/* Right Column - Recent Messages & Tips */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">Recent Messages & Tips</h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {tipMessages.length} {tipMessages.length === 1 ? 'message' : 'messages'}
                  </div>
                  <button
                    onClick={() => loadMessages(true)}
                    disabled={isRefreshingMessages}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    title="Refresh messages"
                  >
                    <RefreshCw size={16} className={isRefreshingMessages ? 'animate-spin' : ''} />
                    {isRefreshingMessages ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {tipMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No messages yet</h3>
                    <p className="text-muted-foreground mb-6">
                      When someone sends you a tip, you'll see the notifications and messages here.
                      {isSmartWallet && (
                        <span className="block mt-2 text-sm text-warning">
                          Note: Smart Wallets may require longer time to connect to XMTP messaging.
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {tipMessages.map(message => {
                      const tipAmount = extractTipAmountFromMessage(message);
                      const formattedMessage = formatTipMessage(message);
                      
                      // Extract timestamp from message content
                      let displayDate = '';
                      try {
                        const content = JSON.parse(message.content);
                        if (content.timestamp) {
                          const date = new Date(content.timestamp);
                          displayDate = date.toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        }
                      } catch (e) {
                        // Fallback to message.sent if no timestamp in content
                        displayDate = new Date(message.sent).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      }
                      
                      return (
                        <li key={message.id} className="p-4 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted/70 transition-colors">
                          <div className="space-y-3">
                            {/* Header with amount and sender */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  From: {(message.senderAddress || message.from || 'Unknown').slice(0, 6)}...{(message.senderAddress || message.from || 'Unknown').slice(-4)}
                                </span>
                              </div>
                              {tipAmount > 0 && (
                                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-semibold border border-green-500/30">
                                  💰 ${tipAmount.toFixed(2)} USDC
                                </span>
                              )}
                            </div>
                            
                            {/* Message content */}
                            {formattedMessage && (
                              <div className="text-foreground text-sm">
                                {formattedMessage}
                              </div>
                            )}
                            
                            {/* Date at bottom */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/30">
                              <p className="text-xs text-muted-foreground">
                                {displayDate}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Copy Success Notification */}
      {copySuccessMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white font-semibold py-2 px-5 rounded-full shadow-lg animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
          {copySuccessMessage}
        </div>
      )}

    </div>
  );
};

export default DashboardPage; 