const AlertStack = ({ alerts, onDismiss }) => (
  <div className="alert-stack">
    {alerts.map((alert) => (
      <div key={alert.id} className={`alert alert-${alert.variant} alert-dismissible fade show`} role="alert">
        {alert.message}
        <button type="button" className="btn-close" aria-label="Fechar" onClick={() => onDismiss(alert.id)} />
      </div>
    ))}
  </div>
);

export default AlertStack;
