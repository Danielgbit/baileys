import { currentQR, setQR, sock } from './state'
import { SendWhatsAppMessagePayload } from './types'
import { sendWhatsAppMessage } from './whatsapp'
import express from 'express'

const app = express()
app.use(express.json())

// POST endpoint to send WhatsApp messages
app.post('/send', async (req, res) => {
    const body = req.body as SendWhatsAppMessagePayload

    if (!body.phone || !body.message) {
        return res.status(400).json({
            success: false,
            error: 'phone and message are required'
        })
    }

    await sendWhatsAppMessage(body.phone, body.message)

    return res.json({ success: true })
})


// GET endpoint to fetch current QR
app.get('/qr', (_req, res) => {
    if (!currentQR) {
        return res.json({
            connected: true,
            qr: null
        })
    }

    return res.json({
        connected: false,
        qr: currentQR
    })
})


// POST endpoint to logout WhatsApp session
app.post('/logout', async (_req, res) => {
    try {
        if (!sock) {
            return res.status(400).json({
                success: false,
                error: 'Socket not ready'
            })
        }

        await sock.logout()
        setQR(null)

        return res.json({ success: true })
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        whatsappConnected: !currentQR
    })
})



/**
 * Starts the Express server on the specified port
 * @param port - Port number to listen on
 */
export function startServer(port: number): void {
    app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`)
    })
}
