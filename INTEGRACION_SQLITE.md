# Integracion SQLite - Distrito Beauty

La pagina ya quedo preparada para usar SQLite mediante un servidor local en Node.

## Como iniciar

Desde esta carpeta:

```powershell
.\iniciar-servidor.ps1
```

O tambien:

```powershell
npm start
```

Luego abre:

```text
http://localhost:3000
```

## Archivos principales

- `database_sqlite.sql`: crea las tablas y datos iniciales.
- `distrito_beauty.db`: base de datos SQLite local. Se crea automaticamente si no existe.
- `server.js`: servidor local. Sirve la pagina y expone la API `/api`.
- `db.js`: capa de datos del frontend. Ahora llama a la API en vez de usar `localStorage`.
- `script.js`: usa `await` para guardar servicios, profesionales, citas, clientes y pagos.

## Crear o resetear la base manualmente

Si quieres borrar y recrear la base con datos iniciales:

```powershell
Remove-Item .\distrito_beauty.db -ErrorAction SilentlyContinue
sqlite3 distrito_beauty.db ".read database_sqlite.sql"
```

Tambien puedes dejar que `server.js` la cree automaticamente al iniciar.

## Endpoints disponibles

```text
GET    /api/health
GET    /api/state

GET    /api/services
POST   /api/services
PUT    /api/services/:id
DELETE /api/services/:id

GET    /api/manicurists
POST   /api/manicurists
PUT    /api/manicurists/:id
DELETE /api/manicurists/:id
PATCH  /api/manicurists/:id/toggle-block
PUT    /api/manicurists/:id/schedule
POST   /api/manicurists/:id/blocked-slots
DELETE /api/manicurists/:id/blocked-slots/:slotId

GET    /api/clients
POST   /api/clients

GET    /api/appointments
POST   /api/appointments
PATCH  /api/appointments/:id/status
DELETE /api/appointments/:id

GET    /api/payments
POST   /api/payments
```

## Nota sobre Webpay

El Webpay actual sigue siendo una simulacion para desarrollo. Para pagos reales hay que integrar Transbank desde el backend, no desde el navegador.
