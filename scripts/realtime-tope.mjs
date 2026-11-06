// Sube el tope de mensajes por segundo de Realtime en el Supabase local (viene en 100 y vuelve a 100 cada vez que
// arranca su contenedor). Al pasarlo, Realtime bota los cambios de todos hasta por ~1 minuto (mide el promedio de
// 60 s) sin avisarle al navegador, y la agenda se queda quieta: con la suite E2E completa (4 tamaños y varias
// agendas abiertas; cada cambio cuenta una vez por agenda que lo puede ver) pasaba a veces.
// Uso: node scripts/realtime-tope.mjs  (lo corren `npm run db:start`, `npm run db:reset` y Playwright antes de cada suite)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TOPE = 2000
const INQUILINO = 'realtime-dev'
// `supabase db reset` reinicia Realtime y no lo espera: su nodo tarda unos segundos en aceptar `rpc` (`nodedown`).
const ESPERA_MAX_MS = 60_000
const ARRANCANDO = /nodedown|noconnection|is restarting|is not running/i

function contenedor() {
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')
  const id = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
  if (!id) throw new Error('No encontré project_id en supabase/config.toml')
  return `supabase_realtime_${id}`
}

function pausa(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Deja el tope en TOPE (si ya es igual o mayor, no lo toca) y devuelve el que quedó. */
export function subirTopeRealtime() {
  // Por el nodo de Realtime en ejecución: cambia la base y su caché a la vez, sin reiniciar el contenedor.
  const elixir = [
    `t = Realtime.Api.get_tenant_by_external_id("${INQUILINO}")`,
    `if t.max_events_per_second < ${TOPE}, do: {:ok, _} = Realtime.Api.update_tenant_by_external_id("${INQUILINO}", %{max_events_per_second: ${TOPE}})`,
    `IO.puts(Realtime.Api.get_tenant_by_external_id("${INQUILINO}").max_events_per_second)`,
  ].join('; ')
  const nombre = contenedor()
  const limite = Date.now() + ESPERA_MAX_MS
  let salida
  for (;;) {
    try {
      salida = execFileSync('docker', ['exec', nombre, '/app/bin/realtime', 'rpc', elixir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      })
      break
    } catch (e) {
      const detalle = `${e.stderr || ''}${e.stdout || ''}` || e.message
      if (ARRANCANDO.test(detalle) && Date.now() < limite) {
        pausa(1000)
        continue
      }
      const causa = e.code === 'ETIMEDOUT' ? 'Docker o Realtime no respondieron en 30 s' : detalle.trim()
      throw new Error(`No se pudo subir el tope de Realtime (¿Supabase local está arriba? npm run db:start): ${causa}`)
    }
  }
  const tope = Number(salida.trim().split(/\s+/).pop())
  if (!(tope >= TOPE)) throw new Error(`Realtime quedó con un tope de ${salida.trim()} mensajes por segundo`)
  return tope
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Tope de Realtime: ${subirTopeRealtime()} mensajes por segundo`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
