// ========== IMPORTS ==========
import {
    initDatabase, getDefaultSchedule,
    getActiveServices, getServiceById, getServices, createService, updateService, deleteService,
    getActiveManicurists, getManicurists, getManicuristById, createManicurist, updateManicurist, deleteManicurist,
    toggleManicuristBlock, updateManicuristSchedule, addBlockedSlot, removeBlockedSlot, getManicuristAvailableSlots,
    createClient, getClients, getAppointmentsByClient,
    getAppointments, createAppointment, updateAppointmentStatus, deleteAppointment as dbDeleteAppointment,
    getBookedSlots, createPayment, getStats, getManicuristStats
} from './db.js';

// ========== CONSTANTS ==========
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WHATSAPP_NUMBER = '56912345678';
const ADMIN_CREDENTIALS = { user: 'admin', pass: 'admin123' };
const DEPOSIT_PERCENTAGE = 0.30;

// ========== STATE ==========
let currentPage = 'home';
let bookingStep = 1;
let selectedService = null;
let selectedManicurist = null;
let selectedDate = null;
let selectedTime = null;
let currentWeekStart = getMonday(new Date());
let isAdminLoggedIn = false;
let currentPaymentType = 'credit';
let lastPaymentInfo = null;
let currentAdminTab = 'overview';

// ========== FORMAT HELPERS ==========
function formatCLP(amount) {
    return '$' + amount.toLocaleString('es-CL');
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await initDatabase();
        renderHomeServices();
        renderFullServices();
        renderBookingServices();
        renderManicurists();
        renderWeek();
        setupNavigation();
        setupBookingNav();
        setupAdminLogin();
        setupWeekNav();
        setupMobileMenu();
        setupWebpayModal();
        setupAdminTabs();
        setupServiceModal();
        setupManicuristModal();
        setupScheduleModal();
        setupBlockSlotModal();
    } catch (error) {
        console.error(error);
        showToast('No se pudo conectar con SQLite. Inicia el servidor local.', 'error');
    }
});

// ========== NAVIGATION ==========
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navigateTo(this.dataset.page);
        });
    });
    document.getElementById('heroBookBtn').addEventListener('click', () => navigateTo('booking'));
    document.getElementById('viewAllServicesBtn').addEventListener('click', () => navigateTo('services'));
}

function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    const targetLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (targetLink) targetLink.classList.add('active');

    document.getElementById('mainNav').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.navigateTo = navigateTo;

function setupMobileMenu() {
    document.getElementById('mobileMenuBtn').addEventListener('click', function () {
        document.getElementById('mainNav').classList.toggle('open');
    });
}

// ========== HOME SERVICES ==========
function renderHomeServices() {
    const grid = document.getElementById('homeServicesGrid');
    const services = getActiveServices();
    grid.innerHTML = services.slice(0, 3).map(s => createServiceCard(s)).join('');
}

function renderFullServices() {
    const grid = document.getElementById('servicesFullGrid');
    const services = getActiveServices();
    grid.innerHTML = services.map(s => createServiceCard(s)).join('');
}

function createServiceCard(service) {
    return `
        <div class="service-card" onclick="navigateTo('booking')">
            <img src="${service.image}" alt="${service.name}" class="service-card-img" loading="lazy">
            <div class="service-card-body">
                <h3>${service.name}</h3>
                <p>${service.description}</p>
                <div class="service-meta">
                    <span class="service-price">${formatCLP(service.price)}</span>
                    <span class="service-duration"><i class="fas fa-clock"></i> ${service.duration} min</span>
                </div>
            </div>
        </div>
    `;
}

// ========== BOOKING: SERVICES ==========
function renderBookingServices() {
    const grid = document.getElementById('bookingServiceGrid');
    const services = getActiveServices();
    grid.innerHTML = services.map(s => `
        <div class="service-select-card" data-id="${s.id}">
            <div class="service-icon"><i class="${s.icon}"></i></div>
            <h4>${s.name}</h4>
            <span class="price">${formatCLP(s.price)}</span>
            <div class="duration"><i class="fas fa-clock"></i> ${s.duration} min</div>
        </div>
    `).join('');

    grid.querySelectorAll('.service-select-card').forEach(card => {
        card.addEventListener('click', function () {
            selectService(parseInt(this.dataset.id));
        });
    });
}

function selectService(id) {
    selectedService = getServiceById(id);
    document.querySelectorAll('.service-select-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.service-select-card[data-id="${id}"]`);
    if (card) card.classList.add('selected');
    updateSummary();
}

// ========== BOOKING: MANICURISTS ==========
function renderManicurists() {
    const grid = document.getElementById('manicuristGrid');
    const manicurists = getActiveManicurists();
    grid.innerHTML = manicurists.map(m => `
        <div class="manicurist-card" data-id="${m.id}">
            <div class="manicurist-avatar">${m.emoji}</div>
            <h4>${m.name}</h4>
            <p>${m.specialty}</p>
        </div>
    `).join('');

    grid.querySelectorAll('.manicurist-card').forEach(card => {
        card.addEventListener('click', function () {
            selectManicurist(parseInt(this.dataset.id));
        });
    });
}

function selectManicurist(id) {
    selectedManicurist = getManicuristById(id);
    document.querySelectorAll('.manicurist-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.manicurist-card[data-id="${id}"]`);
    if (card) card.classList.add('selected');
    // Reset date/time when manicurist changes
    selectedDate = null;
    selectedTime = null;
    renderWeek();
    document.getElementById('timeSlotsContainer').innerHTML = '<p class="hint-text">Selecciona un día para ver los horarios disponibles</p>';
    updateSummary();
}

// ========== BOOKING: CALENDAR ==========
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function setupWeekNav() {
    document.getElementById('prevWeekBtn').addEventListener('click', function () {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderWeek();
    });
    document.getElementById('nextWeekBtn').addEventListener('click', function () {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderWeek();
    });
}

function renderWeek() {
    const grid = document.getElementById('weekGrid');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 5);

    document.getElementById('weekLabel').textContent =
        `${currentWeekStart.getDate()} ${MONTH_NAMES[currentWeekStart.getMonth()]} - ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

    let html = '';
    for (let i = 0; i < 6; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const isPast = date < today;
        const isSunday = date.getDay() === 0;

        // Check if manicurist works this day
        let manicuristOff = false;
        if (selectedManicurist) {
            const dayKey = DAY_KEYS[date.getDay()];
            const schedule = selectedManicurist.schedule;
            if (schedule && schedule[dayKey] && !schedule[dayKey].active) {
                manicuristOff = true;
            }
        }

        const disabled = isPast || isSunday || manicuristOff;
        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

        html += `
            <div class="day-card ${disabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}"
                 data-date="${date.toISOString()}" ${manicuristOff ? 'title="Manicurista no trabaja este día"' : ''}>
                <div class="day-name">${DAY_NAMES[date.getDay()]}</div>
                <div class="day-number">${date.getDate()}</div>
                <div class="day-month">${MONTH_NAMES[date.getMonth()]}</div>
            </div>
        `;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.day-card:not(.disabled)').forEach(card => {
        card.addEventListener('click', function () {
            selectDate(this.dataset.date);
        });
    });
}

function selectDate(isoString) {
    selectedDate = new Date(isoString);
    renderWeek();
    renderTimeSlots();
    updateSummary();
}

function renderTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    if (!selectedDate || !selectedManicurist) {
        container.innerHTML = '<p class="hint-text">Selecciona un día para ver los horarios disponibles</p>';
        return;
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const bookedSlots = getBookedSlots(dateStr, selectedManicurist.id);

    // Use the new schedule-aware available slots
    const availableSlots = getManicuristAvailableSlots(selectedManicurist.id, dateStr);

    if (availableSlots.length === 0) {
        container.innerHTML = '<p class="hint-text">No hay horarios disponibles para este día</p>';
        return;
    }

    const html = `
        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">
            Horarios disponibles - ${DAY_NAMES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}
        </h4>
        <div class="time-slots-grid">
            ${availableSlots.map(slot => {
                const isBooked = bookedSlots.includes(slot);
                const isSelected = selectedTime === slot;
                return `
                    <div class="time-slot ${isBooked ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}"
                         data-time="${slot}">
                        ${slot}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    container.innerHTML = html;

    container.querySelectorAll('.time-slot:not(.unavailable)').forEach(slot => {
        slot.addEventListener('click', function () {
            selectTime(this.dataset.time);
        });
    });
}

function selectTime(time) {
    selectedTime = time;
    renderTimeSlots();
    updateSummary();
}

// ========== BOOKING: NAVIGATION ==========
function setupBookingNav() {
    document.getElementById('nextStepBtn').addEventListener('click', nextStep);
    document.getElementById('prevStepBtn').addEventListener('click', prevStep);
}

function nextStep() {
    if (bookingStep === 1 && !selectedService) {
        showToast('Por favor selecciona un servicio', 'error');
        return;
    }
    if (bookingStep === 2 && !selectedManicurist) {
        showToast('Por favor selecciona una manicurista', 'error');
        return;
    }
    if (bookingStep === 3 && (!selectedDate || !selectedTime)) {
        showToast('Por favor selecciona día y hora', 'error');
        return;
    }
    if (bookingStep === 4) {
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        if (!name || !phone) {
            showToast('Por favor completa nombre y teléfono', 'error');
            return;
        }
    }

    if (bookingStep < 5) {
        bookingStep++;
        updateBookingSteps();
        if (bookingStep === 5) {
            updatePaymentInfo();
        }
    }
}

function prevStep() {
    if (bookingStep > 1) {
        bookingStep--;
        updateBookingSteps();
    }
}

function updateBookingSteps() {
    document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
    const step = document.getElementById('step-' + bookingStep);
    if (step) step.classList.add('active');

    document.querySelectorAll('.progress-step').forEach(ps => {
        const stepNum = parseInt(ps.dataset.step);
        ps.classList.toggle('active', stepNum <= bookingStep);
        ps.classList.toggle('completed', stepNum < bookingStep);
    });

    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');

    prevBtn.style.display = bookingStep > 1 ? 'inline-flex' : 'none';
    nextBtn.style.display = bookingStep < 5 ? 'inline-flex' : 'none';

    const summary = document.getElementById('bookingSummary');
    summary.classList.toggle('visible', bookingStep >= 2);

    updateSummary();
}

function updatePaymentInfo() {
    if (!selectedService) return;
    const total = selectedService.price;
    const deposit = Math.ceil(total * DEPOSIT_PERCENTAGE);
    const remaining = total - deposit;

    document.getElementById('payServiceName').textContent = selectedService.name;
    document.getElementById('payTotalPrice').textContent = formatCLP(total);
    document.getElementById('payDepositAmount').textContent = formatCLP(deposit);
    document.getElementById('payRemainingAmount').textContent = formatCLP(remaining);
}

function updateSummary() {
    const details = document.getElementById('summaryDetails');
    let html = '';

    if (selectedService) {
        html += `<div class="summary-row"><span>Servicio:</span><span>${selectedService.name}</span></div>`;
    }
    if (selectedManicurist) {
        html += `<div class="summary-row"><span>Manicurista:</span><span>${selectedManicurist.name}</span></div>`;
    }
    if (selectedDate) {
        html += `<div class="summary-row"><span>Fecha:</span><span>${DAY_NAMES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}</span></div>`;
    }
    if (selectedTime) {
        html += `<div class="summary-row"><span>Hora:</span><span>${selectedTime}</span></div>`;
    }
    if (selectedService) {
        const deposit = Math.ceil(selectedService.price * DEPOSIT_PERCENTAGE);
        html += `<div class="summary-row"><span>Total:</span><span>${formatCLP(selectedService.price)}</span></div>`;
        html += `<div class="summary-row summary-highlight"><span>Abono (30%):</span><span>${formatCLP(deposit)}</span></div>`;
    }

    details.innerHTML = html;
}

// ========== WEBPAY MODAL ==========
function setupWebpayModal() {
    document.getElementById('payWithWebpayBtn').addEventListener('click', openWebpayModal);
    document.getElementById('closeWebpayModal').addEventListener('click', closeWebpayModal);

    document.getElementById('webpayModal').addEventListener('click', function (e) {
        if (e.target === this) closeWebpayModal();
    });

    document.getElementById('webpayForm').addEventListener('submit', function (e) {
        e.preventDefault();
        processWebpayPayment();
    });

    document.getElementById('cardNumber').addEventListener('input', formatCardNumber);
    document.getElementById('cardExpiry').addEventListener('input', formatExpiry);
    document.getElementById('cardCvv').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
    });

    document.getElementById('tabCredit').addEventListener('click', () => selectPaymentType('credit'));
    document.getElementById('tabDebit').addEventListener('click', () => selectPaymentType('debit'));

    document.getElementById('successWhatsappBtn').addEventListener('click', function () {
        confirmViaWhatsapp(lastPaymentInfo);
    });
}

function openWebpayModal() {
    if (!selectedService) return;

    const deposit = Math.ceil(selectedService.price * DEPOSIT_PERCENTAGE);
    const orderNum = '#' + Date.now().toString().slice(-6);

    document.getElementById('webpayAmountDisplay').textContent = formatCLP(deposit);
    document.getElementById('webpayOrderNumber').textContent = orderNum;
    document.getElementById('webpayPayBtnAmount').textContent = formatCLP(deposit);

    document.getElementById('webpayFormContainer').style.display = 'block';
    document.getElementById('webpayProcessing').style.display = 'none';
    document.getElementById('webpaySuccess').style.display = 'none';

    document.getElementById('webpayForm').reset();
    document.getElementById('webpayModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeWebpayModal() {
    document.getElementById('webpayModal').classList.remove('active');
    document.body.style.overflow = '';
}

function selectPaymentType(type) {
    currentPaymentType = type;
    document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.payment-tab[data-type="${type}"]`).classList.add('active');
    document.getElementById('installmentsGroup').style.display = type === 'debit' ? 'none' : 'block';
}

function formatCardNumber(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
    }
    e.target.value = formatted;

    const icon = document.getElementById('cardBrandIcon');
    if (value.startsWith('4')) {
        icon.className = 'fab fa-cc-visa card-brand-icon';
    } else if (value.startsWith('5') || value.startsWith('2')) {
        icon.className = 'fab fa-cc-mastercard card-brand-icon';
    } else {
        icon.className = 'fas fa-credit-card card-brand-icon';
    }
}

function formatExpiry(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    e.target.value = value;
}

function processWebpayPayment() {
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const expiry = document.getElementById('cardExpiry').value;
    const cvv = document.getElementById('cardCvv').value;
    const cardName = document.getElementById('cardName').value.trim();

    if (cardNumber.length < 13) { showToast('Número de tarjeta inválido', 'error'); return; }
    if (!expiry || expiry.length < 5) { showToast('Fecha de vencimiento inválida', 'error'); return; }
    if (cvv.length < 3) { showToast('CVV inválido', 'error'); return; }
    if (!cardName) { showToast('Ingresa el nombre en la tarjeta', 'error'); return; }

    document.getElementById('webpayFormContainer').style.display = 'none';
    document.getElementById('webpayProcessing').style.display = 'block';

    setTimeout(async function () {
        try {
        const deposit = Math.ceil(selectedService.price * DEPOSIT_PERCENTAGE);
        const authCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

        lastPaymentInfo = {
            authCode,
            amount: deposit,
            date: dateStr,
            cardLast4: cardNumber.slice(-4),
            type: currentPaymentType === 'credit' ? 'Crédito' : 'Débito'
        };

        const clientName = document.getElementById('clientName').value.trim();
        const clientPhone = document.getElementById('clientPhone').value.trim();
        const clientEmail = document.getElementById('clientEmail').value.trim();

        const client = await createClient({ name: clientName, phone: clientPhone, email: clientEmail });

        const appointment = await createAppointment({
            clientId: client.id,
            clientName, clientPhone, clientEmail,
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            servicePrice: selectedService.price,
            serviceDuration: selectedService.duration,
            manicuristId: selectedManicurist.id,
            manicuristName: selectedManicurist.name,
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime,
            status: 'confirmed',
            depositPaid: deposit,
            depositAuthCode: authCode,
            remainingBalance: selectedService.price - deposit
        });

        await createPayment({
            appointmentId: appointment.id,
            amount: deposit, authCode,
            cardLast4: cardNumber.slice(-4),
            type: currentPaymentType === 'credit' ? 'Crédito' : 'Débito',
            date: dateStr
        });

        document.getElementById('webpayProcessing').style.display = 'none';
        document.getElementById('webpaySuccess').style.display = 'block';
        document.getElementById('authCode').textContent = authCode;
        document.getElementById('paidAmount').textContent = formatCLP(deposit);
        document.getElementById('paymentDate').textContent = dateStr;
        renderTimeSlots();
        renderAdminDashboard();

        } catch (error) {
            console.error(error);
            document.getElementById('webpayProcessing').style.display = 'none';
            document.getElementById('webpayFormContainer').style.display = 'block';
            showToast(error.message || 'No se pudo guardar la cita', 'error');
        }
    }, 2500);
}

// ========== WHATSAPP ==========
function confirmViaWhatsapp(paymentInfo) {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const email = document.getElementById('clientEmail').value.trim();

    if (!name || !phone) {
        showToast('Por favor completa nombre y teléfono', 'error');
        return;
    }

    const deposit = Math.ceil(selectedService.price * DEPOSIT_PERCENTAGE);
    const dateFormatted = `${DAY_NAMES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

    const message = encodeURIComponent(
        `✨ *NUEVA CITA - Glamour Nails* ✨\n\n` +
        `👤 *Cliente:* ${name}\n` +
        `📱 *Teléfono:* ${phone}\n` +
        `${email ? `📧 *Email:* ${email}\n` : ''}` +
        `💅 *Servicio:* ${selectedService.name}\n` +
        `💰 *Precio Total:* ${formatCLP(selectedService.price)}\n` +
        `✅ *Abono Pagado (Webpay):* ${formatCLP(deposit)}\n` +
        `💳 *Código Autorización:* ${paymentInfo ? paymentInfo.authCode : 'N/A'}\n` +
        `🏷 *Saldo Pendiente:* ${formatCLP(selectedService.price - deposit)}\n` +
        `⏱ *Duración:* ${selectedService.duration} min\n` +
        `👩‍🎨 *Manicurista:* ${selectedManicurist.name}\n` +
        `📅 *Fecha:* ${dateFormatted}\n` +
        `🕐 *Hora:* ${selectedTime}\n\n` +
        `¡Pago confirmado! Te esperamos. 💖`
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
    showToast('¡Cita confirmada y abono pagado! 🎉', 'success');
    closeWebpayModal();
    resetBooking();
}

function resetBooking() {
    selectedService = null;
    selectedManicurist = null;
    selectedDate = null;
    selectedTime = null;
    bookingStep = 1;
    lastPaymentInfo = null;

    document.querySelectorAll('.service-select-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.manicurist-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('clientForm').reset();
    document.getElementById('timeSlotsContainer').innerHTML = '<p class="hint-text">Selecciona un día para ver los horarios disponibles</p>';

    updateBookingSteps();
    renderWeek();
}

// ========== ADMIN ==========
function setupAdminLogin() {
    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const user = document.getElementById('adminUser').value.trim();
        const pass = document.getElementById('adminPass').value.trim();

        if (user === ADMIN_CREDENTIALS.user && pass === ADMIN_CREDENTIALS.pass) {
            isAdminLoggedIn = true;
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            renderAdminDashboard();
            showToast('Bienvenido al panel de administración', 'success');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
        isAdminLoggedIn = false;
        document.getElementById('adminLogin').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('loginForm').reset();
    });

    document.getElementById('filterManicurist').addEventListener('change', function () {
        renderAdminDashboard();
    });

    document.getElementById('filterAppointmentStatus').addEventListener('change', function () {
        renderAppointmentsTable();
    });
}

function setupAdminTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            currentAdminTab = this.dataset.tab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('tab-' + currentAdminTab).classList.add('active');

            if (currentAdminTab === 'appointments') renderAppointmentsTable();
            if (currentAdminTab === 'manage-services') renderManageServices();
            if (currentAdminTab === 'manage-manicurists') renderManageManicurists();
            if (currentAdminTab === 'clients') renderClientsTable();
        });
    });
}

function renderAdminDashboard() {
    const filter = document.getElementById('filterManicurist').value;
    const stats = getStats(filter);

    const filterSelect = document.getElementById('filterManicurist');
    // Rebuild options
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">Todas</option>';
    getManicurists().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name + (m.blocked ? ' (Bloqueada)' : '');
        filterSelect.appendChild(opt);
    });
    filterSelect.value = currentVal || 'all';

    document.getElementById('totalAppointments').textContent = stats.totalAppointments;
    document.getElementById('totalHours').textContent = stats.totalHours;
    document.getElementById('totalEarnings').textContent = formatCLP(stats.totalEarnings);
    document.getElementById('totalClients').textContent = stats.totalClients;

    renderManicuristReports(filter);
}

function renderManicuristReports(filter) {
    const container = document.getElementById('manicuristReports');
    const manicurists = getManicurists().filter(m => m.active);
    const manicuristsToShow = filter === 'all'
        ? manicurists
        : manicurists.filter(m => m.id === parseInt(filter));

    container.innerHTML = manicuristsToShow.map(m => {
        const stats = getManicuristStats(m.id);
        if (!stats) return '';

        return `
            <div class="report-card ${m.blocked ? 'report-card-blocked' : ''}">
                <div class="report-card-header">
                    <div class="report-avatar">${m.emoji}</div>
                    <div>
                        <h4>${m.name} ${m.blocked ? '<span class="badge-blocked">Bloqueada</span>' : ''}</h4>
                        <p>${m.specialty}</p>
                    </div>
                </div>
                <div class="report-stats">
                    <div class="report-stat">
                        <span class="value">${stats.totalServices}</span>
                        <span class="label">Servicios</span>
                    </div>
                    <div class="report-stat">
                        <span class="value">${stats.totalHours}h</span>
                        <span class="label">Horas</span>
                    </div>
                    <div class="report-stat">
                        <span class="value">${formatCLP(stats.totalRevenue)}</span>
                        <span class="label">Ingresos</span>
                    </div>
                    <div class="report-stat">
                        <span class="value">${formatCLP(stats.commission)}</span>
                        <span class="label">Comisión (${m.commission * 100}%)</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAppointmentsTable() {
    const tbody = document.getElementById('appointmentsTableBody');
    const emptyMsg = document.getElementById('emptyMessage');
    const statusFilter = document.getElementById('filterAppointmentStatus').value;

    let allAppointments = getAppointments();
    if (statusFilter !== 'all') {
        allAppointments = allAppointments.filter(a => a.status === statusFilter);
    }

    if (allAppointments.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    const sorted = [...allAppointments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = sorted.map(a => {
        const statusClass = a.status === 'confirmed' ? 'status-confirmed'
            : a.status === 'completed' ? 'status-completed'
            : 'status-cancelled';
        const statusText = a.status === 'confirmed' ? 'Confirmada'
            : a.status === 'completed' ? 'Completada'
            : 'Cancelada';

        return `
            <tr>
                <td>${a.date}</td>
                <td>${a.time}</td>
                <td>${a.clientName}</td>
                <td>${a.clientPhone || '-'}</td>
                <td>${a.serviceName}</td>
                <td>${a.manicuristName}</td>
                <td>${formatCLP(a.servicePrice)}</td>
                <td>${a.depositPaid ? formatCLP(a.depositPaid) : '-'}</td>
                <td>${a.remainingBalance !== undefined ? formatCLP(a.remainingBalance) : '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    ${a.status === 'confirmed' ? `<button class="btn btn-success btn-action" data-action="complete" data-id="${a.id}" title="Completar"><i class="fas fa-check-double"></i></button>` : ''}
                    <button class="btn btn-danger btn-action" data-action="delete" data-id="${a.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-action="complete"]').forEach(btn => {
        btn.addEventListener('click', async function () {
            await updateAppointmentStatus(this.dataset.id, 'completed');
            renderAppointmentsTable();
            renderAdminDashboard();
            showToast('Cita marcada como completada', 'success');
        });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async function () {
            if (confirm('¿Estás seguro de eliminar esta cita?')) {
                await dbDeleteAppointment(this.dataset.id);
                renderAppointmentsTable();
                renderAdminDashboard();
                showToast('Cita eliminada', 'success');
            }
        });
    });
}

// ========== ADMIN: MANAGE SERVICES ==========
function setupServiceModal() {
    document.getElementById('addServiceBtn').addEventListener('click', function () {
        document.getElementById('serviceModalTitle').textContent = 'Agregar Servicio';
        document.getElementById('serviceForm').reset();
        document.getElementById('svcEditId').value = '';
        document.getElementById('svcIcon').value = 'fas fa-hand-sparkles';
        document.getElementById('serviceModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    document.getElementById('closeServiceModal').addEventListener('click', function () {
        document.getElementById('serviceModal').classList.remove('active');
        document.body.style.overflow = '';
    });

    document.getElementById('serviceModal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.getElementById('serviceForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const editId = document.getElementById('svcEditId').value;
        const serviceData = {
            name: document.getElementById('svcName').value.trim(),
            description: document.getElementById('svcDescription').value.trim(),
            price: parseInt(document.getElementById('svcPrice').value),
            duration: parseInt(document.getElementById('svcDuration').value),
            icon: document.getElementById('svcIcon').value.trim() || 'fas fa-hand-sparkles',
            image: 'https://mgx-backend-cdn.metadl.com/generate/images/1059835/2026-04-15/mutla4iaafba/service-basic-manicure.png'
        };

        if (editId) {
            await updateService(parseInt(editId), serviceData);
            showToast('Servicio actualizado', 'success');
        } else {
            await createService(serviceData);
            showToast('Servicio creado', 'success');
        }

        document.getElementById('serviceModal').classList.remove('active');
        document.body.style.overflow = '';
        renderManageServices();
        renderHomeServices();
        renderFullServices();
        renderBookingServices();
    });
}

function renderManageServices() {
    const grid = document.getElementById('manageServicesGrid');
    const services = getServices();

    grid.innerHTML = services.map(s => `
        <div class="manage-service-card ${!s.active ? 'inactive' : ''}">
            <div class="manage-service-icon"><i class="${s.icon}"></i></div>
            <div class="manage-service-info">
                <h4>${s.name}</h4>
                <p>${s.description}</p>
                <div class="manage-service-meta">
                    <span>${formatCLP(s.price)}</span>
                    <span><i class="fas fa-clock"></i> ${s.duration} min</span>
                </div>
            </div>
            <div class="manage-service-actions">
                <button class="btn btn-sm" data-edit="${s.id}" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-action" data-delete-svc="${s.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.dataset.edit);
            const service = getServiceById(id);
            if (!service) return;

            document.getElementById('serviceModalTitle').textContent = 'Editar Servicio';
            document.getElementById('svcEditId').value = id;
            document.getElementById('svcName').value = service.name;
            document.getElementById('svcDescription').value = service.description;
            document.getElementById('svcPrice').value = service.price;
            document.getElementById('svcDuration').value = service.duration;
            document.getElementById('svcIcon').value = service.icon;
            document.getElementById('serviceModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    grid.querySelectorAll('[data-delete-svc]').forEach(btn => {
        btn.addEventListener('click', async function () {
            if (confirm('¿Estás seguro de eliminar este servicio?')) {
                await deleteService(parseInt(this.dataset.deleteSvc));
                renderManageServices();
                renderHomeServices();
                renderFullServices();
                renderBookingServices();
                showToast('Servicio eliminado', 'success');
            }
        });
    });
}

// ========== ADMIN: MANAGE MANICURISTS ==========
function setupManicuristModal() {
    document.getElementById('addManicuristBtn').addEventListener('click', function () {
        document.getElementById('maniModalTitle').textContent = 'Agregar Manicurista';
        document.getElementById('manicuristForm').reset();
        document.getElementById('maniEditId').value = '';
        document.getElementById('maniEmoji').value = '💅';
        document.getElementById('maniCommission').value = '50';
        document.getElementById('manicuristModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    document.getElementById('closeManicuristModal').addEventListener('click', function () {
        document.getElementById('manicuristModal').classList.remove('active');
        document.body.style.overflow = '';
    });

    document.getElementById('manicuristModal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.getElementById('manicuristForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const editId = document.getElementById('maniEditId').value;
        const data = {
            name: document.getElementById('maniName').value.trim(),
            specialty: document.getElementById('maniSpecialty').value.trim(),
            emoji: document.getElementById('maniEmoji').value.trim() || '💅',
            commission: parseInt(document.getElementById('maniCommission').value) / 100
        };

        if (editId) {
            await updateManicurist(parseInt(editId), data);
            showToast('Manicurista actualizada', 'success');
        } else {
            await createManicurist(data);
            showToast('Manicurista agregada', 'success');
        }

        document.getElementById('manicuristModal').classList.remove('active');
        document.body.style.overflow = '';
        renderManageManicurists();
        renderManicurists();
        renderAdminDashboard();
    });
}

function setupScheduleModal() {
    document.getElementById('closeScheduleModal').addEventListener('click', function () {
        document.getElementById('scheduleModal').classList.remove('active');
        document.body.style.overflow = '';
    });

    document.getElementById('scheduleModal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.getElementById('saveScheduleBtn').addEventListener('click', async function () {
        const mId = parseInt(document.getElementById('scheduleManicuristId').value);
        const schedule = {};

        DAY_KEYS.forEach((key, i) => {
            const active = document.getElementById('sched_' + key + '_active').checked;
            const start = document.getElementById('sched_' + key + '_start').value;
            const end = document.getElementById('sched_' + key + '_end').value;
            schedule[key] = { active, start: active ? start : '', end: active ? end : '' };
        });

        await updateManicuristSchedule(mId, schedule);
        showToast('Horario actualizado', 'success');
        document.getElementById('scheduleModal').classList.remove('active');
        document.body.style.overflow = '';
        renderManageManicurists();
        renderManicurists();
    });
}

function setupBlockSlotModal() {
    document.getElementById('closeBlockSlotModal').addEventListener('click', function () {
        document.getElementById('blockSlotModal').classList.remove('active');
        document.body.style.overflow = '';
    });

    document.getElementById('blockSlotModal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.getElementById('blockSlotAllDay').addEventListener('change', function () {
        document.getElementById('blockSlotTimeGroup').style.display = this.checked ? 'none' : 'block';
    });

    document.getElementById('blockSlotForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const mId = parseInt(document.getElementById('blockSlotManicuristId').value);
        const date = document.getElementById('blockSlotDate').value;
        const allDay = document.getElementById('blockSlotAllDay').checked;
        const time = document.getElementById('blockSlotTime').value;

        if (!date) { showToast('Selecciona una fecha', 'error'); return; }
        if (!allDay && !time) { showToast('Selecciona una hora', 'error'); return; }

        const slot = allDay ? { date, allDay: true } : { date, time };
        await addBlockedSlot(mId, slot);
        showToast('Bloqueo agregado', 'success');

        renderBlockedSlotsList(mId);
    });
}

function openScheduleModal(manicuristId) {
    const m = getManicuristById(manicuristId);
    if (!m) return;

    document.getElementById('scheduleManicuristId').value = m.id;
    document.getElementById('scheduleManicuristName').textContent = m.name;

    const schedule = m.schedule || getDefaultSchedule();

    DAY_KEYS.forEach((key) => {
        const day = schedule[key] || { active: false, start: '9:00', end: '18:00' };
        document.getElementById('sched_' + key + '_active').checked = day.active;
        document.getElementById('sched_' + key + '_start').value = day.start || '9:00';
        document.getElementById('sched_' + key + '_end').value = day.end || '18:00';
    });

    document.getElementById('scheduleModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openBlockSlotModal(manicuristId) {
    const m = getManicuristById(manicuristId);
    if (!m) return;

    document.getElementById('blockSlotManicuristId').value = m.id;
    document.getElementById('blockSlotManicuristName').textContent = m.name;
    document.getElementById('blockSlotForm').reset();
    document.getElementById('blockSlotTimeGroup').style.display = 'block';

    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('blockSlotDate').min = today;

    renderBlockedSlotsList(manicuristId);

    document.getElementById('blockSlotModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function renderBlockedSlotsList(manicuristId) {
    const m = getManicuristById(manicuristId);
    const container = document.getElementById('blockedSlotsList');

    if (!m || !m.blockedSlots || m.blockedSlots.length === 0) {
        container.innerHTML = '<p class="hint-text" style="padding:1rem;">No hay bloqueos registrados</p>';
        return;
    }

    container.innerHTML = m.blockedSlots.map((slot, idx) => `
        <div class="blocked-slot-item">
            <div class="blocked-slot-info">
                <i class="fas fa-ban"></i>
                <span>${slot.date} ${slot.allDay ? '(Todo el día)' : slot.time}</span>
            </div>
            <button class="btn btn-danger btn-action" data-remove-block="${idx}" data-mani-id="${manicuristId}" title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('[data-remove-block]').forEach(btn => {
        btn.addEventListener('click', async function () {
            await removeBlockedSlot(parseInt(this.dataset.maniId), parseInt(this.dataset.removeBlock));
            renderBlockedSlotsList(parseInt(this.dataset.maniId));
            showToast('Bloqueo eliminado', 'success');
        });
    });
}

function renderManageManicurists() {
    const grid = document.getElementById('manageManicuristsGrid');
    const manicurists = getManicurists();

    grid.innerHTML = manicurists.map(m => {
        const schedDays = m.schedule ? DAY_KEYS.filter(k => m.schedule[k] && m.schedule[k].active).map(k => {
            const idx = DAY_KEYS.indexOf(k);
            return DAY_NAMES[idx];
        }).join(', ') : 'Sin configurar';

        const blockedCount = m.blockedSlots ? m.blockedSlots.length : 0;

        return `
            <div class="manage-mani-card ${m.blocked ? 'mani-blocked' : ''}">
                <div class="manage-mani-top">
                    <div class="manage-mani-avatar">${m.emoji}</div>
                    <div class="manage-mani-info">
                        <h4>${m.name} ${m.blocked ? '<span class="badge-blocked">Bloqueada</span>' : '<span class="badge-active">Activa</span>'}</h4>
                        <p class="mani-specialty">${m.specialty}</p>
                        <p class="mani-schedule-preview"><i class="fas fa-calendar-alt"></i> ${schedDays}</p>
                        ${blockedCount > 0 ? `<p class="mani-blocked-count"><i class="fas fa-ban"></i> ${blockedCount} bloqueo(s)</p>` : ''}
                    </div>
                </div>
                <div class="manage-mani-actions">
                    <button class="btn btn-sm" data-edit-mani="${m.id}" title="Editar"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-sm" data-schedule-mani="${m.id}" title="Horario"><i class="fas fa-clock"></i> Horario</button>
                    <button class="btn btn-sm" data-block-slot-mani="${m.id}" title="Bloquear horarios"><i class="fas fa-ban"></i> Bloqueos</button>
                    <button class="btn ${m.blocked ? 'btn-success' : 'btn-warning'} btn-action" data-toggle-block="${m.id}" title="${m.blocked ? 'Desbloquear' : 'Bloquear'}">
                        <i class="fas ${m.blocked ? 'fa-unlock' : 'fa-lock'}"></i> ${m.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <button class="btn btn-danger btn-action" data-delete-mani="${m.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // Edit
    grid.querySelectorAll('[data-edit-mani]').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.dataset.editMani);
            const m = getManicuristById(id);
            if (!m) return;

            document.getElementById('maniModalTitle').textContent = 'Editar Manicurista';
            document.getElementById('maniEditId').value = id;
            document.getElementById('maniName').value = m.name;
            document.getElementById('maniSpecialty').value = m.specialty;
            document.getElementById('maniEmoji').value = m.emoji;
            document.getElementById('maniCommission').value = Math.round(m.commission * 100);
            document.getElementById('manicuristModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    // Schedule
    grid.querySelectorAll('[data-schedule-mani]').forEach(btn => {
        btn.addEventListener('click', function () {
            openScheduleModal(parseInt(this.dataset.scheduleMani));
        });
    });

    // Block slots
    grid.querySelectorAll('[data-block-slot-mani]').forEach(btn => {
        btn.addEventListener('click', function () {
            openBlockSlotModal(parseInt(this.dataset.blockSlotMani));
        });
    });

    // Toggle block
    grid.querySelectorAll('[data-toggle-block]').forEach(btn => {
        btn.addEventListener('click', async function () {
            const id = parseInt(this.dataset.toggleBlock);
            const m = await toggleManicuristBlock(id);
            showToast(m.blocked ? 'Manicurista bloqueada' : 'Manicurista desbloqueada', 'success');
            renderManageManicurists();
            renderManicurists();
            renderAdminDashboard();
        });
    });

    // Delete
    grid.querySelectorAll('[data-delete-mani]').forEach(btn => {
        btn.addEventListener('click', async function () {
            if (confirm('¿Estás seguro de eliminar esta manicurista?')) {
                await deleteManicurist(parseInt(this.dataset.deleteMani));
                renderManageManicurists();
                renderManicurists();
                renderAdminDashboard();
                showToast('Manicurista eliminada', 'success');
            }
        });
    });
}

// ========== ADMIN: CLIENTS ==========
function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    const emptyMsg = document.getElementById('emptyClientsMessage');
    const clients = getClients();

    if (clients.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    const sorted = [...clients].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = sorted.map(c => {
        const clientAppointments = getAppointmentsByClient(c.id);
        const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-CL') : '-';
        return `
            <tr>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.email || '-'}</td>
                <td>${clientAppointments.length}</td>
                <td>${dateStr}</td>
            </tr>
        `;
    }).join('');
}

// ========== TOAST ==========
function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + (type || '');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
