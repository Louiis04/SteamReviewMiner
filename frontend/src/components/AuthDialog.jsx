import { useEffect, useState } from 'react';

const initialForm = { email: '', password: '', displayName: '' };

const AuthDialog = ({ open, mode = 'login', loading, error, onClose, onSubmit, onSwitch }) => {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    onSubmit(mode, form);
  };

  const title = mode === 'login' ? 'Entrar' : 'Criar conta';
  const toggleLabel = mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já possui conta? Entrar';

  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="auth-modal card shadow-lg">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 className="mb-1">{title}</h5>
              <p className="text-muted small mb-0">Gerencie seus favoritos e personalize a experiência.</p>
            </div>
            <button type="button" className="btn btn-sm btn-light" onClick={onClose} disabled={loading}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
          {error ? <div className="alert alert-danger py-2" role="alert">{error}</div> : null}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="mb-3">
              <label htmlFor="auth-email" className="form-label">Email</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                required
                autoFocus
                disabled={loading}
              />
            </div>
            {mode === 'register' ? (
              <div className="mb-3">
                <label htmlFor="auth-display" className="form-label">Apelido (opcional)</label>
                <input
                  id="auth-display"
                  name="displayName"
                  type="text"
                  className="form-control"
                  value={form.displayName}
                  onChange={handleChange}
                  maxLength={120}
                  disabled={loading}
                />
              </div>
            ) : null}
            <div className="mb-3">
              <label htmlFor="auth-password" className="form-label">Senha</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Enviando...' : title}
            </button>
            <button type="button" className="btn btn-link w-100 mt-2" onClick={onSwitch} disabled={loading}>
              {toggleLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthDialog;
