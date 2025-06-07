import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { User, MessageSquare, CheckCircle, LogOut, Wallet } from 'lucide-react';
import { registerStaff, getStaff } from '../services/api';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AlertModal from '../components/AlertModal';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isXmtpActive, setIsXmtpActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [checkingExistingUser, setCheckingExistingUser] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  // Check if user already exists when wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      setCheckingExistingUser(true);
      getStaff(address)
        .then(staff => {
          if (staff) {
            // User already exists, redirect to dashboard
            navigate('/dashboard');
          }
        })
        .catch(() => {
          // User doesn't exist, stay on auth page
          console.log('User not found, showing registration form');
        })
        .finally(() => {
          setCheckingExistingUser(false);
        });
    }
  }, [isConnected, address, navigate]);

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

  // Placeholder for XMTP activation
  const activateXmtp = useCallback(async () => {
    if (!address) return;
    console.log('Activating XMTP for', address);
    // In a real app, you would initialize the XMTP client here
    // const xmtp = await Client.create(signer);
    setIsXmtpActive(true);
    console.log('XMTP activated');
  }, [address]);

  // Automatically activate XMTP after wallet connection
  React.useEffect(() => {
    if (isConnected && !isXmtpActive && !checkingExistingUser) {
      activateXmtp();
    }
  }, [isConnected, isXmtpActive, activateXmtp, checkingExistingUser]);

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
    
    if (!address) {
      setAlertInfo({ show: true, message: 'Please connect your wallet first.' });
      return;
    }
    
    if (!isXmtpActive) {
      setAlertInfo({ show: true, message: 'Please wait for secure messaging to be set up.' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('=== REGISTRATION PROCESS STARTED ===');
      console.log('User data:', { 
        name: name.trim(), 
        address, 
        photoName: photo.name, 
        photoSize: photo.size,
        photoType: photo.type 
      });
      
      setUploadingPhoto(true);
      // Upload photo to Firebase Storage
      const photoUrl = await uploadPhotoToStorage(photo, address.toLowerCase());
      console.log('✅ Photo uploaded successfully:', photoUrl);
      setUploadingPhoto(false);

      // Register staff with all data
      const registrationData = {
        walletAddress: address.toLowerCase(),
        name: name.trim(),
        photoUrl,
      };
      
      console.log('📤 Sending registration data to backend:', registrationData);
      
      const result = await registerStaff(registrationData);
      console.log('✅ Registration API response:', result);

      // Verify the user was actually saved with robust retry logic
      console.log('🔍 Verifying user was saved...');
      const maxAttempts = 4;
      let verificationAttempts = 0;
      
      while (verificationAttempts < maxAttempts) {
        try {
          // Add a delay before the first attempt and between retries
          const delay = (verificationAttempts + 1) * 3000; // 3s, 6s, 9s, 12s
          console.log(`⏳ Waiting for ${delay / 1000}s before verification attempt ${verificationAttempts + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));

          const savedUser = await getStaff(address.toLowerCase());
          console.log(`✅ User verification successful (attempt ${verificationAttempts + 1}):`, savedUser);
          
          if (!savedUser || !savedUser.name || !savedUser.photoUrl) {
            throw new Error('User data was not saved correctly to the database.');
          }
          
          console.log('✅ Registration completed successfully, navigating to dashboard');
          navigate('/dashboard');
          return; // Exit the function successfully
          
        } catch (verificationError) {
          verificationAttempts++;
          console.error(`❌ User verification failed (attempt ${verificationAttempts}):`, verificationError);
          
          if (verificationAttempts >= maxAttempts) {
             throw new Error('Registration completed, but we could not verify your data immediately. Please refresh the page to log in.');
          }
        }
      }
      
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
      } else if (errorMessage.includes('name')) {
        errorMessage = "Invalid name. Please use only letters, numbers, and spaces.";
      } else if (errorMessage.includes('verification')) {
        errorMessage = "Registration may have completed but verification failed. Please try refreshing the page or logging in again.";
      }
      
      setAlertInfo({ show: true, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setName('');
    setPhoto(null);
    setPhotoPreview(null);
    setIsXmtpActive(false);
  };

  const handleConnectWallet = () => {
    // Get the first available connector (usually MetaMask or Coinbase Wallet)
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    } else {
      setAlertInfo({ 
        show: true, 
        message: 'No wallet found. Please install MetaMask or Coinbase Wallet.' 
      });
    }
  };

  if (checkingExistingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking your account...</p>
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
              {!isConnected ? (
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={handleConnectWallet}
                    className="w-full max-w-sm py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                  >
                    <Wallet size={20} />
                    Connect Wallet
                  </button>
                  <p className="text-sm text-muted-foreground text-center">
                    Connect your wallet to continue
                  </p>
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-success rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Wallet Connected</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="p-2 text-muted-foreground hover:text-error transition-colors rounded-md hover:bg-error/10"
                      title="Disconnect wallet"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isConnected && (
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
                        <p className="text-xs text-error mt-1">Name must be at least 2 characters</p>
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
                              className="absolute -top-1 -right-1 w-6 h-6 bg-error text-error-foreground rounded-full flex items-center justify-center text-xs hover:bg-error/90 transition-colors"
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

                {/* XMTP Setup */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isXmtpActive ? 'bg-success' : 'bg-muted'
                    }`}>
                      {isXmtpActive ? (
                        <CheckCircle size={16} className="text-success-foreground" />
                      ) : (
                        <MessageSquare size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Secure Messaging</h2>
                  </div>

                  <div className={`p-4 rounded-lg border transition-all ${
                    isXmtpActive 
                      ? 'bg-success/10 border-success text-success' 
                      : 'bg-muted border-border'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isXmtpActive ? (
                        <>
                          <CheckCircle size={16} />
                          <span className="font-medium">XMTP Messaging Ready</span>
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-muted-foreground">Setting up secure messaging...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!name || name.length < 2 || !photo || !isXmtpActive || isLoading || uploadingPhoto}
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