import fs from 'fs'

const logFile = new URL('../logs/provenance.log', import.meta.url)

interface AuditEntry {
  level: 'info' | 'warn' | 'error'
  event: string
  message: string
  payload?: Record<string, any>
  timestamp: string
}

function append(entry: AuditEntry): void {
  const line = JSON.stringify(entry)
  fs.appendFile(logFile, line + '\n', err => {
    if (err) {
      console.error('Failed to write audit log', err)
    }
  })
  const logLine = `[${entry.level.toUpperCase()}] ${entry.event} – ${entry.message}`
  if (entry.level === 'error') {
    console.error(logLine, entry.payload)
  } else {
    console.log(logLine, entry.payload ?? '')
  }
}

export const auditLogger = {
  info(event: string, message: string, payload?: Record<string, any>) {
    append({ level: 'info', event, message, payload, timestamp: new Date().toISOString() })
  },
  warn(event: string, message: string, payload?: Record<string, any>) {
    append({ level: 'warn', event, message, payload, timestamp: new Date().toISOString() })
  },
  error(event: string, message: string, payload?: Record<string, any>) {
    append({ level: 'error', event, message, payload, timestamp: new Date().toISOString() })
  }
}
