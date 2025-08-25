// apps/mobile/lib/api/modules/_fetch.js
import api from "../client";

/**
 * Drop-in replacement for the old fetch wrapper that uses the Axios client.
 * It inherits the baseURL + auth header + retries from api/client.js
 */
export async function jsonFetch(
  url,
  { method = "GET", body, token, params, headers = {}, timeout = 20000 } = {}
) {
  const cfg = {
    url,
    method,
    data: body,
    params,
    timeout,
    headers: { ...headers },
  };
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  try {
    console.log('🚀 jsonFetch making request:', { url, method, hasToken: !!token });
    
    const response = await api.request(cfg);
    
    console.log('📨 Response received:', { 
      status: response.status, 
      statusText: response.statusText,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : 'none'
    });

    // Check if response is successful (200-299 status codes)
    if (response.status >= 200 && response.status < 300) {
      return response.data;
    } else {
      // Handle non-2xx status codes as errors
      const errorMsg = response.data?.error || 
                      response.data?.message || 
                      `Request failed with status ${response.status}`;
      console.error('❌ Non-2xx status code:', response.status, errorMsg);
      throw new Error(errorMsg);
    }
    
  } catch (err) {
    console.error('💥 jsonFetch error caught:', {
      message: err.message,
      name: err.name,
      isAxiosError: err.isAxiosError,
      status: err.response?.status,
      statusText: err.response?.statusText,
      responseData: err.response?.data
    });

    // Handle Axios errors properly
    if (err.isAxiosError) {
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        const errorData = err.response.data;
        
        let errorMessage;
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `Request failed with status ${status}`;
        }
        
        console.error(`❌ Server error [${status}]:`, errorMessage);
        
        // ✅ Handle auth errors properly - only clear token on 401, not 403
        if (status === 401) {
          // 401 = Invalid/expired token - trigger sign out
          console.warn('🚨 401 Unauthorized - token invalid, should sign out');
          const error = new Error('UNAUTHORIZED');
          error.status = 401;
          error.response = err.response;
          throw error;
        } else if (status === 403) {
          // 403 = Valid token but insufficient permissions - keep token
          console.warn('🚫 403 Forbidden - insufficient permissions');
          const error = new Error('FORBIDDEN');
          error.status = 403;
          error.response = err.response;
          throw error;
        }
        
        const error = new Error(`${status}: ${errorMessage}`);
        error.status = status;
        error.response = err.response;
        throw error;
        
      } else if (err.request) {
        // Request made but no response received
        console.error('❌ Network error - no response received');
        const error = new Error('Network error: No response received from server');
        error.isNetworkError = true;
        throw error;
        
      } else {
        // Something else happened in setting up the request
        console.error('❌ Request setup error:', err.message);
        throw new Error(`Request setup error: ${err.message}`);
      }
    } else {
      // Non-Axios error, re-throw as-is
      console.error('❌ Non-Axios error:', err.message);
      throw err;
    }
  }
}

/**
 * Form data fetch for file uploads - also uses Axios client
 * @param {string} path - API endpoint path
 * @param {FormData} formData - Form data with files
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function formDataFetch(path, formData, token) {
  const cfg = {
    url: path,
    method: "POST",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000, // Longer timeout for file uploads
  };
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  try {
    console.log('📤 formDataFetch making request:', { url: path, hasToken: !!token });
    
    const response = await api.request(cfg);
    
    console.log('📨 Upload response received:', { 
      status: response.status, 
      statusText: response.statusText,
      hasData: !!response.data
    });

    // Check if response is successful (200-299 status codes)
    if (response.status >= 200 && response.status < 300) {
      return response.data;
    } else {
      const errorMsg = response.data?.error || 
                      response.data?.message || 
                      `Upload failed with status ${response.status}`;
      console.error('❌ Upload non-2xx status:', response.status, errorMsg);
      throw new Error(errorMsg);
    }
    
  } catch (err) {
    console.error('💥 formDataFetch error:', err.message);

    // Handle Axios errors properly
    if (err.isAxiosError) {
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data;
        
        let errorMessage;
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `Upload failed with status ${status}`;
        }
        
        // ✅ Handle auth errors for uploads too
        if (status === 401) {
          const error = new Error('UNAUTHORIZED');
          error.status = 401;
          error.response = err.response;
          throw error;
        } else if (status === 403) {
          const error = new Error('FORBIDDEN');
          error.status = 403;
          error.response = err.response;
          throw error;
        }
        
        const error = new Error(`${status}: ${errorMessage}`);
        error.status = status;
        error.response = err.response;
        throw error;
        
      } else if (err.request) {
        throw new Error('Network error: Upload failed - no response received');
      } else {
        throw new Error(`Upload setup error: ${err.message}`);
      }
    } else {
      throw err;
    }
  }
}