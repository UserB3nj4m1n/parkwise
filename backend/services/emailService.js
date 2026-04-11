const { SMTPClient } = require('emailjs');

console.log('Inicializujem emailService...');
console.log('DEBUG - EMAIL_USER:', process.env.EMAIL_USER);

const client = new SMTPClient({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'smtp.gmail.com',
  ssl: true,
});

async function sendBookingConfirmation(bookingDetails) {
  console.log('Pokus o odoslanie emailu na:', bookingDetails.email);
  
  const { 
    email, licensePlate, booking_date, startTime, endTime, 
    total_price, cancellation_token, slot_name, cardholderName 
  } = bookingDetails;

  const cancellationUrl = `http://parkwise.store:3000/api/bookings/cancel/${cancellation_token}`;

  const htmlContent = `
    <h1>Potvrdenie Rezervácie</h1>
    <p>Ďakujeme za Vašu rezerváciu v ParkWise!</p>
    <h2>Faktúra</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px;"><b>Meno a Priezvisko:</b></td><td style="padding: 8px;">${cardholderName}</td></tr>
      <tr><td style="padding: 8px;"><b>EČV:</b></td><td style="padding: 8px;">${licensePlate}</td></tr>
      <tr><td style="padding: 8px;"><b>Parkovacie miesto:</b></td><td style="padding: 8px;">${slot_name}</td></tr>
      <tr><td style="padding: 8px;"><b>Dátum:</b></td><td style="padding: 8px;">${booking_date}</td></tr>
      <tr><td style="padding: 8px;"><b>Čas:</b></td><td style="padding: 8px;">${startTime} - ${endTime}</td></tr>
      <tr><td style="padding: 8px;"><b>Celková cena:</b></td><td style="padding: 8px;">${total_price.toFixed(2)} €</td></tr>
    </table>
    <p style="margin-top: 20px;">Ak si želáte zrušiť rezerváciu, kliknite na odkaz nižšie:</p>
    <a href="${cancellationUrl}">Zrušiť Rezerváciu</a>
    <p style="margin-top: 20px;">Ďakujeme, že ste si vybrali ParkWise!</p>
  `;

  return new Promise((resolve, reject) => {
    client.send({
      from: `ParkWise <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Potvrdenie Vašej rezervácie parkovania',
      attachment: [
        { data: htmlContent, alternative: true }
      ]
    }, (err, message) => {
      if (err) {
        console.error('CHYBA pri odosielaní emailu:', err);
        reject(err);
      } else {
        console.log('EMAIL ÚSPEŠNE ODOSLANÝ!');
        resolve(message);
      }
    });
  });
}

module.exports = { sendBookingConfirmation };
