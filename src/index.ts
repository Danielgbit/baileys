import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'

import P from 'pino'
import { Boom } from '@hapi/boom'
import fs from 'fs'

import { setSocket, setQR, setConnected } from './state'
import { startServer } from './server'

let serverStarted = false

console.log('🚀 [BOOT] Proceso Node iniciado')

async function startBot() {
    console.log('🤖 [BOT] startBot() ejecutándose')

    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    console.log('🔐 [AUTH] Auth state cargado')

    const socket = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    setSocket(socket)
    console.log('📦 [STATE] Socket guardado')

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        console.log('🔌 [CONNECTION]', update)

        if (qr) {
            setQR(qr)
            console.log('📱 [QR] Nuevo QR generado')
        }

        if (connection === 'open') {
            setConnected(true)
            setQR(null)
            console.log('✅ WhatsApp conectado')
        }

        if (connection === 'close') {
            setConnected(false)

            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ Conexión cerrada. Reason:', reason)

            // LOGOUT real → limpiar auth y generar nuevo QR
            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada, limpiando auth...')

                setQR(null)
                setSocket(null as any)

                try {
                    fs.rmSync('./auth', { recursive: true, force: true })
                    console.log('🧨 Auth eliminada')
                } catch (e) {
                    console.log('⚠️ No se pudo borrar auth')
                }

                setTimeout(startBot, 1000)
                return
            }

            // reconexión normal
            console.log('🔁 Reintentando conexión...')
            setTimeout(startBot, 2000)
        }
    })

    // Levantar Express solo una vez
    if (!serverStarted) {
        serverStarted = true
        startServer(Number(process.env.PORT) || 3001)
    }
}

// 🔥 BOOT
startBot().catch((err) => {
    console.error('🔥 FATAL', err)
})
