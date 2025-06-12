import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Search } from 'lucide-react';
import { searchUser } from '../services/api';

const SendTipPage: React.FC = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState<{ name: string; photoUrl: string; walletAddress: string } | null>(null);

  const validateAddress = (addr: string): boolean => {
    // Check if it's a valid Ethereum address (0x followed by 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    // Check if it's a basename (ends with .base.eth)
    const basenameRegex = /^[a-zA-Z0-9-]+\.base\.eth$/;
    
    return ethAddressRegex.test(addr) || basenameRegex.test(addr);
  };

  const handleAddressChange = async (value: string) => {
    setAddress(value);
    setSearchError('');
    setFoundUser(null);
    
    if (value.trim() === '') {
      return;
    }

    // If it's already a valid address, don't search
    if (validateAddress(value)) {
      return;
    }

    // Debounce search
    if (isSearching) return;
    
    setIsSearching(true);
    
    try {
      const result = await searchUser(value.trim());
      
      if (result.found) {
        setFoundUser(result.user);
        setSearchError('');
        
        // If searching by name, update the address
        if (!value.startsWith('0x')) {
          setAddress(result.user.walletAddress);
        }
      } else {
        setFoundUser(null);
        if (value.trim() && !validateAddress(value)) {
          setSearchError('User not found. Please enter a valid wallet address or try a different name.');
        }
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchError('Error searching for user. Please try again.');
      setFoundUser(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      alert('Please enter a wallet address or username');
      return;
    }

    setIsValidating(true);
    
    try {
      let finalAddress = address.trim();
      
      // If it's a basename, we would normally resolve it to an address
      // For now, we'll just check if it's valid format
      if (address.endsWith('.base.eth')) {
        // In a real app, you would resolve the basename to an address here
        // For demo purposes, we'll show an alert
        alert('Basename resolution not implemented yet. Please use a wallet address (0x...)');
        setIsValidating(false);
        return;
      }
      
      if (!validateAddress(finalAddress)) {
        alert('Please enter a valid wallet address (0x...) or username');
        setIsValidating(false);
        return;
      }
      
      // Navigate to the tip page with the address
      navigate(`/tip/${finalAddress.toLowerCase()}`);
    } catch (error) {
      console.error('Error validating address:', error);
      alert('Error validating address. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {/* Header Section */}
        <div className="text-center mb-8 mt-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Send a Tip</h1>
          <p className="text-muted-foreground text-lg">
            Enter the recipient's name, wallet address or basename to send them a tip
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="address" className="block text-lg font-semibold text-foreground mb-3">
                Recipient
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Name, 0x... or username.base.eth"
                  className="w-full pl-12 pr-4 py-4 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
                  required
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
              {/* Found User Display */}
              {foundUser && (
                <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img 
                      src={foundUser.photoUrl} 
                      alt={foundUser.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{foundUser.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {foundUser.walletAddress.slice(0, 8)}...{foundUser.walletAddress.slice(-6)}
                      </p>
                    </div>
                    <div className="text-success">✓</div>
                  </div>
                </div>
              )}
              
              {/* Error Display */}
              {searchError && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{searchError}</p>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mt-2">
                Enter a name, wallet address (0x...) or a basename (username.base.eth)
              </p>
            </div>

            <button
              type="submit"
              disabled={isValidating || !address.trim() || searchError !== '' || isSearching}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  Validating...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Continue to Tip
                </>
              )}
            </button>
          </form>
        </div>

        {/* Examples Section */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Examples</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Username</p>
                <p className="text-xs text-muted-foreground">alice, john, sarah</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Wallet Address</p>
                <p className="text-xs text-muted-foreground font-mono">0x742d35Cc6634C0532925a3b8D...</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Basename</p>
                <p className="text-xs text-muted-foreground">alice.base.eth</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Always double-check the recipient address before sending. 
            Transactions cannot be reversed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SendTipPage; 