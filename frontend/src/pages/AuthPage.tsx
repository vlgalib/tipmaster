import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { User, ArrowLeft } from 'lucide-react';
import { registerStaff, getStaff } from '../services/api';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AlertModal from '../components/AlertModal';
import SafeWalletComponents from '../components/SafeWalletComponents';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [checkingExistingUser, setCheckingExistingUser] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  // Use wagmi useAccount like XmtpContext does
  const { address: currentWalletAddress, isConnected } = useAccount();

  // Check for existing user when wallet address changes
  useEffect(() => {
    const checkExistingUser = async (address: string) => {
      setCheckingExistingUser(true);
      console.log(`[Auth] 🔍 Starting user check for address: ${address}`);
      
      try {
        // Add timeout to prevent infinite loading
        const checkPromise = getStaff(address);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User check timeout')), 3000)
        );
        
        console.log(`[Auth] 📡 Making API call to check if user exists...`);
        const staff = await Promise.race([checkPromise, timeoutPromise]);
        
        if (staff && staff.walletAddress) {
          console.log('✅ [Auth] Existing user found:', staff);
          console.log('🚀 [Auth] Navigating to dashboard with state:', { newStaffProfile: staff });
          navigate('/dashboard', { state: { newStaffProfile: staff } });
          return;
        } else {
          console.log('ℹ️ [Auth] User exists but missing walletAddress, showing registration form');
        }
      } catch (error) {
        console.log('✅ [Auth] New user or API error, showing registration form:', error);
        
        // If API is down or user doesn't exist, show registration form
        // This ensures the form always appears for new users
      } finally {
        console.log(`[Auth] 🏁 User check completed, setting checkingExistingUser to false`);
        setCheckingExistingUser(false);
      }
    };

    if (currentWalletAddress && isConnected) {
      checkExistingUser(currentWalletAddress);
    }
  }, [currentWalletAddress, isConnected, navigate]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setAlertInfo({ show: true, message: 'Photo size must be less than 5MB. Please choose a smaller file.' });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setAlertInfo({ show: true, message: 'Please select a valid image file (JPG, PNG, etc.).' });
        return;
      }
      
      setPhoto(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
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
      
      console.log('Uploading file to:', fileName);
      const snapshot = await uploadBytes(storageRef, file);
      console.log('Upload successful, getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Failed to upload photo. Please check your internet connection and try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!name || name.trim().length < 2) {
      setAlertInfo({ show: true, message: 'Please enter a valid name (at least 2 characters).' });
      return;
    }
    
    if (!photo) {
      setAlertInfo({ show: true, message: 'Please select a profile photo.' });
      return;
    }
    
    if (!currentWalletAddress) {
      setAlertInfo({ show: true, message: 'Please connect your wallet first.' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('=== REGISTRATION PROCESS STARTED ===');
      console.log('User data:', { 
        name: name.trim(), 
        address: currentWalletAddress, 
        photoName: photo.name, 
        photoSize: photo.size,
        photoType: photo.type 
      });
      
      setUploadingPhoto(true);
      // Upload photo to Firebase Storage
      const photoUrl = await uploadPhotoToStorage(photo, currentWalletAddress);
      console.log('✅ Photo uploaded successfully:', photoUrl);
      setUploadingPhoto(false);

      // Register staff with all data
      const registrationData = {
        walletAddress: currentWalletAddress,
        name: name.trim(),
        photoUrl,
      };
      
      console.log('📤 Sending registration data to backend:', registrationData);
      
      const savedUser = await registerStaff(registrationData);
      console.log('✅ Registration API response:', savedUser);

      if (!savedUser || !savedUser.walletAddress) {
        throw new Error('Registration failed: No user data returned from server.');
      }
          
      console.log('✅ Registration completed successfully, navigating to dashboard');
      console.log('📦 Data being passed to dashboard:', { newStaffProfile: savedUser });
      
      navigate('/dashboard', { state: { newStaffProfile: savedUser } });
      
    } catch (error) {
      console.error("❌ Registration failed:", error);
      setUploadingPhoto(false);
      
      let errorMessage = "Registration failed. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // More specific error messages
      if (errorMessage.includes('photo') || errorMessage.includes('upload')) {
        errorMessage = "Failed to upload photo. Please check your internet connection and try again.";
      } else if (errorMessage.includes('wallet') || errorMessage.includes('address')) {
        errorMessage = "Wallet connection issue. Please disconnect and reconnect your wallet.";
      }
      
      setAlertInfo({ show: true, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingExistingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking your account...</p>
          <p className="text-xs text-muted-foreground mt-2">Address: {currentWalletAddress}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertModal 
        isOpen={alertInfo.show}
        onClose={() => setAlertInfo({ show: false, message: '' })}
        title="Registration Failed"
        message={alertInfo.message}
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <button 
                onClick={() => navigate('/')} 
                className="absolute left-4 top-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
              >
                <ArrowLeft size={20} />
                <span>Back to Home</span>
              </button>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Join TipMaster
            </h1>
            <p className="text-muted-foreground text-lg">
              Connect your wallet and create your profile to start receiving tips
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-card rounded-xl border border-border p-8 shadow-2xl">
            {/* Wallet Connection */}
            <div className="mb-8">
              {!currentWalletAddress ? (
                <div className="flex flex-col items-center space-y-4">
                  <SafeWalletComponents
                    fallback={
                      <button className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors">
                        Loading Wallet...
                      </button>
                    }
                  >
                    {({ Wallet, ConnectWallet, WalletDropdown, Identity, Avatar, Name, Address, WalletDropdownDisconnect }) => (
                      <Wallet>
                        <ConnectWallet className="w-full">
                          <div className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-center">
                            Connect Wallet
                          </div>
                        </ConnectWallet>
                        <WalletDropdown>
                          <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                            <Avatar />
                            <Name />
                            <Address />
                          </Identity>
                          <WalletDropdownDisconnect />
                        </WalletDropdown>
                      </Wallet>
                    )}
                  </SafeWalletComponents>
                  <p className="text-sm text-muted-foreground text-center">
                    Connect your wallet to continue with registration
                  </p>
                </div>
              ) : (
                <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                      <div>
                        <p className="text-sm font-medium text-success">Wallet Connected</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {currentWalletAddress?.slice(0, 6)}...{currentWalletAddress?.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <SafeWalletComponents
                      fallback={<div></div>}
                    >
                      {({ Wallet, WalletDropdown, WalletDropdownDisconnect, Identity, Avatar, Name, Address }) => (
                        <Wallet>
                          <WalletDropdown>
                            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                              <Avatar />
                              <Name />
                              <Address />
                            </Identity>
                            <WalletDropdownDisconnect />
                          </WalletDropdown>
                        </Wallet>
                      )}
                    </SafeWalletComponents>
                  </div>
                </div>
              )}
            </div>

            {currentWalletAddress && (
              <form onSubmit={handleRegister} className="space-y-6">
                {/* Profile Setup */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <User size={16} className="text-primary-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Create Your Profile</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value.trim())}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                        placeholder="Enter your display name"
                        required
                        minLength={2}
                        maxLength={50}
                      />
                      {name && name.length < 2 && (
                        <p className="text-xs text-red-500 mt-1">Name must be at least 2 characters</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="photo" className="block text-sm font-medium text-foreground mb-2">
                        Profile Photo *
                      </label>
                      
                      {/* Photo Preview */}
                      {photoPreview && (
                        <div className="mb-3 flex justify-center">
                          <div className="relative">
                            <img 
                              src={photoPreview} 
                              alt="Profile preview" 
                              className="w-20 h-20 rounded-full object-cover border-4 border-border"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPhoto(null);
                                setPhotoPreview(null);
                              }}
                              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              title="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="relative">
                        <input
                          type="file"
                          id="photo"
                          onChange={handlePhotoChange}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all"
                          accept="image/*"
                          required
                        />
                        {uploadingPhoto && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a clear photo (JPG, PNG, max 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!name || name.length < 2 || !photo || isLoading || uploadingPhoto}
                  className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      {uploadingPhoto ? 'Uploading Photo...' : 'Creating Profile...'}
                    </div>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              By continuing, you agree to our terms of service
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthPage; 