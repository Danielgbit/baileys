import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    Browsers
} from 'baileys'

import P from 'pino'
import QRCode from 'qrcode'
import NodeCache from 'node-cache'
import { Boom } from '@hapi/boom'

/**
 * Cache de metadata de grupos
 */
const groupCache = new NodeCache({
    stdTTL: 5 * 60, // 5 minutos
    useClones: false
})

let sock: ReturnType<typeof makeWASocket> | null = null
let isRestarting = false

async function startBot() {
    /**
     * AUTH STATE
     * ⚠️ SOLO DESARROLLO
     */
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    /**
     * SOCKET CONFIG
     */
    sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),

        browser: Browsers.macOS('Desktop'),

        // ✅ reduce ruido y presencia
        markOnlineOnConnect: false,

        // ✅ recomendado para bots
        syncFullHistory: false,

        // ✅ cache de grupos
        cachedGroupMetadata: async (jid) => groupCache.get(jid),

        // ✅ requerido por Baileys
        getMessage: async () => undefined
    })

    /**
     * Guardar credenciales
     */
    sock.ev.on('creds.update', saveCreds)

    /**
     * Guardar metadata de grupos en cache
     */
    sock.ev.on('groups.update', (groups) => {
        for (const group of groups) {
            if (group.id) {
                groupCache.set(group.id, group)
            }
        }
    })

    /**
     * CONNECTION UPDATE
     */
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        // QR
        if (qr) {
            console.log(
                await QRCode.toString(qr, {
                    type: 'terminal',
                    small: true
                })
            )
        }

        // Conectado
        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp')
            isRestarting = false
        }

        // Desconectado
        if (connection === 'close') {
            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ Conexión cerrada:', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada, borra ./auth y vuelve a escanear')
                return
            }

            if (
                reason === DisconnectReason.restartRequired &&
                !isRestarting
            ) {
                isRestarting = true
                console.log('🔄 Reiniciando socket...')
                await sock?.end?.(new Error('Restarting'))
                startBot()
            }
        }
    })

    /**
     * MENSAJES ENTRANTES
     */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        const msg = messages[0]
        if (!msg?.message || msg.key.fromMe) return

        const jid = msg.key.remoteJid
        if (!jid) return

        // ❌ evitar grupos
        if (jid.endsWith('@g.us')) return

        // Texto robusto
        const text =
            msg.message.conversation ??
            msg.message.extendedTextMessage?.text ??
            msg.message.imageMessage?.caption ??
            msg.message.videoMessage?.caption

        if (!text) return

        console.log('📩', jid, text)

        // Respuesta simple
        await sock?.sendMessage(jid, { text: 'Hola 👋' })
    })
}

startBot()
