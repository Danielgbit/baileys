//src/server.ts
import { currentQR, setQR, sock, isConnected } from './state'
import { SendWhatsAppMessagePayload } from './types'
import { sendWhatsAppMessage } from './whatsapp'
import express from 'express'

const app = express()
app.use(express.json())

// POST endpoint to send WhatsApp messages
app.post('/send', async (req, res) => {
    try {
        const body = req.body as SendWhatsAppMessagePayload

        if (!body.phone || !body.message) {
            return res.status(400).json({
                success: false,
                error: 'phone and message are required'
            })
        }

        if (!sock || !isConnected) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp not connected'
            })
        }

        await sendWhatsAppMessage(body.phone, body.message)

        return res.json({ success: true })
    } catch (err: any) {
        console.error('❌ SEND ERROR', err)

        return res.status(500).json({
            success: false,
            error: err.message ?? 'Failed to send message'
        })
    }
})



// GET endpoint to fetch current QR
app.get('/qr', (_req, res) => {
    // Ya conectado, no hay QR
    if (isConnected) {
        return res.json({
            connected: true,
            qr: null
        })
    }

    // No conectado y hay QR disponible
    if (currentQR) {
        return res.json({
            connected: false,
            qr: currentQR
        })
    }

    // No conectado y aún no hay QR
    return res.json({
        connected: false,
        qr: null
    })
})



// POST endpoint to logout WhatsApp session
app.post('/logout', async (_req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.json({ success: true })
        }

        await sock.logout()
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
        whatsappConnected: isConnected,
        waitingForQR: !!currentQR
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
