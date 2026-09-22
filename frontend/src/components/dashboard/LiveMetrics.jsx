/**
 * LiveMetrics - Compact live city status metrics
 */

export function LiveMetrics({ potholes, isConnected }) {
  const count = isConnected ? potholes.length : null;
  const severe = isConnected ? potholes.filter((p) => p.severity === "severe").length : null;
  const deteriorating = isConnected ? potholes.filter((p) => p.riskScore >= 70).length : null;

  return (
    <section className="metrics-panel" aria-label="Live city status">
      <div className="metrics-header">
        <span>LIVE CITY STATUS</span>
      </div>
      <div className="metric-grid">
        <div>
          <span>Known hazards</span>
          <strong>{count ?? "--"}</strong>
        </div>
        <div>
          <span>Severe</span>
          <strong>{severe ?? "--"}</strong>
        </div>
        <div>
          <span>Deteriorating</span>
          <strong>{deteriorating ?? "--"}</strong>
        </div>
      </div>
    </section>
  );
}