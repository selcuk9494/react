export const getApiUrl = () => {
  let apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    return apiUrl;
  }

  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();
