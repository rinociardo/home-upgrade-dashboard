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
  const annualIncome = +document.getElementById("annualIncome").value;
  const incomeCOLA = +document.getElementById("incomeCOLA").value / 100;

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
    annualIncome,
    loanTerm,
    60,
    1000,
    inflation,
    incomeCOLA
  );

  // Use 40th, 50th, 60th percentiles and custom labels/colors
  const percentiles = computePercentiles(
    sims,
    [40, 50, 60],
    ["Bad-Markets Scenario", "Most Likely Scenario", "Good-Markets Scenario"],
    ["#f0ad4e", "#0275d8", "#5cb85c"]
  );
  renderChart(percentiles);
  scenarioAssessment(sims, percentiles);
}

function runSimulations(initial, annualMortgage, lifestyle, annualIncome, loanYears, totalYears, runs, inflation, incomeCOLA) {
  const results = [];

  for (let i = 0; i < runs; i++) {
    let balance = initial;
    let lifestyleCost = lifestyle;
    let income = annualIncome;
    const path = [];

    for (let year = 0; year < totalYears; year++) {
      const spy = randomClamped(0.07, 0.15);
      const cd = randomClamped(0.025, 0.005);
      const growth = 0.9 * spy + 0.1 * cd;

      balance *= 1 + growth;
      if (year < loanYears) balance -= annualMortgage;
      // Subtract net expenses (lifestyle - income)
      balance -= Math.max(lifestyleCost - income, 0);

      path.push(Math.max(balance, 0));
      lifestyleCost *= 1 + inflation;
      income *= 1 + incomeCOLA;
    }

    results.push(path);
  }

  return results;
}

function computePercentiles(sims, percents, labels, colors) {
  const years = sims[0].length;
  const sortedPerYear = Array.from({ length: years }, (_, y) =>
    sims.map(run => run[y]).sort((a, b) => a - b)
  );

  return percents.map((p, i) => ({
    label: labels[i],
    data: sortedPerYear.map(vals => {
      const rank = Math.floor((p / 100) * vals.length);
      return vals[Math.min(rank, vals.length - 1)];
    }),
    borderColor: colors[i],
    backgroundColor: i === 0 ? 'rgba(2,117,216,0.08)' : undefined, // Only fill for "Worse" (will use fill: +1)
    fill: i === 0 ? '+1' : false, // Fill between 0 and 1 (Worse and Better)
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
      labels: datasets[0].data.map((_, i) => (i + 1) % 5 === 0 ? String(i + 1).padStart(2, '0') : ''),
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Projected Savings Over Time',
          font: { size: 20 }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 14 }
          }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `€${(context.parsed.y / 1e6).toFixed(2)}M`;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Year',
            font: { size: 16 }
          },
          ticks: {
            font: { size: 13 },
            callback: function(value, index) {
              return (index + 1) % 5 === 0 ? String(index + 1).padStart(2, '0') : '';
            }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Savings (M€)',
            font: { size: 16 }
          },
          ticks: {
            font: { size: 13 },
            callback: function(value) {
              return (value / 1e6).toFixed(1);
            }
          },
          grid: { color: '#e0e0e0' }
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
}

function scenarioAssessment(sims, percentiles) {
  // % of runs where savings never go below zero
  const successRate = sims.filter(path => path.every(v => v > 0)).length / sims.length;

  let message = "";
  if (successRate > 0.95) {
    message = "✅ Your plan is very robust. In almost all scenarios, your savings last for the full period.";
  } else if (successRate > 0.75) {
    message = "🟡 Your plan is fairly safe, but there is some risk in adverse markets.";
  } else {
    message = "⚠️ Warning: In many scenarios, your savings may run out. Consider adjusting your expenses or increasing your income.";
  }

  // Show if "Bad-Markets Scenario" hits zero
  if (percentiles[0].data.some(v => v <= 0)) {
    message += " In the worst-case scenario, your savings could be depleted before the end of the period.";
  }

  document.getElementById("aiAssessment").textContent = message;
}

window.onload = calculate;

// Link savingsEUR and savingsUSD
const eurInput = document.getElementById("savingsEUR");
const usdInput = document.getElementById("savingsUSD");
const rateInput = document.getElementById("exchangeRate");

// USD to EUR
usdInput.addEventListener("input", () => {
  const rate = +rateInput.value;
  const usd = +usdInput.value;
  eurInput.value = rate ? (usd / rate).toFixed(2) : "";
});

// EUR to USD
eurInput.addEventListener("input", () => {
  const rate = +rateInput.value;
  const eur = +eurInput.value;
  usdInput.value = (eur * rate).toFixed(2);
});

// Exchange rate change updates EUR if USD is set, or USD if EUR is set
rateInput.addEventListener("input", () => {
  const rate = +rateInput.value;
  if (usdInput.value) {
    eurInput.value = rate ? (+usdInput.value / rate).toFixed(2) : "";
  } else if (eurInput.value) {
    usdInput.value = (eurInput.value * rate).toFixed(2);
  }
});

// On page load, calculate EUR from USD
window.addEventListener("DOMContentLoaded", () => {
  const rate = +rateInput.value;
  const usd = +usdInput.value;
  eurInput.value = rate ? (usd / rate).toFixed(2) : "";
});