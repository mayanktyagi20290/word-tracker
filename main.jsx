import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes.jsx";

// Used for both static pre-rendering (build) and client hydration (browser).
export const createRoot = ViteReactSSG({ routes });
