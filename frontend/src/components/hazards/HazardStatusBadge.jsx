/**
 * HazardStatusBadge - Status indicator
 */

const STATUS_COLORS = {
  active: { bg: "#fee2e2", text: "#991b1b" },
  fixed: { bg: "#dcfce7", text: "#166534" },
  needs_review: { bg: "#fef3c7", text: "#92400e" }
};

export function HazardStatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.active;
  const label = status === "needs_review" ? "Needs review" : status;

  return (
    <span
      className="status-badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}
