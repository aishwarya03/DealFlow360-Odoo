import { Toaster } from 'react-hot-toast';

import { CartProvider } from './context/CartContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <CartProvider>
      <AppRoutes />
      <Toaster position="bottom-right" toastOptions={{ duration: 2500 }} />
    </CartProvider>
  );
}

export default App;
