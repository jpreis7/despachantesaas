import { useState, useEffect } from 'react'
import ServiceForm from './components/ServiceForm'
import ServiceList from './components/ServiceList'
import ClientManager from './components/ClientManager'
import ConfirmationModal from './components/ConfirmationModal'
import Login from './components/Login'
import { supabase } from './supabaseClient'
import { authenticatedFetch } from './api'

function App() {
  const [session, setSession] = useState(null)
  const [services, setServices] = useState([]);
  const [view, setView] = useState('services'); // 'services' or 'clients'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:3001/api/services');
      const result = await response.json();
      if (result.message === 'success') {
        setServices(result.data);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchServices();
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Login />
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Despachante Manager</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'inherit'
          }}
        >
          Sair
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <button
          onClick={() => setView('services')}
          style={{
            backgroundColor: view === 'services' ? '#2563eb' : '#4b5563',
            color: 'white',
            padding: '0.8rem 2rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Serviços
        </button>
        <button
          onClick={() => setView('clients')}
          style={{
            backgroundColor: view === 'clients' ? '#2563eb' : '#4b5563',
            color: 'white',
            padding: '0.8rem 2rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Clientes (Lojas)
        </button>
      </div>

      {view === 'services' ? (
        <>
          <ServiceForm onServiceAdded={fetchServices} />
          <ServiceList services={services} />
        </>
      ) : (
        <ClientManager />
      )}
    </div>
  );
}

export default App;
