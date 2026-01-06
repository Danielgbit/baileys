// ==============================
// 📦 IMPORTS
// ==============================

// Baileys: core de WhatsApp
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'

// Logger (silenciado para Baileys, NO para console.log)
import P from 'pino'

// Manejo de errores de conexión
import { Boom } from '@hapi/boom'

// Estado global compartido
import { setSocket, setQR, setConnected } from './state'

// Servidor Express
import { startServer } from './server'

// ==============================
// 🔒 CONTROL DE SERVIDOR
// ==============================

// Evita levantar Express más de una vez
let serverStarted = false

console.log('🚀 [BOOT] Proceso Node iniciado')

// ==============================
// 🤖 FUNCIÓN PRINCIPAL DEL BOT
// ==============================

async function startBot() {
    console.log('🤖 [BOT] startBot() ejecutándose')

    /**
     * 🔐 Autenticación persistente
     */
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    console.log('🔐 [AUTH] Auth state cargado')

    /**
     * 📲 Crear socket de WhatsApp
     */
    console.log('📲 [SOCKET] Creando socket de WhatsApp')

    const socket = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    console.log('📲 [SOCKET] Socket creado')

    // Guardar socket globalmente
    setSocket(socket)
    console.log('📦 [STATE] Socket guardado en state')

    /**
     * 💾 Guardar credenciales cuando cambian
     */
    socket.ev.on('creds.update', () => {
        console.log('💾 [AUTH] Credenciales actualizadas')
        saveCreds()
    })

    /**
     * 🔌 Estado de conexión WhatsApp
     */
    socket.ev.on('connection.update', (update) => {
        console.log('🔌 [CONNECTION] Update:', update)

        const { connection, lastDisconnect, qr } = update

        if (qr) {
            setQR(qr)
            console.log('📱 [QR] QR recibido')
        }

        if (connection === 'open') {
            setQR(null)
            setConnected(true)
            console.log('✅ [CONNECTION] WhatsApp conectado')
        }

        if (connection === 'close') {
            setConnected(false)

            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ [CONNECTION] Conexión cerrada. Reason:', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 [LOGOUT] Sesión cerrada desde WhatsApp')
                setQR(null)
                return
            }

            console.log('🔁 [RECONNECT] Reintentando conexión en 2s...')
            setTimeout(startBot, 2000)
        }
    })

    /**
     * 📩 RECEPCIÓN DE MENSAJES ENTRANTES (DEBUG TOTAL)
     */
    console.log('🟢 [LISTENER] messages.upsert registrado')

    socket.ev.on('messages.upsert', async (data) => {
        console.log(
            '🟡 [RAW messages.upsert]',
            JSON.stringify(data, null, 2)
        )

        const { messages, type } = data
        if (type !== 'notify') return

        for (const msg of messages) {
            if (msg.key.fromMe) {
                console.log('↩️ [SKIP] Mensaje propio ignorado')
                continue
            }

            const remoteJid = msg.key.remoteJid
            console.log('📞 [JID] remoteJid:', remoteJid)

            if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue

            const phone = remoteJid.replace('@s.whatsapp.net', '')

            const message =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                null

            console.log('📝 [MESSAGE] Texto:', message)

            if (!message) continue

            console.log('📩 [INCOMING] Mensaje válido recibido', {
                phone,
                message
            })

            /**
             * 🚀 Enviar mensaje al webhook de n8n
             */
            try {
                console.log('🌐 [WEBHOOK] Enviando a n8n...')

                const response = await fetch(
                    'https://n8n.centrodeesteticalulu.site/webhook-test/31433296-1118-4b03-b1a9-d57a1ea0937e',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            phone,
                            message,
                            timestamp: new Date().toISOString(),
                            source: 'whatsapp'
                        })
                    }
                )

                console.log(
                    '✅ [WEBHOOK] Enviado a n8n. Status:',
                    response.status
                )
            } catch (error) {
                console.error(
                    '❌ [WEBHOOK ERROR] Error enviando a n8n',
                    error
                )
            }
        }
    })

    /**
     * 🚀 Levantar Express una sola vez
     */
    if (!serverStarted) {
        serverStarted = true
        console.log('🚀 [SERVER] Iniciando Express')
        startServer(Number(process.env.PORT) || 3001)
    }
}

// ==============================
// 🔥 ARRANQUE INICIAL
// ==============================

startBot().catch((err) => {
    console.error('🔥 [FATAL] Error al iniciar el bot', err)
})
