import { currentQR, sock, isConnected } from './state'
import { SendWhatsAppMessagePayload } from './types'
import { sendWhatsAppMessage } from './whatsapp'
import express from 'express'

const app = express()
app.use(express.json())

// ==============================
// 📤 SEND MESSAGE
// ==============================
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

// ==============================
// 📱 GET QR
// ==============================
app.get('/qr', (_req, res) => {
    if (isConnected) {
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

// ==============================
// 🔐 LOGOUT
// ==============================
app.post('/logout', async (_req, res) => {
    try {
        if (!sock) {
            return res.json({ success: true })
        }

        await sock.logout()

        return res.json({
            success: true,
            message: 'Session closed. New QR will be generated.'
        })
    } catch (err: any) {
        console.error('❌ LOGOUT ERROR', err)

        return res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

// ==============================
// ❤️ HEALTH
// ==============================
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        whatsappConnected: isConnected,
        waitingForQR: !isConnected && !!currentQR
    })
})


app.post('/reset', async (_req, res) => {
    try {
        if (!sock) {
            return res.json({
                success: true,
                message: 'No active WhatsApp session'
            })
        }

        await sock.logout()

        return res.json({
            success: true,
            message: 'Session reset. New QR will be generated.'
        })
    } catch (err: any) {
        console.error('❌ RESET ERROR', err)

        return res.status(500).json({
            success: false,
            error: err.message
        })
    }
})


// ==============================
// 🚀 START SERVER
// ==============================
export function startServer(port: number): void {
    app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`)
    })
}
