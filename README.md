# Kabert Music Manager
Sistema Web de Gestión Académica para Escuelas de Música — **Kabert Studio · LMKE**

## 1. Crear el proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo (gratuito).
2. Entra a **SQL Editor** → pega y ejecuta todo el contenido de `supabase/schema.sql`.
   Esto crea las tablas (`estudiantes`, `especialidades`, `eventos_calendario`, `pagos`, `historial`, `configuracion`) y las políticas de acceso.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el cliente
Abre `js/supabaseClient.js` y reemplaza:
```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-KEY";
```
con tus valores reales.

## 3. Probar localmente
Como el navegador bloquea `fetch` en archivos `file://` para algunos casos, sirve la carpeta con cualquier servidor estático, por ejemplo:
```bash
npx serve .
# o
python3 -m http.server 8080
```
Abre `http://localhost:8080`.

## 4. Publicar en GitHub Pages
1. Sube esta carpeta a un repositorio (por ejemplo `kabertpro/kabert-music-manager`).
2. En **Settings → Pages**, selecciona la rama `main` y carpeta raíz `/`.
3. Tu sistema quedará disponible en `https://kabertpro.github.io/kabert-music-manager/`.

## 5. Acceso

- **Portal del Estudiante**: pantalla principal, usuario y contraseña generados al registrar al estudiante.
- **Panel Administrador**: botón discreto ⚙️ en la esquina inferior derecha del login → contraseña `kabert2026`
  (puedes cambiarla en `js/app.js`, constante `ADMIN_PASSWORD`).

## Notas de seguridad importantes

Este sistema está pensado para desplegarse **enteramente en el cliente** (GitHub Pages), tal como se solicitó. Ten en cuenta:

- Las contraseñas de estudiantes se guardan **en texto plano** en la tabla `estudiantes` y la contraseña de administrador está fija en el código JavaScript. Esto es visible para cualquiera que inspeccione el código fuente o la base de datos. Es un enfoque válido para un entorno académico interno de bajo riesgo, pero **no protege datos sensibles de forma robusta**.
- Las políticas de RLS de Supabase están abiertas a la clave `anon` para que la app funcione sin backend. Cualquier persona con la URL y la clave `anon` (visibles en el código fuente) podría leer o escribir en las tablas directamente vía API.
- Si en el futuro se requiere mayor seguridad, se recomienda:
  - Mover la validación de administrador y estudiante a una **Supabase Edge Function**, o
  - Usar **Supabase Auth** con hash de contraseñas y RLS por usuario autenticado.

## Estructura del proyecto
```
index.html
css/style.css
js/
  supabaseClient.js   → conexión Supabase
  utils.js            → fechas, códigos, helpers de UI
  calendarEngine.js   → motor de calendario (permisos, reposiciones, mensualidades)
  payments.js         → pagos y generación de recibos PDF
  admin.js            → panel de administración
  student.js          → portal del estudiante
  app.js              → splash, login, navegación, modales
supabase/schema.sql   → esquema completo de base de datos
```

## Qué incluye esta primera versión
- Splash screen animado, login de estudiante y acceso oculto de administrador.
- Motor de calendario: genera automáticamente las clases de cada estudiante según sus días de horario.
- Agenda del Día con registro de asistencia en un clic (Asistió / Permiso / Falta).
- Permisos con reposición automática y recálculo de la mensualidad **respetando días reales de clase** (nunca sumando días de calendario).
- Registro y edición de estudiantes con generación automática de código por iniciales (con resolución de duplicados).
- Especialidades administrables, sin nombres fijos en el código.
- Pagos completos/parciales con cálculo de saldo pendiente y recibos PDF profesionales.
- Historial cronológico por estudiante (alta, asistencias, permisos, reposiciones, pagos, bajas, reactivaciones).
- Portal del estudiante: perfil editable, horarios y próximas clases, historial y mensualidades con descarga de recibos.
- Diseño responsivo tipo dashboard (azul oscuro / celeste / blanco / gris claro), con menú lateral colapsable en móvil.

## Posibles siguientes pasos
- Subida real de fotografías (actualmente se usa una URL de imagen).
- Edición de horario con regeneración automática del calendario futuro.
- Reportes y estadísticas (ingresos por mes, asistencia por especialidad, etc.).
