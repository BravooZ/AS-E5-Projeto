document.querySelector('.login-button').addEventListener('click', function(event) {
    event.preventDefault(); 

    const email = document.querySelector('.login-input[type="text"]').value;
    const password = document.querySelector('.login-input[type="password"]').value;

    const predefinedAccounts = [
        { email: 'tiago.s.s.vieira@ua.pt', password: 'birdlover' },
        { email: 'susanadias@gmail.com', password: 'susanadias' } 
    ];

    const accountFound = predefinedAccounts.find(account => account.email === email && account.password === password);

    if (accountFound) {
        localStorage.setItem('email', email);
        localStorage.setItem('hasAccount', 'true');
        window.location.href = 'index.html';
    } else {
        showAlert('Membro não encontrado');
    }
});

document.querySelector('.guest-button').addEventListener('click', function(event) {
    event.preventDefault(); 

    const guestEmail = document.querySelector('.guest-input[type="text"]').value; 

    if (guestEmail === 'diogolinux@gmail.com' || guestEmail === 'susanadias@gmail.com') {
        alert('Invalido, email já associado a uma conta');
    } else if (guestEmail.includes("@gmail.com")) {
        localStorage.setItem('email', guestEmail);
        localStorage.setItem('hasAccount', 'false');
        window.location.href = 'index.html';
    } else {
        alert('Email inválido');
    }
});

function showAlert(message) {
    if (message) {
        alert(message);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    localStorage.clear();
});
