// Map initialization
var map = L.map('map').setView([40.6405, -8.6538], 14); // Aveiro

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.Control.geocoder().addTo(map);

let carros = [];
let carroSelecionado = null;
let saldo = 0;
let ultimaEstacaoAssociada = null;
let markers = [];
let reservas = {}; // Object to store reservations { id: { title, date, time } }

// Carregar carros do utilizador
async function carregarCarros() {
    const email = localStorage.getItem('email');
    if (!email) return;
    const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
    carros = await resp.json();
    const select = document.getElementById('car-select');
    select.innerHTML = '';
    if (carros.length === 0) {
        select.innerHTML = '<option value="">Sem carros registados</option>';
        select.disabled = true;
    } else {
        select.disabled = false;
        select.innerHTML = '<option value="">Selecionar carro...</option>' +
            carros.map(c => `<option value="${c.id}">${c.marca} ${c.modelo} (${c.ano})</option>`).join('');
    }
}

// Evento de seleção de carro
document.getElementById('car-select').addEventListener('change', function() {
    carroSelecionado = this.value;
    atualizarMarcadores();
});

async function carregarSaldo() {
  const email = localStorage.getItem('email');
  if (!email) return;
  try {
    const resp = await fetch(`http://localhost:3000/api/wallet/${email}`);
    if (resp.ok) {
      const data = await resp.json();
      saldo = parseFloat(data.saldo);
      // Atualiza saldo na página
      const saldoSpan = document.getElementById('saldo-span');
      if (saldoSpan) saldoSpan.textContent = saldo.toFixed(2) + '€';
    }
  } catch (e) {
    saldo = 0;
    const saldoSpan = document.getElementById('saldo-span');
    if (saldoSpan) saldoSpan.textContent = '0,00€';
  }
}

async function descontarSaldo(valor, registar = false) {
  const email = localStorage.getItem('email');
  if (!email) return false;
  // valor deve ser negativo para descontar
  const resp = await fetch('http://localhost:3000/api/wallet/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, valor: -Math.abs(valor), registar })
  });
  if (resp.ok) {
    await carregarSaldo();
    return true;
  }
  return false;
}

// Chama ao iniciar
carregarCarros();
carregarSaldo();


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
  const isAdmin = localStorage.getItem('is_admin') === '1';
  const jaReservado = id in reservas;
  const status = jaReservado ? reservas[id].status : null;

  let adminBtn = '';
  if (isAdmin) {
    adminBtn = `<button type="button" style="background:#4bc0c0;color:#232c33;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;width:100%;margin-bottom:8px;font-weight:bold;" onclick="verReservasEstacao('${id}','${titulo.replace(/'/g, '\'')}')">Ver reservas/carregamentos</button>`;
  }

  if (jaReservado && status === 'iniciado') {
    return `
      <strong>${titulo}</strong><br>
      ${endereco}<br>
      ${adminBtn}
      <div style="margin-bottom:10px; font-weight:bold; color:#007bff;">
        Carregamento iniciado em: ${reservas[id].data} às ${reservas[id].hora}
      </div>
      <button
        type="button"
        style="background-color: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; width: 100%;"
        onclick="cancelarReserva('${id}')"
      >Terminar carregamento</button>
    `;
  } else if (jaReservado && status === 'reservado') {
    return `
      <strong>${titulo}</strong><br>
      ${endereco}<br>
      ${adminBtn}
      <div style="margin-bottom:10px; font-weight:bold; color:orange;">
        Reservado para: ${reservas[id].data} às ${reservas[id].hora}
      </div>
      <button
        type="button"
        style="background-color: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; width: 100%;"
        onclick="cancelarReserva('${id}')"
      >Cancelar reserva</button>
    `;
  } else {
    const podeReservar = available > 0 && carroSelecionado && saldo >= 1;
    const podeIniciar = available > 0 && carroSelecionado;
    return `
      <strong>${titulo}</strong><br>
      ${endereco}<br>
      ${adminBtn}
      Disponíveis: ${available} de ${total}<br><br>
      <button
        type="button"
        style="background-color: ${podeReservar ? 'orange' : '#6c757d'}; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: ${podeReservar ? 'pointer' : 'not-allowed'}; margin-bottom: 10px; width: 100%; box-shadow: ${podeReservar ? '0 0 8px orange' : 'none'};"
        ${podeReservar ? '' : 'disabled'}
        onclick="mostrarFormularioReserva('${id}')"
      >Reservar</button>
      <button
        type="button"
        style="background-color: ${podeIniciar ? '#007bff' : '#6c757d'}; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: ${podeIniciar ? 'pointer' : 'not-allowed'}; margin-bottom: 10px; width: 100%;"
        ${podeIniciar ? '' : 'disabled'}
        onclick="iniciarAgora('${id}', '${titulo}')"
      >Iniciar carregamento</button>
      <div id="formulario-reserva-${id}" style="display:none; margin-top:10px;">
        <label>Data: <input type="date" id="data-${id}" required value="${new Date().toISOString().split('T')[0]}"></label><br><br>
        <label>Hora: <input type="time" id="hora-${id}" required></label><br><br>
        <button type="button" onclick="confirmarReserva('${id}', '${titulo}')" style="background-color:#007bff;color:#fff;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;width: 100%;">Confirmar</button>
      </div>
    `;
  }
}

// Função global para admin ver reservas/carregamentos da estação
window.verReservasEstacao = async function(estacao_id, titulo) {
  let modal = document.getElementById('admin-modal-estacao');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-modal-estacao';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div id='admin-modal-content' style='background:#232c33;color:#fff;padding:24px 18px 18px 18px;border-radius:10px;min-width:320px;max-width:95vw;max-height:80vh;overflow:auto;box-shadow:0 0 24px #000;position:relative;'>
      <span id='admin-modal-close' style='position:absolute;top:8px;right:16px;cursor:pointer;font-size:1.5em;'>&times;</span>
      <h3 style='margin-top:0;margin-bottom:12px;'>Reservas/Carregamentos<br><span style='font-size:0.7em;font-weight:normal;'>${titulo}</span></h3>
      <div id='admin-modal-body'>A carregar...</div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('admin-modal-close').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
  } else {
    modal.style.display = 'flex';
    document.getElementById('admin-modal-body').innerHTML = 'A carregar...';
    document.querySelector('#admin-modal-content h3 span').textContent = titulo;
  }
  try {
    const resp = await fetch(`http://localhost:3000/api/admin/estacao/${estacao_id}`);
    const data = await resp.json();
    if (!data || data.length === 0) {
      document.getElementById('admin-modal-body').innerHTML = '<span style="color:#aaa;">Sem reservas/carregamentos nesta estação.</span>';
      return;
    }
    let html = '<ul style="padding-left:16px;">';
    data.forEach(r => {
      html += `<li style='margin-bottom:10px;'><b>${r.status}</b> - ${r.data || ''} ${r.hora || ''}<br>
        <span style='color:#4bc0c0;'>Carro:</span> ${r.carro.marca} ${r.carro.modelo} (${r.carro.ano}) [${r.carro.matricula}]<br>
        <span style='color:#4bc0c0;'>Utilizador:</span> ${r.usuario.nome} ${r.usuario.apelido} (${r.usuario.email})
      </li>`;
    });
    html += '</ul>';
    document.getElementById('admin-modal-body').innerHTML = html;
  } catch (e) {
    document.getElementById('admin-modal-body').innerHTML = '<span style="color:#c00;">Erro ao carregar dados.</span>';
  }
};

function createUserMarker(lat, lon, color, popupContent, id) {
  // Remove marker antigo do mesmo tipo se existir
  const old = markers.find(m => m.options && m.options.userMarkerId === id);
  if (old) {
    map.removeLayer(old);
    markers = markers.filter(m => m !== old);
  }
  const icon = L.divIcon({
    className: 'custom-user-marker',
    html: `<i style="
      background-color:${color};
      border-radius:50%;
      display:block;
      width:24px;
      height:24px;
      border:3px solid white;
      box-shadow: 0 0 10px ${color};
    "></i>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const marker = L.marker([lat, lon], { icon: icon, userMarkerId: id, interactive: true }).bindPopup(popupContent);
  marker.addTo(map);
  markers.push(marker);
  return marker;
}

function mostrarFormularioReserva(id) {
  const form = document.getElementById(`formulario-reserva-${id}`);
  if (form.style.display === 'none') {
    form.style.display = 'block';
    // Preencher data automaticamente
    const dataInput = document.getElementById(`data-${id}`);
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
  } else {
    form.style.display = 'none';
  }
}

async function confirmarReserva(id, titulo) {
  const data = document.getElementById(`data-${id}`).value;
  const hora = document.getElementById(`hora-${id}`).value;
  if (!data || !hora) {
    alert('Por favor, escolha data e hora.');
    return;
  }
  if (saldo < 1) {
    alert('Saldo insuficiente para reservar.');
    return;
  }
  const ok = await descontarSaldo(1, false); // Só desconta ao reservar
  if (!ok) {
    alert('Erro ao descontar saldo.');
    return;
  }
  // Buscar dados do ponto no mapa
  const marker = markers.find(m => m.getPopup && m.getPopup().getContent().includes(id));
  let lat = null, lon = null, endereco = '';
  if (marker) {
    [lat, lon] = [marker.getLatLng().lat, marker.getLatLng().lng];
    const popup = marker.getPopup().getContent();
    const match = popup.match(/<br>(.*?)<br>/);
    if (match) endereco = match[1];
  }
  reservas[id] = { titulo, data, hora, cheguei: false, carro: carroSelecionado, status: 'reservado', lat, lon, endereco };

  // Guardar na base de dados
  await fetch('http://localhost:3000/api/carro_estacao/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      carro_id: carroSelecionado,
      estacao_id: id,
      status: 'reservado',
      data, hora, lat, lon, endereco
    })
  });

  const color = 'orange';
  const popupContent = criarPopupComReserva(titulo, endereco, 0, 1, id);
  createUserMarker(lat, lon, color, popupContent, id);

  alert(`Reserva confirmada para "${titulo}" no dia ${data} às ${hora}.`);

  if (marker) {
    map.setView(marker.getLatLng(), 17, { animate: true });
    marker.openPopup();
  }

  atualizarMarcadores();
}

async function iniciarAgora(id, titulo) {
  const saldoDescontado = 5; // reduzir dinheiro wallet
  const saldoOk = await descontarSaldo(saldoDescontado, true);
  if (!saldoOk) {
    alert('Erro ao descontar saldo. Verifique seu saldo e tente novamente.');
    return;
  }

  const data = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString().slice(0,5);

  // Buscar dados do ponto no mapa
  const marker = markers.find(m => m.getPopup && m.getPopup().getContent().includes(id));
  let lat = null, lon = null, endereco = '';
  if (marker) {
    [lat, lon] = [marker.getLatLng().lat, marker.getLatLng().lng];
    const popup = marker.getPopup().getContent();
    const match = popup.match(/<br>(.*?)<br>/);
    if (match) endereco = match[1];
  }
  reservas[id] = { titulo, data, hora, cheguei: false, carro: carroSelecionado, status: 'iniciado', lat, lon, endereco };

  // Atualiza na base de dados
  await fetch('http://localhost:3000/api/carro_estacao/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      carro_id: carroSelecionado,
      estacao_id: id,
      status: 'iniciado',
      data, hora, lat, lon, endereco
    })
  });

  const color = '#007bff';
  const popupContent = criarPopupComReserva(titulo, endereco, 0, 1, id);
  createUserMarker(lat, lon, color, popupContent, id);

  if (marker) {
    map.setView(marker.getLatLng(), 17, { animate: true });
    marker.openPopup();
  }

  alert(`Carregamento iniciado para "${titulo}".`);
  atualizarMarcadores();
}

async function cancelarReserva(id) {
  if (confirm('Tem certeza que deseja cancelar?')) {
    const reserva = reservas[id];
    if (reserva) {
      // Só desconta saldo se for reserva ativa
      if (reserva.status === 'reservado') {
        const ok = await descontarSaldo(1, false);
        if (!ok) {
          alert('Erro ao descontar saldo ao cancelar reserva.');
        }
      }
      await fetch('http://localhost:3000/api/carro_estacao/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carro_id: reserva.carro,
          estacao_id: id
        })
      });
    }
    delete reservas[id];

    const userMarker = markers.find(m => m.options && m.options.userMarkerId === id);
    if (userMarker) {
      map.removeLayer(userMarker);
      markers = markers.filter(m => m !== userMarker);
    }

    atualizarMarcadores();
  }
}

function calcularDisponiveis(ponto, reservas, id) {
  let total = ponto.NumberOfPoints ?? 1;
  let ocupados = 0;
  Object.entries(reservas).forEach(([rid, reserva]) => {
    if (rid == id && (reserva.status === 'reservado' || reserva.status === 'iniciado')) {
      ocupados++;
    }
  });
  return Math.max(0, total - ocupados);
}

function atualizarMarcadores() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  carregarEstacoes(true); // true = atualizar sem limpar reservas
}

async function carregarEstacoes(manterReservas = false) {
  const centro = map.getCenter();
  const lat = centro.lat;
  const lon = centro.lng;
  const zoom = map.getZoom();
  const distancia = raioPorZoom(zoom);

  // Limpa marcadores se necessário
  if (!manterReservas) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
  }

  // Se NÃO houver carro selecionado, mostra todas as estações normalmente
  if (!carroSelecionado) {
    fetch(`https://api.openchargemap.io/v3/poi/?output=json&countrycode=PT&latitude=${lat}&longitude=${lon}&maxresults=50&distance=${distancia}&distanceunit=KM&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`)
      .then(response => response.json())
      .then(data => {
        Object.entries(reservas).forEach(([id, reserva]) => {
          const pontoReservado = data.find(p => (p.ID == id));
          let latR, lonR, tituloR, enderecoR, availableR, totalR;
          if (pontoReservado) {
            const addr = pontoReservado.AddressInfo;
            latR = addr.Latitude;
            lonR = addr.Longitude;
            tituloR = addr.Title;
            enderecoR = addr.AddressLine1;
            totalR = pontoReservado.NumberOfPoints ?? 1;
            availableR = calcularDisponiveis(pontoReservado, reservas, id);
          } else {
            return;
          }
          const popupContent = criarPopupComReserva(tituloR, enderecoR, availableR, totalR, id);
          const marker = createColoredMarker(latR, lonR, 'green', popupContent, true);
          marker.addTo(map);
          markers.push(marker);
        });

        data.forEach((ponto, index) => {
          const id = ponto.ID || `station-${index}`;
          if (reservas[id]) return;
          const { AddressInfo, NumberOfPoints } = ponto;
          const lat = AddressInfo.Latitude;
          const lon = AddressInfo.Longitude;
          const titulo = AddressInfo.Title;
          const endereco = AddressInfo.AddressLine1;
          const total = NumberOfPoints ?? 1;
          const available = calcularDisponiveis(ponto, reservas, id);
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
    ultimaEstacaoAssociada = null;
    return;
  }

  // Se houver carro selecionado, tenta buscar associação à base de dados
  try {
    const resp = await fetch(`http://localhost:3000/api/carro_estacao/${carroSelecionado}`);
    if (resp.ok) {
      const assoc = await resp.json();
      if (assoc && assoc.estacao_id) {
        // Buscar dados reais da estação à API
        const estacaoResp = await fetch(`https://api.openchargemap.io/v3/poi/?output=json&chargepointid=${assoc.estacao_id}&countrycode=PT&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`);
        const estacoes = await estacaoResp.json();
        const ponto = estacoes && estacoes.length > 0 ? estacoes[0] : null;
        if (ponto) {
          const addr = ponto.AddressInfo;
          const latR = addr.Latitude;
          const lonR = addr.Longitude;
          const tituloR = addr.Title;
          const enderecoR = addr.AddressLine1;
          const totalR = ponto.NumberOfPoints ?? 1;
          const availableR = calcularDisponiveis(ponto, reservas, assoc.estacao_id);
          const popupContent = criarPopupComReserva(tituloR, enderecoR, availableR, totalR, assoc.estacao_id);
          const marker = createColoredMarker(latR, lonR, 'green', popupContent, true);
          marker.addTo(map);
          markers.push(marker);

          // Só faz setView se mudou de estação associada ou se está muito longe
          const precisaZoom = !ultimaEstacaoAssociada ||
            ultimaEstacaoAssociada.estacao_id !== assoc.estacao_id ||
            map.getBounds().contains([latR, lonR]) === false;

          ultimaEstacaoAssociada = { estacao_id: assoc.estacao_id, lat: latR, lon: lonR };

          if (precisaZoom) {
            map.setView([latR, lonR], 17, { animate: true });
          }
        }
        return;
      }
    }
  } catch (e) {
    // Se falhar, ignora e mostra normalmente
  }

  // Se não houver associação, mostra todas as estações normalmente
  fetch(`https://api.openchargemap.io/v3/poi/?output=json&countrycode=PT&latitude=${lat}&longitude=${lon}&maxresults=50&distance=${distancia}&distanceunit=KM&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`)
    .then(response => response.json())
    .then(data => {
      Object.entries(reservas).forEach(([id, reserva]) => {
        const pontoReservado = data.find(p => (p.ID == id));
        let latR, lonR, tituloR, enderecoR, availableR, totalR;
        if (pontoReservado) {
          const addr = pontoReservado.AddressInfo;
          latR = addr.Latitude;
          lonR = addr.Longitude;
          tituloR = addr.Title;
          enderecoR = addr.AddressLine1;
          totalR = pontoReservado.NumberOfPoints ?? 1;
          availableR = calcularDisponiveis(pontoReservado, reservas, id);
        } else {
          return;
        }
        const popupContent = criarPopupComReserva(tituloR, enderecoR, availableR, totalR, id);
        const marker = createColoredMarker(latR, lonR, 'green', popupContent, true);
        marker.addTo(map);
        markers.push(marker);
      });

      data.forEach((ponto, index) => {
        const id = ponto.ID || `station-${index}`;
        if (reservas[id]) return;
        const { AddressInfo, NumberOfPoints } = ponto;
        const lat = AddressInfo.Latitude;
        const lon = AddressInfo.Longitude;
        const titulo = AddressInfo.Title;
        const endereco = AddressInfo.AddressLine1;
        const total = NumberOfPoints ?? 1;
        const available = calcularDisponiveis(ponto, reservas, id);
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

async function chegueiReserva(id) {
  if (!(id in reservas)) return;
  if (reservas[id].cheguei) return;
  reservas[id].cheguei = true;
  // Só devolve saldo se foi reserva
  if (reservas[id].status === 'reservado') {
    const ok = await descontarSaldo(-1);
    if (!ok) {
      alert('Erro ao devolver saldo.');
      return;
    }
    alert('Chegada confirmada! O saldo foi devolvido.');
  } else {
    alert('Chegada confirmada!');
  }
  atualizarMarcadores();
}
window.chegueiReserva = chegueiReserva;

carregarEstacoes();
window.mostrarFormularioReserva = mostrarFormularioReserva;
window.confirmarReserva = confirmarReserva;
window.iniciarAgora = iniciarAgora;
window.cancelarReserva = cancelarReserva;
window.chegueiReserva = chegueiReserva;
map.on('moveend', () => carregarEstacoes(false));