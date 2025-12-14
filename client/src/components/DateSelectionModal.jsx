
import { useState, useEffect } from 'react';

export default function DateSelectionModal({ isOpen, onClose, onConfirm, title, message }) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(selectedDate);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>{title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{message}</p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Data de Finalização</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-danger"
                            style={{ backgroundColor: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-success"
                        >
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
