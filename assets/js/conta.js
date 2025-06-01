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
    const email = localStorage.getItem('email');
    if (!email) return;
    const container = document.getElementById('reservations-container');
    const title = document.getElementById('reservations-title');
    const list = document.getElementById('reservations-list');
    // Título dinâmico (podes mudar para outro texto se quiseres)
    title.textContent = "Histórico de Carregamentos";
    // Toggle visibilidade
    container.style.display = (container.style.display === 'block') ? 'none' : 'block';

    fetch(`http://localhost:3000/api/carregamentos/${email}`)
        .then(resp => resp.json())
        .then(carregamentos => {
            if (!Array.isArray(carregamentos) || carregamentos.length === 0) {
                list.innerHTML = "<div class='reservation-empty'>Sem carregamentos registados.</div>";
            } else {
                list.innerHTML = carregamentos.map(c =>
                    `<div class="reservation">
                        <div class="reservation-row">
                            <span class="reservation-icon">💶</span>
                            <span class="reservation-value">${parseFloat(c.valor).toFixed(2)}€</span>
                        </div>
                        <div class="reservation-row">
                            <span class="reservation-date">${new Date(c.data_hora).toLocaleDateString()}</span>
                            <span class="reservation-time">${new Date(c.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>`
                ).join('');
            }
        });
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

  // Preencher formulário com dados atuais
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

      // Preenche formulário de edição
      const form = document.getElementById('edit-profile-form');
      form.email.value = user.email;
      form.telefone.value = user.telefone;
      form.morada.value = user.morada;
      form.cidade.value = user.cidade;
      form.codigo_postal.value = user.codigo_postal;
      form.pais.value = user.pais;
    }
  } catch (err) {
    document.querySelector('.profile-name').textContent = 'Erro ao carregar utilizador';
  }

  // Mostrar/ocultar formulário de edição
  window.toggleProfileForm = function () {
    const card = document.getElementById('profile-form-card');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  };

  // Mostrar/ocultar formulário de password
  document.getElementById('show-password-form-btn').onclick = function () {
    const pf = document.getElementById('password-form');
    pf.style.display = pf.style.display === 'none' ? 'block' : 'none';
  };

  // Botão cancelar para fechar o formulário de edição
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      document.getElementById('profile-form-card').style.display = 'none';
    };
  }

  // Submeter alterações de dados
  document.getElementById('edit-profile-form').onsubmit = async function (e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      email: form.email.value,
      telefone: form.telefone.value,
      morada: form.morada.value,
      cidade: form.cidade.value,
      codigo_postal: form.codigo_postal.value,
      pais: form.pais.value,
      old_email: localStorage.getItem('email')
    };
    const resp = await fetch('http://localhost:3000/api/user/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (resp.ok) {
      alert('Dados alterados com sucesso!');
      localStorage.setItem('email', data.email);
      location.reload();
    } else {
      alert('Erro ao alterar dados.');
    }
  };

  // Submeter alteração de password
  document.getElementById('password-form').onsubmit = async function (e) {
    e.preventDefault();
    const nova_password = e.target.nova_password.value;
    if (!nova_password) return alert('Introduza a nova password.');
    const resp = await fetch('http://localhost:3000/api/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: localStorage.getItem('email'), password: nova_password })
    });
    if (resp.ok) {
      alert('Password alterada com sucesso!');
      e.target.reset();
      e.target.style.display = 'none';
    } else {
      alert('Erro ao alterar password.');
    }
  };
});