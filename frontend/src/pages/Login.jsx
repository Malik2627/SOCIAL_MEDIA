import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateLoginForm } from '../utils/authValidation.js';
import '../styles/auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) {
      setApiError('');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError('');

    const { isValid, errors, values } = validateLoginForm(formData);
    if (!isValid) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch (error) {
      setApiError(error?.message || 'Unable to log in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting || loading;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-heading">
        <header className="auth-header">
          <span className="auth-brand">Social Media</span>
          <h1 id="login-heading" className="auth-title">
            Welcome back
          </h1>
          <p className="auth-subtitle">Sign in to continue to your account.</p>
        </header>

        {apiError && (
          <div className="auth-banner-error" role="alert">
            {apiError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              className={`auth-input${fieldErrors.email ? ' auth-input--error' : ''}`}
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="login-email-error" className="auth-field-error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isBusy}
            error={fieldErrors.password}
          />

          <div className="auth-actions">
            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={isBusy}
            >
              {submitting ? 'Logging in...' : 'Login'}
            </button>

            <Link to="/register" className="auth-btn auth-btn--secondary">
              Create Account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

