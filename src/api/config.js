export const getApiUrl = () => import.meta.env.VITE_API_URL || "https://opticontrol.cowib.es";

/**
 * Modo demo estático: no se usa backend. Toda la información es local (src/api/staticData.js)
 * para presentar el sistema al cliente. Activar con VITE_STATIC_DEMO=true en .env
 */
export const isStaticDemo = import.meta.env.VITE_STATIC_DEMO === "true";
