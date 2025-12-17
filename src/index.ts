import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'
import P from 'pino'
import { Boom } from '@hapi/boom'
import { setSocket, setQR } from './state'
import { startServer } from './server'

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

        if (qr) setQR(qr)

        if (connection === 'open') {
            setQR(null)
            console.log('✅ WhatsApp conectado')
        }

        if (connection === 'close') {
            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ Conexión cerrada', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada')
                process.exit(1)
            }

            startBot()
        }
    })

    startServer(Number(process.env.PORT) || 3001)
}

startBot()
