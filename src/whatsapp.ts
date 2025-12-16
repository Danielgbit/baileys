// src/whatsapp.ts
import makeWASocket from 'baileys'

let sock: ReturnType<typeof makeWASocket> | null = null

export function setSocket(s: ReturnType<typeof makeWASocket>) {
    sock = s
}

export async function sendWhatsAppMessage(
    phone: string,
    text: string
) {
    if (!sock) {
        throw new Error('WhatsApp socket not ready')
    }

    const jid = `${phone}@s.whatsapp.net`

    await sock.sendMessage(jid, {
        text
    })
}
