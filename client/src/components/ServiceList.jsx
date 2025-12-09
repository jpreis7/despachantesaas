import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch } from '../api';

export default function ServiceList({ services }) {
  const [filterClient, setFilterClient] = useState('');
  const [clients, setClients] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

  useEffect(() => {
    authenticatedFetch('/clients')
      .then(res => res.json())
      .then(data => {
        if (data.message === 'success') {
          setClients(data.data);
        }
      })
      .catch(console.error);
  }, []);

  const filteredServices = useMemo(() => {
    if (!filterClient) return services;
    return services.filter(service =>
      service.client === filterClient
    );
  }, [services, filterClient]);

  const totalValue = useMemo(() => {
    return filteredServices.reduce((sum, service) => sum + service.value, 0);
  }, [filteredServices]);

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      const response = await authenticatedFetch(`/services/${deleteModal.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        window.location.reload();
      } else {
        alert('Erro ao apagar serviço');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Erro de conexão');
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Fix: "2025-12-30" is parsed as UTC, causing -1 day in local time.
    // We split and show the parts directly to avoid timezone conversion.
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportExcel = () => {
    const dataToExport = filteredServices.map(service => ({
      Data: formatDate(service.date),
      Tipo: service.type,
      Placa: service.plate,
      Modelo: service.model,
      Proprietário: service.owner,
      Cliente: service.client,
      Valor: service.value
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Serviços");

    // Auto-width for columns
    const max_width = dataToExport.reduce((w, r) => Math.max(w, r.Tipo ? r.Tipo.length : 10), 10);
    worksheet["!cols"] = [{ wch: 12 }, { wch: max_width }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];

    XLSX.writeFile(workbook, `Servicos_${filterClient || 'Geral'}.xlsx`);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Lista de Serviços</h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ⬇ Exportar Excel
          </button>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              list="clients-list"
              type="text"
              placeholder="Pesquisar Cliente..."
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              style={{ minWidth: '200px' }}
            />
            <datalist id="clients-list">
              {clients.map(client => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {filterClient && (
        <div style={{
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Total a Cobrar ({filteredServices.length} serviços):</span>
          <span>R$ {totalValue.toFixed(2)}</span>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Proprietário</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>
                  {filterClient ? 'Nenhum serviço encontrado para este cliente.' : 'Nenhum serviço cadastrado.'}
                </td>
              </tr>
            ) : (
              filteredServices.map((service) => (
                <tr key={service.id}>
                  <td>{formatDate(service.date)}</td>
                  <td>{service.type}</td>
                  <td>{service.plate}</td>
                  <td>{service.model}</td>
                  <td>{service.owner}</td>
                  <td>{service.client}</td>
                  <td>R$ {service.value.toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteClick(service.id)}
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Apagar Serviço"
        message="Tem certeza que deseja apagar este serviço? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
