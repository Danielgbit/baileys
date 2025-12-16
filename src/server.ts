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

/**
 * Starts the Express server on the specified port
 * @param port - Port number to listen on
 */
export function startServer(port: number): void {
    app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`)
    })
}
