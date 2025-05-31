function toggleProfileForm() {
    var form = document.getElementById('profile-form-card');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}

function showCars() {
    var form = document.getElementById('cars-form-card');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}

function showReservations() {
  const reservations = JSON.parse(localStorage.getItem('reservations')) || [];
  const reservationsContainer = document.getElementById('reservations-container');
  var form = document.getElementById('reservations-container');

  if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }

  reservationsContainer.innerHTML = reservations.map(reservation => `
    <div class="reservation">
      <h3>${reservation.name}</h3>
      <p>Data: ${reservation.date}</p>
      <p>Hora: ${reservation.time}</p>
      <p>Status: ${reservation.status}</p>
      <button onclick="removeReservation('${reservation.id}')">Remover</button>
    </div>
  `).join('');
}

function removeReservation(reservationId) {
  let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
  reservations = reservations.filter(reservation => reservation.id !== reservationId);
  localStorage.setItem('reservations', JSON.stringify(reservations));

  showReservations();
}

function setupReservationsButton() {
  const button = document.getElementById('show-reservations-button');
  button.addEventListener('click', showReservations);
}

document.addEventListener('DOMContentLoaded', setupReservationsButton);
