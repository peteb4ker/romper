export const getSetting = async (
  key: "sdCardPath" | "darkMode",
): Promise<any> => {
  return window.electronAPI.getSetting(key);
};

export const setSetting = async (
  key: "sdCardPath" | "darkMode",
  value: any,
): Promise<void> => {
  window.electronAPI.setSetting(key, value);
};

export const applyTheme = async (): Promise<void> => {
  try {
    const darkMode = await getSetting("darkMode"); // Await the darkMode setting
    console.log("applyTheme: Retrieved darkMode from settings:", darkMode); // Log the retrieved darkMode

    if (typeof darkMode === "boolean") {
      document.documentElement.classList.toggle("dark", darkMode);
      console.log("applyTheme: Applied darkMode:", darkMode); // Log the applied darkMode
    } else {
      console.log(
        "applyTheme: No darkMode found in settings, defaulting to light mode",
      );
    }

    window.addEventListener("beforeunload", () => {
      const currentDarkMode =
        document.documentElement.classList.contains("dark");
      console.log("applyTheme: App exiting with darkMode:", currentDarkMode); // Log the darkMode on exit
    });
  } catch (error) {
    console.error("applyTheme: Failed to retrieve or apply darkMode:", error);
  }
};

export const toggleTheme = (): void => {
  const currentDarkMode = document.documentElement.classList.contains("dark");
  const newDarkMode = !currentDarkMode;

  document.documentElement.classList.toggle("dark", newDarkMode);
  setSetting("darkMode", newDarkMode);

  console.log("toggleTheme: Theme toggled to:", newDarkMode); // Log the toggled theme
};
