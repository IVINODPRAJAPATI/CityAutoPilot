window.ExplainabilityEngine = (function() {
  const explanations = {}; 

  function logChange(i, j, intervention, reason, impact) {
    const key = i + "_" + j;
    explanations[key] = {
      cell: [i, j],
      intervention: intervention,
      reason: reason,
      impact: impact
    };
  }

  function getExplanation(i, j) {
    const key = i + "_" + j;
    return explanations[key] || null;
  }
  
  function getAllExplanations() {
    return explanations;
  }
  
  function clearExplanations() {
    for (const key in explanations) {
      delete explanations[key];
    }
  }

  return { logChange, getExplanation, getAllExplanations, clearExplanations };
})();
