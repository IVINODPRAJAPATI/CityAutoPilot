window.Panels = (function() {
  let chartInstance = null;
  let chartData = [];

  function init() {
    const ctx = document.getElementById('score-chart');
    if (!ctx) return;
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Health Score',
          data: chartData,
          borderColor: '#30D158',
          backgroundColor: 'rgba(48, 209, 88, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { display: false },
          y: { min: 0, max: 100 }
        }
      }
    });

    const budgetSlider = document.getElementById('budget-slider');
    const budgetDisplay = document.getElementById('budget-display');
    if (budgetSlider && budgetDisplay) {
      budgetSlider.addEventListener('input', (e) => {
        budgetDisplay.textContent = e.target.value;
      });
    }

    const btnClose = document.getElementById('btn-close-popup');
    if (btnClose) {
      btnClose.addEventListener('click', hideExplanation);
    }
  }

  function updateMetrics(metrics, totalBudget) {
    if (!metrics) return;
    
    document.getElementById('val-temp').textContent = `${(metrics.avgTemp || 0).toFixed(1)}°C`;
    
    let floodStr = "LOW";
    if (metrics.floodRisk > 0.6) floodStr = "EXTREME";
    else if (metrics.floodRisk > 0.4) floodStr = "HIGH";
    else if (metrics.floodRisk > 0.2) floodStr = "MEDIUM";
    
    document.getElementById('val-flood').textContent = floodStr;
    document.getElementById('val-energy').textContent = `${(metrics.energyLoad || 0).toFixed(0)} kWh`;
    document.getElementById('val-biodiv').textContent = (metrics.biodiversity || 0).toFixed(2);
    document.getElementById('val-budget').textContent = `${(metrics.budgetUsed || 0).toFixed(1)} / ${totalBudget || 25}`;

    chartData.push(metrics.healthScore || 0);
    
    if (chartInstance) {
      chartInstance.data.labels = chartData.map((_, idx) => `Iter ${idx+1}`);
      chartInstance.update();
    }
  }

  function updateHealthScore(oldVal, newVal) {
    const el = document.getElementById('health-score-val');
    const indicator = document.getElementById('health-indicator');
    
    let start = oldVal || 0;
    let end = newVal || 0;
    
    if (start === end) {
      el.textContent = end.toFixed(0);
      updateColor(end);
      return;
    }

    let current = start;
    let step = (end - start) / 10;
    
    let timer = setInterval(() => {
      current += step;
      if ((step > 0 && current >= end) || (step < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      el.textContent = current.toFixed(0);
      updateColor(current);
    }, 50);

    function updateColor(val) {
      if (val < 40) {
        el.style.color = '#FF3B30';
        indicator.textContent = '🔴';
      } else if (val < 60) {
        el.style.color = '#FF9500';
        indicator.textContent = '🟡';
      } else {
        el.style.color = '#30D158';
        indicator.textContent = '🟢';
      }
    }
  }

  function showExplanation(x, y, data) {
    const popup = document.getElementById('explanation-popup');
    if (!popup) return;

    if (!data) {
        document.getElementById('exp-title').textContent = "STATIC CELL";
        document.getElementById('exp-reason').textContent = "This cell was not modified during optimization.";
        document.getElementById('exp-impact').innerHTML = "No changes applied.";
    } else {
        document.getElementById('exp-title').textContent = data.intervention ? data.intervention.replace(/_/g, ' ').toUpperCase() : "INTERVENTION";
        document.getElementById('exp-reason').textContent = data.reason || "Unknown reason.";
        
        let impactHtml = "";
        if (data.impact) {
          if (data.impact.tempDrop) impactHtml += `Temp Drop: ${data.impact.tempDrop.toFixed(1)}°C<br>`;
          if (data.impact.floodReduction) impactHtml += `Flood Reduced: ${data.impact.floodReduction.toFixed(0)}%<br>`;
          if (data.impact.cost) impactHtml += `Cost: ${data.impact.cost.toFixed(1)}<br>`;
        } else {
          impactHtml = "Impact data not provided.";
        }
        document.getElementById('exp-impact').innerHTML = impactHtml;
    }

    // Attempt to keep popup inside window boundaries
    let left = x + 15;
    let top = y + 15;
    
    // Quick clamp using approximate widths
    if (left + 250 > window.innerWidth) left = window.innerWidth - 270;
    if (top + 150 > window.innerHeight) top = window.innerHeight - 170;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.classList.add('visible');
  }

  function hideExplanation() {
    const popup = document.getElementById('explanation-popup');
    if (popup) {
      popup.classList.remove('visible');
    }
  }

  function resetChart() {
    chartData = [];
    if(chartInstance) {
      chartInstance.data.labels = [];
      chartInstance.update();
    }
  }

  return {
    init,
    updateMetrics,
    updateHealthScore,
    showExplanation,
    hideExplanation,
    resetChart
  };
})();
