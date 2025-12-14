import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../api';

export default function ServiceForm({ onServiceAdded }) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: '',
        value: '',
        plate: '',
        model: '',
        owner: '',
        client: '',
        dispatcher: ''
    });

    const [clients, setClients] = useState([]);

    useEffect(() => {
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
        fetchClients();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.client) {
            alert('Por favor, selecione uma loja/cliente.');
            return;
        }

        try {
            const response = await authenticatedFetch('/services', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    value: Number(formData.value)
                }),
            });

            if (response.ok) {
                onServiceAdded(); // Trigger refresh in parent
                setFormData({
                    date: new Date().toISOString().split('T')[0],
                    type: '',
                    value: '',
                    plate: '',
                    model: '',
                    owner: '',
                    client: '',
                    dispatcher: ''
                });
                alert('Serviço adicionado com sucesso!');
            } else {
                alert('Erro ao adicionar serviço');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Erro de conexão');
        }
    };

    return (
        <div className="card">
            <h2>Novo Serviço</h2>
            <form onSubmit={handleSubmit} className="form-grid">
                <div className="form-group">
                    <label>Data</label>
                    <input type="date" name="date" required value={formData.date} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Tipo de Serviço</label>
                    <input type="text" name="type" placeholder="Ex: Licenciamento" required value={formData.type} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Valor (R$)</label>
                    <input type="number" step="0.01" name="value" placeholder="0.00" required value={formData.value} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Placa do Carro</label>
                    <input type="text" name="plate" placeholder="ABC-1234" required value={formData.plate} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Modelo</label>
                    <input type="text" name="model" placeholder="Marca/Modelo" required value={formData.model} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Proprietário</label>
                    <input type="text" name="owner" placeholder="Nome do Proprietário" required value={formData.owner} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Despachante</label>
                    <input type="text" name="dispatcher" placeholder="Nome do Despachante" value={formData.dispatcher} onChange={handleChange} />
                </div>

                <div className="form-group">
                    <label>Loja/Cliente</label>
                    <select name="client" required value={formData.client} onChange={handleChange}>
                        <option value="">Selecione um cliente...</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.name}>{client.name}</option>
                        ))}
                    </select>
                </div>

                <button type="submit" className="submit-btn">Adicionar Serviço</button>
            </form>
        </div>
    );
}
