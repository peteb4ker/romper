import { NavLink, useNavigate } from 'react-router-dom';
import { FiFolder, FiMusic, FiSettings, FiInfo } from 'react-icons/fi';
import { MdSdCard } from 'react-icons/md';


const Sidebar = () => {
    const navigate = useNavigate();

    // Always show the select/change SD card button
    const handleSelectSdCard = async () => {
        // Defensive: check if electronAPI exists (should always in Electron)
        if (window.electronAPI && window.electronAPI.selectSdCard) {
            const selectedPath = await window.electronAPI.selectSdCard();
            if (selectedPath && window.electronAPI.setSetting) {
                window.electronAPI.setSetting('sdCardPath', selectedPath);
                navigate('/kits'); // Navigate to kits view after SD card selection
            }
        } else {
            alert('SD card selection is only available in the Electron app.');
        }
    };

    return (
        <div className="h-screen w-56 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 flex flex-col border-r border-gray-300 dark:border-slate-800">
            <h1 className="text-lg font-bold px-3 py-2 border-b border-gray-200 dark:border-slate-800 tracking-tight">
                Romper
            </h1>
            <button
                onClick={handleSelectSdCard}
                className="mx-3 my-2 px-2 py-1 flex items-center space-x-1 text-sm bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
            >
                <MdSdCard size={16} />
                <span>Select SD Card</span>
            </button>
            <nav className="flex-1 px-2 py-2 space-y-1">
                <NavLink
                    to="/kits"
                    className={({ isActive }) =>
                        `flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-800 text-sm ${isActive ? 'bg-gray-200 dark:bg-slate-800 font-semibold' : ''}`
                    }
                >
                    <FiFolder className="text-cyan-600 dark:text-cyan-400" size={16} />
                    <span>Kits</span>
                </NavLink>
                <NavLink
                    to="/samples"
                    className={({ isActive }) =>
                        `flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-800 text-sm ${isActive ? 'bg-gray-200 dark:bg-slate-800 font-semibold' : ''}`
                    }
                >
                    <FiMusic className="text-amber-600 dark:text-amber-400" size={16} />
                    <span>Samples</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-800 text-sm ${isActive ? 'bg-gray-200 dark:bg-slate-800 font-semibold' : ''}`
                    }
                >
                    <FiSettings className="text-green-600 dark:text-green-400" size={16} />
                    <span>Settings</span>
                </NavLink>
                <NavLink
                    to="/about"
                    className={({ isActive }) =>
                        `flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-800 text-sm ${isActive ? 'bg-gray-200 dark:bg-slate-800 font-semibold' : ''}`
                    }
                >
                    <FiInfo className="text-gray-500 dark:text-gray-300" size={16} />
                    <span>About</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default Sidebar;