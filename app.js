import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- CONFIGURATION SUPABASE ---
// La base de données est déjà configurée automatiquement.
// Vous n'avez rien à modifier ici.
const SUPABASE_URL = 'https://zwybiqrmqkiarbelgmzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3eWJpcXJtcWtpYXJiZWxnbXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzU0MzEsImV4cCI6MjEwMzcxMTQzMX0.k25NLgEtYQt-lgzNHwFC2dBc6Ey2c-8VTPzQQe2c6rc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TIME SLOTS ---
const TIME_SLOTS = [];
for (let h = 8; h <= 17; h++) {
  TIME_SLOTS.push(String(h).padStart(2, '0') + ':00');
  TIME_SLOTS.push(String(h).padStart(2, '0') + ':30');
}

// --- DOM HELPERS ---
const $ = (id) => document.getElementById(id);
const showToast = (msg) => {
  const toast = $('toast') || document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3500);
};

// --- HEADER SCROLL ---
window.addEventListener('scroll', () => {
  const header = $('header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 10);
});

// --- MOBILE MENU ---
const burger = $('burger');
if (burger) {
  burger.addEventListener('click', () => {
    const nav = $('nav');
    nav.classList.toggle('open');
  });
}

// --- FAQ ---
window.toggleFaq = (btn) => {
  const item = btn.closest('.faq-item');
  item.classList.toggle('open');
};

// --- BOOKING MODAL ---
window.openBookingModal = () => {
  $('bookingFormWrap').style.display = 'block';
  $('ticketView').style.display = 'none';
  $('bookingError').textContent = '';
  $('bookingForm').reset();
  populateTimeSlots();
  setMinDate();
  $('bookingModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeBookingModal = () => {
  $('bookingModal').classList.remove('open');
  document.body.style.overflow = '';
};

window.resetBooking = () => {
  $('bookingFormWrap').style.display = 'block';
  $('ticketView').style.display = 'none';
  $('bookingError').textContent = '';
  $('bookingForm').reset();
  populateTimeSlots();
};

// --- DATE / TIME HELPERS ---
function setMinDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateInput = $('bk-date');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
  dateInput.addEventListener('change', checkSunday);
}

function checkSunday() {
  const dateInput = $('bk-date');
  const date = new Date(dateInput.value + 'T00:00:00');
  if (date.getDay() === 0) {
    $('bookingError').textContent = 'Le cabinet est fermé le dimanche. Veuillez choisir un autre jour.';
    dateInput.value = '';
    populateTimeSlots();
  } else {
    $('bookingError').textContent = '';
    updateTimeSlots();
  }
}

function populateTimeSlots() {
  const select = $('bk-heure');
  select.innerHTML = '<option value="">Choisir une heure</option>';
  TIME_SLOTS.forEach((slot) => {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = slot;
    select.appendChild(opt);
  });
}

window.updateTimeSlots = async () => {
  const date = $('bk-date').value;
  if (!date) return;
  const select = $('bk-heure');
  populateTimeSlots();
  try {
    const { data: existing, error } = await supabase
      .from('rendezvous')
      .select('heure')
      .eq('date', date)
      .neq('statut', 'Annulé');
    if (error) return;
    const takenSlots = new Set(existing.map((r) => r.heure));
    Array.from(select.options).forEach((opt) => {
      if (opt.value && takenSlots.has(opt.value)) {
        opt.disabled = true;
        opt.textContent = opt.value + ' (réservé)';
      }
    });
  } catch (e) {
    // silently fail — user can still pick any slot
  }
};

// --- TICKET ID GENERATOR ---
function generateTicketId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  const stamp = Date.now().toString().slice(-3);
  return `SJ-${random}-${stamp}`;
}

// --- SUBMIT BOOKING ---
window.submitBooking = async (event) => {
  event.preventDefault();
  const errorEl = $('bookingError');
  errorEl.textContent = '';
  const submitBtn = $('bookingSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Vérification du créneau...';

  const nom = $('bk-nom').value.trim();
  const telephone = $('bk-tel').value.trim();
  const email = $('bk-email').value.trim();
  const motif = $('bk-motif').value;
  const date = $('bk-date').value;
  const heure = $('bk-heure').value;

  if (!nom || !telephone || !motif || !date || !heure) {
    errorEl.textContent = 'Veuillez remplir tous les champs obligatoires.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmer mon rendez-vous →';
    return;
  }

  try {
    // Check if slot is already taken
    const { data: existing, error: checkError } = await supabase
      .from('rendezvous')
      .select('id')
      .eq('date', date)
      .eq('heure', heure)
      .neq('statut', 'Annulé')
      .limit(1);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      errorEl.textContent = 'Ce créneau est déjà réservé. Veuillez choisir une autre heure.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmer mon rendez-vous →';
      updateTimeSlots();
      return;
    }

    // Generate ticket ID and insert
    const ticketId = generateTicketId();

    const { error: insertError } = await supabase
      .from('rendezvous')
      .insert({
        ticket_id: ticketId,
        nom,
        telephone,
        email: email || null,
        motif,
        date,
        heure,
        statut: 'Confirmé',
      });

    if (insertError) throw insertError;

    // Show ticket
    showTicket(ticketId, nom, motif, date, heure);
    showToast('Rendez-vous confirmé avec succès !');
  } catch (err) {
    errorEl.textContent = 'Une erreur est survenue. Veuillez réessayer ou nous appeler directement.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmer mon rendez-vous →';
  }
};

// --- SHOW TICKET ---
function showTicket(ticketId, nom, motif, date, heure) {
  $('bookingFormWrap').style.display = 'none';
  $('ticketView').style.display = 'block';

  $('ticketId').textContent = ticketId;
  $('ticketNom').textContent = nom;
  $('ticketMotif').textContent = motif;
  $('ticketDate').textContent = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  $('ticketHeure').textContent = heure;

  // QR Code
  const qrData = `Cabinet Saint Jean - RDV ${ticketId} - ${nom} - ${date} ${heure} - Cocody Abidjan`;
  $('ticketQr').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

  $('bookingSubmit').disabled = false;
  $('bookingSubmit').textContent = 'Confirmer mon rendez-vous →';
}

// --- DOWNLOAD TICKET (PDF via print) ---
window.downloadTicket = () => {
  const ticketCard = $('ticketCard');
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
    <head>
      <title>Ticket ${$('ticketId').textContent}</title>
      <style>
        body { font-family: 'Poppins', Arial, sans-serif; padding: 40px; background: #f5f8fa; }
        .ticket-card { max-width: 480px; margin: 0 auto; border: 2px solid #2EC4B6; border-radius: 20px; overflow: hidden; }
        .ticket-header { background: #0E76A8; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
        .ticket-body { padding: 28px; text-align: center; background: #fff; }
        .ticket-label { font-size: 13px; color: #6B7B95; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .ticket-id { font-size: 32px; font-weight: 800; color: #0E76A8; margin-bottom: 24px; }
        .ticket-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
        .ticket-row span { color: #6B7B95; }
        .ticket-row strong { color: #1A2B4C; }
        .ticket-qr { display: flex; justify-content: center; margin: 20px 0; }
        .ticket-instruction { font-size: 13px; color: #6B7B95; }
      </style>
    </head>
    <body>${ticketCard.outerHTML}</body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
};

// --- CLOSE MODAL ON BACKDROP CLICK ---
$('bookingModal').addEventListener('click', (e) => {
  if (e.target === $('bookingModal')) closeBookingModal();
});

// --- ESC TO CLOSE ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('bookingModal').classList.contains('open')) {
    closeBookingModal();
  }
});

// --- INIT ---
populateTimeSlots();
