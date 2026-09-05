import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <>
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </AuthProvider>
    <CartProvider>
      <AppRoutes />
      <Toaster position="bottom-right" toastOptions={{ duration: 2500 }} />
    </CartProvider>
    </>
  );
}

export default App;
