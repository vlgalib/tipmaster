import React, { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { DollarSign, Users, AlertTriangle, LogOut, Copy, Download, TrendingUp, Eye, EyeOff, Edit, Save, X } from 'lucide-react';
import { getHistory, getStaff, registerStaff } from '../services/api';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface TipData {
  id: string;
  senderAddress: string;
  amount: number;
  message: string;
  createdAt: { seconds: number };
  txHash: string;
}

interface StatsData {
  name: string;
  value: string;
  icon: any;
  change: string;
  trend: 'up' | 'down';
}

interface StaffData {
  name: string;
  photoUrl: string;
}

const DashboardPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<TipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [addressVisible, setAddressVisible] = useState(false);
  const [stats, setStats] = useState<StatsData[]>([]);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const calculateStats = (tips: TipData[]): StatsData[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate today's tips
    const todayTips = tips.filter(tip => {
      const tipDate = new Date(tip.createdAt.seconds * 1000);
      return tipDate >= today;
    });
    const todayTotal = todayTips.reduce((sum, tip) => sum + tip.amount, 0);
    
    // Calculate this week's tips
    const weekTips = tips.filter(tip => {
      const tipDate = new Date(tip.createdAt.seconds * 1000);
      return tipDate >= weekAgo;
    });
    const weekTotal = weekTips.reduce((sum, tip) => sum + tip.amount, 0);
    
    // Calculate total tips
    const totalAmount = tips.reduce((sum, tip) => sum + tip.amount, 0);
    
    // Calculate unique customers
    const uniqueCustomers = new Set(tips.map(tip => tip.senderAddress)).size;
    
    return [
      { 
        name: "Today's Tips", 
        value: `$${todayTotal.toFixed(2)}`, 
        icon: DollarSign, 
        change: todayTips.length > 0 ? `+${todayTips.length}` : '0', 
        trend: 'up' as const
      },
      { 
        name: 'This Week', 
        value: `$${weekTotal.toFixed(2)}`, 
        icon: TrendingUp, 
        change: weekTips.length > 0 ? `+${weekTips.length}` : '0', 
        trend: 'up' as const
      },
      { 
        name: 'Total Tips', 
        value: `$${totalAmount.toFixed(2)}`, 
        icon: DollarSign, 
        change: tips.length > 0 ? `${tips.length} tips` : '0', 
        trend: 'up' as const
      },
      { 
        name: 'Total Customers', 
        value: uniqueCustomers.toString(), 
        icon: Users, 
        change: uniqueCustomers > 0 ? `${uniqueCustomers} unique` : '0', 
        trend: 'up' as const
      },
    ];
  };

  useEffect(() => {
    if (isConnected && address) {
      setLoading(true);
      
      const lowerCaseAddress = address.toLowerCase();

      getStaff(lowerCaseAddress)
        .then(staff => {
          setStaffData(staff);
          setEditName(staff?.name || '');
          
          return getHistory(lowerCaseAddress);
        })
        .then(history => {
          setFeed(history);
          setStats(calculateStats(history));
          setLoading(false);
        })
        .catch(error => {
          console.error("Failed to fetch staff data", error);
          setLoading(false);
          
          // If user not found (404), redirect to registration
          if (error.message && error.message.includes('Staff member not found')) {
            console.log('User not registered, redirecting to auth page');
            navigate('/');
          } else {
            // For other errors, show empty data but don't redirect
            setFeed([]);
            setStats(calculateStats([]));
            setStaffData(null);
          }
        });
    } else if (!isConnected && !loading) {
        navigate('/');
    }
  }, [isConnected, address, navigate]);

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
    if (!address || !editName.trim()) return;
    
    setIsUpdatingProfile(true);
    try {
      let photoUrl = staffData?.photoUrl || '';
      const lowerCaseAddress = address.toLowerCase();
      
      if (editPhoto) {
        photoUrl = await uploadPhotoToStorage(editPhoto, lowerCaseAddress);
      }
      
      await registerStaff({
        walletAddress: lowerCaseAddress,
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

  const handleLogout = () => {
    disconnect();
    navigate('/');
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      alert('Address copied to clipboard!');
    }
  };

  const copyTipUrl = () => {
    if (address) {
      const tipUrl = `${window.location.origin}/tip/${address.toLowerCase()}`;
      navigator.clipboard.writeText(tipUrl);
      alert('Tipping URL copied to clipboard!');
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Authentication Required</h1>
          <p className="text-muted-foreground mb-8">
            Please connect your wallet to access your dashboard and start receiving tips.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200"
          >
            Connect Wallet
          </Link>
        </div>
      </div>
    );
  }

  const tipUrl = `${window.location.origin}/tip/${address}`;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
                    src={staffData?.photoUrl || `https://i.pravatar.cc/150?u=${address}`} 
                    alt={staffData?.name || 'Profile'} 
                    className="w-12 h-12 rounded-full border-2 border-border object-cover"
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
                    {staffData?.name || 'Unknown User'}
                  </h1>
                  <p className="text-sm text-muted-foreground">Welcome back!</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-sm font-medium text-foreground">
                  {addressVisible ? address : `${address.slice(0, 6)}...${address.slice(-4)}`}
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
              <button
                onClick={handleLogout}
                className="p-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
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
                    src={editPhotoPreview || staffData?.photoUrl || `https://i.pravatar.cc/150?u=${address}`} 
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
              {stats.map((stat) => (
                <div key={stat.name} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <stat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      stat.trend === 'up' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-error/10 text-error'
                    }`}>
                      {stat.change}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.name}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* QR Code Section */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Your Tip QR Code</h2>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  {showQR ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showQR && (
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-white rounded-xl">
                    <QRCodeCanvas value={tipUrl} size={200} />
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
                      <button className="flex items-center justify-center gap-2 py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">
                        <Download size={14} />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Activity Feed */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
                <div className="text-sm text-muted-foreground">
                  {feed.length} {feed.length === 1 ? 'transaction' : 'transactions'}
                </div>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {feed.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No tips yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Share your QR code or tip link to start receiving tips from customers.
                    </p>
                    <button
                      onClick={() => setShowQR(true)}
                      className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                    >
                      Show QR Code
                    </button>
                  </div>
                ) : (
                  feed.map((item, index) => (
                    <div key={item.id || index} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                      <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-success" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-foreground">
                            Tip received
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 font-mono">
                          From: {item.senderAddress.slice(0, 6)}...{item.senderAddress.slice(-4)}
                        </p>
                        {item.message && (
                          <p className="text-sm text-foreground mb-3 bg-background px-3 py-2 rounded-md">
                            "{item.message}"
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-success">
                              +${item.amount} USDC
                            </span>
                          </div>
                          <a
                            href={`https://basescan.org/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:text-primary/80 font-mono transition-colors"
                          >
                            {item.txHash.slice(0, 10)}...
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage; 