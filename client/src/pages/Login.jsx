import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../lib/roles';

/*
 * Hackathon convenience, not a feature: every seeded account uses the same
 * password (prisma/seed.js in server/), so a judge or teammate can try every
 * role in seconds without hunting for credentials.
 */
const DEMO_ACCOUNTS = [
  { email: 'admin@dealflow360.com', role: 'ADMIN' },
  { email: 'rep@dealflow360.com', role: 'SALES_REP' },
  { email: 'manager@dealflow360.com', role: 'SALES_MANAGER' },
  { email: 'finance@dealflow360.com', role: 'FINANCE' },
];
const DEMO_PASSWORD = 'Password123';

const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already signed in — don't show the form again.
  if (user) {
    return <Navigate to={location.state?.from?.pathname ?? '/workspace'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      toast.success('Logged in');
      navigate(location.state?.from?.pathname ?? '/workspace', { replace: true });
    } catch (err) {
      // The API deliberately returns the same message for an unknown email
      // and a wrong password — see docs/API.html "Login". Shown verbatim.
      setError(err.response?.data?.message ?? 'Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <Logo className="mb-8" />

      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Staff sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Internal workspace — rep, manager, finance and admin.
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <div className="mt-6 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Demo accounts · password {DEMO_PASSWORD}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-md border border-slate-200 px-2.5 py-2 text-left text-xs transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="block font-medium text-slate-700">
                {ROLES[account.role].label}
              </span>
              <span className="text-slate-400">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Login;
