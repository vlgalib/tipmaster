// No need for a full base URL when using rewrites. 
// Requests will be proxied to our functions by Firebase Hosting.
const API_BASE_URL = '/api';

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

export const sendTip = (data: { staffId: string; amount: number; message: string; senderAddress: string, txHash: string }) => {
  return fetchApi('sendTip', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getHistory = (staffId: string) => {
  return fetchApi(`getHistory?staffId=${staffId}`);
}; 