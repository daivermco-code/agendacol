// Crea (o deja al día) los usuarios de demo (dueña, recepción y los 4 profesionales) y su acceso al negocio inventado.
// Uso: node --env-file=.env.local scripts/usuarios-demo.mjs  (lo corre `npm run db:reset`)
// En la nube (tu proyecto): DEMO_PROYECTO_NUBE=https://<tu-ref>.supabase.co node --env-file=.env.local scripts/usuarios-demo.mjs --nube
// La contraseña sale de DEMO_PASSWORD en el archivo .env; nunca se escribe en el repo ni se imprime.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
const clave = process.env.DEMO_PASSWORD

if (!url || !llave || !clave) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DEMO_PASSWORD en .env.local')
  process.exit(1)
}
// Solo el Supabase de esta máquina o, pidiéndolo con --nube, el proyecto que diga DEMO_PROYECTO_NUBE.
const PROYECTO_NUBE = process.env.DEMO_PROYECTO_NUBE
const nube = process.argv.includes('--nube')
if (nube ? !PROYECTO_NUBE || url !== PROYECTO_NUBE : !/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  console.error(nube ? `Con --nube solo corre contra ${PROYECTO_NUBE}.` : 'Este script solo corre contra Supabase local.')
  process.exit(1)
}

const NEGOCIO = 'a0000000-0000-4000-8000-000000000001'
const USUARIOS = [
  { correo: 'duena@salonceiba.test', nombre: 'Mariana Gómez', rol: 'dueno', profesional_id: null },
  { correo: 'recepcion@salonceiba.test', nombre: 'Laura Pinzón', rol: 'recepcion', profesional_id: null },
  {
    correo: 'carolina@salonceiba.test',
    nombre: 'Carolina Ruiz',
    rol: 'profesional',
    profesional_id: 'b0000000-0000-4000-8000-000000000001',
  },
  {
    correo: 'andres@salonceiba.test',
    nombre: 'Andrés Molina',
    rol: 'profesional',
    profesional_id: 'b0000000-0000-4000-8000-000000000002',
  },
  {
    correo: 'valentina@salonceiba.test',
    nombre: 'Valentina Ospina',
    rol: 'profesional',
    profesional_id: 'b0000000-0000-4000-8000-000000000003',
  },
  {
    correo: 'julian@salonceiba.test',
    nombre: 'Julián Herrera',
    rol: 'profesional',
    profesional_id: 'b0000000-0000-4000-8000-000000000004',
  },
]

const supabase = createClient(url, llave, { auth: { persistSession: false } })

const { data: lista, error: errorLista } = await supabase.auth.admin.listUsers({ perPage: 200 })
if (errorLista) throw errorLista

for (const u of USUARIOS) {
  let usuario = lista.users.find((x) => x.email === u.correo)
  if (usuario) {
    const { error } = await supabase.auth.admin.updateUserById(usuario.id, { password: clave })
    if (error) throw error
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.correo,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre: u.nombre },
    })
    if (error) throw error
    usuario = data.user
  }
  const { error } = await supabase.from('miembros').upsert(
    {
      negocio_id: NEGOCIO,
      user_id: usuario.id,
      nombre: u.nombre,
      correo: u.correo,
      rol: u.rol,
      profesional_id: u.profesional_id,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
  console.log(`✓ ${u.rol.padEnd(11)} ${u.correo}`)
}
