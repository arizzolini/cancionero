# Cancionero

App web para tocar guitarra y cantar sin soltar el instrumento. Importás una URL concreta de [Cifra Club](https://www.cifraclub.com/), la guardás en el dispositivo y la letra intenta seguirte mientras cantás.

## Qué hace

- Importa **una canción por URL**, no rastrea ni busca en Cifra Club.
- Guarda título, artista, tono, acordes y letra en **IndexedDB** (solo este navegador/dispositivo).
- Busca dentro de tu biblioteca personal.
- Sigue la letra de forma aproximada con el micrófono del navegador.
- Si el canto o la guitarra no se entienden, sigue con **auto-scroll**, botones y órdenes de voz:
  - `asistente siguiente`
  - `asistente atrás`
  - `asistente pausa`
  - `asistente seguir`

El seguimiento por canto es **orientativo**, no exacto. El reconocimiento de voz está pensado para habla, no para canto con guitarra.

## Uso

1. Abrí la app en **Chrome o Edge** (escritorio o celular).
2. Pegá una URL como `https://www.cifraclub.com/los-huayra/la-noche-sin-ti/`.
3. Tocá la canción guardada.
4. Activá **Mic. on**, permití el micrófono y cantá cerca del celular.
5. Ajustá tamaño de texto y velocidad de auto-scroll.

Las canciones no se sincronizan entre dispositivos. Si cambiás de celular o borrás datos del navegador, hay que volver a importarlas.

## Privacidad

- La app **no guarda audio**.
- En Chrome/Edge el reconocimiento de voz del navegador puede enviar el audio a su propio servicio.
- No hay cuentas ni base de datos en el servidor: el backend solo descarga la página de Cifra Club cuando importás una URL.

## Límites

- El parser depende del HTML de Cifra Club. Si el sitio cambia, la importación puede fallar.
- Cifra Club puede bloquear o limitar las descargas desde el servidor de Vercel.
- El micrófono no funciona en Firefox de forma fiable.
- No copies ni redistribuyas las cifras; la app conserva el enlace a la fuente original.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

## Despliegue en Vercel

1. Subí el repo a GitHub, GitLab o Bitbucket.
2. Importá el proyecto en [Vercel](https://vercel.com/new).
3. Framework: Next.js. Build: `next build`.
4. Cada push a la rama principal genera producción; las demás ramas generan preview.

No hace falta base de datos ni variables de entorno para este MVP.
