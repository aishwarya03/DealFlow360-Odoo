import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { usePortalAuth } from '../hooks/usePortalAuth';

/*
 * Sign-in for the customer portal — a separate token audience from staff
 * login (see client/src/api/portal.js). Lands back wherever the customer
 * came from (e.g. /request-quote with their cart still intact) so signing
 * in mid-checkout doesn't lose their place.
 */
const PortalLogin = () => {
  useBrandTag(`Customer Login · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = usePortalAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(location.state?.from ?? '/request-quote', {
        replace: true,
        state: location.state?.items ? { items: location.state.items } : undefined,
      });
    } catch (err) {
      if (err.response?.status === 404) {
        // No account with this email — send them to create one instead of
        // dead-ending on a login form they can't get past.
        navigate('/request-quote', {
          replace: true,
          state: { email, items: location.state?.items },
        });
        return;
      }
      setError(err.response?.data?.message ?? 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Card>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Sign in to your account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track your quotations and pick up where you left off.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error || undefined}
              required
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          New here?{' '}
          <Link to="/request-quote" className="font-medium text-brand-600 hover:text-brand-700">
            Request a quote to create an account
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
};

export default PortalLogin;
