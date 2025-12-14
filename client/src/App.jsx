import { useState, useEffect } from 'react'
import ServiceForm from './components/ServiceForm'
import ServiceList from './components/ServiceList'
import ClientManager from './components/ClientManager'
import DispatcherManager from './components/DispatcherManager'

import Login from './components/Login'
import { supabase } from './supabaseClient'
import { authenticatedFetch } from './api'

function App() {
  const [session, setSession] = useState(null)
  const [services, setServices] = useState([]);
  const [view, setView] = useState('services'); // 'services', 'clients', 'dispatchers'

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
      const response = await authenticatedFetch('/services');
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
      <div className="header-container">
        <h1 className="app-title">Despachante Manager</h1>
        <button
          onClick={handleLogout}
          className="logout-btn"
        >
          Sair
        </button>
      </div>

      <div className="nav-container">
        <button
          onClick={() => setView('services')}
          className={`nav-btn ${view === 'services' ? 'active' : 'inactive'}`}
        >
          Serviços
        </button>
        <button
          onClick={() => setView('clients')}
          className={`nav-btn ${view === 'clients' ? 'active' : 'inactive'}`}
        >
          Clientes (Lojas)
        </button>
        <button
          onClick={() => setView('dispatchers')}
          className={`nav-btn ${view === 'dispatchers' ? 'active' : 'inactive'}`}
        >
          Despachantes
        </button>
      </div>

      {view === 'services' ? (
        <>
          <ServiceForm onServiceAdded={fetchServices} />
          <ServiceList services={services} onRefresh={fetchServices} />
        </>
      ) : view === 'clients' ? (
        <ClientManager />
      ) : (
        <DispatcherManager />
      )}
    </div>
  );
}

export default App;
