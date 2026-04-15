document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elementy ---
    const bookingsContainer = document.getElementById('bookings-container');
    const slotsContainer = document.getElementById('slots-container');
    const openBarrierBtn = document.getElementById('open-barrier-btn');
    
    const modal = document.getElementById('edit-modal');
    const editBookingIdInput = document.getElementById('edit-booking-id');
    const editEmailInput = document.getElementById('edit-email');
    const editLicensePlateInput = document.getElementById('edit-license-plate');
    const saveButton = document.getElementById('save-edit');
    const cancelButton = document.getElementById('cancel-edit');

    // --- Pomocné Funkcie pre Preklad ---
    function translateBookingStatus(status) {
        if (status === 'confirmed') return 'potvrdené';
        if (status === 'cancelled') return 'zrušené';
        return status;
    }

    function translateSlotStatus(status) {
        if (status === 'available') return 'voľné';
        if (status === 'reserved') return 'obsadené';
        return status;
    }

    // --- API Wrapper ---
    const api = {
        async request(url, options = {}) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({ error: 'Neznáma serverová chyba' }));
                    throw new Error(errorBody.error || `HTTP chyba! Status: ${response.status}`);
                }
                return response.json();
            } catch (error) {
                console.error(`Chyba pri API volaní na ${url}:`, error);
                throw error;
            }
        }
    };
    api.put = (url, data) => api.request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    api.delete = (url) => api.request(url, { method: 'DELETE' });
    api.get = (url) => api.request(url);

    // --- Logika Modálneho Okna ---
    function openModal(booking) {
        editBookingIdInput.value = booking.id;
        editEmailInput.value = booking.email;
        editLicensePlateInput.value = booking.license_plate;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    async function handleSave() {
        try {
            await api.put(`/admin/bookings/${editBookingIdInput.value}`, {
                email: editEmailInput.value,
                license_plate: editLicensePlateInput.value
            });
            closeModal();
            loadData();
        } catch (error) {
            alert(`Chyba pri ukladaní: ${error.message}`);
        }
    }

    // --- Vykresľovanie Tabuliek ---
    async function renderBookings() {
        try {
            const bookings = await api.get('/admin/bookings');
            let table = `
                <table class="min-w-full leading-normal">
                    <thead><tr class="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">ID</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">EČV</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">Email</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">Dátum a Čas</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">Stav</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left">Akcie</th>
                    </tr></thead>
                    <tbody class="text-gray-700 dark:text-slate-300">
            `;
            if (bookings.length > 0) {
                bookings.forEach(b => {
                    const statusClass = b.status === 'confirmed' ? 'text-green-900 bg-green-200' : 'text-red-900 bg-red-200';
                    table += `
                        <tr data-booking='${JSON.stringify(b)}'>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${b.id}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${b.license_plate}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${b.email}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${b.booking_date} <br> ${b.start_time} - ${b.end_time}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"><span class="relative inline-block px-3 py-1 font-semibold ${statusClass} leading-tight rounded-full">${translateBookingStatus(b.status)}</span></td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                <button class="text-blue-600 hover:text-blue-900" data-action="edit">Upraviť</button>
                                <button class="text-indigo-600 hover:text-indigo-900 ml-4" data-action="toggle">Zmeniť stav</button>
                                <button class="text-red-600 hover:text-red-900 ml-4" data-action="delete">Odstrániť</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                table += `<tr><td colspan="6" class="text-center p-4">Žiadne rezervácie.</td></tr>`;
            }
            bookingsContainer.innerHTML = table + `</tbody></table>`;
        } catch (e) {
            bookingsContainer.innerHTML = `<p class="p-4 text-red-500">Chyba pri načítaní rezervácií: ${e.message}</p>`;
        }
    }

    async function renderSlots() {
        try {
            const slots = await api.get('/admin/slots');
            let table = `
                <table class="min-w-full leading-normal">
                    <thead><tr>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider">ID</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Názov miesta</th>
                        <th class="px-5 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-left text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Stav</th>
                    </tr></thead>
                    <tbody class="text-gray-700 dark:text-slate-300">
            `;
            if (slots.length > 0) {
                slots.forEach(s => {
                    const statusClass = s.status === 'available' ? 'text-green-900 bg-green-200' : 'text-yellow-900 bg-yellow-200';
                    table += `
                        <tr>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${s.id}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${s.slot_name}</td>
                            <td class="px-5 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"><span class="relative inline-block px-3 py-1 font-semibold ${statusClass} leading-tight rounded-full">${translateSlotStatus(s.status)}</span></td>
                        </tr>
                    `;
                });
            } else {
                table += `<tr><td colspan="3" class="text-center p-4">Žiadne parkovacie miesta.</td></tr>`;
            }
            slotsContainer.innerHTML = table + `</tbody></table>`;
        } catch (e) {
            slotsContainer.innerHTML = `<p class="p-4 text-red-500">Chyba pri načítaní miest: ${e.message}</p>`;
        }
    }

    // --- Spracovanie Akcií ---
    bookingsContainer.addEventListener('click', async (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const button = e.target;
        const action = button.dataset.action;
        const row = button.closest('tr');
        const booking = JSON.parse(row.dataset.booking);

        if (action === 'edit') {
            openModal(booking);
        } else if (action === 'toggle') {
            const newStatus = booking.status === 'confirmed' ? 'cancelled' : 'confirmed';
            if (confirm(`Naozaj chcete zmeniť stav rezervácie #${booking.id} na "${translateBookingStatus(newStatus)}"?`)) {
                try {
                    await api.put(`/admin/bookings/${booking.id}/status`, { newStatus });
                    loadData();
                } catch (error) {
                    alert('Chyba: ' + error.message);
                }
            }
        } else if (action === 'delete') {
            if (confirm(`Naozaj chcete natrvalo odstrániť rezerváciu #${booking.id}?`)) {
                try {
                    await api.delete(`/admin/bookings/${booking.id}`);
                    loadData();
                } catch (error) {
                    alert('Chyba: ' + error.message);
                }
            }
        }
    });

    openBarrierBtn.addEventListener('click', async () => {
        try {
            // Voláme proxy endpoint na našom admin serveri (port 3001)
            const response = await fetch('/admin/open-barrier');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            alert(data.sprava || 'Závora bola úspešne otvorená!');
        } catch (error) {
            console.error('Chyba pri otváraní závory:', error);
            alert('Chyba: ' + error.message);
        }
    });

    // --- Inicializácia ---
    async function loadData() {
        await renderBookings();
        await renderSlots();
    }
    cancelButton.addEventListener('click', closeModal);
    saveButton.addEventListener('click', handleSave);
    
    loadData();
});
