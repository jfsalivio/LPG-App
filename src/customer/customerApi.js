const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
export const CUSTOMER_TOKEN_KEY = 'gastrack.customer.token';

export async function customerRequest(path, body, token) {
  const response = await fetch(`${base}/customer-auth${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Unable to connect to your customer account.');
    error.status = response.status;
    throw error;
  }
  return data;
}
