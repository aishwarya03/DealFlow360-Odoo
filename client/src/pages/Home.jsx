import { useState } from 'react';
import { pingBackend } from '../api/ping';

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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        Hackathon Boilerplate
      </h1>

      <button
        onClick={handlePing}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Ping Backend
      </button>

      {message && (
        <p className="text-lg font-medium">
          {message}
        </p>
      )}
    </div>
  );
};

export default Home;