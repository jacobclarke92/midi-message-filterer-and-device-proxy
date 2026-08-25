// oxlint-disable no-unused-vars
// deno-lint-ignore-file no-unversioned-import no-explicit-any no-unused-vars
import * as easymidi from 'npm:easymidi@3.2.0'
import { serveDir } from 'jsr:@std/http/file-server'

type MidiEventType =
  | 'noteon'
  | 'noteoff'
  | 'poly aftertouch'
  | 'cc'
  | 'program'
  | 'channel aftertouch'
  | 'pitch'
  | 'position'
  | 'select'
  | 'clock'
  | 'start'
  | 'continue'
  | 'stop'
  | 'activesense'
  | 'reset'
  | 'mtc'
  | 'sysex'

interface BlockedCC {
  cc: number
  channel: number | 'all'
}

const PORT = 33445

const proxyOutput = new easymidi.Output('Ohm Proxy', true)
let activeInput: easymidi.Input | null = null
let activeInputName: string | null = null
let blockedCCs: BlockedCC[] = []
const clients = new Set<WebSocket>()

function broadcast(type: string, payload?: unknown) {
  const msg = JSON.stringify({ type, payload })
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  }
}

function processState() {
  return {
    inputs: easymidi.getInputs(),
    activeInput: activeInputName,
    blockedCCs: blockedCCs,
  }
}

function setupMidiInput(portName: string | null) {
  if (activeInput) {
    activeInput.close()
    activeInput = null
    activeInputName = null
  }

  if (!portName) return

  try {
    activeInput = new easymidi.Input(portName)
    activeInputName = portName
    console.log(`Now listening to MIDI input: ${portName}`)

    const messageTypes: MidiEventType[] = [
      'noteon',
      'noteoff',
      'poly aftertouch',
      'cc',
      'program',
      'channel aftertouch',
      'pitch',
      'position',
      'select',
      'clock',
      'start',
      'continue',
      'stop',
      'activesense',
      'reset',
      'mtc',
      'sysex',
    ]

    messageTypes.forEach((type) => {
      // Type assertion needed because easymidi's .on() expects a strictly narrowed type callback depending on event
      activeInput!.on(type as any, (msg: any) => {
        let isBlocked = false

        if (type === 'cc') {
          const ccMsg = msg as easymidi.ControlChange
          for (const rule of blockedCCs) {
            if (
              rule.cc === ccMsg.controller &&
              (rule.channel === 'all' || rule.channel === ccMsg.channel)
            ) {
              isBlocked = true
              break
            }
          }
        }

        if (!isBlocked && proxyOutput) {
          try {
            // Again, a type assertion is necessary here to map dynamic strings to dynamic overloaded sends
            if (msg) proxyOutput.send(type as any, msg)
            else proxyOutput.send(type as any)
          } catch (e) {
            // Ignore proxy output exceptions
          }
        }

        broadcast('midiMessage', {
          time: Date.now(),
          type,
          msg,
          isBlocked,
        })
      })
    })
  } catch (error) {
    console.error(`Failed to open MIDI port ${portName}:`, error)
  }
}

Deno.serve({ port: PORT }, (req) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req)

    socket.onopen = () => {
      console.log('WebUI connected via WebSocket')
      clients.add(socket)
      socket.send(
        JSON.stringify({
          type: 'state',
          payload: processState(),
        }),
      )
    }

    socket.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data)

        switch (type) {
          case 'setBlockedCCs':
            blockedCCs = payload
            console.log('Updated blocked CCs:', blockedCCs)
            broadcast('state', processState())
            break
          case 'selectInput':
            setupMidiInput(payload)
            broadcast('state', processState())
            break
          case 'refreshPorts':
            socket.send(
              JSON.stringify({
                type: 'state',
                payload: processState(),
              }),
            )
            break
        }
      } catch (err) {
        console.error('Failed to parse websocket message:', err)
      }
    }

    socket.onclose = () => {
      console.log('WebUI disconnected')
      clients.delete(socket)
    }

    return response
  }

  // Fallback API for sanity check
  if (new URL(req.url).pathname === '/api/status') {
    return Response.json({ status: 'running', activeInput: activeInputName })
  }

  let distPath = 'frontend/dist'
  if (import.meta.dirname) distPath = `${import.meta.dirname}/../frontend/dist`

  return serveDir(req, {
    fsRoot: distPath,
    urlRoot: '',
    showDirListing: false,
    enableCors: true,
  })
})

const url = `http://localhost:${PORT}/`
console.log(`MIDI Proxy backend starting up at ${url}`)

try {
  const os = Deno.build.os
  const cmd = os === 'windows' ? 'cmd' : os === 'darwin' ? 'open' : 'xdg-open'
  const args = os === 'windows' ? ['/c', 'start', url] : [url]
  new Deno.Command(cmd, { args }).spawn()
} catch (e) {
  console.error('Failed to open browser automatically:', e)
}
