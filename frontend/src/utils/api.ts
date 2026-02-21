export const getApiUrl = () => {
  let apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    apiUrl = apiUrl.replace(/\/+$/, '');
    apiUrl = apiUrl.replace(/(\/api)+$/, '/api');
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    return apiUrl;
  }

  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8001/api`;
  }
  return 'http://localhost:8001/api';
};

export const API_URL = getApiUrl();
