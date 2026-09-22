/**
 * ServerUnavailable - Offline/error state with retry
 */

import { AlertTriangle, RefreshCw } from "lucide-react";

export function ServerUnavailable({ error, onRetry }) {
  return (
    <section className="server-error" role="alert">
      <AlertTriangle size={28} aria-hidden />
      <div>
        <strong>SERVER UNAVAILABLE</strong>
        <p>Unable to load road hazard data.</p>
        {error && <p className="server-error-detail">{error}</p>}
      </div>
      <button type="button" onClick={onRetry} className="retry-button">
        <RefreshCw size={16} />
        Retry
      </button>
    </section>
  );
}