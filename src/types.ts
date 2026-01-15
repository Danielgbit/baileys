// src/types.ts
/**
 * Payload para enviar mensajes de WhatsApp
 * Usado por:
 * - POST /send
 * - n8n
 * - Next.js
 */
export interface SendWhatsAppMessagePayload {
    phone: string
    message: string
}

/**
 * Respuesta estándar de la API
 */
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/**
 * Tipos de mensajes soportados (extensible)
 */
export type WhatsAppMessageType = 'text' | 'image' | 'document'

/**
 * Payload extendido (futuro)
 */
export interface SendWhatsAppExtendedPayload
    extends SendWhatsAppMessagePayload {
    type?: WhatsAppMessageType
    mediaUrl?: string
    filename?: string
}
