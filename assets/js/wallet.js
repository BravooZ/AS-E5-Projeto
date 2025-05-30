// Monthly and yearly data for charts
const monthlyLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthlyData = [320, 290, 310, 280, 260, 250, 240, 245, 255, 270, 300, 315];

const yearlyLabels = ['2021', '2022', '2023', '2024', '2025'];
const yearlyData = [3200, 3400, 3100, 3500, 3700];

// Monthly chart
new Chart(document.getElementById('monthlyChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: monthlyLabels,
        datasets: [{
            label: 'Consumption (kWh)',
            data: monthlyData,
            borderColor: '#4bc0c0',
            backgroundColor: 'rgba(75,192,192,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#4bc0c0'
        }]
    },
    options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    }
});

// Yearly chart
new Chart(document.getElementById('yearlyChart').getContext('2d'), {
    type: 'bar',
    data: {
        labels: yearlyLabels,
        datasets: [{
            label: 'Consumption (kWh)',
            data: yearlyData,
            backgroundColor: '#ffb74d'
        }]
    },
    options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    }
});
