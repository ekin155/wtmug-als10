const API = 'https://jsonblob.com/api/jsonBlob';

export async function publishSDP(sdp) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ sdp, ts: Date.now() })
  });
  const loc = res.headers.get('Location') || res.headers.get('location');
  return loc.split('/').pop();
}

export async function fetchSDP(id) {
  const res = await fetch(`${API}/${id}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error('SDP bulunamadı (ID: ' + id + ')');
  const data = await res.json();
  return data.sdp;
}