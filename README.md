# minibia-bot-personal

Versión personalizada recuperada del paquete `minibia-bot-mobile-1.0.zip`.

## Base y copia de trabajo

- `base/`: fotografía del código original. Conservar sus archivos sin modificaciones.
- Raíz y `src/`: copia de trabajo para los próximos cambios.
- `pz-bot.js`: bundle integrado con interfaz móvil, regreso seguro y combate.
- `minibia-bot.js.gz.b64`: el mismo bundle comprimido para el cargador y la exportación de ajustes.
- `portable-installer.js` y los parches `*-live.js`: herramientas anteriores conservadas; el instalador portátil todavía descarga una revisión del autor original. Para usar nuestra versión, utiliza el cargador de abajo.

Se verificó que el código fuente inicial reconstruía exactamente el bundle de referencia. SHA-256 de esa versión inicial de `pz-bot.js`: `1a41a059a7209f7824068b0468d1bca6ebe836383821fb75ca0607794d794454`.

## Cargar nuestra versión

En la consola del navegador, con el juego abierto:

```js
(async () => {
  window.minibiaBotSourceUrl = "https://raw.githubusercontent.com/Etorfina/minibia-bot-personal/main/minibia-bot.js.gz.b64";
  const response = await fetch(window.minibiaBotSourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`No pude descargar el bot: HTTP ${response.status}`);
  const bytes = Uint8Array.from(atob((await response.text()).trim()), c => c.charCodeAt(0));
  const code = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  (0, eval)(code);
})().catch(console.error);
```

El botón **Copiar código con mis ajustes** exporta las rutas y opciones del navegador actual. El repositorio conserva el código; los ajustes personales no se sincronizan automáticamente. La clave API y la configuración de Auto Reply se excluyen de la exportación.

## Barra de inicio

La barra aparece compacta en el centro de la pantalla:

- **START** reanuda los módulos que estaban configurados y habilitados antes de pulsar STOP.
- **STOP** detiene todos los módulos y la reconexión automática. La selección anterior queda guardada para START, incluso después de recargar la página.
- **☰** despliega el menú; **×** lo cierra y devuelve la barra al centro.
- Mantén presionado **✥** y arrástralo para mover la barra.

## Desarrollo

Editar `src/` y ejecutar `bash build.sh`: el script regenera `pz-bot.js` y `minibia-bot.js.gz.b64`. La carpeta `base/` queda como referencia. Las comprobaciones verifican sintaxis e integridad; el comportamiento dentro del juego requiere una prueba en una sesión real.

## Documentación original

El README original se conserva en el respaldo local `minibia-bot-base-y-trabajo.zip`.
