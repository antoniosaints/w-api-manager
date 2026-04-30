const API = '';

export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || 'Falha na requisicao');
  }
  return payload;
}

export { API };
