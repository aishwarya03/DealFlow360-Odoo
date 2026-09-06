import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

import Button from '../components/Button';
import Logo from '../components/Logo';

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
    <div className="animate-slide-up">
      <Logo />

      <div className="relative mt-10 select-none">
        <p className="text-[7rem] font-bold leading-none tracking-tight text-slate-200 sm:text-[9rem]">
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
            <Compass className="size-8 text-brand-600" aria-hidden="true" />
          </div>
        </div>
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
        This page doesn&apos;t exist
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        The link may be broken, or you don&apos;t have access to this page.
        Double-check the address, or head back to somewhere familiar.
      </p>

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link to="/">
          <Button variant="secondary">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Button>
        </Link>
        <Link to="/workspace">
          <Button variant="primary">Go to workspace</Button>
        </Link>
      </div>
    </div>
  </div>
);

export default NotFound;
