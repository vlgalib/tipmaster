// Use different base URL for development vs production
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' // Development: use proxy
  : 'https://us-central1-tips-6545c.cloudfunctions.net'; // Production: direct to Firebase Functions

// A helper to handle fetch requests and errors
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    let errorMessage = 'API request failed';
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If response is not JSON, use status text
      if (response.status === 404) {
        errorMessage = 'Staff member not found.';
      } else {
        errorMessage = response.statusText || errorMessage;
      }
    }
    
    const error = new Error(errorMessage);
    console.error(`API Error [${response.status}]:`, errorMessage);
    throw error;
  }
  
  return response.json();
};

export const registerStaff = (data: { walletAddress: string; name: string; photoUrl: string; }) => {
  return fetchApi('registerStaff', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getStaff = (staffId: string) => {
  return fetchApi(`getStaff?staffId=${staffId}`);
};

export const sendTip = (data: { recipientAddress: string; amount: number; message?: string }) => {
  return fetchApi('sendTip', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const searchUser = async (query: string) => {
  console.log('[API] Searching for user:', query);
  console.log('[API] Using base URL:', API_BASE_URL);
  
  try {
    const result = await fetchApi(`searchUser?query=${encodeURIComponent(query)}`);
    console.log('[API] Search result:', result);
    return result;
  } catch (error) {
    console.error('[API] Search error:', error);
    throw error;
  }
}; 