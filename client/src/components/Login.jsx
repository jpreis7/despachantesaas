import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Erro ao fazer login: ' + error.message)
        }
        setLoading(false)
    }

    return (
        <div className="card" style={{ maxWidth: '400px', margin: '4rem auto', textAlign: 'center' }}>
            <h1>Despachante Login</h1>
            <form onSubmit={handleLogin} className="form-group" style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Email</label>
                    <input
                        type="email"
                        placeholder="Seu email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '2rem' }}>
                    <label>Senha</label>
                    <input
                        type="password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
                <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Carregando...' : 'Entrar'}
                </button>
            </form>
        </div>
    )
}
