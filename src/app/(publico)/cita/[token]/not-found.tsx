import { CalendarX2 } from "lucide-react";

export default function CitaNoEncontrada() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-niebla-oscura text-ac-pizarra">
          <CalendarX2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">No encontramos esta cita</h1>
        <p className="mt-1 text-ac-pizarra">
          Revisa que el enlace esté completo, tal como llegó en tu correo o
          WhatsApp. Si el problema sigue, comunícate con el negocio.
        </p>
      </div>
    </main>
  );
}
