import React from 'react'
import LoginForm from './components/LoginForm'
import './App.css'

function App() {
    const [themeMode, setThemeMode] = React.useState(() => {
        const saved = localStorage.getItem('ums_theme_mode');
        return saved || 'system';
    });

    const [activeTheme, setActiveTheme] = React.useState('light');

    React.useEffect(() => {
        const getSystemTheme = () => {
            const hasSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const hour = new Date().getHours();
            const hasTimeDark = (hour >= 22 || hour < 6);
            return hasSystemDark || hasTimeDark ? 'dark' : 'light';
        };

        if (themeMode === 'system') {
            // Apply initial theme
            setActiveTheme(getSystemTheme());

            // Watch for OS theme changes in real-time
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e) => {
                setActiveTheme(e.matches ? 'dark' : 'light');
            };

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleChange);
            } else {
                mediaQuery.addListener(handleChange);
            }

            return () => {
                if (mediaQuery.removeEventListener) {
                    mediaQuery.removeEventListener('change', handleChange);
                } else {
                    mediaQuery.removeListener(handleChange);
                }
            };
        } else {
            setActiveTheme(themeMode);
        }
    }, [themeMode]);

    React.useEffect(() => {
        document.body.setAttribute('data-theme', activeTheme);
        localStorage.setItem('ums_theme_mode', themeMode);
    }, [activeTheme, themeMode]);

    const toggleTheme = () => {
        setThemeMode(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    return (
        <div className="app-container">
            <header>
                <h1>Smart Attendance</h1>
                <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Dark Mode">
                    {themeMode === 'system' ? '🖥️' : themeMode === 'light' ? '🌙' : '☀️'}
                </button>
            </header>
            <main>
                <LoginForm />
            </main>
        </div>
    )
}

export default App
