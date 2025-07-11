function calculate() {
  const currentHome = +document.getElementById("currentHome").value;
  const mortgageRemaining = +document.getElementById("mortgageRemaining").value;
  const newHome = +document.getElementById("newHome").value;
  
  const newRate = +document.getElementById("newRate").value / 100;
  const loanTerm = +document.getElementById("loanTerm").value;
  const availableSavings = +document.getElementById("savingsEUR").value;
  const lifestyleExpenses = +document.getElementById("lifestyleExpenses").value;
  const inflation = +document.getElementById("inflationRate").value / 100;
  const annualIncome = +document.getElementById("annualIncome").value;
  const incomeCOLA = +document.getElementById("incomeCOLA").value / 100;

  const equityUsed = currentHome - mortgageRemaining;
  const dueToSeller = newHome - currentHome;
  const downPercent = currentHome / newHome;
  
  const loanAmount = newHome * (1 - downPercent);

  let monthlyPayment = 0;
  if (loanAmount > 0 && newRate > 0) {
    const monthlyRate = newRate / 12;
    const payments = loanTerm * 12;
    monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));
  }

  const cashUsed = mortgageRemaining;
  const savingsAfterPurchase = availableSavings - cashUsed;

  document.getElementById("equityUsed").textContent = equityUsed.toLocaleString();
  document.getElementById("dueToSeller").textContent = dueToSeller.toLocaleString();
  document.getElementById("downPercent").textContent = downPercent.toLocaleString();
  document.getElementById("loanAmount").textContent = loanAmount.toLocaleString();
  document.getElementById("monthlyPay").textContent = monthlyPayment.toLocaleString();
  document.getElementById("cashUsed").textContent = cashUsed.toLocaleString();
  document.getElementById("remainingSavings").textContent = savingsAfterPurchase.toLocaleString();

  let allDatasets = [];

  const runs = 10000;
  const years = +document.getElementById("numYears").value || 60;
  const marketPaths = generateMarketPaths(runs, years);

  // Only add "Current" if checked
  const plotCurrent = typeof renderScenarioList.currentChecked === "undefined" ? true : renderScenarioList.currentChecked;
  let sims, meanSigmaDatasets;
  if (plotCurrent) {
    sims = runSimulations(
      savingsAfterPurchase,
      monthlyPayment * 12,
      lifestyleExpenses,
      annualIncome,
      loanTerm,
      years,
      runs,
      inflation,
      incomeCOLA,
      marketPaths
    );
//    meanSigmaDatasets = computeMeanAndSigmaBands(
meanSigmaDatasets = computePercentileBands(

      sims,
      "Current",
      "#0275d8",
      "rgba(2,117,216,0.15)"
    );
    allDatasets.push(...meanSigmaDatasets);
  }

  // Add saved scenarios if checked
  savedScenarios.forEach((scenario) => {
    if (scenario.checked === false) return;
    const s = scenario.inputs;
    const equity = s.currentHome - s.mortgageRemaining;
    const requiredDown = s.newHome * (s.downPercent / 100);
    const actualDown = Math.min(equity, requiredDown);
    const loanAmount = s.newHome - actualDown;
    let monthlyPayment = 0;
    if (loanAmount > 0 && s.newRate > 0) {
      const monthlyRate = s.newRate / 100 / 12;
      const payments = s.loanTerm * 12;
      monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));
    }
    const cashUsed = Math.max(requiredDown - equity, 0);
    const savingsAfterPurchase = s.availableSavings - cashUsed;

    const simsSaved = runSimulations(
      savingsAfterPurchase,
      monthlyPayment * 12,
      s.lifestyleExpenses,
      s.annualIncome,
      s.loanTerm,
      years,
      runs,
      s.inflation / 100,
      s.incomeCOLA / 100,
      marketPaths
    );

    const meanSigmaSaved = computeMeanAndSigmaBands(
      simsSaved,
      scenario.label,
      "#5cb85c",
      "rgba(92,184,92,0.15)"
    );
    allDatasets.push(...meanSigmaSaved);
  });

  renderChart(allDatasets);

  // Only show assessment if "Current" is plotted
  if (plotCurrent && sims && meanSigmaDatasets) {
    scenarioAssessment(sims, meanSigmaDatasets);
  } else {
    document.getElementById("aiAssessment").textContent = "Assessment will appear here after calculation.";
  }
}

function debounce(fn, delay = 300) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}



// ==================== Simulation Logic ====================

const debouncedCalculate = debounce(calculate);


function runSimulations(initial, annualMortgage, lifestyle, annualIncome, loanYears, totalYears, runs, inflation, incomeCOLA, marketPaths) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    let balance = initial;
    let lifestyleCost = lifestyle;
    let income = annualIncome;
    const path = [];
    for (let year = 0; year < totalYears; year++) {
      const growth = marketPaths[i][year];
      balance *= 1 + growth;
      if (year < loanYears) balance -= annualMortgage;
      balance -= Math.max(lifestyleCost - income, 0);
      path.push(balance); // ✅ allows negative values
      lifestyleCost *= 1 + inflation;
      income *= 1 + incomeCOLA;
    }
    results.push(path);
  }
  return results;
}



// ==================== Forecasting Logic ====================

function computePercentileBands(sims, labelBase = "Current", color = "#0275d8", bandColor = "rgba(2,117,216,0.15)") {
  const years = sims[0].length;
  const p10 = [], p50 = [], p90 = [];

  function getPercentile(sortedVals, percentile) {
    const idx = Math.floor((percentile / 100) * sortedVals.length);
    return sortedVals[Math.min(idx, sortedVals.length - 1)];
  }

  for (let y = 0; y < years; y++) {
    const vals = sims.map(run => run[y]).sort((a, b) => a - b);
    p10.push(getPercentile(vals, 10));
    p50.push(getPercentile(vals, 50));
    p90.push(getPercentile(vals, 90));
  }

  return [
    {
      label: `10th Percentile (${labelBase})`,
      data: p10,
      borderColor: bandColor,
      backgroundColor: bandColor,
      fill: '+1',
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.25
    },
    {
      label: `90th Percentile (${labelBase})`,
      data: p90,
      borderColor: bandColor,
      backgroundColor: bandColor,
      fill: false,
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.25
    },
    {
      label: `Median (50th Percentile - ${labelBase})`,
      data: p50,
      borderColor: color,
      backgroundColor: color,
      fill: false,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25
    },
    {
      label: "Savings Deficit Zone",
      data: p10.map(v => (v < 0 ? v : null)),
      backgroundColor: "rgba(220,53,69,0.1)",
      borderColor: "rgba(220,53,69,0.3)",
      fill: true,
      pointRadius: 0,
      borderWidth: 1,
      tension: 0.25
    }
  ];
}




// ==================== Chart Rendering ====================

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
          labels: { font: { size: 14 } }
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
          title: { display: true, text: 'Year', font: { size: 16 } },
          ticks: {
            font: { size: 13 },
            callback: function(value, index) {
              return (index + 1) % 5 === 0 ? String(index + 1).padStart(2, '0') : '';
            }
          }
        },
        y: {
          title: { display: true, text: 'Savings (M€)', font: { size: 16 } },
          ticks: {
            font: { size: 13 },
            callback: function(value) {
              return (value / 1e6).toFixed(1);
            }
          },
          grid: { color: '#e0e0e0' },
          beginAtZero: false,
          suggestedMin: -10000
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


function scenarioAssessment(sims, percentileDatasets) {
  const successRate = sims.filter(path => path.every(v => v > 0)).length / sims.length;

  let message = "";
  if (successRate > 0.95) {
    message = "✅ Your plan is very robust. In almost all scenarios, your savings last for the full period.";
  } else if (successRate > 0.75) {
    message = "🟡 Your plan is fairly safe, but there is some risk in adverse markets.";
  } else {
    message = "⚠️ Warning: In many scenarios, your savings may run out. Consider adjusting your expenses or increasing your income.";
  }

  const tenthPercentileCurve = percentileDatasets[0].data;
  const depletionYear = tenthPercentileCurve.findIndex(v => v <= 0);
  if (depletionYear >= 0) {
    message += ` <span style="color: red;">Based on the 10th percentile curve, your savings could be depleted by year ${depletionYear + 1}.</span>`;
  }
  document.getElementById("aiAssessment").innerHTML = message;
}


function generateMarketPaths(runs, years) {
  const paths = [];
  for (let i = 0; i < runs; i++) {
    const path = [];
    for (let year = 0; year < years; year++) {
      const spy = randomClamped(0.07, 0.15);
      const cd = randomClamped(0.025, 0.005);
      const growth = 0.9 * spy + 0.1 * cd;
      path.push(growth);
    }
    paths.push(path);
  }
  return paths;
}

function renderScenarioList() {
  const listDiv = document.getElementById("scenarioList");
  if (!listDiv) return;
  listDiv.innerHTML = '';

  // Get checked status for current scenario (default to true if not set)
  if (typeof renderScenarioList.currentChecked === "undefined") {
    renderScenarioList.currentChecked = true;
  }

  // Build the list: current + saved
  const all = [
    { label: "Current", checked: renderScenarioList.currentChecked, idx: -1 }
  ].concat(
    savedScenarios.map((s, i) => ({
      label: s.label,
      checked: s.checked !== false,
      idx: i
    }))
  );

  all.forEach(s => {
    const id = "scenarioCheck_" + s.idx;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.checked = s.checked;
    cb.onchange = () => {
      if (s.idx === -1) {
        renderScenarioList.currentChecked = cb.checked;
      } else {
        savedScenarios[s.idx].checked = cb.checked;
      }
      // If all are unchecked, force "Current" to be checked
      const anyChecked = (renderScenarioList.currentChecked || false) ||
        savedScenarios.some(ss => ss.checked !== false);
      if (!anyChecked) {
        renderScenarioList.currentChecked = true;
      }
      renderScenarioList();
      calculate();
    };
    const label = document.createElement("label");
    label.htmlFor = id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + s.label));
    listDiv.appendChild(label);
  });
}

// --- Currency sync logic ---
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

// On page load, calculate EUR from USD and render scenario list
window.addEventListener("DOMContentLoaded", () => {
  if (typeof rateInput !== "undefined" && typeof usdInput !== "undefined" && typeof eurInput !== "undefined") {
    const rate = +rateInput.value;
    const usd = +usdInput.value;
    eurInput.value = rate ? (usd / rate).toFixed(2) : "";
  }
  renderScenarioList();
  calculate();
});

let savedScenarios = [];

document.getElementById("saveScenarioBtn").addEventListener("click", () => {
  // Gather current input values
  const scenarioInputs = {
    currentHome: +document.getElementById("currentHome").value,
    mortgageRemaining: +document.getElementById("mortgageRemaining").value,
    newHome: +document.getElementById("newHome").value,
    downPercent: +document.getElementById("downPercent").value,
    newRate: +document.getElementById("newRate").value,
    loanTerm: +document.getElementById("loanTerm").value,
    availableSavings: +document.getElementById("savingsEUR").value,
    lifestyleExpenses: +document.getElementById("lifestyleExpenses").value,
    inflation: +document.getElementById("inflationRate").value,
    annualIncome: +document.getElementById("annualIncome").value,
    incomeCOLA: +document.getElementById("incomeCOLA").value
  };

  // Check for duplicate scenario (same inputs)
  const existing = savedScenarios.find(s =>
    JSON.stringify(s.inputs) === JSON.stringify(scenarioInputs)
  );
  if (existing) {
    showScenarioModal(existing.label, scenarioInputs);
    return;
  }

  const label = prompt("Enter a name for this scenario:", `Scenario ${savedScenarios.length + 1}`);
  if (!label) return;

  savedScenarios.push({ label, inputs: scenarioInputs });
  renderScenarioList();
  alert(`Scenario "${label}" saved! When you click Evaluate, all saved scenarios will be shown on the chart.`);
  calculate();
});

// Modal logic
function showScenarioModal(existingLabel, scenarioInputs) {
  const modal = document.getElementById("scenarioModal");
  const msg = document.getElementById("scenarioModalMsg");
  const input = document.getElementById("scenarioModalInput");
  const yesBtn = document.getElementById("scenarioModalYes");
  const noBtn = document.getElementById("scenarioModalNo");

  msg.textContent = `The scenario already exists, it's called "${existingLabel}". Would you like to save it with a different name?`;
  input.value = "";
  input.style.display = "block";
  modal.style.display = "flex";

  yesBtn.onclick = () => {
    const label = input.value.trim() || `Scenario ${savedScenarios.length + 1}`;
    savedScenarios.push({ label, inputs: scenarioInputs });
    modal.style.display = "none";
    renderScenarioList();
    alert(`Scenario "${label}" saved! When you click Evaluate, all saved scenarios will be shown on the chart.`);
    calculate();
  };
  noBtn.onclick = () => {
    modal.style.display = "none";
  };
}

window.onload = () => {
  calculate(); // Initial run

  const inputIds = [
    "currentHome",
    "mortgageRemaining",
    "newHome",
    "downPercent",
    "newRate",
    "loanTerm",
    "savingsEUR",
    "lifestyleExpenses",
    "inflationRate",
    "annualIncome",
    "incomeCOLA",
    "exchangeRate",
    "savingsUSD",
    "numYears"
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", debouncedCalculate);
    }
  });
};
