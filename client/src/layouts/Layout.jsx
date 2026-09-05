import Navbar from '../components/NavBar';

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto p-4">
        {children}
      </main>
    </>
  );
};

export default Layout;