const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'distrito_beauty.db');
const SCHEMA_FILE = path.join(ROOT_DIR, 'database_sqlite.sql');

const DEFAULT_SCHEDULE = {
    lun: { active: true, start: '09:00', end: '18:00' },
    mar: { active: true, start: '09:00', end: '18:00' },
    mie: { active: true, start: '09:00', end: '18:00' },
    jue: { active: true, start: '09:00', end: '18:00' },
    vie: { active: true, start: '09:00', end: '18:00' },
    sab: { active: true, start: '09:00', end: '16:00' },
    dom: { active: false, start: '', end: '' }
};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function toBool(value) {
    return value === true || value === 1;
}

function createId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function openDatabase() {
    const shouldInit = !fs.existsSync(DB_FILE);
    const db = new DatabaseSync(DB_FILE);
    db.exec('PRAGMA foreign_keys = ON');

    const hasTables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'services'")
        .get();

    if (shouldInit || !hasTables) {
        const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
        db.exec(schema);
    }

    return db;
}

const db = openDatabase();

function mapService(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        duration: row.duration_minutes,
        icon: row.icon,
        image: row.image_url,
        active: toBool(row.active),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapClient(row) {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapAppointment(row) {
    return {
        id: row.id,
        clientId: row.client_id,
        serviceId: row.service_id,
        manicuristId: row.manicurist_id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        clientEmail: row.client_email || '',
        serviceName: row.service_name,
        servicePrice: row.service_price,
        serviceDuration: row.service_duration,
        manicuristName: row.manicurist_name,
        date: row.appointment_date,
        time: row.appointment_time,
        status: row.status,
        depositPaid: row.deposit_paid,
        depositAuthCode: row.deposit_auth_code || '',
        remainingBalance: row.remaining_balance,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapPayment(row) {
    return {
        id: row.id,
        appointmentId: row.appointment_id,
        amount: row.amount,
        authCode: row.auth_code,
        cardLast4: row.card_last4,
        type: row.payment_type,
        date: row.payment_date,
        createdAt: row.created_at
    };
}

function getServices() {
    return db
        .prepare('SELECT * FROM services WHERE active = 1 ORDER BY id')
        .all()
        .map(mapService);
}

function getServiceById(id) {
    const row = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(id);
    return row ? mapService(row) : null;
}

function buildScheduleMap() {
    const rows = db
        .prepare(`
            SELECT s.*
            FROM manicurist_schedules s
            JOIN manicurists m ON m.id = s.manicurist_id
            WHERE m.active = 1
            ORDER BY s.manicurist_id, s.id
        `)
        .all();

    const schedules = new Map();
    for (const row of rows) {
        if (!schedules.has(row.manicurist_id)) {
            schedules.set(row.manicurist_id, clone(DEFAULT_SCHEDULE));
        }
        schedules.get(row.manicurist_id)[row.day_key] = {
            active: toBool(row.is_active),
            start: row.start_time || '',
            end: row.end_time || ''
        };
    }
    return schedules;
}

function buildBlockedSlotsMap() {
    const rows = db
        .prepare(`
            SELECT b.*
            FROM manicurist_blocked_slots b
            JOIN manicurists m ON m.id = b.manicurist_id
            WHERE m.active = 1
            ORDER BY b.blocked_date, b.blocked_time
        `)
        .all();

    const slots = new Map();
    for (const row of rows) {
        if (!slots.has(row.manicurist_id)) {
            slots.set(row.manicurist_id, []);
        }
        slots.get(row.manicurist_id).push({
            id: row.id,
            date: row.blocked_date,
            time: row.blocked_time || '',
            allDay: toBool(row.all_day)
        });
    }
    return slots;
}

function getManicurists() {
    const scheduleMap = buildScheduleMap();
    const blockedMap = buildBlockedSlotsMap();
    return db
        .prepare('SELECT * FROM manicurists WHERE active = 1 ORDER BY id')
        .all()
        .map((row) => ({
            id: row.id,
            name: row.name,
            specialty: row.specialty,
            emoji: row.emoji || '',
            commission: row.commission_rate,
            active: toBool(row.active),
            blocked: toBool(row.blocked),
            schedule: scheduleMap.get(row.id) || clone(DEFAULT_SCHEDULE),
            blockedSlots: blockedMap.get(row.id) || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
}

function getManicuristById(id) {
    return getManicurists().find((m) => m.id === Number(id)) || null;
}

function getClients() {
    return db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all().map(mapClient);
}

function getAppointments() {
    return db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all().map(mapAppointment);
}

function getPayments() {
    return db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all().map(mapPayment);
}

function getState() {
    return {
        services: getServices(),
        manicurists: getManicurists(),
        clients: getClients(),
        appointments: getAppointments(),
        payments: getPayments()
    };
}

function json(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}

function noContent(res) {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                req.destroy();
                reject(new Error('Payload demasiado grande'));
            }
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('JSON invalido'));
            }
        });
        req.on('error', reject);
    });
}

function transaction(work) {
    db.exec('BEGIN');
    try {
        const result = work();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function requireFields(body, fields) {
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            const error = new Error(`Falta el campo ${field}`);
            error.status = 400;
            throw error;
        }
    }
}

function createService(body) {
    requireFields(body, ['name', 'description', 'price', 'duration']);
    const info = db
        .prepare(`
            INSERT INTO services (name, description, price, duration_minutes, icon, image_url, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `)
        .run(
            body.name,
            body.description,
            Number(body.price),
            Number(body.duration),
            body.icon || 'fas fa-hand-sparkles',
            body.image || ''
        );
    return getServiceById(Number(info.lastInsertRowid));
}

function updateService(id, body) {
    requireFields(body, ['name', 'description', 'price', 'duration']);
    db.prepare(`
        UPDATE services
        SET name = ?, description = ?, price = ?, duration_minutes = ?, icon = ?, image_url = ?
        WHERE id = ? AND active = 1
    `).run(
        body.name,
        body.description,
        Number(body.price),
        Number(body.duration),
        body.icon || 'fas fa-hand-sparkles',
        body.image || '',
        id
    );
    return getServiceById(id);
}

function createManicurist(body) {
    requireFields(body, ['name', 'specialty']);
    return transaction(() => {
        const info = db.prepare(`
            INSERT INTO manicurists (name, specialty, emoji, commission_rate, active, blocked)
            VALUES (?, ?, ?, ?, 1, 0)
        `).run(
            body.name,
            body.specialty,
            body.emoji || '',
            Number(body.commission ?? 0.5)
        );
        const id = Number(info.lastInsertRowid);
        const schedule = body.schedule || clone(DEFAULT_SCHEDULE);
        saveSchedule(id, schedule);
        return getManicuristById(id);
    });
}

function updateManicurist(id, body) {
    requireFields(body, ['name', 'specialty']);
    db.prepare(`
        UPDATE manicurists
        SET name = ?, specialty = ?, emoji = ?, commission_rate = ?
        WHERE id = ? AND active = 1
    `).run(
        body.name,
        body.specialty,
        body.emoji || '',
        Number(body.commission ?? 0.5),
        id
    );
    return getManicuristById(id);
}

function saveSchedule(manicuristId, schedule) {
    const statement = db.prepare(`
        INSERT INTO manicurist_schedules (manicurist_id, day_key, is_active, start_time, end_time)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(manicurist_id, day_key) DO UPDATE SET
            is_active = excluded.is_active,
            start_time = excluded.start_time,
            end_time = excluded.end_time
    `);

    for (const dayKey of Object.keys(DEFAULT_SCHEDULE)) {
        const day = schedule[dayKey] || DEFAULT_SCHEDULE[dayKey];
        statement.run(
            manicuristId,
            dayKey,
            day.active ? 1 : 0,
            day.active ? day.start : null,
            day.active ? day.end : null
        );
    }
}

function createClient(body) {
    requireFields(body, ['name', 'phone']);
    const existing = db.prepare('SELECT * FROM clients WHERE phone = ?').get(body.phone);
    if (existing) {
        db.prepare('UPDATE clients SET name = ?, email = ? WHERE id = ?').run(
            body.name,
            body.email || '',
            existing.id
        );
        return mapClient(db.prepare('SELECT * FROM clients WHERE id = ?').get(existing.id));
    }

    const id = createId('cli');
    db.prepare('INSERT INTO clients (id, name, phone, email) VALUES (?, ?, ?, ?)').run(
        id,
        body.name,
        body.phone,
        body.email || ''
    );
    return mapClient(db.prepare('SELECT * FROM clients WHERE id = ?').get(id));
}

function createAppointment(body) {
    requireFields(body, [
        'clientId',
        'serviceId',
        'manicuristId',
        'clientName',
        'clientPhone',
        'serviceName',
        'servicePrice',
        'serviceDuration',
        'manicuristName',
        'date',
        'time'
    ]);

    const id = createId('apt');
    db.prepare(`
        INSERT INTO appointments (
            id, client_id, service_id, manicurist_id,
            client_name, client_phone, client_email,
            service_name, service_price, service_duration,
            manicurist_name, appointment_date, appointment_time,
            status, deposit_paid, deposit_auth_code, remaining_balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        body.clientId,
        Number(body.serviceId),
        Number(body.manicuristId),
        body.clientName,
        body.clientPhone,
        body.clientEmail || '',
        body.serviceName,
        Number(body.servicePrice),
        Number(body.serviceDuration),
        body.manicuristName,
        body.date,
        body.time,
        body.status || 'confirmed',
        Number(body.depositPaid || 0),
        body.depositAuthCode || '',
        Number(body.remainingBalance || 0)
    );
    return mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
}

function createPayment(body) {
    requireFields(body, ['appointmentId', 'amount', 'authCode', 'cardLast4', 'type', 'date']);
    const id = createId('pay');
    db.prepare(`
        INSERT INTO payments (id, appointment_id, amount, auth_code, card_last4, payment_type, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        body.appointmentId,
        Number(body.amount),
        body.authCode,
        body.cardLast4,
        body.type,
        body.date
    );
    return mapPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}

async function handleApi(req, res, url) {
    if (req.method === 'OPTIONS') {
        noContent(res);
        return;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};

    if (req.method === 'GET' && url.pathname === '/api/health') {
        json(res, 200, { ok: true, database: path.basename(DB_FILE) });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
        json(res, 200, getState());
        return;
    }

    if (parts[1] === 'services') {
        if (req.method === 'GET' && parts.length === 2) {
            json(res, 200, getServices());
            return;
        }
        if (req.method === 'POST' && parts.length === 2) {
            json(res, 201, createService(body));
            return;
        }
        if (req.method === 'PUT' && parts.length === 3) {
            json(res, 200, updateService(Number(parts[2]), body));
            return;
        }
        if (req.method === 'DELETE' && parts.length === 3) {
            db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(Number(parts[2]));
            json(res, 200, { ok: true });
            return;
        }
    }

    if (parts[1] === 'manicurists') {
        if (req.method === 'GET' && parts.length === 2) {
            json(res, 200, getManicurists());
            return;
        }
        if (req.method === 'POST' && parts.length === 2) {
            json(res, 201, createManicurist(body));
            return;
        }
        if (req.method === 'PUT' && parts.length === 3) {
            json(res, 200, updateManicurist(Number(parts[2]), body));
            return;
        }
        if (req.method === 'DELETE' && parts.length === 3) {
            db.prepare('UPDATE manicurists SET active = 0, blocked = 1 WHERE id = ?').run(Number(parts[2]));
            json(res, 200, { ok: true });
            return;
        }
        if (req.method === 'PATCH' && parts.length === 4 && parts[3] === 'toggle-block') {
            const current = getManicuristById(Number(parts[2]));
            if (!current) {
                json(res, 404, { error: 'Manicurista no encontrada' });
                return;
            }
            db.prepare('UPDATE manicurists SET blocked = ? WHERE id = ?').run(current.blocked ? 0 : 1, current.id);
            json(res, 200, getManicuristById(current.id));
            return;
        }
        if (req.method === 'PUT' && parts.length === 4 && parts[3] === 'schedule') {
            saveSchedule(Number(parts[2]), body.schedule || body);
            json(res, 200, getManicuristById(Number(parts[2])));
            return;
        }
        if (req.method === 'POST' && parts.length === 4 && parts[3] === 'blocked-slots') {
            requireFields(body, ['date']);
            const manicuristId = Number(parts[2]);
            const allDay = body.allDay ? 1 : 0;
            const time = allDay ? null : body.time;
            const exists = db.prepare(`
                SELECT id
                FROM manicurist_blocked_slots
                WHERE manicurist_id = ?
                  AND blocked_date = ?
                  AND (all_day = 1 OR ? = 1 OR blocked_time = ?)
            `).get(manicuristId, body.date, allDay, time);

            if (!exists) {
                db.prepare(`
                    INSERT INTO manicurist_blocked_slots (manicurist_id, blocked_date, blocked_time, all_day)
                    VALUES (?, ?, ?, ?)
                `).run(manicuristId, body.date, time, allDay);
            }
            json(res, 201, getManicuristById(manicuristId));
            return;
        }
        if (req.method === 'DELETE' && parts.length === 5 && parts[3] === 'blocked-slots') {
            db.prepare('DELETE FROM manicurist_blocked_slots WHERE id = ? AND manicurist_id = ?').run(
                Number(parts[4]),
                Number(parts[2])
            );
            json(res, 200, getManicuristById(Number(parts[2])));
            return;
        }
    }

    if (parts[1] === 'clients') {
        if (req.method === 'GET' && parts.length === 2) {
            json(res, 200, getClients());
            return;
        }
        if (req.method === 'POST' && parts.length === 2) {
            json(res, 201, createClient(body));
            return;
        }
    }

    if (parts[1] === 'appointments') {
        if (req.method === 'GET' && parts.length === 2) {
            json(res, 200, getAppointments());
            return;
        }
        if (req.method === 'POST' && parts.length === 2) {
            json(res, 201, createAppointment(body));
            return;
        }
        if (req.method === 'PATCH' && parts.length === 4 && parts[3] === 'status') {
            requireFields(body, ['status']);
            db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(body.status, parts[2]);
            json(res, 200, mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(parts[2])));
            return;
        }
        if (req.method === 'DELETE' && parts.length === 3) {
            db.prepare('DELETE FROM appointments WHERE id = ?').run(parts[2]);
            json(res, 200, { ok: true });
            return;
        }
    }

    if (parts[1] === 'payments') {
        if (req.method === 'GET' && parts.length === 2) {
            json(res, 200, getPayments());
            return;
        }
        if (req.method === 'POST' && parts.length === 2) {
            json(res, 201, createPayment(body));
            return;
        }
    }

    json(res, 404, { error: 'Ruta API no encontrada' });
}

function serveStatic(req, res, url) {
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.normalize(path.join(ROOT_DIR, pathname));
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Archivo no encontrado');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

    try {
        if (url.pathname.startsWith('/api/')) {
            await handleApi(req, res, url);
            return;
        }
        serveStatic(req, res, url);
    } catch (error) {
        const status = error.status || (String(error.message).includes('UNIQUE constraint failed') ? 409 : 500);
        json(res, status, { error: error.message || 'Error interno' });
    }
});

server.listen(PORT, () => {
    console.log(`Distrito Beauty listo en http://localhost:${PORT}`);
    console.log(`Base SQLite: ${DB_FILE}`);
});
