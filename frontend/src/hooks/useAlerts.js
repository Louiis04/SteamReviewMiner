import { useCallback, useEffect, useRef, useState } from 'react';

export const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const timeouts = useRef({});

  useEffect(() => () => {
    Object.values(timeouts.current).forEach((timeoutId) => clearTimeout(timeoutId));
  }, []);

  const dismissAlert = useCallback((id) => {
    const timeoutId = timeouts.current[id];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete timeouts.current[id];
    }
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const pushAlert = useCallback((message, variant = 'info') => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `alert-${Date.now()}-${Math.random()}`;
    setAlerts((prev) => [...prev, { id, message, variant }]);
    const timeoutId = setTimeout(() => dismissAlert(id), 5000);
    timeouts.current[id] = timeoutId;
  }, [dismissAlert]);

  return { alerts, pushAlert, dismissAlert };
};
