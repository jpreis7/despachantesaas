import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch } from '../api';

export default function ServiceList({ services, onRefresh }) {
  const [filterClient, setFilterClient] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterDispatcher, setFilterDispatcher] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open', 'finished', 'all'
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
  }, [filterClient, filterPlate, filterDispatcher, statusFilter, dateFilter, services]);

  const filteredServices = useMemo(() => {
    let result = services;

    // Filter by Client
    if (filterClient) {
      result = result.filter(service => service.client === filterClient);
    }

    // Filter by Plate (Partial match, case insensitive)
    if (filterPlate) {
      const plateQuery = filterPlate.toLowerCase();
      result = result.filter(service => service.plate && service.plate.toLowerCase().includes(plateQuery));
    }

    // Filter by Dispatcher (Partial match, case insensitive)
    if (filterDispatcher) {
      const dispatcherQuery = filterDispatcher.toLowerCase();
      result = result.filter(service => service.dispatcher && service.dispatcher.toLowerCase().includes(dispatcherQuery));
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      if (statusFilter === 'open') {
        result = result.filter(service => !service.completion_date);
      } else if (statusFilter === 'finished') {
        result = result.filter(service => service.completion_date);
      }
    }

    // Filter by Date
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
  }, [services, filterClient, filterPlate, filterDispatcher, statusFilter, dateFilter]);

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

  const handleQuickFinish = async (id) => {
    try {
      const completionDate = new Date().toISOString().split('T')[0]; // Current date YYYY-MM-DD
      const response = await authenticatedFetch(`/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completion_date: completionDate })
      });

      if (response.ok) {
        if (onRefresh) onRefresh();
      } else {
        const res = await response.json();
        alert(`Erro ao finalizar: ${res.error || 'Desconhecido'}`);
      }
    } catch (error) {
      console.error("Error finishing service:", error);
      alert("Erro de conexão ao finalizar serviço.");
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
      Status: service.completion_date ? `Finalizado (${formatDate(service.completion_date)})` : 'Em Aberto',
      Tipo: service.type,
      Placa: service.plate,
      Modelo: service.model,
      Despachante: service.dispatcher || '',
      Proprietário: service.owner,
      Cliente: service.client,
      Valor: service.value
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Serviços");

    // Auto-width rough calculation
    const max_width = dataToExport.reduce((w, r) => Math.max(w, r.Tipo ? r.Tipo.length : 10), 10);
    // Config column widths (approximate chars)
    worksheet["!cols"] = [
      { wch: 12 }, // Data
      { wch: 15 }, // Status
      { wch: max_width }, // Tipo
      { wch: 10 }, // Placa
      { wch: 15 }, // Modelo
      { wch: 15 }, // Despachante
      { wch: 20 }, // Proprietário
      { wch: 15 }, // Cliente
      { wch: 10 }  // Valor
    ];

    XLSX.writeFile(workbook, `Servicos_${statusFilter}.xlsx`);
  };

  return (
    <div className="card">
      <div className="header-container" style={{ marginBottom: '1.5rem', borderBottom: 'none', paddingBottom: 0, flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Lista de Serviços</h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>

          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStatusFilter('open')}
              className={statusFilter === 'open' ? 'btn-danger' : 'nav-btn'}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                backgroundColor: statusFilter === 'open' ? undefined : 'var(--border-color)',
                color: statusFilter === 'open' ? undefined : 'var(--text-secondary)'
              }}
            >
              Em Aberto
            </button>
            <button
              onClick={() => setStatusFilter('finished')}
              className={statusFilter === 'finished' ? 'btn-success' : 'nav-btn'}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                backgroundColor: statusFilter === 'finished' ? undefined : 'var(--border-color)',
                color: statusFilter === 'finished' ? undefined : 'var(--text-secondary)'
              }}
            >
              Finalizados
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'btn-primary' : 'nav-btn'}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                backgroundColor: statusFilter === 'all' ? undefined : 'var(--border-color)',
                color: statusFilter === 'all' ? undefined : 'var(--text-secondary)'
              }}
            >
              Todos
            </button>
          </div>

          {/* Quick Date Filters */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['all', '7', '14', '30'].map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={dateFilter === filter ? 'btn-primary' : 'nav-btn'}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  backgroundColor: dateFilter === filter ? undefined : 'var(--border-color)',
                  color: dateFilter === filter ? undefined : 'var(--text-secondary)'
                }}
              >
                {filter === 'all' ? 'Todos' : `${filter}d`}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportExcel}
            className="btn-success"
            style={{ fontWeight: 500 }}
          >
            ⬇ Exportar Excel
          </button>
        </div>

        {/* Text Filters Row */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
            <input
              type="text"
              placeholder="Filtrar por Placa..."
              value={filterPlate}
              onChange={(e) => setFilterPlate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
            <input
              type="text"
              placeholder="Filtrar por Despachante..."
              value={filterDispatcher}
              onChange={(e) => setFilterDispatcher(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
            <input
              list="clients-list"
              type="text"
              placeholder="Pesquisar Loja/Cliente..."
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              style={{ width: '100%' }}
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
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--background)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
          Total: <span style={{ color: 'var(--success-color)' }}>R$ {totalValue.toFixed(2)}</span>
          <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            ({filteredServices.length} serviços)
          </span>
        </div>
        {selectedServices.size > 0 && (
          <button
            onClick={handleBulkDeleteClick}
            className="btn-danger"
            style={{ padding: '0.4rem 1rem' }}
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
              <th>Status</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Proprietário</th>
              <th>Cliente</th>
              <th>Despachante</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {currentServices.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  {filterClient || filterPlate || filterDispatcher || dateFilter !== 'all' ? 'Nenhum serviço encontrado com os filtros atuais.' : 'Nenhum serviço cadastrado.'}
                </td>
              </tr>
            ) : (
              currentServices.map((service) => (
                <tr key={service.id} style={{ backgroundColor: selectedServices.has(service.id) ? 'var(--primary-light)' : 'transparent' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedServices.has(service.id)}
                      onChange={() => handleSelectService(service.id)}
                    />
                  </td>
                  <td>
                    {service.completion_date ? (
                      <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 500 }}>
                        ✓ Finalizado<br />
                        <small style={{ color: 'var(--text-secondary)' }}>{formatDate(service.completion_date)}</small>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning-color)', fontSize: '0.85rem', fontWeight: 500 }}>Em Aberto</span>
                    )}
                  </td>
                  <td>{formatDate(service.date)}</td>
                  <td>{service.type}</td>
                  <td>{service.plate}</td>
                  <td>{service.model}</td>
                  <td>{service.owner}</td>
                  <td>{service.client}</td>
                  <td>{service.dispatcher || '-'}</td>
                  <td style={{ fontWeight: '500' }}>R$ {service.value.toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!service.completion_date && (
                        <button
                          onClick={() => handleQuickFinish(service.id)}
                          className="btn-success"
                          title="Marcar como Finalizado"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(service.id)}
                        className="btn-danger"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="nav-btn"
            style={{
              borderRadius: '4px',
              backgroundColor: currentPage === 1 ? 'var(--background)' : 'white',
              border: '1px solid var(--border-color)',
              color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--primary-color)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Anterior
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0.5rem' }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="nav-btn"
            style={{
              borderRadius: '4px',
              backgroundColor: currentPage === totalPages ? 'var(--background)' : 'white',
              border: '1px solid var(--border-color)',
              color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--primary-color)',
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
