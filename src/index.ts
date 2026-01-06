// ==============================
// 📦 IMPORTS
// ==============================

// Baileys: core de WhatsApp
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'

// Logger (silenciado)
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

// ==============================
// 🤖 FUNCIÓN PRINCIPAL DEL BOT
// ==============================

async function startBot() {
    /**
     * 🔐 Autenticación persistente
     * Guarda credenciales en ./auth
     * Evita escanear QR cada vez
     */
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    /**
     * 📲 Crear socket de WhatsApp
     */
    const socket = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    // Guardar socket globalmente
    setSocket(socket)

    /**
     * 💾 Guardar credenciales cuando cambian
     */
    socket.ev.on('creds.update', saveCreds)

    /**
     * 🔌 Estado de conexión WhatsApp
     */
    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        // 📱 QR generado (esperando escaneo)
        if (qr) {
            setQR(qr)
            console.log('📱 QR recibido')
        }

        // ✅ Conectado correctamente
        if (connection === 'open') {
            setQR(null)
            setConnected(true)
            console.log('✅ WhatsApp conectado')
        }

        // ❌ Conexión cerrada
        if (connection === 'close') {
            setConnected(false)

            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ Conexión cerrada', reason)

            /**
             * 🚫 Logout real desde WhatsApp
             * Se debe escanear un nuevo QR
             */
            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada, esperando nuevo QR')
                setQR(null)
                return
            }

            /**
             * 🔁 Desconexión temporal
             * Reintento automático
             */
            console.log('🔁 Reintentando conexión...')
            setTimeout(startBot, 2000)
        }
    })

    /**
     * 📩 RECEPCIÓN DE MENSAJES ENTRANTES
     * Aquí se dispara cuando alguien escribe al WhatsApp
     */
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        for (const msg of messages) {
            // ❌ Ignorar mensajes enviados por el bot
            if (msg.key.fromMe) continue

            const remoteJid = msg.key.remoteJid
            if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue

            // 📞 Número del cliente
            const phone = remoteJid.replace('@s.whatsapp.net', '')

            // 📝 Texto del mensaje
            const message =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                null

            if (!message) continue

            console.log('📩 MENSAJE ENTRANTE')
            console.log({ phone, message })

            /**
             * 🚀 Enviar mensaje al webhook de n8n
             */
            try {
                await fetch(
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

                console.log('✅ Enviado a n8n')
            } catch (error) {
                console.error('❌ Error enviando a n8n', error)
            }
        }
    })

    /**
     * 🚀 Levantar Express una sola vez
     */
    if (!serverStarted) {
        serverStarted = true
        startServer(Number(process.env.PORT) || 3001)
    }
}

// ==============================
// 🔥 ARRANQUE INICIAL
// ==============================

startBot()
