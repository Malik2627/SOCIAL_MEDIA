import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateRegisterForm } from '../utils/authValidation.js';
import '../styles/auth.css';

export default function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
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

    const { isValid, errors, userData } = validateRegisterForm(formData);
    if (!isValid) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await register(userData);
      navigate('/', { replace: true });
    } catch (error) {
      setApiError(error?.message || 'Unable to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting || loading;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="register-heading">
        <header className="auth-header">
          <span className="auth-brand">Social Media</span>
          <h1 id="register-heading" className="auth-title">
            Create your account
          </h1>
          <p className="auth-subtitle">Join the community in a few quick steps.</p>
        </header>

        {apiError && (
          <div className="auth-banner-error" role="alert">
            {apiError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-name">
              Name
            </label>
            <input
              id="register-name"
              name="name"
              type="text"
              className={`auth-input${fieldErrors.name ? ' auth-input--error' : ''}`}
              value={formData.name}
              onChange={handleChange}
              placeholder="Alex Morgan"
              autoComplete="name"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="register-name-error" className="auth-field-error" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-username">
              Username
            </label>
            <input
              id="register-username"
              name="username"
              type="text"
              className={`auth-input${fieldErrors.username ? ' auth-input--error' : ''}`}
              value={formData.username}
              onChange={handleChange}
              placeholder="alexmorgan"
              autoComplete="username"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'register-username-error' : undefined}
            />
            {fieldErrors.username && (
              <p id="register-username-error" className="auth-field-error" role="alert">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              className={`auth-input${fieldErrors.email ? ' auth-input--error' : ''}`}
              value={formData.email}
              onChange={handleChange}
              placeholder="alex@example.com"
              autoComplete="email"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="register-email-error" className="auth-field-error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <PasswordField
            id="register-password"
            name="password"
            label="Password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            disabled={isBusy}
            error={fieldErrors.password}
          />

          <PasswordField
            id="register-confirm-password"
            name="confirmPassword"
            label="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={isBusy}
            error={fieldErrors.confirmPassword}
          />

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-bio">
              Bio <span className="auth-label-optional">(Optional)</span>
            </label>
            <textarea
              id="register-bio"
              name="bio"
              className={`auth-textarea${fieldErrors.bio ? ' auth-textarea--error' : ''}`}
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell people a little about yourself"
              maxLength={250}
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.bio)}
              aria-describedby={fieldErrors.bio ? 'register-bio-error' : undefined}
            />
            {fieldErrors.bio && (
              <p id="register-bio-error" className="auth-field-error" role="alert">
                {fieldErrors.bio}
              </p>
            )}
          </div>

          <div className="auth-actions">
            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={isBusy}
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <footer className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </footer>
      </section>
    </main>
  );
}

