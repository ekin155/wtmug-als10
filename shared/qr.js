// QR üretmek ve okumak için CDN'den küçük kütüphaneler yükler.
// NOT: İlk yüklemede internet gerekir; Service Worker sonrası önbelleğe alınabilir.

export async function loadQRLib() {
  if (window.QRCode) return window.QRCode;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.QRCode;
}

export async function loadQRScanner() {
  if (window.jsQR) return window.jsQR;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.jsQR;
}

// Bir metni QR olarak bir DOM elemanına basar
export async function renderQR(container, text) {
  const QRCode = await loadQRLib();
  container.innerHTML = '';
  new QRCode(container, { text, width: 220, height: 220 });
}

// Kamerayı açar, QR okununca callback'e verir
export async function scanQR(videoEl, onResult) {
  const jsQR = await loadQRScanner();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  });
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', '');
  await videoEl.play();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let stopped = false;

  function tick() {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code && code.data) {
        stopped = true;
        stream.getTracks().forEach(t => t.stop());
        onResult(code.data);
        return;
      }
    }
    requestAnimationFrame(tick);
  }
  tick();

  return () => { stopped = true; stream.getTracks().forEach(t => t.stop()); };
}