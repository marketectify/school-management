export async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch('/api/' + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(localStorage.getItem('school-campus') ? { 'X-School-Id': localStorage.getItem('school-campus') } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the app is running and try again.');
  }
  if (response.status === 204) return null;
  let data;
  if (response.headers.get('content-type')?.includes('application/json')) {
    try { data = await response.json(); } catch { /* Handle invalid or empty responses below. */ }
  }
  if (!response.ok) {
    const message = data?.message || (response.status >= 500
      ? 'The API is unavailable. Check the backend terminal and MongoDB connection.'
      : 'Request failed (HTTP ' + response.status + ').');
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (data === undefined) throw new Error('The server returned an invalid response.');
  return data;
}
