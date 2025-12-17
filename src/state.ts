// src/state.ts
import type makeWASocket from 'baileys'

export let sock: ReturnType<typeof makeWASocket> | null = null
export let currentQR: string | null = null

export function setSocket(s: ReturnType<typeof makeWASocket>) {
    sock = s
}

export function setQR(qr: string | null) {
    currentQR = qr
}
