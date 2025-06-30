function calculate() {
  const currentHome = +document.getElementById("currentHome").value;
  const mortgageRemaining = +document.getElementById("mortgageRemaining").value;
  const newHome = +document.getElementById("newHome").value;
  const downPercent = +document.getElementById("downPercent").value / 100;
  const newRate = +document.getElementById("newRate").value / 100;
  const loanTerm = +document.getElementById("loanTerm").value;
  const availableSavings = +document.getElementById("savingsEUR").value;
  const lifestyleExpenses = +document.getElementById("lifestyleExpenses").value;
  const inflation = +document.getElementById("inflationRate").value / 100;

  const equity = currentHome - mortgageRemaining;
  const requiredDown = newHome * downPercent;
  const savingsShortfall = Math.max(requiredDown - equity, 0);
  const actualDown = Math.min(equity, requiredDown);
  const loanAmount = newHome - actualDown;

  const monthlyRate = newRate / 12;
  const payments = loanTerm * 12;
  const monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));

  const cashUsed = savingsShortfall;
  const savingsAfterPurchase = availableSavings - cashUsed;

  document.getElementById("equityUsed").textContent = equity.toLocaleString();
  document.getElementById("requiredDown").textContent = requiredDown.toLocaleString();
  document.getElementById("savingsNeeded").textContent = savingsShortfall.toLocaleString();
  document.getElementById("loanAmount").textContent = loanAmount.toLocaleString();
  document.getElementById("monthlyPay").textContent = monthlyPayment.toFixed(2).toLocaleString();
  document.getElementById("cashUsed").textContent = cashUsed.toLocaleString();
  document.getElementById("remainingSavings").textContent = savingsAfterPurchase.toLocaleString();

  const sims = runSimulations(
    savingsAfterPurchase,
    monthlyPayment * 12,
    lifestyleExpenses,
    loanTerm,
    60,
    1000,
    inflation
  );

  const percentiles = computePercentiles(sims, [25, 50, 75]);
  renderChart(percentiles);
}

function runSimulations(initial, annualMortgage, lifestyle, loanYears, totalYears, runs, inflation) {
  const results = [];

  for (let i = 0; i < runs; i++) {
    let balance = initial;
    let lifestyleCost = lifestyle;
    const path = [];

    for (let year = 0; year < totalYears; year++) {
      const spy = randomClamped(0.07, 0.15);
      const cd = randomClamped(0.025, 0.005);
      const growth = 0.9 * spy + 0.1 * cd;

      balance *= 1 + growth;
      if (year < loanYears) balance -= annualMortgage;
      balance -= lifestyleCost;

      path.push(Math.max(balance, 0));
      lifestyleCost *= 1 + inflation;
    }

    results.push(path);
  }

  return results;
}

function computePercentiles(sims, percents) {
  const years = sims[0].length;
  const sortedPerYear = Array.from({ length: years }, (_, y) =>
    sims.map(run => run[y]).sort((a, b) => a - b)
  );

  return percents.map((p, i) => ({
    label: `${p}th Percentile`,
    data: sortedPerYear.map(vals => {
      const rank = Math.floor((p / 100) * vals.length);
      return vals[Math.min(rank, vals.length - 1)];
    }),
    borderColor: ['#f0ad4e', '#0275d8', '#5cb85c'][i],
    fill: false,
    tension: 0.25,
    pointRadius: 0
  }));
}

function renderChart(datasets) {
  const ctx = document.getElementById('costChart').getContext('2d');
  if (window.chartInstance) window.chartInstance.destroy();

  window.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datasets[0].data.map((_, i) => `Year ${i + 1}`),
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 12 },
          title: {
            display: true,
            text: 'Projected Savings Trajectories'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Savings' }
        },
        x: {
          title: { display: true, text: 'Years Into the Future' }
        }
      }
    }
  });
}

function randomClamped(mean, stddev) {
  let value;
  do {
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    value = mean + stddev * z;
  } while (Math.abs(value - mean) > 2 * stddev);
  return value;
}window.onload = calculate;

// Link savingsEUR and savingsUSD
const eurInput = document.getElementById("savingsEUR");
const usdInput = document.getElementById("savingsUSD");
const rateInput = document.getElementById("exchangeRate");

eurInput.addEventListener("input", () => {
  const rate = +rateInput.value;
  const eur = +eurInput.value;
  usdInput.value = (eur * rate).toFixed(2);
});

usdInput.addEventListener("input", () => {
  const rate = +rateInput.value;
  const usd = +usdInput.value;
  eurInput.value = rate ? (usd / rate).toFixed(2) : "";
});

rateInput.addEventListener("input", () => {
  eurInput.dispatchEvent(new Event("input"));
});

// Initial render
window.onload = calculate;