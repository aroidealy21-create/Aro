const BASE = '/api';

async function handle(res) {
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (e) {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get(path) {
    return fetch(`${BASE}${path}`).then(handle);
  },
  post(path, body) {
    return fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(handle);
  },
  put(path, body) {
    return fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(handle);
  },
  delete(path) {
    return fetch(`${BASE}${path}`, { method: 'DELETE' }).then(handle);
  },
  postForm(path, formData) {
    return fetch(`${BASE}${path}`, { method: 'POST', body: formData }).then(handle);
  },
  putForm(path, formData) {
    return fetch(`${BASE}${path}`, { method: 'PUT', body: formData }).then(handle);
  }
};

export function photoUrl(filename) {
  if (!filename) return null;
  return `/photos/${filename}`;
}

export function formatMoney(value, currency) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency || 'Ar'}`;
}
