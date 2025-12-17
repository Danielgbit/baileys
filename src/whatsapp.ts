// src/whatsapp.ts
import { sock } from './state'

export async function sendWhatsAppMessage(
    phone: string,
    message: string
) {
    if (!sock) {
        throw new Error('WhatsApp socket not ready')
    }

    const jid = `${phone}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: message })
}
