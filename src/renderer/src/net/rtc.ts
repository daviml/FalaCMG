/*
 * RTCPeerConnection usada pelo Trystero (via rtcPolyfill). Ajusta o codec das transmissões de tela
 * no instante do addTrack, antes da negociação: depois disso a preferência só valeria na próxima oferta.
 */

// VP9 quando a GPU codifica por hardware; senão VP8 (leve e universal).
// H.264 fica de fora: o Electron anuncia suporte mas, sem encoder de hardware, a transmissão não chega.
let preferred = 'video/VP8'

async function detectHardwareCodec(): Promise<void> {
  for (const mime of ['video/VP9']) {
    try {
      const info = await navigator.mediaCapabilities.encodingInfo({
        type: 'webrtc',
        video: { contentType: mime, width: 1920, height: 1080, bitrate: 2_500_000, framerate: 30 }
      })
      if (info.supported && info.powerEfficient) {
        preferred = mime
        break
      }
    } catch {
      /* codec não suportado */
    }
  }
  console.info('[rtc] codec preferido para tela:', preferred)
}
detectHardwareCodec()

const rank = (mime: string) => (mime === preferred ? 0 : mime === 'video/VP8' ? 1 : 2)

/** Conexões ativas (inspeção/diagnóstico: window.__falacmgPcs) */
export const peerConnections = new Set<RTCPeerConnection>()
;(window as unknown as { __falacmgPcs: Set<RTCPeerConnection> }).__falacmgPcs = peerConnections

export class FalaPeerConnection extends RTCPeerConnection {
  constructor(config?: RTCConfiguration) {
    super(config)
    peerConnections.add(this)
    this.addEventListener('connectionstatechange', () => {
      if (this.connectionState === 'closed' || this.connectionState === 'failed') peerConnections.delete(this)
    })
  }

  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender {
    const sender = super.addTrack(track, ...streams)
    // Só a tela tem contentHint de vídeo
    if (track.kind === 'video' && track.contentHint) {
      const tr = this.getTransceivers().find((t) => t.sender === sender)
      const caps = RTCRtpSender.getCapabilities('video')?.codecs
      if (tr && caps) {
        try {
          tr.setCodecPreferences([...caps].sort((a, b) => rank(a.mimeType) - rank(b.mimeType)))
        } catch (e) {
          console.warn('[rtc] codec', e)
        }
      }
    }
    return sender
  }
}
