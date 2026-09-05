import { Link } from 'react-router-dom';

import Button from '../components/Button';
import Logo from '../components/Logo';

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <Logo />
    <p className="mt-8 text-sm font-medium text-brand-600">404</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
      Page not found
    </h1>
    <p className="mt-2 text-sm text-slate-500">
      That page doesn&apos;t exist, or you don&apos;t have access to it.
    </p>
    <Link to="/" className="mt-6">
      <Button variant="secondary">Back to home</Button>
    </Link>
  </div>
);

export default NotFound;
