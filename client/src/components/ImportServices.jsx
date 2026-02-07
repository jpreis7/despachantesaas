import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import ConfirmationModal from './ConfirmationModal';

export default function ImportServices() {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                // Codepage 1252 helps with some ANSI encoded CSVs common in Brazil/Excel
                const workbook = XLSX.read(data, { type: 'array', codepage: 1252 });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    setMessage({ type: 'error', text: 'Nenhum dado encontrado no arquivo.' });
                    setPreviewData([]);
                    return;
                }

                // Check if semicolon separation failed (all keys in one string)
                const firstKey = Object.keys(jsonData[0])[0];
                if (Object.keys(jsonData[0]).length === 1 && firstKey.includes(';')) {
                    setMessage({ type: 'warning', text: 'Detectado possível problema com separador (ponto e vírgula). Tentando processar, mas verifique a pré-visualização.' });
                    // NOTE: Implementing manual CSV parsing here would be ideal if XLSX fails hard, 
                    // but usually XLSX handles it if extension is .csv. 
                    // If the user uploads a file where XLSX fails to split columns, we might need a different approach.
                    // For now, let's proceed and see if preview reveals the issue to the user.
                }

                setPreviewData(jsonData);
                setMessage(null);
            } catch (error) {
                console.error('Error parsing file:', error);
                setMessage({ type: 'error', text: 'Erro ao ler o arquivo. Certifique-se que é um CSV ou Excel válido.' });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportClick = () => {
        if (previewData.length === 0) {
            setMessage({ type: 'error', text: 'Nenhum dado encontrado no arquivo.' });
            return;
        }
        setIsConfirmOpen(true);
    };

    const processData = (row) => {
        // Helper to find value by extensive list of potential keys (case insensitive, trimmed)
        const getField = (keys) => {
            const foundKey = Object.keys(row).find(k =>
                keys.some(searchKey => k.trim().toLowerCase() === searchKey)
            );
            return foundKey ? row[foundKey] : null;
        };

        const parseDate = (raw) => {
            if (!raw) return null;
            let dateStr = null;

            // Excel Serial Date
            if (typeof raw === 'number') {
                const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
                return dateObj.toISOString().split('T')[0];
            }

            if (typeof raw === 'string') {
                const cleanRaw = raw.trim();
                // DD/MM/YYYY or DD-MM-YYYY
                if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(cleanRaw)) {
                    const parts = cleanRaw.split(/[\/-]/);
                    // standard: day/month/year
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                // YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}/.test(cleanRaw)) {
                    return cleanRaw.substring(0, 10);
                }
            }
            return dateStr;
        };

        // Priority Mapping

        // 1. Date (Data_Entrada > Data > Date)
        const dateRaw = getField(['data_entrada', 'data entrada']) || getField(['data', 'date']);
        // Only use current date if NO date found. 
        // If date found is invalid, we might want to default to today or keep null? 
        // Logic: parseDate returns null if invalid/missing. || fallback.
        const date = parseDate(dateRaw) || new Date().toISOString().split('T')[0];

        // 2. Completion Date (Data_Fim > Data Saida > Completion Date)
        const completionRaw = getField(['data_fim', 'data fim', 'data_saida', 'completion_date']);
        const completionDate = parseDate(completionRaw);

        return {
            date: date,
            completion_date: completionDate, // Supabase handles null correctly
            type: getField(['tipo', 'type', 'serviço', 'service']) || 'Outros',
            value: parseFloat(getField(['valor', 'value', 'preço', 'price'])) || 0,
            plate: getField(['placa', 'plate']) || '',
            model: getField(['modelo', 'model', 'veículo', 'vehicle']) || '',
            owner: getField(['proprietário', 'owner', 'cliente final']) || '',
            client: getField(['cliente', 'client', 'loja', 'store']) || '',
            dispatcher: getField(['despachante', 'dispatcher']) || '',
        };
    };

    const handleConfirmImport = async () => {
        setIsConfirmOpen(false);
        setUploading(true);
        setMessage(null);

        let successCount = 0;
        let errorCount = 0;
        const total = previewData.length;

        setProgress({ current: 0, total, success: 0, errors: 0 });

        const formattedData = previewData.map(processData);

        // Chunking
        const chunkSize = 50;
        for (let i = 0; i < formattedData.length; i += chunkSize) {
            const chunk = formattedData.slice(i, i + chunkSize);

            const { error } = await supabase
                .from('services')
                .insert(chunk);

            if (error) {
                console.error('Error importing batch:', error);
                errorCount += chunk.length;
            } else {
                successCount += chunk.length;
            }

            setProgress(prev => ({
                ...prev,
                current: Math.min(prev.current + chunkSize, total),
                success: successCount,
                errors: errorCount
            }));
        }

        setUploading(false);
        if (errorCount === 0) {
            setMessage({ type: 'success', text: `${successCount} serviços importados com sucesso!` });
            setFile(null);
            setPreviewData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            setMessage({ type: 'warning', text: `Importação concluída. ${successCount} sucessos, ${errorCount} erros.` });
        }
    };

    return (
        <div className="card">
            <h2>Importar Serviços (CSV/Excel)</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Selecione uma planilha para importar. A planilha pode conter colunas como:
                <strong> Data_Entrada, Data_Fim, Tipo, Valor, Placa, Modelo, Proprietário, Cliente, Despachante</strong>.
            </p>

            <div className="form-group">
                <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={uploading}
                />
            </div>

            {message && (
                <div className={`message-box ${message.type === 'error' ? 'error' : message.type === 'warning' ? 'warning' : 'success'}`}
                    style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        backgroundColor: message.type === 'error' ? '#fee2e2' : message.type === 'success' ? '#dcfce7' : '#fef3c7',
                        color: message.type === 'error' ? '#991b1b' : message.type === 'success' ? '#166534' : '#92400e',
                        border: `1px solid ${message.type === 'error' ? '#f87171' : message.type === 'success' ? '#86efac' : '#fcd34d'}`
                    }}
                >
                    {message.text}
                </div>
            )}

            {uploading && (
                <div style={{ marginBottom: '1rem' }}>
                    <p>Importando... {progress.current} de {progress.total}</p>
                    <div style={{ width: '100%', height: '10px', backgroundColor: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${(progress.current / progress.total) * 100}%`,
                            height: '100%',
                            backgroundColor: 'var(--primary)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            {previewData.length > 0 && !uploading && (
                <div>
                    <p style={{ marginBottom: '1rem' }}>
                        <strong>{previewData.length}</strong> registros encontrados.
                    </p>
                    <button className="submit-btn" onClick={handleImportClick}>
                        Realizar Importação
                    </button>

                    <div style={{ marginTop: '2rem', overflowX: 'auto' }}>
                        <h3>Pré-visualização (primeiros 5 registros)</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    {Object.keys(previewData[0] || {}).slice(0, 8).map(key => (
                                        <th key={key} style={{ padding: '0.5rem', textAlign: 'left' }}>{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.slice(0, 5).map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                        {Object.values(row).slice(0, 8).map((val, j) => (
                                            <td key={j} style={{ padding: '0.5rem' }}>{val}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmImport}
                title="Confirmar Importação"
                message={`Você tem certeza que deseja importar ${previewData.length} registros para o sistema? Esta ação adicionará todos os serviços da planilha à sua conta.`}
                confirmText="Confirmar Importação"
                confirmStyle="btn-primary"
            />
        </div>
    );
}
