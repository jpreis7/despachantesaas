import { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch } from '../api';

export default function ClientManager() {
    const [clients, setClients] = useState([]);
    const [newClientName, setNewClientName] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

    const fetchClients = async () => {
        try {
            const response = await authenticatedFetch('/clients');
            const result = await response.json();
            if (result.message === 'success') {
                setClients(result.data);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newClientName.trim()) return;

        try {
            const response = await authenticatedFetch('/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newClientName }),
            });

            if (response.ok) {
                setNewClientName('');
                fetchClients();
                alert('Cliente adicionado com sucesso!');
            } else {
                const error = await response.json();
                alert(`Erro ao adicionar cliente: ${error.error}`);
            }
        } catch (error) {
            console.error('Error adding client:', error);
            alert('Erro de conexão.');
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.id) return;

        try {
            const response = await authenticatedFetch(`/clients/${deleteModal.id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchClients();
                // alert('Cliente apagado com sucesso!'); // Optional: remove alert for smoother UX with modal
            } else {
                alert('Erro ao apagar cliente');
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
            <h2>Gerenciar Clientes</h2>

            <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <input
                    type="text"
                    placeholder="Nome da Loja/Cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '1rem' }}
                />
                <button type="submit" className="submit-btn" style={{ margin: 0, width: 'auto' }}>Adicionar</button>
            </form>

            <h3>Clientes Cadastrados</h3>
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
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center' }}>Nenhum cliente cadastrado.</td>
                            </tr>
                        ) : (
                            clients.map((client) => (
                                <tr key={client.id}>
                                    <td>{client.id}</td>
                                    <td>{client.name}</td>
                                    <td>
                                        <button
                                            onClick={() => handleDeleteClick(client.id)}
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
                title="Apagar Cliente"
                message="Tem certeza que deseja apagar este cliente? Isso removerá a loja da lista de seleção."
            />
        </div>
    );
}
