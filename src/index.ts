// src/index.ts
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from 'baileys'
import P from 'pino'
import { Boom } from '@hapi/boom'
import { setSocket } from './whatsapp'
import { startServer } from './server'

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined
    })

    setSocket(sock)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado')
        }

        if (connection === 'close') {
            const reason =
                lastDisconnect?.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : undefined

            console.log('❌ Conexión cerrada', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('🚫 Sesión cerrada, borra auth/')
                process.exit(1)
            }

            startBot()
        }
    })

    startServer(Number(process.env.PORT) || 3001)
}

startBot()
