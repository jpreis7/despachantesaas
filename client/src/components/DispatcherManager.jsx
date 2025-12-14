import { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch } from '../api';

export default function DispatcherManager() {
    const [dispatchers, setDispatchers] = useState([]);
    const [newDispatcherName, setNewDispatcherName] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

    const fetchDispatchers = async () => {
        try {
            const response = await authenticatedFetch('/dispatchers');
            const result = await response.json();
            if (result.message === 'success') {
                setDispatchers(result.data);
            }
        } catch (error) {
            console.error('Error fetching dispatchers:', error);
        }
    };

    useEffect(() => {
        fetchDispatchers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newDispatcherName.trim()) return;

        try {
            const response = await authenticatedFetch('/dispatchers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newDispatcherName }),
            });

            if (response.ok) {
                setNewDispatcherName('');
                fetchDispatchers();
                alert('Despachante adicionado com sucesso!');
            } else {
                const error = await response.json();
                alert(`Erro ao adicionar despachante: ${error.error}`);
            }
        } catch (error) {
            console.error('Error adding dispatcher:', error);
            alert('Erro de conexão.');
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.id) return;

        try {
            const response = await authenticatedFetch(`/dispatchers/${deleteModal.id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchDispatchers();
            } else {
                alert('Erro ao apagar despachante');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Erro de conexão');
        } finally {
            setDeleteModal({ isOpen: false, id: null });
        }
    };

    return (
        <div className="card">
            <h2>Gerenciar Despachantes</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Nome do Despachante</label>
                    <input
                        type="text"
                        placeholder="Nome do Despachante"
                        value={newDispatcherName}
                        onChange={(e) => setNewDispatcherName(e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
                <button type="submit" className="btn-primary" style={{ height: 'fit-content', marginBottom: '2px' }}>Adicionar</button>
            </form>

            <h3>Despachantes Cadastrados</h3>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dispatchers.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum despachante cadastrado.</td>
                            </tr>
                        ) : (
                            dispatchers.map((dispatcher) => (
                                <tr key={dispatcher.id}>
                                    <td>{dispatcher.id}</td>
                                    <td>{dispatcher.name}</td>
                                    <td>
                                        <button
                                            onClick={() => handleDeleteClick(dispatcher.id)}
                                            className="btn-danger"
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
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
                title="Apagar Despachante"
                message="Tem certeza que deseja apagar este despachante?"
            />
        </div>
    );
}
