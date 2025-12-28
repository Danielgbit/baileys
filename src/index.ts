import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'
import P from 'pino'
import { Boom } from '@hapi/boom'
import { setSocket, setQR, setConnected } from './state'
import { startServer } from './server'

let serverStarted = false

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const socket = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    setSocket(socket)

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        // 📱 QR recibido
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

            // 🚫 Sesión cerrada desde WhatsApp (LOGOUT REAL)
            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada, esperando nuevo QR')
                setQR(null)
                return
            }

            // 🔁 Desconexión temporal → reintentar
            console.log('🔁 Reintentando conexión...')
            setTimeout(() => {
                startBot()
            }, 2000)
        }
    })

    // 🚀 Levantar Express UNA SOLA VEZ
    if (!serverStarted) {
        serverStarted = true
        startServer(Number(process.env.PORT) || 3001)
    }
}

// 🔥 Arranque inicial
startBot()
