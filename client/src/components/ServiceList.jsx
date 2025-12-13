import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch } from '../api';

export default function ServiceList({ services, onRefresh }) {
  const [filterClient, setFilterClient] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', '7', '14', '30'
  const [clients, setClients] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, isBulk: false });
  const [selectedServices, setSelectedServices] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedServices(new Set());
  }, [filterClient, dateFilter, services]);

  const filteredServices = useMemo(() => {
    let result = services;

    if (filterClient) {
      result = result.filter(service => service.client === filterClient);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      // Reset time part to ensure correct day comparison if needed, 
      // but simplistic approach: check difference in milliseconds
      const daysInMs = parseInt(dateFilter) * 24 * 60 * 60 * 1000;
      const thresholdDate = new Date(now.getTime() - daysInMs);

      result = result.filter(service => {
        if (!service.date) return false;
        // service.date is YYYY-MM-DD. 
        // Create date object at 00:00:00 local time (parsing YYYY-MM-DD roughly works)
        // Better: ensure YYYY-MM-DD is treated correctly. 
        const [year, month, day] = service.date.split('-').map(Number);
        const serviceDate = new Date(year, month - 1, day);
        return serviceDate >= thresholdDate;
      });
    }

    return result;
  }, [services, filterClient, dateFilter]);

  const totalValue = useMemo(() => {
    return filteredServices.reduce((sum, service) => sum + service.value, 0);
  }, [filteredServices]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE);
  const currentServices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredServices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredServices, currentPage]);

  const handleSelectService = (id) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all currently visible (filtered) services
      const allIds = filteredServices.map(s => s.id);
      setSelectedServices(new Set(allIds));
    } else {
      setSelectedServices(new Set());
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, id, isBulk: false });
  };

  const handleBulkDeleteClick = () => {
    setDeleteModal({ isOpen: true, id: null, isBulk: true });
  }

  const handleConfirmDelete = async () => {
    try {
      if (deleteModal.isBulk) {
        // Bulk delete
        const idsToDelete = Array.from(selectedServices);
        await Promise.all(idsToDelete.map(id =>
          authenticatedFetch(`/services/${id}`, { method: 'DELETE' })
        ));

        // Clear selection
        setSelectedServices(new Set());
      } else {
        // Single delete
        if (!deleteModal.id) return;
        await authenticatedFetch(`/services/${deleteModal.id}`, {
          method: 'DELETE',
        });
      }

      // Refresh data
      if (onRefresh) onRefresh();
      else window.location.reload();

    } catch (error) {
      console.error('Error deleting:', error);
      alert('Erro ao apagar serviço(s)');
    } finally {
      setDeleteModal({ isOpen: false, id: null, isBulk: false });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
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

    const max_width = dataToExport.reduce((w, r) => Math.max(w, r.Tipo ? r.Tipo.length : 10), 10);
    worksheet["!cols"] = [{ wch: 12 }, { wch: max_width }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];

    XLSX.writeFile(workbook, `Servicos_${filterClient || 'Geral'}.xlsx`);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Lista de Serviços</h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Date Filters */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['all', '7', '14', '30'].map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                style={{
                  backgroundColor: dateFilter === filter ? '#3b82f6' : '#e5e7eb',
                  color: dateFilter === filter ? 'white' : '#374151',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {filter === 'all' ? 'Todos' : `${filter}d`}
              </button>
            ))}
          </div>

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

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <div style={{ fontWeight: 'bold' }}>
          Total: R$ {totalValue.toFixed(2)}
          <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', fontSize: '0.9rem' }}>
            ({filteredServices.length} serviços)
          </span>
        </div>
        {selectedServices.size > 0 && (
          <button
            onClick={handleBulkDeleteClick}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.4rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Excluir Selecionados ({selectedServices.size})
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={filteredServices.length > 0 && selectedServices.size === filteredServices.length}
                />
              </th>
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
            {currentServices.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center' }}>
                  {filterClient || dateFilter !== 'all' ? 'Nenhum serviço encontrado com os filtros atuais.' : 'Nenhum serviço cadastrado.'}
                </td>
              </tr>
            ) : (
              currentServices.map((service) => (
                <tr key={service.id} style={{ backgroundColor: selectedServices.has(service.id) ? '#eff6ff' : 'transparent' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedServices.has(service.id)}
                      onChange={() => handleSelectService(service.id)}
                    />
                  </td>
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Próximo
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, isBulk: false })}
        onConfirm={handleConfirmDelete}
        title={deleteModal.isBulk ? "Apagar Serviços Selecionados" : "Apagar Serviço"}
        message={deleteModal.isBulk
          ? `Tem certeza que deseja apagar ${selectedServices.size} serviços selecionados? Esta ação não pode ser desfeita.`
          : "Tem certeza que deseja apagar este serviço? Esta ação não pode ser desfeita."
        }
      />
    </div>
  );
}
