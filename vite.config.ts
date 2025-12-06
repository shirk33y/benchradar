import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default {
  base: "/benchradar/",
  plugins: [tailwindcss(), react()],
};
