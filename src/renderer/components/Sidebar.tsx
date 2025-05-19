import { NavLink } from 'react-router-dom';
import { FiFolder, FiMusic, FiSettings } from 'react-icons/fi';

const Sidebar = () => {
    return (
        <div className="h-screen w-64 bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-gray-100 flex flex-col">
            <h1 className="text-xl font-bold p-4 border-b border-gray-300 dark:border-slate-700">
                Romper
            </h1>
            <nav className="flex-1 p-4 space-y-4">
                <NavLink
                    to="/kits"
                    className={({ isActive }) =>
                        `flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 ${isActive ? 'bg-gray-300 dark:bg-slate-700' : ''
                        }`
                    }
                >
                    <FiFolder className="text-cyan-600 dark:text-cyan-400" />
                    <span>Kits</span>
                </NavLink>
                <NavLink
                    to="/samples"
                    className={({ isActive }) =>
                        `flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 ${isActive ? 'bg-gray-300 dark:bg-slate-700' : ''
                        }`
                    }
                >
                    <FiMusic className="text-amber-600 dark:text-amber-400" />
                    <span>Samples</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 ${isActive ? 'bg-gray-300 dark:bg-slate-700' : ''
                        }`
                    }
                >
                    <FiSettings className="text-green-600 dark:text-green-400" />
                    <span>Settings</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default Sidebar;