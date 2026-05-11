PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS manicurist_blocked_slots;
DROP TABLE IF EXISTS manicurist_schedules;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS manicurists;
DROP TABLE IF EXISTS services;

CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    icon TEXT NOT NULL,
    image_url TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manicurists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    emoji TEXT,
    commission_rate REAL NOT NULL DEFAULT 0.5 CHECK (commission_rate >= 0 AND commission_rate <= 1),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    blocked INTEGER NOT NULL DEFAULT 0 CHECK (blocked IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manicurist_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manicurist_id INTEGER NOT NULL,
    day_key TEXT NOT NULL CHECK (day_key IN ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    start_time TEXT,
    end_time TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manicurist_id) REFERENCES manicurists(id) ON DELETE CASCADE,
    UNIQUE (manicurist_id, day_key)
);

CREATE TABLE manicurist_blocked_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manicurist_id INTEGER NOT NULL,
    blocked_date TEXT NOT NULL,
    blocked_time TEXT,
    all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manicurist_id) REFERENCES manicurists(id) ON DELETE CASCADE
);

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    service_id INTEGER NOT NULL,
    manicurist_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    service_name TEXT NOT NULL,
    service_price INTEGER NOT NULL,
    service_duration INTEGER NOT NULL,
    manicurist_name TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
    deposit_paid INTEGER NOT NULL DEFAULT 0,
    deposit_auth_code TEXT,
    remaining_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (manicurist_id) REFERENCES manicurists(id),
    UNIQUE (manicurist_id, appointment_date, appointment_time)
);

CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    auth_code TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

CREATE INDEX idx_services_active ON services(active);
CREATE INDEX idx_manicurists_active_blocked ON manicurists(active, blocked);
CREATE INDEX idx_schedules_manicurist ON manicurist_schedules(manicurist_id);
CREATE INDEX idx_blocked_slots_manicurist_date ON manicurist_blocked_slots(manicurist_id, blocked_date);
CREATE INDEX idx_appointments_date_manicurist ON appointments(appointment_date, manicurist_id);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);

CREATE TRIGGER trg_services_updated_at
AFTER UPDATE ON services
FOR EACH ROW
BEGIN
    UPDATE services SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_manicurists_updated_at
AFTER UPDATE ON manicurists
FOR EACH ROW
BEGIN
    UPDATE manicurists SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_schedules_updated_at
AFTER UPDATE ON manicurist_schedules
FOR EACH ROW
BEGIN
    UPDATE manicurist_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_clients_updated_at
AFTER UPDATE ON clients
FOR EACH ROW
BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_appointments_updated_at
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    UPDATE appointments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

INSERT INTO services (id, name, description, price, duration_minutes, icon, image_url, active) VALUES
    (1, 'Manicure Basica', 'Limado, cuticulas, hidratacion y esmalte tradicional.', 15000, 45, 'fas fa-hand-sparkles', 'https://mgx-backend-cdn.metadl.com/generate/images/1059835/2026-04-15/mutla4iaafba/service-basic-manicure.png', 1),
    (2, 'Manicure en Gel', 'Aplicacion de esmalte en gel con lampara UV, duracion hasta 3 semanas.', 25000, 60, 'fas fa-gem', 'https://mgx-backend-cdn.metadl.com/generate/images/1059835/2026-04-15/mutlcuaaafbq/service-gel-nails.png', 1),
    (3, 'Unas Acrilicas', 'Extension y diseno con acrilico, forma y largo a tu gusto.', 35000, 90, 'fas fa-magic', 'https://mgx-backend-cdn.metadl.com/generate/images/1059835/2026-04-15/mutlcjaaae7q/service-nail-art.png', 1),
    (4, 'Nail Art', 'Disenos personalizados, decoraciones, piedras y efectos especiales.', 30000, 75, 'fas fa-paint-brush', 'https://mgx-backend-cdn.metadl.com/generate/images/1059835/2026-04-15/mutlcjaaae7q/service-nail-art.png', 1);

INSERT INTO manicurists (id, name, specialty, emoji, commission_rate, active, blocked) VALUES
    (1, 'Maria Lopez', 'Nail Art & Acrilicas', ':artist:', 0.5, 1, 0),
    (2, 'Ana Garcia', 'Gel & Manicure', ':nails:', 0.5, 1, 0),
    (3, 'Laura Martinez', 'Pedicure & Spa', ':flower:', 0.5, 1, 0);

INSERT INTO manicurist_schedules (manicurist_id, day_key, is_active, start_time, end_time) VALUES
    (1, 'lun', 1, '09:00', '18:00'),
    (1, 'mar', 1, '09:00', '18:00'),
    (1, 'mie', 1, '09:00', '18:00'),
    (1, 'jue', 1, '09:00', '18:00'),
    (1, 'vie', 1, '09:00', '18:00'),
    (1, 'sab', 1, '09:00', '16:00'),
    (1, 'dom', 0, NULL, NULL),
    (2, 'lun', 1, '09:00', '18:00'),
    (2, 'mar', 1, '09:00', '18:00'),
    (2, 'mie', 1, '09:00', '18:00'),
    (2, 'jue', 1, '09:00', '18:00'),
    (2, 'vie', 1, '09:00', '18:00'),
    (2, 'sab', 1, '09:00', '16:00'),
    (2, 'dom', 0, NULL, NULL),
    (3, 'lun', 1, '09:00', '18:00'),
    (3, 'mar', 1, '09:00', '18:00'),
    (3, 'mie', 1, '09:00', '18:00'),
    (3, 'jue', 1, '09:00', '18:00'),
    (3, 'vie', 1, '09:00', '18:00'),
    (3, 'sab', 1, '09:00', '16:00'),
    (3, 'dom', 0, NULL, NULL);

INSERT INTO clients (id, name, phone, email) VALUES
    ('cli-0001', 'Camila Rojas', '+56 9 1111 1111', 'camila.rojas@email.com'),
    ('cli-0002', 'Fernanda Soto', '+56 9 2222 2222', 'fernanda.soto@email.com');

INSERT INTO appointments (
    id,
    client_id,
    service_id,
    manicurist_id,
    client_name,
    client_phone,
    client_email,
    service_name,
    service_price,
    service_duration,
    manicurist_name,
    appointment_date,
    appointment_time,
    status,
    deposit_paid,
    deposit_auth_code,
    remaining_balance
) VALUES
    ('apt-0001', 'cli-0001', 2, 2, 'Camila Rojas', '+56 9 1111 1111', 'camila.rojas@email.com', 'Manicure en Gel', 25000, 60, 'Ana Garcia', '2026-05-05', '10:00 AM', 'confirmed', 7500, 'AUTH01', 17500),
    ('apt-0002', 'cli-0002', 4, 1, 'Fernanda Soto', '+56 9 2222 2222', 'fernanda.soto@email.com', 'Nail Art', 30000, 75, 'Maria Lopez', '2026-05-06', '3:00 PM', 'completed', 9000, 'AUTH02', 21000);

INSERT INTO payments (id, appointment_id, amount, auth_code, card_last4, payment_type, payment_date) VALUES
    ('pay-0001', 'apt-0001', 7500, 'AUTH01', '4242', 'Credito', '5/5/2026 9:15'),
    ('pay-0002', 'apt-0002', 9000, 'AUTH02', '1234', 'Debito', '6/5/2026 14:40');

INSERT INTO manicurist_blocked_slots (manicurist_id, blocked_date, blocked_time, all_day) VALUES
    (1, '2026-05-07', '11:00 AM', 0),
    (2, '2026-05-08', NULL, 1);
