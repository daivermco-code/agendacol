// Abre la demo para los equipos de la red de la casa (celular, tableta, otro computador). Compila con la IP de
// este PC como dirección de Supabase y la sirve en el puerto 3010. Uso: `npm run demo:casa` (o
// `npm run demo:casa -- 192.168.1.20` para elegir la IP). Después, para volver a la demo normal o correr las
// pruebas: `npm run build`.
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";

const PRIVADA = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function ipDeLaCasa() {
  const candidatas = Object.entries(networkInterfaces())
    // Las redes virtuales de Hyper-V/WSL/Docker no llegan al celular.
    .filter(
      ([nombre]) => !/vEthernet|WSL|Docker|VirtualBox|VMware/i.test(nombre),
    )
    .flatMap(([nombre, dirs]) =>
      (dirs ?? [])
        .filter(
          (d) => d.family === "IPv4" && !d.internal && PRIVADA.test(d.address),
        )
        .map((d) => ({ nombre, ip: d.address })),
    );
  // El Wi-Fi primero: es la red del celular.
  candidatas.sort(
    (a, b) =>
      Number(/wi-?fi|wlan/i.test(b.nombre)) -
      Number(/wi-?fi|wlan/i.test(a.nombre)),
  );
  return candidatas[0]?.ip;
}

const ip = process.argv[2] ?? ipDeLaCasa();
if (!ip) {
  console.error(
    "No encontré la IP de este PC en la red de la casa. Pásala: npm run demo:casa -- 192.168.x.x",
  );
  process.exit(1);
}

const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://${ip}:44421` };
const correr = (args) =>
  spawnSync("npx", args, { stdio: "inherit", env, shell: true }).status ?? 1;

console.log(`\nCompilando la demo para la red de la casa (${ip})…\n`);
if (correr(["next", "build"]) !== 0) process.exit(1);
console.log(
  `\nLista. Desde el celular (en el mismo Wi-Fi): http://${ip}:3010\nPara cerrarla: Ctrl+C.\n`,
);
process.exit(correr(["next", "start", "-p", "3010"]));
