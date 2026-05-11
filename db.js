// ========== DATABASE LAYER (SQLite API) ==========
const API_URL = '/api';

const DEFAULT_SCHEDULE = {
    lun: { active: true, start: '09:00', end: '18:00' },
    mar: { active: true, start: '09:00', end: '18:00' },
    mie: { active: true, start: '09:00', end: '18:00' },
    jue: { active: true, start: '09:00', end: '18:00' },
    vie: { active: true, start: '09:00', end: '18:00' },
    sab: { active: true, start: '09:00', end: '16:00' },
    dom: { active: false, start: '', end: '' }
};

const state = {
    services: [],
    manicurists: [],
    clients: [],
    appointments: [],
    payments: []
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new Error(data?.error || 'Error al conectar con la base de datos');
    }

    return data;
}

function replaceById(collection, item) {
    const index = collection.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
        collection.push(item);
    } else {
        collection[index] = item;
    }
    return item;
}

function removeById(collection, id) {
    const index = collection.findIndex((entry) => String(entry.id) === String(id));
    if (index !== -1) collection.splice(index, 1);
}

function setState(data) {
    state.services = data.services || [];
    state.manicurists = data.manicurists || [];
    state.clients = data.clients || [];
    state.appointments = data.appointments || [];
    state.payments = data.payments || [];
}

// ========== INITIALIZATION ==========
export async function initDatabase() {
    const data = await apiRequest('/state');
    setState(data);
}

export function getDefaultSchedule() {
    return clone(DEFAULT_SCHEDULE);
}

// ========== SERVICES CRUD ==========
export function getServices() {
    return state.services.filter((service) => service.active !== false);
}

export function getActiveServices() {
    return getServices().filter((service) => service.active);
}

export function getServiceById(id) {
    return getServices().find((service) => service.id === Number(id)) || null;
}

export async function createService(service) {
    const created = await apiRequest('/services', {
        method: 'POST',
        body: JSON.stringify(service)
    });
    return replaceById(state.services, created);
}

export async function updateService(id, updates) {
    const updated = await apiRequest(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
    return replaceById(state.services, updated);
}

export async function deleteService(id) {
    await apiRequest(`/services/${id}`, { method: 'DELETE' });
    removeById(state.services, id);
    return true;
}

// ========== MANICURISTS CRUD ==========
export function getManicurists() {
    return state.manicurists.filter((manicurist) => manicurist.active !== false);
}

export function getActiveManicurists() {
    return getManicurists().filter((manicurist) => manicurist.active && !manicurist.blocked);
}

export function getManicuristById(id) {
    return getManicurists().find((manicurist) => manicurist.id === Number(id)) || null;
}

export async function createManicurist(manicurist) {
    const created = await apiRequest('/manicurists', {
        method: 'POST',
        body: JSON.stringify(manicurist)
    });
    return replaceById(state.manicurists, created);
}

export async function updateManicurist(id, updates) {
    const updated = await apiRequest(`/manicurists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
    return replaceById(state.manicurists, updated);
}

export async function deleteManicurist(id) {
    await apiRequest(`/manicurists/${id}`, { method: 'DELETE' });
    removeById(state.manicurists, id);
    return true;
}

export async function toggleManicuristBlock(id) {
    const updated = await apiRequest(`/manicurists/${id}/toggle-block`, { method: 'PATCH' });
    return replaceById(state.manicurists, updated);
}

export async function updateManicuristSchedule(id, schedule) {
    const updated = await apiRequest(`/manicurists/${id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ schedule })
    });
    return replaceById(state.manicurists, updated);
}

export async function addBlockedSlot(manicuristId, slot) {
    const updated = await apiRequest(`/manicurists/${manicuristId}/blocked-slots`, {
        method: 'POST',
        body: JSON.stringify(slot)
    });
    return replaceById(state.manicurists, updated);
}

export async function removeBlockedSlot(manicuristId, slotIndex) {
    const manicurist = getManicuristById(manicuristId);
    const slot = manicurist?.blockedSlots?.[slotIndex];
    if (!slot) return manicurist || null;

    const updated = await apiRequest(`/manicurists/${manicuristId}/blocked-slots/${slot.id}`, {
        method: 'DELETE'
    });
    return replaceById(state.manicurists, updated);
}

export function getManicuristAvailableSlots(manicuristId, dateStr) {
    const manicurist = getManicuristById(manicuristId);
    if (!manicurist || manicurist.blocked) return [];

    const date = new Date(dateStr + 'T12:00:00');
    const dayMap = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const dayKey = dayMap[date.getDay()];
    const daySchedule = manicurist.schedule ? manicurist.schedule[dayKey] : null;

    if (!daySchedule || !daySchedule.active) return [];

    const allSlots = [
        '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
    ];

    function timeToMinutes(time) {
        if (!time) return 0;
        const [hour, minute] = time.split(':').map(Number);
        return hour * 60 + (minute || 0);
    }

    function slotToMinutes(slot) {
        const parts = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!parts) return 0;
        let hour = Number(parts[1]);
        const minute = Number(parts[2]);
        const period = parts[3].toUpperCase();
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
    }

    const startMin = timeToMinutes(daySchedule.start);
    const endMin = timeToMinutes(daySchedule.end);

    let available = allSlots.filter((slot) => {
        const slotMin = slotToMinutes(slot);
        return slotMin >= startMin && slotMin < endMin;
    });

    if (manicurist.blockedSlots) {
        const dayBlocked = manicurist.blockedSlots.filter((slot) => slot.date === dateStr);
        if (dayBlocked.some((slot) => slot.allDay)) return [];
        const blockedTimes = dayBlocked.map((slot) => slot.time);
        available = available.filter((slot) => !blockedTimes.includes(slot));
    }

    return available;
}

// ========== CLIENTS CRUD ==========
export function getClients() {
    return state.clients;
}

export function getClientById(id) {
    return getClients().find((client) => client.id === id) || null;
}

export function findClientByPhone(phone) {
    return getClients().find((client) => client.phone === phone) || null;
}

export async function createClient(client) {
    const created = await apiRequest('/clients', {
        method: 'POST',
        body: JSON.stringify(client)
    });
    return replaceById(state.clients, created);
}

export async function updateClient(id, updates) {
    const client = getClientById(id);
    if (!client) return null;
    return replaceById(state.clients, { ...client, ...updates });
}

export async function deleteClient(id) {
    removeById(state.clients, id);
    return true;
}

// ========== APPOINTMENTS CRUD ==========
export function getAppointments() {
    return state.appointments;
}

export function getAppointmentById(id) {
    return getAppointments().find((appointment) => appointment.id === id) || null;
}

export function getAppointmentsByManicurist(manicuristId) {
    return getAppointments().filter((appointment) => appointment.manicuristId === Number(manicuristId));
}

export function getAppointmentsByClient(clientId) {
    return getAppointments().filter((appointment) => appointment.clientId === clientId);
}

export function getAppointmentsByDate(date) {
    return getAppointments().filter((appointment) => appointment.date === date);
}

export function getBookedSlots(date, manicuristId) {
    return getAppointments()
        .filter((appointment) =>
            appointment.date === date &&
            appointment.manicuristId === Number(manicuristId) &&
            appointment.status !== 'cancelled'
        )
        .map((appointment) => appointment.time);
}

export async function createAppointment(appointment) {
    const created = await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointment)
    });
    return replaceById(state.appointments, created);
}

export async function updateAppointmentStatus(id, status) {
    const updated = await apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    });
    return replaceById(state.appointments, updated);
}

export async function deleteAppointment(id) {
    await apiRequest(`/appointments/${id}`, { method: 'DELETE' });
    removeById(state.appointments, id);
    return true;
}

// ========== PAYMENTS CRUD ==========
export function getPayments() {
    return state.payments;
}

export function getPaymentByAppointmentId(appointmentId) {
    return getPayments().find((payment) => payment.appointmentId === appointmentId) || null;
}

export async function createPayment(payment) {
    const created = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify(payment)
    });
    return replaceById(state.payments, created);
}

// ========== STATISTICS ==========
export function getStats(manicuristId) {
    let appointments = getAppointments();
    if (manicuristId && manicuristId !== 'all') {
        appointments = appointments.filter((appointment) => appointment.manicuristId === Number(manicuristId));
    }

    const totalAppointments = appointments.length;
    const totalMinutes = appointments.reduce((sum, appointment) => sum + (appointment.serviceDuration || 0), 0);
    const totalHours = totalMinutes / 60;
    const totalEarnings = appointments.reduce((sum, appointment) => sum + (appointment.servicePrice || 0), 0);
    const totalDeposits = appointments.reduce((sum, appointment) => sum + (appointment.depositPaid || 0), 0);
    const totalPending = appointments.reduce((sum, appointment) => sum + (appointment.remainingBalance || 0), 0);

    return {
        totalAppointments,
        totalHours: totalHours.toFixed(1),
        totalEarnings,
        totalDeposits,
        totalPending,
        totalManicurists: getActiveManicurists().length,
        totalClients: getClients().length
    };
}

export function getManicuristStats(manicuristId) {
    const manicurist = getManicuristById(manicuristId);
    if (!manicurist) return null;

    const appointments = getAppointmentsByManicurist(manicuristId);
    const totalServices = appointments.length;
    const totalMinutes = appointments.reduce((sum, appointment) => sum + (appointment.serviceDuration || 0), 0);
    const totalRevenue = appointments.reduce((sum, appointment) => sum + (appointment.servicePrice || 0), 0);
    const commission = totalRevenue * manicurist.commission;

    return {
        manicurist,
        totalServices,
        totalHours: (totalMinutes / 60).toFixed(1),
        totalRevenue,
        commission: Math.round(commission)
    };
}

// ========== RESET ==========
export async function resetDatabase() {
    await initDatabase();
}
