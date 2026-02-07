export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    confirmStyle = 'btn-danger' // 'btn-danger' or 'btn-primary'
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2 style={{ marginBottom: '1rem' }}>{title}</h2>
                <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>{message}</p>
                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className={confirmStyle} onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}
