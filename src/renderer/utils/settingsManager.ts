export const getSetting = (key: string): string | undefined => {
    return window.electronAPI.getSetting(key);
};

export const setSetting = (key: string, value: any): void => {
    window.electronAPI.setSetting(key, value);
};

export const applyTheme = (): void => {
    const theme = getSetting('theme');
    console.log('App started with settings:', { theme });

    if (theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    window.addEventListener('beforeunload', () => {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        console.log('App exiting with settings:', { theme: currentTheme });
    });
};

export const toggleTheme = (): void => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setSetting('theme', newTheme);

    console.log('Theme toggled to:', newTheme);
};
