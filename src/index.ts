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

// 🧠 Control de socket y reconexiones
let activeSocket: ReturnType<typeof makeWASocket> | null = null
let reconnecting = false
let restartTimeout: NodeJS.Timeout | null = null

console.log('🚀 [BOOT] Proceso Node iniciado')

async function startBot() {
    if (reconnecting) return
    reconnecting = true

    console.log('🤖 [BOT] Iniciando conexión WhatsApp...')

    // 🔥 cerrar socket anterior
    if (activeSocket) {
        try {
            activeSocket.ws.close()
        } catch {}
        activeSocket = null
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const socket = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    activeSocket = socket
    setSocket(socket)

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            setQR(qr)
            console.log('📱 QR generado')
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado')
            setConnected(true)
            setQR(null)
            reconnecting = false
        }

        if (connection === 'close') {
            setConnected(false)

            const statusCode =
                (lastDisconnect?.error as Boom)?.output?.statusCode

            console.log('❌ Conexión cerrada. Status:', statusCode)

            // 🔥 SOLO borrar auth si WhatsApp hizo logout real
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('🚫 WhatsApp cerró sesión, limpiando auth')

                try {
                    fs.rmSync('./auth', { recursive: true, force: true })
                } catch {}

                setQR(null)

                restartLater(3000)
                return
            }

            // 🌐 errores de red → NO tocar auth
            console.log('🌐 Error de red, reintentando luego...')
            restartLater(15000)
        }
    })

    if (!serverStarted) {
        serverStarted = true
        startServer(Number(process.env.PORT) || 3001)
    }
}

function restartLater(ms: number) {
    if (restartTimeout) return

    restartTimeout = setTimeout(() => {
        restartTimeout = null
        reconnecting = false
        startBot()
    }, ms)
}

// 🔥 BOOT
startBot().catch((err) => {
    console.error('🔥 FATAL', err)
})
