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

document.addEventListener('DOMContentLoaded', async function () {
  const email = localStorage.getItem('email');
  if (!email) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/user/${email}`);
    if (response.ok) {
      const user = await response.json();
      document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido}`;
      document.querySelector('.profile-email').textContent = user.email;
      document.querySelector('.profile-phone').textContent = user.telefone;
      document.querySelector('.profile-address').textContent = user.morada;
      document.querySelector('.profile-city').textContent = user.cidade;
      document.querySelector('.profile-country').textContent = user.pais;
    }
  } catch (err) {
    document.querySelector('.profile-name').textContent = 'Erro ao carregar utilizador';
  }
});