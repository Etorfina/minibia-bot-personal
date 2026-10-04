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
  const verifiedUrl = "https://raw.githubusercontent.com/Etorfina/minibia-bot-personal/ea2ec7c13a387b956d7495423f675a0a7e7b5dee/minibia-bot.js.gz.b64";
  const requiredControls = [
    'data-tab="healing"',
    'id="minibia-bot-heal-spells"',
    'id="minibia-bot-heal-items"',
    'id="minibia-bot-heal-status"',
    'id="minibia-bot-attack-target-list"',
    'id="minibia-bot-attack-stance"',
    'id="minibia-bot-attack-range"'
  ];
  const hasTargetingControls = (source) => requiredControls.every((control) => source.includes(control));
  const decode = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No pude descargar el bot: HTTP ${response.status}`);
    const bytes = Uint8Array.from(atob((await response.text()).trim()), c => c.charCodeAt(0));
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  };
  let code = await decode(`${mainUrl}?v=${Date.now()}`);
  if (!hasTargetingControls(code)) {
    code = await decode(verifiedUrl);
  }
  if (!hasTargetingControls(code)) {
    throw new Error("La versión descargada no incluye las reglas de curación y controles esperados.");
  }
  window.minibiaBotSourceUrl = mainUrl;
  (0, eval)(code);
  if (!document.querySelector('[data-tab="healing"]') || !document.getElementById("minibia-bot-heal-spells") || !document.getElementById("minibia-bot-heal-items") || !document.getElementById("minibia-bot-heal-status") || !document.getElementById("minibia-bot-attack-target-list") || !document.getElementById("minibia-bot-attack-stance") || !document.getElementById("minibia-bot-attack-range")) {
    throw new Error("La versión nueva se descargó, pero no apareció el panel. Recarga el juego y vuelve a ejecutar este código.");
  }
  console.info("[minibia-bot] HealBot y Attack Target actualizados cargados");
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

Editar `src/` y ejecutar `bash build.sh`: el script regenera `pz-bot.js` y `minibia-bot.js.gz.b64`. Ejecutar `node --test tests/*.test.cjs` para validar curación, combate y Cavebot. La carpeta `base/` queda como referencia. El comportamiento dentro del juego requiere una prueba en una sesión real.

## Curación

La pestaña **Curación** organiza las reglas en **Hechizos** y **Runas y pociones**, con ajustes generales en **Condiciones**. Añade una regla por cada acción (por ejemplo, `exura`, `UH`, poción de vida o de maná), asígnale la casilla donde ya colocaste esa acción en Minibia y elige qué vigilar: vida o maná. Cada regla puede activarse por debajo o por encima de un umbral, medido en puntos o porcentaje, con un costo mínimo de maná y un enfriamiento propio.

Las reglas se muestran en filas compactas; toca una para abrir o cerrar sus ajustes. Al añadir una, el editor se abre para configurarla. Las reglas se intentan de arriba abajo. Los controles ↑ y ↓ cambian la prioridad, incluso entre las dos listas. **Wait** es la frecuencia con que se revisan las condiciones; **Delay** es la pausa general después de activar una casilla. El mínimo global de maná evita gastar acciones por debajo de la reserva que indiques. La interfaz muestra la última acción detectada y permite pausar todas las reglas con **Activo**.

La detección de curación confirma un cambio de vida o maná tras activar la casilla. La curación de otros jugadores no está disponible: el cliente actual no ofrece al bot una función fiable para seleccionar y curar a un objetivo ajeno.

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

Pruebas de comportamiento: `node --test tests/auto-attack.test.cjs tests/cave.test.cjs`. Reconstrucción: `bash build.sh`. Las pruebas usan un cliente simulado; falta validar navegación y combate en una sesión real de Minibia.

Si ves **Record Spot** en vez de los botones **Node / Stand / Walk**, tu página aún usa un bundle anterior. Ejecuta el cargador de arriba y recarga Minibia para aplicar la interfaz nueva.

## Attack Target

El módulo busca criaturas visibles del mismo piso y puede funcionar junto con Cavebot. Añade nombres para darles prioridad, reordénalos y, si activas **Atacar solo los de esta lista**, los demás se ignoran. La selección puede seguir el orden de la lista o elegir el más cercano.

El **modo general** ofrece combate cercano, que persigue hasta quedar junto al objetivo, y combate lejano, que conserva una separación ajustable. Por defecto mantiene entre 2 y 3 SQM; cambia el límite máximo de 2 a 8 SQM para mover ese anillo. En cada criatura de la lista, el selector **General / Cerca / Lejos** permite heredar el modo global o definir su propio estilo, como el ajuste de distancia deseada de ElfBot. Asigna la casilla de objetivo y, si la usarás, la de la runa.
