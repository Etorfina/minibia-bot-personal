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
  const mainUrl = "https://raw.githubusercontent.com/Etorfina/minibia-bot-personal/main/minibia-bot.js.gz.b64";
  const verifiedUrl = "https://raw.githubusercontent.com/Etorfina/minibia-bot-personal/9b39bc484239ebacb7a6d54361099ec456b86130/minibia-bot.js.gz.b64";
  const decode = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No pude descargar el bot: HTTP ${response.status}`);
    const bytes = Uint8Array.from(atob((await response.text()).trim()), c => c.charCodeAt(0));
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  };
  let code = await decode(`${mainUrl}?v=${Date.now()}`);
  if (!code.includes('id="minibia-bot-attack-target-list"')) {
    code = await decode(verifiedUrl);
  }
  if (!code.includes('id="minibia-bot-attack-target-list"')) {
    throw new Error("Llegó una versión vieja: falta la lista de prioridades de Attack Target.");
  }
  window.minibiaBotSourceUrl = mainUrl;
  (0, eval)(code);
  if (!document.getElementById("minibia-bot-attack-target-list")) {
    throw new Error("La versión nueva se descargó, pero no apareció el panel. Recarga el juego y vuelve a ejecutar este código.");
  }
  console.info("[minibia-bot] Interfaz actualizada cargada");
})().catch(error => { console.error(error); alert(error.message); });
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

## Cavebot V1

En **Cueva**, toca **Node**, **Stand** o **Walk** para guardar la posición actual como punto en un solo toque. **Label** y **Acción** preguntan el nombre o la instrucción antes de guardar.

- **Node / Walk:** puntos flexibles. La tolerancia por defecto es 1; una configuración anterior con tolerancia 0 conserva su precisión.
- **Stand:** debe llegar exactamente al SQM.
- **Label:** llega al punto y lo identifica con un nombre, por ejemplo `SALIDA`.
- **Action:** llega exactamente al punto y ejecuta `wait:2000` (espera 2 segundos), `skip:1` (omite el siguiente punto) o `goto:SALIDA` (salta al Label). No ejecuta JavaScript arbitrario.

**Ida y vuelta** recorre los puntos en ambas direcciones, incluidas las acciones. **Loop** vuelve del último al primero; graba también el tramo de regreso. Cada preset guarda su modo de recorrido. START comienza por el punto de movimiento más cercano.

Para compartir un preset, selecciónalo y pulsa **Exportar** debajo de **Nuevo / Borrar**. Usa **Copiar** o **Compartir** y envía el texto JSON. En el otro dispositivo abre **Importar**, pega el texto y pulsa **Guardar recorrido**. Se guarda como un preset nuevo, incluyendo puntos, modo y transiciones de piso aprendidas; si el nombre ya existe se añade un número para no sobrescribirlo. La lista de puntos se puede desplegar tocando **Puntos del recorrido**.

El combate tiene prioridad sobre la ruta. Tras 8 segundos sin acercarse al punto, el antiatasco puede omitir un Node/Walk solamente si el siguiente punto también es flexible, está en el mismo piso y el pathfinder confirma una ruta. En los demás casos detiene Cavebot y muestra el punto que requiere revisión. No omite acciones, Stand ni cambios de piso. Las transiciones aprendidas y Auto Loot del juego siguen funcionando como antes.

Pruebas de comportamiento: `node --test tests/cave.test.cjs`. Reconstrucción: `bash build.sh`. Las pruebas usan un cliente simulado; falta validar navegación y combate en una sesión real de Minibia.

Si ves **Record Spot** en vez de los botones **Node / Stand / Walk**, tu página aún usa un bundle anterior. Ejecuta el cargador de arriba y recarga Minibia para aplicar la interfaz nueva.

## Attack Target

El módulo busca criaturas visibles del mismo piso y puede funcionar junto con Cavebot. Añade nombres para darles prioridad, reordénalos y, si activas **Atacar solo los de esta lista**, los demás se ignoran. La selección puede seguir el orden de la lista o elegir el más cercano. En modo cuerpo a cuerpo persigue al objetivo; a distancia mantiene 2–3 casillas. Asigna las casillas de objetivo y, si la usarás, de la runa.
