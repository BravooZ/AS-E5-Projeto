// Map initialization
const map = L.map('map').setView([38.736946, -9.142685], 12); // Lisboa

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.Control.geocoder().addTo(map);

let markers = [];
let reservas = {}; // Object to store reservations { id: { title, date, time } }

function raioPorZoom(zoom) {
  if (zoom >= 15) return 3;
  if (zoom >= 12) return 10;
  if (zoom >= 8) return 30;
  return 50;
}

function getMarkerColor(available, total, reservado) {
  if (reservado) return 'green';
  if (available === 0) return 'red';
  if (available / total < 0.31) return 'orange';
  return 'green';
}

// Create colored marker with special outline for reserved stations
function createColoredMarker(lat, lon, color, popupContent, reservado) {
  let htmlIcon;
  if (reservado) {
    // Green with star outline
    htmlIcon = `
      <div style="position: relative; width: 24px; height: 24px;">
        <i style="
          background-color:${color};
          border-radius:50%;
          display:block;
          width:20px;
          height:20px;
          border:2px solid white;
          box-shadow: 0 0 8px ${color};
          position: absolute;
          top: 2px;
          left: 2px;
          z-index: 1;
        "></i>
        <div style="
          position: absolute;
          top: -8px;
          left: 4px;
          width: 16px;
          height: 16px;
          background: gold;
          clip-path: polygon(
            50% 0%, 61% 35%, 98% 35%, 68% 57%, 
            79% 91%, 50% 70%, 21% 91%, 32% 57%, 
            2% 35%, 39% 35%
          );
          box-shadow: 0 0 5px gold;
          z-index: 2;
        "></div>
      </div>
    `;
  } else {
    htmlIcon = `<i style="
      background-color:${color};
      border-radius:50%;
      display:block;
      width:20px;
      height:20px;
      border:2px solid white;
      box-shadow: 0 0 5px ${color};
    "></i>`;
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: htmlIcon,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return L.marker([lat, lon], { icon: icon }).bindPopup(popupContent);
}

// Create popup with reservation form for date and time
function criarPopupComReserva(titulo, endereco, available, total, id) {
  const podeReservar = available > 0 && !(id in reservas);
  const jaReservado = id in reservas;

  return `
    <strong>${titulo}</strong><br>
    ${endereco}<br>
    Disponíveis: ${available} de ${total}<br><br>

    ${jaReservado ? `
      <div style="margin-bottom:10px; font-weight:bold; color:green;">
        Reservado para: ${reservas[id].data} às ${reservas[id].hora}
      </div>
      <button
        style="
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: pointer;
          width: 100%;
        "
        onclick="cancelarReserva('${id}')"
      >
        Cancelar Reserva
      </button>
    ` : `
      <button
        style="
          background-color: ${podeReservar ? '#28a745' : '#6c757d'};
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: ${podeReservar ? 'pointer' : 'not-allowed'};
          margin-bottom: 10px;
          width: 100%;
        "
        ${podeReservar ? '' : 'disabled'}
        onclick="mostrarFormularioReserva('${id}')"
      >
        Reservar
      </button>
      <button
        style="
          background-color: #007bff;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: pointer;
          margin-bottom: 10px;
          width: 100%;
        "
        onclick="iniciarAgora('${id}', '${titulo}')"
      >
        Iniciar Agora
      </button>
      <div id="formulario-reserva-${id}" style="display:none; margin-top:10px;">
        <label>Data: <input type="date" id="data-${id}" required></label><br><br>
        <label>Hora: <input type="time" id="hora-${id}" required></label><br><br>
        <button
          onclick="confirmarReserva('${id}', '${titulo}')"
          style="
            background-color:#007bff;
            color:#fff;
            border:none;
            padding:8px 12px;
            border-radius:5px;
            cursor:pointer;
            width: 100%;
          "
        >
          Confirmar
        </button>
      </div>
    `}
  `;
}

function mostrarFormularioReserva(id) {
  const form = document.getElementById(`formulario-reserva-${id}`);
  if (form.style.display === 'none') {
    form.style.display = 'block';
  } else {
    form.style.display = 'none';
  }
}

function confirmarReserva(id, titulo) {
  const data = document.getElementById(`data-${id}`).value;
  const hora = document.getElementById(`hora-${id}`).value;
  if (!data || !hora) {
    alert('Por favor, escolha data e hora.');
    return;
  }

  reservas[id] = { titulo, data, hora };

  const reservation = {
    id,
    name: titulo,
    date: data,
    time: hora,
    status: 'reservado'
  };

  let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
  reservations.push(reservation);
  localStorage.setItem('reservations', JSON.stringify(reservations));

  alert(`Reserva confirmada para "${titulo}" no dia ${data} às ${hora}.`);
  atualizarMarcadores();
}

function iniciarAgora(id, titulo) {
  const data = new Date().toLocaleDateString();
  const hora = new Date().toLocaleTimeString();

  reservas[id] = { titulo, data, hora };

  const reservation = {
    id,
    name: titulo,
    date: data,
    time: hora,
    status: 'iniciado'
  };

  let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
  reservations.push(reservation);
  localStorage.setItem('reservations', JSON.stringify(reservations));

  alert(`Reserva iniciada para "${titulo}" agora.`);
  atualizarMarcadores();
}

function cancelarReserva(id) {
  if (confirm('Tem certeza que deseja cancelar a reserva?')) {
    delete reservas[id];

    let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
    reservations = reservations.filter(reservation => reservation.id !== id);
    localStorage.setItem('reservations', JSON.stringify(reservations));

    atualizarMarcadores();
  }
}

function atualizarMarcadores() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  carregarEstacoes(true); // true = atualizar sem limpar reservas
}

function carregarEstacoes(manterReservas = false) {
  const centro = map.getCenter();
  const lat = centro.lat;
  const lon = centro.lng;
  const zoom = map.getZoom();
  const distancia = raioPorZoom(zoom);

  // If not keeping reservations, clear markers to avoid duplication
  if (!manterReservas) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
  }

  fetch(`https://api.openchargemap.io/v3/poi/?output=json&countrycode=PT&latitude=${lat}&longitude=${lon}&maxresults=50&distance=${distancia}&distanceunit=KM&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`)
    .then(response => response.json())
    .then(data => {
      // First, add reserved stations (regardless of location)
      Object.entries(reservas).forEach(([id, reserva]) => {
        // Find in response if it exists (for updated data)
        const pontoReservado = data.find(p => (p.ID == id));
        // If not found, use saved data
        let latR, lonR, tituloR, enderecoR, availableR, totalR;

        if (pontoReservado) {
          const addr = pontoReservado.AddressInfo;
          latR = addr.Latitude;
          lonR = addr.Longitude;
          tituloR = addr.Title;
          enderecoR = addr.AddressLine1;
          availableR = pontoReservado.NumberOfPointsAvailable ?? pontoReservado.NumberOfPoints ?? 1;
          totalR = pontoReservado.NumberOfPoints ?? 1;
        } else {
          // If not in current results (out of range), ignore for simplicity
          return;
        }

        const popupContent = criarPopupComReserva(tituloR, enderecoR, availableR, totalR, id);
        const marker = createColoredMarker(latR, lonR, 'green', popupContent, true);
        marker.addTo(map);
        markers.push(marker);
      });

      // Now add stations from fetch, except those already reserved to avoid duplicates
      data.forEach((ponto, index) => {
        const id = ponto.ID || `station-${index}`;
        if (reservas[id]) return; // skip already reserved

        const { AddressInfo, NumberOfPoints, NumberOfPointsAvailable } = ponto;
        const lat = AddressInfo.Latitude;
        const lon = AddressInfo.Longitude;
        const titulo = AddressInfo.Title;
        const endereco = AddressInfo.AddressLine1;

        const available = NumberOfPointsAvailable ?? NumberOfPoints ?? 0;
        const total = NumberOfPoints ?? 1;

        const cor = getMarkerColor(available, total, false);
        const popupContent = criarPopupComReserva(titulo, endereco, available, total, id);
        const marker = createColoredMarker(lat, lon, cor, popupContent, false);
        marker.addTo(map);
        markers.push(marker);
      });
    })
    .catch(error => {
      console.error('Erro ao carregar estações:', error);
    });
}

carregarEstacoes();
map.on('moveend', () => carregarEstacoes(false));