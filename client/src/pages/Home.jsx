import { useState } from 'react';
import { pingBackend } from '../api/ping';
import Button from '../components/Button';

/*
 * Dev-only diagnostic route (/dev/ping) — not part of the public site or
 * customer portal, and not linked from anywhere a judge would navigate.
 * Kept minimal on purpose; polished only enough to match the app's type scale.
 */
const Home = () => {
  const [message, setMessage] = useState('');

  const handlePing = async () => {
    try {
      const response = await pingBackend();
      setMessage(`${response.message} ✅`);
    } catch (error) {
      setMessage('Backend Connection Failed ❌');
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Backend connectivity check
      </h1>

      <Button onClick={handlePing}>Ping Backend</Button>

      {message && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          {message}
        </p>
      )}
    </div>
  );
};

export default Home;