// Basitleştirilmiş: offer/answer SDP metinleri QR olarak taşınır.
// Gerçek dosya WebRTC DataChannel üzerinden P2P akar.

const CHUNK = 16 * 1024; // 16 KiB

export function createPeer() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  return pc;
}

// Gönderen taraf: dosyayı kanal üzerinden parçalara böler
export function sendFileOverChannel(channel, file, onProgress) {
  return new Promise((resolve, reject) => {
    channel.binaryType = 'arraybuffer';
    let offset = 0;
    const total = file.size;

    channel.onopen = async () => {
      channel.send(JSON.stringify({ type: 'meta', name: file.name, size: total }));
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Sıkışma kontrolü
          while (channel.bufferedAmount > 1_000_000) {
            await new Promise(r => setTimeout(r, 20));
          }
          channel.send(value);
          offset += value.byteLength;
          onProgress && onProgress(offset / total);
        }
        channel.send(JSON.stringify({ type: 'done' }));
        resolve();
      } catch (err) { reject(err); }
    };
    channel.onerror = reject;
  });
}

// Alıcı taraf: gelen parçaları toplar, bitince Blob indirir
export function receiveFileOverChannel(channel, onProgress) {
  let meta = null;
  const chunks = [];
  let received = 0;

  channel.binaryType = 'arraybuffer';
  channel.onmessage = (e) => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);
      if (msg.type === 'meta') { meta = msg; }
      if (msg.type === 'done') {
        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = meta ? meta.name : 'dosya';
        a.click();
      }
      return;
    }
    chunks.push(e.data);
    received += e.data.byteLength;
    if (meta) onProgress && onProgress(received / meta.size);
  };
}

// Offer oluştur (gönderen)
export async function createOfferWithChannel(pc) {
  const channel = pc.createDataChannel('file');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIce(pc);
  return { channel, sdp: pc.localDescription.sdp };
}

// Offer al, answer üret (alıcı)
export async function answerOffer(pc, offerSdp) {
  pc.ondatachannel = (e) => { pc._channel = e.channel; };
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIce(pc);
  return pc.localDescription.sdp;
}

// Answer al, bağlantıyı tamamla (gönderen)
export async function applyAnswer(pc, answerSdp) {
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
}

function waitForIce(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') res();
    };
    setTimeout(res, 3000); // güvenlik
  });
}