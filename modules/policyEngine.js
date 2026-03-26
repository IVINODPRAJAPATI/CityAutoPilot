window.PolicyEngine = (function() {
  function getWeights(policyMode) {
    switch (policyMode) {
      case window.Constants.POLICIES.BALANCED:
        return { heat: 1.0, flood: 1.0, energy: 1.0, biodiversity: 1.0 };
      case window.Constants.POLICIES.FLOOD:
        return { heat: 0.2, flood: 2.0, energy: 0.5, biodiversity: 0.5 };
      case window.Constants.POLICIES.HEAT:
        return { heat: 2.0, flood: 0.2, energy: 1.0, biodiversity: 1.0 };
      case window.Constants.POLICIES.ECO:
        return { heat: 1.0, flood: 0.5, energy: 0.5, biodiversity: 2.0 };
      default:
        return { heat: 1.0, flood: 1.0, energy: 1.0, biodiversity: 1.0 };
    }
  }

  return { getWeights };
})();
