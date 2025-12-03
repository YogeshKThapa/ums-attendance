import React from 'react'
import LoginForm from './components/LoginForm'
import './App.css'

function App() {
    const [theme, setTheme] = React.useState(localStorage.getItem('ums_theme') || 'light');

    React.useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('ums_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="app-container">
            <header>
                <h1>Smart Attendance</h1>
                <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Dark Mode">
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </header>
            <main>
                <LoginForm />
            </main>
        </div>
    )
}

export default App
